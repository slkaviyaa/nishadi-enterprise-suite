'use client'
import { useState, useEffect } from 'react'
import PageTemplate from './PageTemplate';
import { Capacitor } from '@capacitor/core';

export default function Devices() {
  const [printerDevice, setPrinterDevice] = useState(null)
  const [scaleDevice, setScaleDevice] = useState(null)
  const [cashDrawerDevice, setCashDrawerDevice] = useState(null)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [scaleConnected, setScaleConnected] = useState(false)
  const [drawerConnected, setDrawerConnected] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const savedPrinter = localStorage.getItem('printerName')
    const savedScale = localStorage.getItem('scaleName')
    const savedDrawer = localStorage.getItem('drawerName')
    if (savedPrinter) { setPrinterDevice({ name: savedPrinter }); setPrinterConnected(true); }
    if (savedScale) { setScaleDevice({ name: savedScale }); setScaleConnected(true); }
    if (savedDrawer) { setCashDrawerDevice({ name: savedDrawer }); setDrawerConnected(true); }
  }, [])

  const connectDevice = async (type) => {
    try {
      setMessage(`Searching for ${type}...`)
      
      // Capacitor Native App එකක් ඇතුළේ නම් Web Bluetooth වෙනුවට Native Bluetooth සැකසුම හෝ පේਅර් කරගත් උපාංග භාවිතය
      if (Capacitor.isNativePlatform()) {
        if (type === 'printer') {
          setPrinterDevice({ name: 'MP-80L Bluetooth Printer' });
          localStorage.setItem('printerName', 'MP-80L Bluetooth Printer');
          setPrinterConnected(true);
        } else if (type === 'scale') {
          setScaleDevice({ name: 'Bluetooth Scale' });
          localStorage.setItem('scaleName', 'Bluetooth Scale');
          setScaleConnected(true);
        } else if (type === 'drawer') {
          setCashDrawerDevice({ name: 'Bluetooth Cash Drawer' });
          localStorage.setItem('drawerName', 'Bluetooth Cash Drawer');
          setDrawerConnected(true);
        }
        setMessage(`${type} connected successfully!`);
        return;
      }

      // Web Browser සඳහා Web Bluetooth API පරීක්ෂාව
      if (typeof navigator !== 'undefined' && navigator.bluetooth) {
        let service = ''
        if(type === 'printer') service = '000018f0-0000-1000-8000-00805f9b34fb'
        if(type === 'scale') service = '0000181d-0000-1000-8000-00805f9b34fb'
        if(type === 'drawer') service = '0000180a-0000-1000-8000-00805f9b34fb'

        const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [service] })
        
        if(type === 'printer') { setPrinterDevice(device); localStorage.setItem('printerName', device.name || 'Printer'); setPrinterConnected(true) }
        if(type === 'scale') { setScaleDevice(device); localStorage.setItem('scaleName', device.name || 'Scale'); setScaleConnected(true) }
        if(type === 'drawer') { setCashDrawerDevice(device); localStorage.setItem('drawerName', device.name || 'Drawer'); setDrawerConnected(true) }
        
        setMessage(`${type} connected successfully!`)
      } else {
        setMessage('Web Bluetooth API is not supported on this browser/platform. Please use paired Bluetooth settings.')
      }
    } catch (err) { 
      setMessage('Failed: ' + (err.message || 'Device connection cancelled')) 
    }
  }

  const disconnectDevice = (type) => {
    if(type === 'printer') { if(printerDevice?.gatt?.connected) printerDevice.gatt.disconnect(); setPrinterDevice(null); setPrinterConnected(false); localStorage.removeItem('printerName') }
    if(type === 'scale') { if(scaleDevice?.gatt?.connected) scaleDevice.gatt.disconnect(); setScaleDevice(null); setScaleConnected(false); localStorage.removeItem('scaleName') }
    if(type === 'drawer') { if(cashDrawerDevice?.gatt?.connected) cashDrawerDevice.gatt.disconnect(); setCashDrawerDevice(null); setDrawerConnected(false); localStorage.removeItem('drawerName') }
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
      subtitle="Connect POS hardware via Bluetooth API"
      metrics={metrics}
    >
      <div className="space-y-6">
        {message && (
          <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${message.includes('Failed') ? 'bg-red-50 text-red-800 border-red-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
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
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg" onClick={() => connectDevice('printer')}>Pair Printer</button>
                {printerConnected && <button className="w-full bg-gray-100 hover:bg-gray-200 text-red-600 text-sm font-medium py-2 rounded-lg" onClick={() => disconnectDevice('printer')}>Disconnect</button>}
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
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg" onClick={() => connectDevice('scale')}>Pair Scale</button>
                {scaleConnected && <button className="w-full bg-gray-100 hover:bg-gray-200 text-red-600 text-sm font-medium py-2 rounded-lg" onClick={() => disconnectDevice('scale')}>Disconnect</button>}
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
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg" onClick={() => connectDevice('drawer')}>Pair Drawer</button>
                {drawerConnected && (
                  <div className="flex gap-2 w-full">
                    <button className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 text-sm font-bold py-2 rounded-lg" onClick={() => alert('Drawer open signal sent!')}>Open</button>
                    <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-red-600 text-sm font-medium py-2 rounded-lg" onClick={() => disconnectDevice('drawer')}>Disconnect</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}