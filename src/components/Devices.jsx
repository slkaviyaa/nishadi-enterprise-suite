'use client'
import { useState, useEffect } from 'react'

export default function Devices() {
  const [printerDevice, setPrinterDevice] = useState(null)
  const [scaleDevice, setScaleDevice] = useState(null)
  const [cashDrawerDevice, setCashDrawerDevice] = useState(null)
  const [printerConnected, setPrinterConnected] = useState(false)
  const [scaleConnected, setScaleConnected] = useState(false)
  const [drawerConnected, setDrawerConnected] = useState(false)
  const [message, setMessage] = useState('')

  // Load saved device names
  useEffect(() => {
    const savedPrinter = localStorage.getItem('printerName')
    const savedScale = localStorage.getItem('scaleName')
    const savedDrawer = localStorage.getItem('drawerName')
    if (savedPrinter) setPrinterDevice({ name: savedPrinter })
    if (savedScale) setScaleDevice({ name: savedScale })
    if (savedDrawer) setCashDrawerDevice({ name: savedDrawer })
  }, [])

  // Connect Printer
  const connectPrinter = async () => {
    try {
      setMessage('Searching for printer...')
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      })
      setPrinterDevice(device)
      localStorage.setItem('printerName', device.name || 'Printer')
      setPrinterConnected(true)
      setMessage('Printer connected!')
    } catch (err) {
      setMessage('Failed: ' + err.message)
    }
  }

  const disconnectPrinter = () => {
    if (printerDevice?.gatt?.connected) printerDevice.gatt.disconnect()
    setPrinterDevice(null)
    setPrinterConnected(false)
    localStorage.removeItem('printerName')
  }

  // Connect Scale
  const connectScale = async () => {
    try {
      setMessage('Searching for scale...')
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000181d-0000-1000-8000-00805f9b34fb']
      })
      setScaleDevice(device)
      localStorage.setItem('scaleName', device.name || 'Scale')
      setScaleConnected(true)
      setMessage('Scale connected!')
    } catch (err) {
      setMessage('Failed: ' + err.message)
    }
  }

  const disconnectScale = () => {
    if (scaleDevice?.gatt?.connected) scaleDevice.gatt.disconnect()
    setScaleDevice(null)
    setScaleConnected(false)
    localStorage.removeItem('scaleName')
  }

  // Connect Cash Drawer
  const connectDrawer = async () => {
    try {
      setMessage('Searching for cash drawer...')
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['0000180a-0000-1000-8000-00805f9b34fb'] // Device Information (generic)
      })
      setCashDrawerDevice(device)
      localStorage.setItem('drawerName', device.name || 'Cash Drawer')
      setDrawerConnected(true)
      setMessage('Cash drawer connected!')
    } catch (err) {
      setMessage('Failed: ' + err.message)
    }
  }

  const disconnectDrawer = () => {
    if (cashDrawerDevice?.gatt?.connected) cashDrawerDevice.gatt.disconnect()
    setCashDrawerDevice(null)
    setDrawerConnected(false)
    localStorage.removeItem('drawerName')
  }

  // Test open drawer (simulate)
  const openDrawer = () => {
    // In real implementation, send ESC/POS command to printer (printer triggers drawer)
    alert('Cash drawer open signal sent!')
  }

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100">
      <h2 className="text-2xl font-bold dark:text-white">Bluetooth Devices</h2>

      {message && (
        <div className={`px-4 py-2 rounded-lg text-sm ${message.includes('Failed') ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'}`}>
          {message}
        </div>
      )}

      {/* Printer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">🖨️ Thermal Printer</h3>
            {printerDevice && <p className="text-sm opacity-70">{printerDevice.name}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${printerConnected ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700'}`}>
            {printerConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={connectPrinter}>Connect Printer</button>
          {printerConnected && <button className="btn btn-outline btn-sm text-red-500" onClick={disconnectPrinter}>Disconnect</button>}
        </div>
      </div>

      {/* Scale */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">⚖️ Weight Scale</h3>
            {scaleDevice && <p className="text-sm opacity-70">{scaleDevice.name}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${scaleConnected ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700'}`}>
            {scaleConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={connectScale}>Connect Scale</button>
          {scaleConnected && <button className="btn btn-outline btn-sm text-red-500" onClick={disconnectScale}>Disconnect</button>}
        </div>
      </div>

      {/* Cash Drawer */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold">💵 Cash Drawer</h3>
            {cashDrawerDevice && <p className="text-sm opacity-70">{cashDrawerDevice.name}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${drawerConnected ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-200 dark:bg-gray-700'}`}>
            {drawerConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={connectDrawer}>Connect Drawer</button>
          {drawerConnected && (
            <>
              <button className="btn btn-success btn-sm" onClick={openDrawer}>Open Drawer</button>
              <button className="btn btn-outline btn-sm text-red-500" onClick={disconnectDrawer}>Disconnect</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}