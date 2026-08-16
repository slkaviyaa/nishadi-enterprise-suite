import html2canvas from 'html2canvas';

export const printNativeBluetooth = async (htmlContent) => {
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
            
            const printer = devices.find(d => d.name && (d.name.includes('MP-80L') || d.name.toLowerCase().includes('printer'))) || devices[0];
            
            if (!printer || !printer.address) {
              reject("Printer address not found.");
              return;
            }

            window.bluetoothSerial.connect(printer.address, 
              async () => {
                try {
                  const bytes = await generatePrinterBytes(htmlContent);
                  window.bluetoothSerial.write(bytes, 
                    () => {
                      window.bluetoothSerial.disconnect();
                      resolve("Printed Successfully!");
                    },
                    (err) => {
                      window.bluetoothSerial.disconnect();
                      reject("Print write failed: " + JSON.stringify(err));
                    }
                  );
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

async function generatePrinterBytes(htmlString) {
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '576px'; 
  container.style.backgroundColor = 'white';
  container.style.color = 'black';
  document.body.appendChild(container);

  const canvas = await html2canvas(container, { scale: 1, useCORS: true, logging: false });
  document.body.removeChild(container);

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height).data;

  const bytesWidth = Math.ceil(width / 8);
  const header = new Uint8Array([0x1D, 0x76, 0x30, 0x00, bytesWidth & 0xFF, (bytesWidth >> 8) & 0xFF, height & 0xFF, (height >> 8) & 0xFF]);
  const imageBytes = new Uint8Array(bytesWidth * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const brightness = (imageData[i] * 0.299 + imageData[i + 1] * 0.587 + imageData[i + 2] * 0.114);
      const isBlack = (brightness < 128 && imageData[i + 3] > 128);
      
      if (isBlack) {
        const byteIndex = y * bytesWidth + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        imageBytes[byteIndex] |= (1 << bitIndex);
      }
    }
  }
  
  const footer = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);
  const result = new Uint8Array(header.length + imageBytes.length + footer.length);
  result.set(header, 0);
  result.set(imageBytes, header.length);
  result.set(footer, header.length + imageBytes.length);
  
  return result;
}