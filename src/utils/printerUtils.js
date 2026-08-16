import html2canvas from 'html2canvas';

export const printNativeBluetooth = async (htmlContent) => {
  return new Promise((resolve, reject) => {
    // Bluetooth ප්ලගින් එක තියෙනවද කියලා බලනවා
    if (!window.bluetoothSerial) {
      reject("Bluetooth Plugin not found. This works only in the Native Android App.");
      return;
    }

    // Bluetooth ඔන් කරලාද බලනවා
    window.bluetoothSerial.isEnabled(
      () => {
        // Pair කරපු ඩිවයිස් ලිස්ට් එක ගන්නවා
        window.bluetoothSerial.list(
          (devices) => {
            if (devices.length === 0) {
              reject("No paired devices found! Please pair your printer in phone Bluetooth settings.");
              return;
            }
            
            // MP-80L ප්‍රින්ටර් එක හෝ ලිස්ට් එකේ තියෙන පලවෙනි ප්‍රින්ටර් එක තෝරගන්නවා
            const printer = devices.find(d => d.name.includes('MP-80L') || d.name.toLowerCase().includes('printer')) || devices[0];
            
            // ප්‍රින්ටරේට කනෙක්ට් වෙනවා
            window.bluetoothSerial.connect(printer.address, 
              async () => {
                try {
                  // HTML එක ESC/POS Image Bytes වලට කන්වර්ට් කරනවා
                  const bytes = await generatePrinterBytes(htmlContent);
                  
                  // ප්‍රින්ටරේට ඩේටා යවනවා
                  window.bluetoothSerial.write(bytes, 
                    () => {
                      window.bluetoothSerial.disconnect();
                      resolve("Printed Successfully!");
                    },
                    (err) => {
                      window.bluetoothSerial.disconnect();
                      reject("Print failed: " + err);
                    }
                  );
                } catch (e) {
                  window.bluetoothSerial.disconnect();
                  reject("Bill Image conversion failed: " + e.message);
                }
              },
              (err) => {
                reject("Failed to connect to printer: " + err + ". Is the printer turned on?");
              }
            );
          },
          (err) => reject("Failed to list devices: " + err)
        );
      },
      () => {
        reject("Bluetooth is disabled. Please turn it on!");
      }
    );
  });
};

// HTML බිල් එක රිසිට් ප්‍රින්ටරේට තේරෙන Bytes බවට පත් කරන ෆන්ෂන් එක
async function generatePrinterBytes(htmlString) {
  const container = document.createElement('div');
  container.innerHTML = htmlString;
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '576px'; // 80mm Printer width (576 dots)
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
  
  // ESC/POS Raster Image Header
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
  
  // Feed paper and cut (පේළි 4ක් පල්ලෙහාට යවලා කොලේ කපන්න)
  const footer = new Uint8Array([0x0A, 0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);
  
  const result = new Uint8Array(header.length + imageBytes.length + footer.length);
  result.set(header, 0);
  result.set(imageBytes, header.length);
  result.set(footer, header.length + imageBytes.length);
  
  return result;
}