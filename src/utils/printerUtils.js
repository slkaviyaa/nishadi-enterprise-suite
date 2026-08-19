import html2canvas from 'html2canvas';

export const printNativeBluetooth = async (htmlContent, paperSize = '80mm') => {
  return new Promise(async (resolve, reject) => {
    let retries = 0;
    while (!window.bluetoothSerial && retries < 15) {
      await new Promise(r => setTimeout(r, 400));
      retries++;
    }

    if (!window.bluetoothSerial) {
      reject("Bluetooth Plugin not found. Please run inside the Native Android App.");
      return;
    }

    window.bluetoothSerial.isEnabled(
      () => {
        window.bluetoothSerial.list(
          (devices) => {
            if (!devices || devices.length === 0) {
              reject("No paired devices found! Please pair your printer in phone Bluetooth settings.");
              return;
            }
            
            const printer = devices.find(d => d.name && (d.name.includes('MP-80L') || d.name.toLowerCase().includes('printer') || d.name.toLowerCase().includes('pos') || d.name.toLowerCase().includes('bluetooth'))) || devices[0];
            
            if (!printer || !printer.address) {
              reject("Printer address not found.");
              return;
            }

            window.bluetoothSerial.connect(printer.address, 
              async () => {
                try {
                  const bytes = await generatePrinterBytes(htmlContent, paperSize);
                  // 🟢 WRITE IN CHUNKS: To prevent budget thermal printers from crashing
                  await sendBytesInChunks(bytes.buffer);
                  window.bluetoothSerial.disconnect();
                  resolve("Printed Successfully!");
                } catch (e) {
                  window.bluetoothSerial.disconnect();
                  reject("Image conversion failed: " + e.message);
                }
              },
              (err) => {
                reject("Connection failed: " + JSON.stringify(err));
              }
            );
          },
          (err) => {
            reject("Failed to list devices. Please check Bluetooth permissions in phone settings.");
          }
        );
      },
      () => {
        reject("Bluetooth is disabled. Please turn on Bluetooth.");
      }
    );
  });
};

// Raw ArrayBuffer එක 512-byte chunks විදියට write කිරීම
async function sendBytesInChunks(arrayBuffer) {
  const chunkSize = 512;
  const uint8View = new Uint8Array(arrayBuffer);
  
  for (let offset = 0; offset < uint8View.length; offset += chunkSize) {
    const chunk = uint8View.subarray(offset, offset + chunkSize);
    await new Promise((res, rej) => {
      window.bluetoothSerial.write(
        chunk.buffer,
        () => setTimeout(res, 20), // 20ms delay per chunk so printer buffer can clear
        (err) => rej(err)
      );
    });
  }
}

async function generatePrinterBytes(htmlString, paperSize = '80mm') {
  const is58 = paperSize === '58mm';
  const targetWidth = is58 ? 384 : 576; // 58mm = 384 dots, 80mm = 576 dots EXACT MATCH

  const container = document.createElement('div');
  container.innerHTML = htmlString;
  container.style.position = 'fixed'; // Fixed instead of absolute helps some devices
  container.style.top = '0';
  container.style.left = '0';
  container.style.zIndex = '-9999';
  container.style.opacity = '0';
  container.style.width = `${targetWidth}px`; 
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  document.body.appendChild(container);

  // Exact 1:1 scale rendering
  const canvas = await html2canvas(container, { 
    scale: 1, 
    useCORS: true, 
    logging: false,
    width: targetWidth,
    windowWidth: targetWidth
  });
  document.body.removeChild(container);

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height).data;

  const bytesWidth = Math.ceil(width / 8);
  // ESC/POS Command: Reset + Raster Image
  const header = new Uint8Array([
    0x1B, 0x40, // ESC @ (Initialize printer)
    0x1D, 0x76, 0x30, 0x00, 
    bytesWidth & 0xFF, (bytesWidth >> 8) & 0xFF, 
    height & 0xFF, (height >> 8) & 0xFF
  ]);
  const imageBytes = new Uint8Array(bytesWidth * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = imageData[i + 3];
      const brightness = (imageData[i] * 0.299 + imageData[i + 1] * 0.587 + imageData[i + 2] * 0.114);
      const isBlack = (alpha > 128 && brightness < 160); // Adjusted threshold for sharper text
      
      if (isBlack) {
        const byteIndex = y * bytesWidth + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        imageBytes[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  // Feed 4 lines and Cut
  const footer = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);
  const result = new Uint8Array(header.length + imageBytes.length + footer.length);
  result.set(header, 0);
  result.set(imageBytes, header.length);
  result.set(footer, header.length + imageBytes.length);
  
  return result;
}