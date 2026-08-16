const bluetooth = require('bluetooth-serial-port');
const server = new bluetooth.BluetoothSerialPort();

console.log('🔄 Starting Virtual Bluetooth Printer Server...');

server.listen(function (clientAddress) {
    console.log('✅ Connected to Phone / Device: ' + clientAddress);

    server.on('data', function(buffer) {
        console.log('🖨️ Received Print Bytes Data (Length):', buffer.length);
        console.log('📦 Raw Bytes:', buffer);
    });

}, function(error) {
    console.error('❌ Bluetooth Server Error:', error);
}, { uuid: '00001101-0000-1000-8000-00805F9B34FB' });