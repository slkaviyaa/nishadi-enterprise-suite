'use client'
import { useState, useEffect } from 'react'
import PageTemplate from './PageTemplate';
import { Capacitor } from '@capacitor/core';
import { FiBluetooth, FiX, FiSettings, FiLoader } from 'react-icons/fi';

export default function Devices() {
  const [printerDevice, setPrinterDevice] = useState(null)
  const [scaleDevice, setScaleDevice] = useState(null)
  const [cashDrawerDevice, setCashDrawerDevice] = useState(null)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [scaleConnected, setScaleConnected] = useState(false)
  const [drawerConnected, setDrawerConnected] = useState(false)
  const [message, setMessage] = useState('')

  // 📱 Bluetooth Modal States
  const [deviceModalOpen, setDeviceModalOpen] = useState(false)
  const [pairedDevices, setPairedDevices] = useState([])
  const [selectingDeviceType, setSelectingDeviceType] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    const savedPrinter = localStorage.getItem('printerName')
    const savedScale = localStorage.getItem('scaleName')
    const savedDrawer = localStorage.getItem('drawerName')
    if (savedPrinter) { setPrinterDevice({ name: savedPrinter }); setPrinterConnected(true); }
    if (savedScale) { setScaleDevice({ name: savedScale }); setScaleConnected(true); }
    if (savedDrawer) { setCashDrawerDevice({ name: savedDrawer }); setDrawerConnected(true); }
  }, [])

  const connectDevice = async (type) => {
    setMessage(`Searching for ${type}...`)
    
    // 🚀 NATIVE ANDROID BLUETOOTH HANDLING
    if (Capacitor.isNativePlatform()) {
      if (!window.bluetoothSerial) {
        setMessage('Native Bluetooth plugin not found.');
        return;
      }

      // 1. Check if Bluetooth is ON
      window.bluetoothSerial.isEnabled(
        () => {
          // 2. BT is ON -> Get paired devices list and show Modal
          window.bluetoothSerial.list(
            (devices) => {
              setPairedDevices(devices || []);
              setSelectingDeviceType(type);
              setDeviceModalOpen(true);
              setMessage('');
            },
            (err) => { setMessage('Failed to list devices: ' + err); }
          );
        },
        () => {
          // 3. BT is OFF -> Show Android System Popup to Turn ON Bluetooth
          window.bluetoothSerial.enable(
            () => {
              setMessage('Bluetooth enabled! Tap Pair again.');
            },
            () => {
              setMessage('Bluetooth must be enabled to connect devices.');
            }
          );
        }
      );
      return;
    }

    // 💻 WEB BROWSER FALLBACK (Using Web Bluetooth API)
    if (typeof navigator !== 'undefined' && navigator.bluetooth) {
      try {
        let service = ''
        if(type === 'printer') service = '000018f0-0000-1000-8000-00805f9b34fb'
        if(type === 'scale') service = '0000181d-0000-1000-8000-00805f9b34fb'
        if(type === 'drawer') service = '0000180a-0000-1000-8000-00805f9b34fb'

        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [service] })
        
        if(type === 'printer') { setPrinterDevice(device); localStorage.setItem('printerName', device.name || 'Printer'); setPrinterConnected(true) }
        if(type === 'scale') { setScaleDevice(device); localStorage.setItem('scaleName', device.name || 'Scale'); setScaleConnected(true) }
        if(type === 'drawer') { setCashDrawerDevice(device); localStorage.setItem('drawerName', device.name || 'Drawer'); setDrawerConnected(true) }
        
        setMessage(`${type} connected successfully!`)
      } catch(err) {
        setMessage('Failed: ' + (err.message || 'Cancelled'))
      }
    } else {
      setMessage('Web Bluetooth API is not supported on this browser.')
    }
  }

  // 📌 ඩිවයිස් එකක් තේරුවම Connection එක Test කරලා සේව් කරන Function එක
  const selectDeviceFromList = (device) => {
    setIsTesting(true);
    setMessage(`Testing connection to ${device.name || 'Device'}...`);

    // Connection Test
    window.bluetoothSerial.connect(device.address, 
      () => {
        // ✅ Connection Successful! (Disconnect immediately to free port for POS page)
        window.bluetoothSerial.disconnect();
        setIsTesting(false);
        setDeviceModalOpen(false);

        const deviceName = device.name || 'Unknown Device';
        if (selectingDeviceType === 'printer') {
          setPrinterDevice({ name: deviceName, address: device.address });
          localStorage.setItem('printerName', deviceName);
          localStorage.setItem('printerAddress', device.address);
          setPrinterConnected(true);
        } else if (selectingDeviceType === 'scale') {
          setScaleDevice({ name: deviceName, address: device.address });
          localStorage.setItem('scaleName', deviceName);
          localStorage.setItem('scaleAddress', device.address);
          setScaleConnected(true);
        } else if (selectingDeviceType === 'drawer') {
          setCashDrawerDevice({ name: deviceName, address: device.address });
          localStorage.setItem('drawerName', deviceName);
          localStorage.setItem('drawerAddress', device.address);
          setDrawerConnected(true);
        }
        setMessage(`✅ ${selectingDeviceType} (${deviceName}) tested and saved successfully!`);
      },
      (err) => {
        // ❌ Connection Failed!
        setIsTesting(false);
        setMessage(`❌ Connection failed for ${device.name}: Make sure the device is turned on and in range.`);
      }
    );
  }

  const disconnectDevice = (type) => {
    if(type === 'printer') { if(printerDevice?.gatt?.connected) printerDevice.gatt.disconnect(); setPrinterDevice(null); setPrinterConnected(false); localStorage.removeItem('printerName'); localStorage.removeItem('printerAddress'); }
    if(type === 'scale') { if(scaleDevice?.gatt?.connected) scaleDevice.gatt.disconnect(); setScaleDevice(null); setScaleConnected(false); localStorage.removeItem('scaleName'); localStorage.removeItem('scaleAddress'); }
    if(type === 'drawer') { if(cashDrawerDevice?.gatt?.connected) cashDrawerDevice.gatt.disconnect(); setCashDrawerDevice(null); setDrawerConnected(false); localStorage.removeItem('drawerName'); localStorage.removeItem('drawerAddress'); }
    setMessage(`${type} disconnected.`);
  }

  const activeCount = [printerConnected, scaleConnected, drawerConnected].filter(Boolean).length

  const metrics = [
    { label: 'Active Devices', value: activeCount, icon: '🔌' },
    { label: 'System Status', value: activeCount > 0 ? 'Online' : 'Standby', icon: '⚡' },
  ]

  return (
    <PageTemplate
      title="🔌 Bluetooth Devices"
      subtitle="Connect POS hardware natively via Bluetooth"
      metrics={metrics}
    >
      <div className="space-y-6 pb-10">
        {message && (
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${message.includes('Failed') || message.includes('❌') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Printer */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-3xl">🖨️</div>
              <h3 className="font-bold text-gray-800 dark:text-white">Thermal Printer</h3>
              <p className="text-xs text-gray-500 h-4">{printerDevice ? printerDevice.name : 'No device paired'}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${printerConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {printerConnected ? 'Connected' : 'Disconnected'}
              </span>
              <div className="pt-4 w-full flex flex-col gap-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition" onClick={() => connectDevice('printer')}>Pair Printer</button>
                {printerConnected && <button className="w-full bg-gray-100 hover:bg-gray-200 text-red-600 text-sm font-medium py-2 rounded-lg transition" onClick={() => disconnectDevice('printer')}>Disconnect</button>}
              </div>
            </div>
          </div>

          {/* Scale */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-3xl">⚖️</div>
              <h3 className="font-bold text-gray-800 dark:text-white">Weight Scale</h3>
              <p className="text-xs text-gray-500 h-4">{scaleDevice ? scaleDevice.name : 'No device paired'}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${scaleConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {scaleConnected ? 'Connected' : 'Disconnected'}
              </span>
              <div className="pt-4 w-full flex flex-col gap-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition" onClick={() => connectDevice('scale')}>Pair Scale</button>
                {scaleConnected && <button className="w-full bg-gray-100 hover:bg-gray-200 text-red-600 text-sm font-medium py-2 rounded-lg transition" onClick={() => disconnectDevice('scale')}>Disconnect</button>}
              </div>
            </div>
          </div>

          {/* Drawer */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-3xl">💵</div>
              <h3 className="font-bold text-gray-800 dark:text-white">Cash Drawer</h3>
              <p className="text-xs text-gray-500 h-4">{cashDrawerDevice ? cashDrawerDevice.name : 'No device paired'}</p>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${drawerConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {drawerConnected ? 'Connected' : 'Disconnected'}
              </span>
              <div className="pt-4 w-full flex flex-col gap-2">
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition" onClick={() => connectDevice('drawer')}>Pair Drawer</button>
                {drawerConnected && (
                  <div className="flex gap-2 w-full">
                    <button className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-bold py-2 rounded-lg transition" onClick={() => alert('Drawer open signal sent!')}>Open</button>
                    <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-red-600 text-sm font-medium py-2 rounded-lg transition" onClick={() => disconnectDevice('drawer')}>Disconnect</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 🟢 BLUETOOTH DEVICE PICKER MODAL */}
        {deviceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border dark:border-gray-700 animate-scaleIn">
              
              <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                  <FiBluetooth className="text-blue-500"/> Select {selectingDeviceType}
                </h3>
                <button onClick={() => !isTesting && setDeviceModalOpen(false)} disabled={isTesting} className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-50">
                  <FiX size={22}/>
                </button>
              </div>

              <div className="p-4 max-h-80 overflow-y-auto space-y-2 relative">
                {/* Testing Overlay */}
                {isTesting && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 z-10 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl">
                    <FiLoader className="animate-spin text-blue-600 mb-2" size={32} />
                    <span className="font-bold text-gray-800 dark:text-white text-sm">Testing Connection...</span>
                    <span className="text-xs text-gray-500">Please wait.</span>
                  </div>
                )}

                {pairedDevices.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500 font-medium">No paired devices found.</p>
                    <p className="text-xs text-gray-400 mt-1">Please pair your printer via OS settings first.</p>
                  </div>
                ) : (
                  pairedDevices.map((d, i) => (
                    <button 
                      key={i} 
                      onClick={() => selectDeviceFromList(d)} 
                      disabled={isTesting}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition border border-gray-200 dark:border-gray-600 disabled:opacity-50"
                    >
                      <div className="text-left">
                        <div className="font-bold text-sm text-gray-900 dark:text-white">{d.name || 'Unknown Device'}</div>
                        <div className="text-xs text-gray-500 mt-0.5 tracking-wider font-mono">{d.address}</div>
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800">
                        Connect
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                <button 
                  onClick={() => { if(window.bluetoothSerial) window.bluetoothSerial.showBluetoothSettings() }} 
                  disabled={isTesting}
                  className="w-full py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <FiSettings size={16} /> Open OS Bluetooth Settings
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageTemplate>
  )
}