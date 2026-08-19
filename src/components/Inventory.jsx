'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { 
  FiEdit, FiTrash2, FiDownload, FiPlus, FiUpload, 
  FiBox, FiCheckSquare, FiSquare, FiLock, FiRepeat, FiX, FiRefreshCw, FiCheck, FiArrowRight 
} from 'react-icons/fi'

export default function Inventory() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const { showToast } = useToast()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [selectedProducts, setSelectedProducts] = useState([])

  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr)
  const [dateTo, setDateTo] = useState(todayStr) 
  const [movements, setMovements] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  const [totalAdded, setTotalAdded] = useState(0)
  const [totalSold, setTotalSold] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [fastMovingList, setFastMovingList] = useState([])

  const currency = settings?.currency_symbol || 'Rs. '
  const fileInputRef = useRef(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentBpId, setCurrentBpId] = useState(null)
  const [currentProductId, setCurrentProductId] = useState(null)
  
  const [formData, setFormData] = useState({
    sku: '', barcode: '', name: '', category: '', cost_price: '', selling_price: '', stock_quantity: '',
    track_profit: false, low_stock_alerts: false, auto_update_stock: true,
    prevent_out_of_stock_sale: true, has_barcode: false, track_expiry: false, add_tax: false
  })

  const [importStep, setImportStep] = useState(0) 
  const [csvHeaders, setCsvHeaders] = useState([])
  const [csvData, setCsvData] = useState([])
  const [fieldMapping, setFieldMapping] = useState({
    name: '', category: '', sku: '', cost_price: '', selling_price: '', stock_quantity: ''
  })
  const [previewData, setPreviewData] = useState([])

  const dbFields = [
    { key: 'name', label: 'Item Name', required: true },
    { key: 'category', label: 'Category', required: false },
    { key: 'selling_price', label: 'Selling Price', required: true },
    { key: 'cost_price', label: 'Cost Price', required: false },
    { key: 'stock_quantity', label: 'Stock', required: false },
    { key: 'sku', label: 'Part Number / Barcode', required: false }
  ]

  const loadInitialInventory = async () => {
    if (!branch) return
    setLoading(true)
    setSelectedProducts([])
    try {
      const { data: bpData, error: bpErr } = await supabase
        .from('branch_products')
        .select(`
          id, product_id, price, cost_price, stock_quantity, 
          track_profit, low_stock_alerts, auto_update_stock, prevent_out_of_stock_sale, has_barcode, track_expiry, add_tax,
          products!inner(sku, barcode, name, category, deleted_at)
        `)
        .eq('branch_id', branch)
        .is('products.deleted_at', null)

      if (bpErr) throw bpErr

      const { data: allSales, error: salesErr } = await supabase
        .from('order_items')
        .select('branch_product_id, quantity, orders!inner(branch_id)')
        .eq('orders.branch_id', branch)

      if (salesErr) console.error('Sales Data Error:', salesErr)

      const lifetimeSoldMap = {}
      ;(allSales || []).forEach(item => {
        if (item.branch_product_id) {
          lifetimeSoldMap[item.branch_product_id] = (lifetimeSoldMap[item.branch_product_id] || 0) + Number(item.quantity || 0)
        }
      })

      const formattedProducts = (bpData || []).map(p => {
        const sold = lifetimeSoldMap[p.id] || 0
        const stock = Number(p.stock_quantity) || 0
        const added = stock + sold 

        return {
          id: p.id,
          product_id: p.product_id,
          sku: p.products?.sku || 'N/A',
          barcode: p.products?.barcode || '',
          name: p.products?.name || 'Unnamed',
          category: p.products?.category || 'Uncategorized',
          price: Number(p.price) || 0,
          cost: Number(p.cost_price) || 0,
          stock: stock,
          lifetimeAdded: added,
          lifetimeSold: sold,
          track_profit: p.track_profit,
          low_stock_alerts: p.low_stock_alerts,
          auto_update_stock: p.auto_update_stock,
          prevent_out_of_stock_sale: p.prevent_out_of_stock_sale,
          has_barcode: p.has_barcode,
          track_expiry: p.track_expiry,
          add_tax: p.add_tax
        }
      })

      setProducts(formattedProducts)

      const currentBalanceSum = formattedProducts.reduce((sum, p) => sum + p.stock, 0)
      setTotalBalance(currentBalanceSum)

      const sortedBySales = [...formattedProducts]
        .filter(p => p.lifetimeSold > 0)
        .sort((a, b) => b.lifetimeSold - a.lifetimeSold)
        .slice(0, 4)
      setFastMovingList(sortedBySales)

      generateMovementReport(formattedProducts, dateFrom, dateTo)

    } catch (err) {
      console.error(err)
      showToast('Error loading inventory data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (branch) {
      loadInitialInventory()
    }
  }, [branch])

  const generateMovementReport = async (currentProducts = products, fromDate, toDate) => {
    if (!branch) return
    setReportLoading(true)
    try {
      let salesQuery = supabase
        .from('order_items')
        .select('branch_product_id, quantity, created_at, orders!inner(branch_id)')
        .eq('orders.branch_id', branch)

      if (fromDate && fromDate !== '') salesQuery = salesQuery.gte('created_at', `${fromDate}T00:00:00.000Z`)
      if (toDate && toDate !== '') salesQuery = salesQuery.lte('created_at', `${toDate}T23:59:59.999Z`)

      const { data: orderItemsData, error: salesErr } = await salesQuery
      if (salesErr) console.error('Report Sales Query Error:', salesErr)

      const salesMap = {}
      let periodSold = 0
      ;(orderItemsData || []).forEach(item => {
        if (item.branch_product_id) {
          salesMap[item.branch_product_id] = (salesMap[item.branch_product_id] || 0) + Number(item.quantity || 0)
          periodSold += Number(item.quantity || 0)
        }
      })

      let periodAdded = 0
      const movementReportList = currentProducts.map(p => {
        const sold = salesMap[p.id] || 0
        const balance = p.stock
        const added = balance + sold 
        periodAdded += added

        return { id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, category: p.category, price: p.price, cost: p.cost, added: added, sold: sold, balance: balance }
      }).filter(m => m.added > 0 || m.sold > 0 || m.balance > 0)

      setTotalSold(periodSold)
      setTotalAdded(periodAdded)
      setMovements(movementReportList)

    } catch (err) {
      console.error(err)
      showToast('Error generating stock movement report', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  const handleClearDates = () => {
    setDateFrom('')
    setDateTo('')
    setMovements([]) 
    setTotalSold(0)
    setTotalAdded(0)
    showToast('Report dates cleared', 'success')
  }

  const handleOpenAddModal = () => {
    setIsEditing(false)
    setFormData({
      sku: '', barcode: '', name: '', category: '', cost_price: '', selling_price: '', stock_quantity: '',
      track_profit: false, low_stock_alerts: false, auto_update_stock: true,
      prevent_out_of_stock_sale: true, has_barcode: false, track_expiry: false, add_tax: false
    })
    setIsModalOpen(true)
  }

  const handleEdit = (p) => {
    setIsEditing(true)
    setCurrentBpId(p.id)
    setCurrentProductId(p.product_id)
    setFormData({
      sku: p.sku, barcode: p.barcode || '', name: p.name, category: p.category, 
      cost_price: p.cost, selling_price: p.price, stock_quantity: p.stock,
      track_profit: p.track_profit || false,
      low_stock_alerts: p.low_stock_alerts || false,
      auto_update_stock: p.auto_update_stock !== false,
      prevent_out_of_stock_sale: p.prevent_out_of_stock_sale !== false,
      has_barcode: p.has_barcode || false,
      track_expiry: p.track_expiry || false,
      add_tax: p.add_tax || false
    })
    setIsModalOpen(true)
  }

  const toggleFeature = (feature) => {
    setFormData(prev => ({ ...prev, [feature]: !prev[feature] }))
  }

  const handleSaveModal = async () => {
    if (!formData.name || !formData.selling_price) {
      showToast('Name and Selling Price are required', 'error')
      return
    }

    try {
      if (isEditing) {
        await supabase.from('products').update({ 
          sku: formData.sku, 
          barcode: formData.barcode, 
          name: formData.name, 
          category: formData.category || 'Uncategorized' 
        }).eq('id', currentProductId)

        await supabase.from('branch_products').update({
          price: Number(formData.selling_price),
          cost_price: Number(formData.cost_price),
          stock_quantity: Number(formData.stock_quantity),
          track_profit: formData.track_profit,
          low_stock_alerts: formData.low_stock_alerts,
          auto_update_stock: formData.auto_update_stock,
          prevent_out_of_stock_sale: formData.prevent_out_of_stock_sale,
          has_barcode: formData.has_barcode,
          track_expiry: formData.track_expiry,
          add_tax: formData.add_tax
        }).eq('id', currentBpId)

        showToast('Product updated successfully!', 'success')
      } else {
        const { data: newProd, error: prodErr } = await supabase.from('products').insert({ 
          sku: formData.sku || `ITM-${Date.now().toString().slice(-6)}`, 
          barcode: formData.barcode, 
          name: formData.name, 
          category: formData.category || 'Uncategorized' 
        }).select().single()

        if (prodErr) throw prodErr

        await supabase.from('branch_products').insert({
          product_id: newProd.id,
          branch_id: branch,
          price: Number(formData.selling_price),
          cost_price: Number(formData.cost_price),
          stock_quantity: Number(formData.stock_quantity),
          track_profit: formData.track_profit,
          low_stock_alerts: formData.low_stock_alerts,
          auto_update_stock: formData.auto_update_stock,
          prevent_out_of_stock_sale: formData.prevent_out_of_stock_sale,
          has_barcode: formData.has_barcode,
          track_expiry: formData.track_expiry,
          add_tax: formData.add_tax
        })

        showToast('Product added successfully!', 'success')
      }
      setIsModalOpen(false)
      loadInitialInventory()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', productId)
      showToast('Product deleted successfully', 'success')
      loadInitialInventory()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedProducts.length} items?`)) return
    setLoading(true)
    try {
      await supabase.from('products').update({ deleted_at: new Date().toISOString() }).in('id', selectedProducts)
      showToast(`${selectedProducts.length} items deleted successfully`, 'success')
      loadInitialInventory()
    } catch (err) {
      showToast(err.message, 'error')
      setLoading(false)
    }
  }

  const parseCSVLine = (text) => {
    const result = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (c === '"') {
        inQuotes = !inQuotes
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
    result.push(cur.trim())
    return result
  }

  const startCSVImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = ({ target }) => {
      const rawLines = target.result.split(/\r?\n/).filter(r => r.trim())
      if (rawLines.length < 2) {
        showToast('CSV file is empty or invalid', 'error')
        return
      }

      const headers = parseCSVLine(rawLines[0]).map(h => h.replace(/^"|"$/g, ''))
      const data = rawLines.slice(1).map(line => parseCSVLine(line).map(c => c.replace(/^"|"$/g, '')))

      setCsvHeaders(headers)
      setCsvData(data)

      const newMapping = { name: '', category: '', sku: '', cost_price: '', selling_price: '', stock_quantity: '' }
      headers.forEach(h => {
        const lower = h.toLowerCase()
        if (lower.includes('name') || lower.includes('item') || lower.includes('description')) newMapping.name = h
        else if (lower.includes('category')) newMapping.category = h
        else if (lower.includes('sku') || lower.includes('barcode') || lower.includes('code') || lower.includes('part')) newMapping.sku = h
        else if (lower.includes('cost')) newMapping.cost_price = h
        else if (lower.includes('selling') || lower.includes('retail') || lower.includes('price') || lower.includes('mrp')) newMapping.selling_price = h
        else if (lower.includes('stock') || lower.includes('qty') || lower.includes('quantity')) newMapping.stock_quantity = h
      })

      setFieldMapping(newMapping)
      setImportStep(1)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const proceedToPreview = () => {
    if (!fieldMapping.name || !fieldMapping.selling_price) {
      showToast('Item Name and Selling Price fields are mandatory to map!', 'error')
      return
    }

    const pData = csvData.map((row, idx) => {
      const getVal = (fieldKey) => {
        const headerName = fieldMapping[fieldKey]
        if (!headerName) return ''
        const colIdx = csvHeaders.indexOf(headerName)
        return (colIdx !== -1 && row[colIdx] !== undefined) ? row[colIdx] : ''
      }

      return {
        id: idx,
        name: getVal('name'),
        category: getVal('category'),
        selling_price: getVal('selling_price'),
        cost_price: getVal('cost_price'),
        stock_quantity: getVal('stock_quantity'),
        barcode: getVal('sku'),
        sku: '' // Allow UI edit, backend fallback if empty
      }
    }).filter(r => r.name)

    setPreviewData(pData)
    setImportStep(2)
  }

  const handlePreviewEdit = (idx, field, value) => {
    const newData = [...previewData]
    newData[idx][field] = value
    setPreviewData(newData)
  }

  const cleanNumber = (val) => {
    if (!val) return 0
    const cleaned = String(val).replace(/[^0-9.-]+/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  const saveImportToDatabase = async () => {
    try {
      setLoading(true)

      const validItems = previewData.filter(item => item.name && String(item.name).trim() !== '')
      if (validItems.length === 0) {
        showToast('No valid items to import', 'error')
        setLoading(false)
        return
      }

      const itemMap = {}
      validItems.forEach((item) => {
        const rawBarcode = item.barcode ? String(item.barcode).trim() : ''
        const mapKey = rawBarcode || String(item.name).trim().toLowerCase()

        if (itemMap[mapKey]) {
          itemMap[mapKey].stockQty += cleanNumber(item.stock_quantity)
        } else {
          itemMap[mapKey] = {
            name: String(item.name).trim(),
            category: item.category ? String(item.category).trim() : 'Uncategorized',
            costPrice: cleanNumber(item.cost_price),
            sellingPrice: cleanNumber(item.selling_price) > 0 ? cleanNumber(item.selling_price) : 1,
            stockQty: cleanNumber(item.stock_quantity),
            barcode: rawBarcode,
            // User input SKU or Auto Gen
            systemSku: item.sku ? String(item.sku).trim() : `ITM-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 9000) + 1000}`
          }
        }
      })

      const cleanedItems = Object.values(itemMap)
      let successCount = 0
      const BATCH_SIZE = 100

      for (let i = 0; i < cleanedItems.length; i += BATCH_SIZE) {
        const batch = cleanedItems.slice(i, i + BATCH_SIZE)
        const batchBarcodes = batch.map(b => b.barcode).filter(Boolean)

        const existingMap = {}
        if (batchBarcodes.length > 0) {
          const { data: existingProds } = await supabase
            .from('products')
            .select('id, sku, barcode')
            .in('barcode', batchBarcodes)
          ;(existingProds || []).forEach(p => {
            if (p.barcode) existingMap[p.barcode] = p.id
          })
        }

        const newToInsert = []
        batch.forEach(b => {
          if (b.barcode && existingMap[b.barcode]) {
            b.finalProductId = existingMap[b.barcode]
          } else {
            newToInsert.push({ sku: b.systemSku, barcode: b.barcode, name: b.name, category: b.category })
          }
        })

        if (newToInsert.length > 0) {
          const { data: createdProds } = await supabase
            .from('products')
            .insert(newToInsert)
            .select('id, barcode, sku')

          ;(createdProds || []).forEach(p => {
            const matched = batch.find(b => (b.barcode && b.barcode === p.barcode) || b.systemSku === p.sku)
            if (matched) matched.finalProductId = p.id
          })
        }

        const branchPayloads = batch.map(b => {
          if (!b.finalProductId) return null
          return {
            product_id: b.finalProductId,
            branch_id: branch,
            price: b.sellingPrice,
            cost_price: b.costPrice,
            stock_quantity: b.stockQty
          }
        }).filter(Boolean)

        if (branchPayloads.length > 0) {
          const { error: bpErr } = await supabase
            .from('branch_products')
            .upsert(branchPayloads, { onConflict: 'branch_id,product_id' })
          if (!bpErr) successCount += branchPayloads.length
        }
      }

      showToast(`✅ Successfully imported ${successCount} items!`, 'success')
      setImportStep(0)
      loadInitialInventory()
    } catch (err) {
      console.error('Import Error:', err)
      showToast('Import Error: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()) || 
    (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())) || 
    p.category.toLowerCase().includes(search.toLowerCase())
  )

  const metrics = [
    { label: 'Total Stock Balance', value: totalBalance.toLocaleString(), icon: '📦' },
    { label: 'Period Stock Sold', value: totalSold.toLocaleString(), icon: '🛍️' },
    { label: 'Period Stock Added', value: totalAdded.toLocaleString(), icon: '📥' },
    { label: 'Fast Moving Items', value: fastMovingList.length, icon: '🔥' }
  ]

  // ================= 📊 COMPLETE EXCEL EXPORT (INVENTORY + MOVEMENT) =================
  const exportExcel = async () => {
    if (filteredProducts.length === 0 && movements.length === 0) {
      return showToast('No data available to export.', 'error')
    }
    setLoading(true)
    
    try {
      const ExcelJS = (await import('exceljs')).default
      const fileSaver = await import('file-saver')
      const saveAs = fileSaver.saveAs || fileSaver.default?.saveAs || fileSaver.default
      
      const workbook = new ExcelJS.Workbook()

      // ---------------- 1. SHEET 1: Current Product Inventory ----------------
      const invSheet = workbook.addWorksheet('Current Inventory')

      invSheet.columns = [
        { header: 'System SKU', key: 'sku', width: 20 },
        { header: 'Part No / Barcode', key: 'barcode', width: 20 },
        { header: 'Item Name', key: 'name', width: 40 },
        { header: 'Category', key: 'category', width: 25 },
        { header: 'Cost Price', key: 'cost', width: 16 },
        { header: 'Selling Price', key: 'price', width: 16 },
        { header: 'Current Stock', key: 'stock', width: 16 },
        { header: 'Total Value (Cost)', key: 'total_cost_value', width: 22 },
        { header: 'Total Value (Selling)', key: 'total_sell_value', width: 22 }
      ]

      invSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      invSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
      invSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

      filteredProducts.forEach(p => {
        invSheet.addRow({
          sku: p.sku,
          barcode: p.barcode || 'N/A',
          name: p.name,
          category: p.category,
          cost: p.cost,
          price: p.price,
          stock: p.stock,
          total_cost_value: p.stock * p.cost,
          total_sell_value: p.stock * p.price
        })
      })

      invSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.getCell('stock').font = { color: { argb: 'FF2563EB' }, bold: true }
          row.alignment = { vertical: 'middle' }
        }
      })

      // ---------------- 2. SHEET 2: Stock Movement Report ----------------
      const movementSheet = workbook.addWorksheet('Stock Movement')

      movementSheet.columns = [
        { header: 'System SKU', key: 'sku', width: 20 },
        { header: 'Part No / Barcode', key: 'barcode', width: 20 },
        { header: 'Item Name', key: 'name', width: 40 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Cost Price', key: 'cost', width: 16 },
        { header: 'Selling Price', key: 'price', width: 16 },
        { header: 'Period Added (+)', key: 'added', width: 18 },
        { header: 'Period Sold (-)', key: 'sold', width: 18 },
        { header: 'Closing Balance', key: 'balance', width: 18 },
        { header: 'Current Value (Cost)', key: 'total_value', width: 22 }
      ]

      movementSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      movementSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } }
      movementSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

      const exportMovementList = movements.length > 0 ? movements : filteredProducts.map(p => ({
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        category: p.category,
        cost: p.cost,
        price: p.price,
        added: p.lifetimeAdded,
        sold: p.lifetimeSold,
        balance: p.stock
      }))

      exportMovementList.forEach(m => {
        movementSheet.addRow({
          sku: m.sku,
          barcode: m.barcode || 'N/A',
          name: m.name,
          category: m.category || 'Uncategorized',
          cost: m.cost,
          price: m.price,
          added: m.added,
          sold: m.sold,
          balance: m.balance,
          total_value: (m.balance || 0) * (m.cost || 0)
        })
      })

      movementSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.getCell('added').font = { color: { argb: 'FF16A34A' }, bold: true }
          row.getCell('sold').font = { color: { argb: 'FFDC2626' }, bold: true }
          row.getCell('balance').font = { color: { argb: 'FF2563EB' }, bold: true }
          row.alignment = { vertical: 'middle' }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(new Blob([buffer]), `Inventory_and_Stock_Movement_${new Date().toISOString().split('T')[0]}.xlsx`)
      showToast('Inventory & Stock Movement exported successfully!', 'success')
      
    } catch (err) {
      console.error(err)
      showToast('Failed to export Excel', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTemplate
      title="📦 Inventory & Stock Movement"
      subtitle="Monitor stock balance, analyze fast-moving products, and track movements"
      metrics={metrics}
    >
      <div className="space-y-6 pb-10">
        {fastMovingList.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-5 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔥</span>
              <h3 className="font-extrabold text-orange-900 dark:text-orange-300 text-base">Fast Moving Products (Highest Lifetime Demand)</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fastMovingList.map((item, idx) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-3.5 rounded-lg border border-orange-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-2 py-0.5 rounded-full uppercase">Rank #{idx + 1}</span>
                      <span className="text-xs font-mono text-gray-400">{item.sku}</span>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white mt-2 line-clamp-1">{item.name}</p>
                  </div>
                  <div className="mt-3 flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-gray-500">Units Sold:</span>
                    <span className="font-extrabold text-sm text-orange-600 dark:text-orange-400">{item.lifetimeSold} Pcs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white text-base">Current Product Stock Overview</h3>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={startCSVImport} className="hidden" />
              
              <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800/50">
                <FiUpload size={14} /> Import CSV
              </button>

              <button onClick={exportExcel} className="bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800/50" title="Exports both Current Inventory and Movement sheets">
                <FiDownload size={14} /> Export All to Excel
              </button>
              
              <button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition flex items-center gap-1.5">
                <FiPlus size={16} /> Add Product
              </button>

              <input
                type="text"
                placeholder="🔍 Search System SKU, Part No, Name..."
                className="w-full sm:w-64 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {selectedProducts.length > 0 && (
            <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 animate-fadeIn">
              <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
                {selectedProducts.length} item(s) selected
              </span>
              <button 
                onClick={handleBulkDelete}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition"
              >
                <FiTrash2 size={14} /> Delete Selected
              </button>
            </div>
          )}

          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar border border-gray-100 dark:border-gray-700 rounded-lg relative">
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 shadow-sm z-10">
                <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3 border-b dark:border-gray-600 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                      checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProducts(filteredProducts.map(p => p.product_id))
                        else setSelectedProducts([])
                      }}
                    />
                  </th>
                  <th className="p-3 border-b dark:border-gray-600">System SKU & Part No</th>
                  <th className="p-3 border-b dark:border-gray-600">Item Name & Category</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right">Cost Price</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right">Selling Price</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-green-600 bg-green-50/50 dark:bg-green-900/10">Added (+) & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-red-600 bg-red-50/50 dark:bg-red-900/10">Sold (-) & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">Balance & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {filteredProducts.map(p => {
                  const isHot = fastMovingList.some(fm => fm.id === p.id)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                          checked={selectedProducts.includes(p.product_id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedProducts([...selectedProducts, p.product_id])
                            else setSelectedProducts(selectedProducts.filter(id => id !== p.product_id))
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200">{p.sku}</div>
                        {p.barcode && <div className="text-[10px] text-gray-500 font-mono mt-0.5">Part: {p.barcode}</div>}
                      </td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white max-w-[200px] truncate" title={p.name}>
                        <div className="flex items-center gap-2">
                          <span className="truncate">{p.name}</span>
                          {isHot && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[9px] font-bold border border-orange-200">🔥 HOT</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5 bg-gray-100 dark:bg-gray-800 w-max px-2 py-0.5 rounded-full">{p.category}</div>
                      </td>
                      <td className="p-3 text-right text-gray-600 dark:text-gray-400">{currency}{p.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-white">{currency}{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      
                      <td className="p-3 text-center bg-green-50/30 dark:bg-green-900/10">
                        <div className="font-bold text-green-600">{p.lifetimeAdded > 0 ? `+${p.lifetimeAdded}` : '0'}</div>
                        {p.lifetimeAdded > 0 && <div className="text-[10px] text-green-700/70 dark:text-green-400/70 mt-0.5">{currency}{(p.lifetimeAdded * p.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                      </td>
                      
                      <td className="p-3 text-center bg-red-50/30 dark:bg-red-900/10">
                        <div className="font-bold text-red-500">{p.lifetimeSold > 0 ? `-${p.lifetimeSold}` : '0'}</div>
                        {p.lifetimeSold > 0 && <div className="text-[10px] text-red-700/70 dark:text-red-400/70 mt-0.5">{currency}{(p.lifetimeSold * p.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                      </td>
                      
                      <td className="p-3 text-center bg-blue-50/30 dark:bg-blue-900/10">
                        <div className="font-extrabold text-blue-700 dark:text-blue-400">{p.stock}</div>
                        {p.stock > 0 && <div className="text-[10px] text-blue-700/70 dark:text-blue-400/70 mt-0.5">{currency}{(p.stock * p.cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEdit(p)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-md transition"><FiEdit size={14} /></button>
                          <button onClick={() => handleDelete(p.product_id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-md transition"><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= ADD / EDIT MODAL ================= */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 sm:p-0 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-scaleIn flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 bg-blue-600 text-white">
                <div className="flex items-center gap-2">
                  {isEditing ? <FiEdit size={18} /> : <FiPlus size={18} />}
                  <h3 className="font-bold tracking-wide">{isEditing ? 'MANAGE ITEM' : 'ADD NEW ITEM'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-blue-100 hover:text-white transition bg-blue-700 p-1.5 rounded-lg"><FiX size={20} /></button>
              </div>

              <div className="overflow-y-auto p-5 space-y-5 custom-scrollbar bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0 relative shadow-sm">
                    <FiBox size={20} />
                    <div className="absolute -bottom-1 -right-1 bg-white text-blue-600 rounded-full p-1 shadow"><FiEdit size={10} /></div>
                  </div>
                  <div className="w-full space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Item Name *</label>
                      <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full font-bold text-lg bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none pb-1 text-gray-900 dark:text-white focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Category</label>
                        <input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full font-semibold text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none pb-1 text-gray-700 dark:text-gray-300 focus:border-blue-500" placeholder="e.g. Spare Parts" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Part Number / Barcode</label>
                        <input type="text" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} className="w-full font-mono text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none pb-1 text-gray-500 dark:text-gray-400 focus:border-blue-500" placeholder="Leave empty if none" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Cost Price</label>
                    <input type="number" value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Selling Price *</label>
                    <input type="number" value={formData.selling_price} onChange={e => setFormData({ ...formData, selling_price: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Stock Available</label>
                    <input type="number" value={formData.stock_quantity} onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })} className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white" />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <label className="text-xs font-semibold text-gray-500 mb-2 block text-center">Track Profit?</label>
                    <button type="button" onClick={() => toggleFeature('track_profit')} className="text-2xl text-blue-600 dark:text-blue-400">
                      {formData.track_profit ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                  <div className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleFeature('auto_update_stock')}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded"><FiRepeat size={16} /></div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Auto-update stock on item sales</span>
                    </div>
                    <div className="text-xl text-blue-600 dark:text-blue-400">{formData.auto_update_stock ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}</div>
                  </div>
                  <div className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-l-4 border-green-400" onClick={() => toggleFeature('prevent_out_of_stock_sale')}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-green-100 dark:bg-green-900/30 text-green-600 rounded"><FiLock size={16} /></div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Prevent item sale when out of stock?</span>
                    </div>
                    <div className="text-xl text-blue-600 dark:text-blue-400">{formData.prevent_out_of_stock_sale ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}</div>
                  </div>
                </div>
              </div>

              <div className="flex p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 gap-3">
                {isEditing && (
                  <button onClick={() => handleDelete(currentProductId)} className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-sm uppercase tracking-wide">Delete</button>
                )}
                <button onClick={handleSaveModal} className="flex-[2] py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md uppercase tracking-wide">
                  {isEditing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= CSV IMPORT STEP 1: MAPPING ================= */}
        {importStep === 1 && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><FiUpload /> Map CSV Columns</h2>
                  <p className="text-sm text-gray-500 mt-1">Select which column from your file matches our system fields.</p>
                </div>
                <button onClick={() => setImportStep(0)} className="text-gray-500 hover:text-red-500"><FiX size={24} /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-3 w-1/3">Required Field (System)</th>
                      <th className="p-3 w-1/2">Your Field (From CSV)</th>
                      <th className="p-3 w-1/6 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbFields.map((field) => (
                      <tr key={field.key} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-4"><span className={`font-semibold ${field.required ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>{field.label} {field.required && <span className="text-red-500">*</span>}</span></td>
                        <td className="p-4">
                          <select 
                            value={fieldMapping[field.key] || ''} 
                            onChange={(e) => setFieldMapping({ ...fieldMapping, [field.key]: e.target.value })}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 outline-none focus:border-blue-500 transition"
                          >
                            <option value="">-- Ignore this field --</option>
                            {csvHeaders.map(h => (<option key={h} value={h}>{h}</option>))}
                          </select>
                        </td>
                        <td className="p-4 text-center">
                          {fieldMapping[field.key] ? (
                            <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"><FiCheck size={18} strokeWidth={3} /></div>
                          ) : (
                            field.required ? <span className="text-xs text-red-500 font-bold">Required</span> : <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                <button onClick={() => setImportStep(0)} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 transition">Cancel</button>
                <button onClick={proceedToPreview} className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition flex items-center gap-2">Next Step <FiArrowRight /></button>
              </div>
            </div>
          </div>
        )}

        {/* ================= CSV IMPORT STEP 2: PREVIEW ================= */}
        {importStep === 2 && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[95vh]">
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><FiEdit /> Review & Edit Data before Saving</h2>
                  <p className="text-sm text-gray-500 mt-1">You can edit names, categories, prices, or stock quantities right here before confirming.</p>
                </div>
                <button onClick={() => setImportStep(0)} className="text-gray-500 hover:text-red-500"><FiX size={24} /></button>
              </div>

              <div className="p-2 overflow-auto custom-scrollbar flex-1 bg-gray-100/50 dark:bg-gray-900/50">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10">
                    <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="p-3 border-b dark:border-gray-700 w-40">System SKU</th>
                      <th className="p-3 border-b dark:border-gray-700">Item Name *</th>
                      <th className="p-3 border-b dark:border-gray-700 w-40">Category</th>
                      <th className="p-3 border-b dark:border-gray-700 w-32">Selling Price *</th>
                      <th className="p-3 border-b dark:border-gray-700 w-32">Cost Price</th>
                      <th className="p-3 border-b dark:border-gray-700 w-28">Stock</th>
                      <th className="p-3 border-b dark:border-gray-700 w-40">Part Number / Barcode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {previewData.map((item, idx) => (
                      <tr key={idx} className="bg-white dark:bg-gray-800 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition">
                        <td className="p-2">
                          <input 
                            type="text" 
                            value={item.sku || ''} 
                            onChange={(e) => handlePreviewEdit(idx, 'sku', e.target.value)} 
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-500 dark:text-gray-400 outline-none focus:border-blue-500" 
                            placeholder="Auto-generate" 
                          />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.name || ''} onChange={(e) => handlePreviewEdit(idx, 'name', e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-blue-500" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.category || ''} onChange={(e) => handlePreviewEdit(idx, 'category', e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" placeholder="Uncategorized" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.selling_price || ''} onChange={(e) => handlePreviewEdit(idx, 'selling_price', e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-bold text-blue-600 dark:text-blue-400 outline-none focus:border-blue-500" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.cost_price || ''} onChange={(e) => handlePreviewEdit(idx, 'cost_price', e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.stock_quantity || ''} onChange={(e) => handlePreviewEdit(idx, 'stock_quantity', e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 text-center" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.barcode || ''} onChange={(e) => handlePreviewEdit(idx, 'barcode', e.target.value)} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-sm font-mono text-gray-500 dark:text-gray-400 outline-none focus:border-blue-500" placeholder="Leave empty if none" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-800 px-3 py-1 rounded-full">{previewData.length} items ready to import/update</span>
                <div className="flex gap-3">
                  <button onClick={() => setImportStep(1)} className="px-6 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 transition">Back</button>
                  <button onClick={saveImportToDatabase} disabled={loading} className="px-8 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition flex items-center gap-2 disabled:opacity-50">
                    {loading ? <FiRefreshCw className="animate-spin" /> : <FiCheck />} Confirm & Save Import
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTemplate>
  )
}