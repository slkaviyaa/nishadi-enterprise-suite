'use client'
import { useState, useEffect } from 'react'
import PageTemplate from './PageTemplate';

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
    if (savedPrinter) setPrinterDevice({ name: savedPrinter })
    if (savedScale) setScaleDevice({ name: savedScale })
    if (savedDrawer) setCashDrawerDevice({ name: savedDrawer })
  }, [])

  const connectDevice = async (type) => {
    try {
      setMessage(`Searching for ${type}...`)
      let service = ''
      if(type === 'printer') service = '000018f0-0000-1000-8000-00805f9b34fb'
      if(type === 'scale') service = '0000181d-0000-1000-8000-00805f9b34fb'
      if(type === 'drawer') service = '0000180a-0000-1000-8000-00805f9b34fb'

      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [service] })
      
      if(type === 'printer') { setPrinterDevice(device); localStorage.setItem('printerName', device.name || 'Printer'); setPrinterConnected(true) }
      if(type === 'scale') { setScaleDevice(device); localStorage.setItem('scaleName', device.name || 'Scale'); setScaleConnected(true) }
      if(type === 'drawer') { setCashDrawerDevice(device); localStorage.setItem('drawerName', device.name || 'Drawer'); setDrawerConnected(true) }
      
      setMessage(`${type} connected successfully!`)
    } catch (err) { setMessage('Failed: ' + err.message) }
  }

  const disconnectDevice = (type) => {
    if(type === 'printer') { if(printerDevice?.gatt?.connected) printerDevice.gatt.disconnect(); setPrinterDevice(null); setPrinterConnected(false); localStorage.removeItem('printerName') }
    if(type === 'scale') { if(scaleDevice?.gatt?.connected) scaleDevice.gatt.disconnect(); setScaleDevice(null); setScaleConnected(false); localStorage.removeItem('scaleName') }
    if(type === 'drawer') { if(cashDrawerDevice?.gatt?.connected) cashDrawerDevice.gatt.disconnect(); setCashDrawerDevice(null); setDrawerConnected(false); localStorage.removeItem('drawerName') }
  }

  const activeCount = [printerConnected, scaleConnected, drawerConnected].filter(Boolean).length

  const metrics = [
    { label: 'Active Devices', value: activeCount, icon: '🔌' },
    { label: 'System Status', value: activeCount > 0 ? 'Online' : 'Standby', icon: '⚡' },
  ]

  return (
    <PageTemplate
      title="🔌 Bluetooth Devices"
      subtitle="Connect POS hardware via Web Bluetooth API"
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