'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { 
  FiEdit, FiTrash2, FiDownload, FiPlus, FiUpload, 
  FiBox, FiCheckSquare, FiSquare, FiLock, FiRepeat, FiAlertCircle, FiX, FiRefreshCw 
} from 'react-icons/fi'

export default function Inventory() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const { showToast } = useToast()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Date Filters for Stock Movement
  const todayStr = new Date().toISOString().split('T')[0]
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgoStr)
  const [dateTo, setDateTo] = useState(todayStr) 
  const [movements, setMovements] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  // Totals for Metrics
  const [totalAdded, setTotalAdded] = useState(0)
  const [totalSold, setTotalSold] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [fastMovingList, setFastMovingList] = useState([])

  const currency = settings?.currency_symbol || 'Rs. '
  const fileInputRef = useRef(null)

  // ================= ADD / EDIT MODAL STATES =================
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentBpId, setCurrentBpId] = useState(null)
  const [currentProductId, setCurrentProductId] = useState(null)
  
  const [formData, setFormData] = useState({
    sku: '', name: '', cost_price: '', selling_price: '', stock_quantity: '',
    track_profit: false, low_stock_alerts: false, auto_update_stock: true,
    prevent_out_of_stock_sale: true, has_barcode: false, track_expiry: false, add_tax: false
  })

  useEffect(() => {
    if (branch) {
      loadInitialInventory()
    }
  }, [branch])

  const loadInitialInventory = async () => {
    setLoading(true)
    try {
      const { data: bpData, error: bpErr } = await supabase
        .from('branch_products')
        .select(`
          id, product_id, price, cost_price, stock_quantity, 
          track_profit, low_stock_alerts, auto_update_stock, prevent_out_of_stock_sale, has_barcode, track_expiry, add_tax,
          products!inner(sku, name, deleted_at)
        `)
        .eq('branch_id', branch)
        .is('products.deleted_at', null)

      if (bpErr) throw bpErr

      // Fetch ALL Sales (Removed strict status check to ensure no sales are missed)
      const { data: allSales, error: salesErr } = await supabase
        .from('order_items')
        .select('branch_product_id, quantity, orders!inner(branch_id)')
        .eq('orders.branch_id', branch)

      if (salesErr) console.error("Sales Data Error:", salesErr)

      const lifetimeSoldMap = {}
      ;(allSales || []).forEach(item => {
        if (item.branch_product_id) {
          lifetimeSoldMap[item.branch_product_id] = (lifetimeSoldMap[item.branch_product_id] || 0) + Number(item.quantity || 0)
        }
      })

      // Fix applied: Added = Stock Balance + Lifetime Sold
      const formattedProducts = (bpData || []).map(p => {
        const sold = lifetimeSoldMap[p.id] || 0
        const stock = Number(p.stock_quantity) || 0
        const added = stock + sold // Guaranteed to show correct Total Added

        return {
          id: p.id,
          product_id: p.product_id,
          sku: p.products?.sku || 'N/A',
          name: p.products?.name || 'Unnamed',
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

      // Auto load report based on default dates
      generateMovementReport(formattedProducts, dateFrom, dateTo)

    } catch (err) {
      console.error(err)
      showToast('Error loading inventory data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Uses parameters to handle "Clear" functionality safely without waiting for React State
  const generateMovementReport = async (currentProducts = products, fromDate, toDate) => {
    setReportLoading(true)
    try {
      let salesQuery = supabase
        .from('order_items')
        .select('branch_product_id, quantity, created_at, orders!inner(branch_id)')
        .eq('orders.branch_id', branch)

      if (fromDate && fromDate !== '') {
        salesQuery = salesQuery.gte('created_at', `${fromDate}T00:00:00.000Z`)
      }
      if (toDate && toDate !== '') {
        salesQuery = salesQuery.lte('created_at', `${toDate}T23:59:59.999Z`)
      }

      const { data: orderItemsData, error: salesErr } = await salesQuery
      if (salesErr) console.error("Report Sales Query Error:", salesErr)

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

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          price: p.price,
          cost: p.cost,
          added: added,
          sold: sold,
          balance: balance
        }
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

  // FIXED CLEAR BUTTON: Instantly clears dates AND removes items from table
  const handleClearDates = () => {
    setDateFrom('')
    setDateTo('')
    setMovements([]) // This line empties the report table completely
    setTotalSold(0)
    setTotalAdded(0)
    showToast('Report dates cleared', 'success')
  }

  // ================= ADD / EDIT / DELETE LOGIC =================
  const handleOpenAddModal = () => {
    setIsEditing(false)
    setFormData({
      sku: '', name: '', cost_price: '', selling_price: '', stock_quantity: '',
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
      sku: p.sku, name: p.name, 
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
    if(!formData.name || !formData.selling_price) {
      showToast('Name and Selling Price are required', 'error')
      return
    }

    try {
      if (isEditing) {
        await supabase.from('products').update({ sku: formData.sku, name: formData.name }).eq('id', currentProductId)
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
          sku: formData.sku || `SKU-${Date.now().toString().slice(-6)}`, 
          name: formData.name 
        }).select().single()

        if(prodErr) throw prodErr

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
    } catch(err) {
      showToast(err.message, 'error')
    }
  }

  const handleDelete = async (productId) => {
    if(!confirm("Are you sure you want to delete this product?")) return;
    try {
      await supabase.from('products').update({ deleted_at: new Date().toISOString() }).eq('id', productId)
      showToast('Product deleted successfully', 'success')
      loadInitialInventory()
    } catch(err) {
      showToast(err.message, 'error')
    }
  }

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async ({ target }) => {
      try {
        setLoading(true)
        const rows = target.result.split('\n').filter(r => r.trim());
        let importCount = 0;

        for (let i = 1; i < rows.length; i++) { 
          const cols = rows[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 5) continue;
          
          const [sku, name, cost, price, stock] = cols;

          const { data: newProd } = await supabase.from('products').insert({ sku, name }).select().single()
          if(newProd) {
            await supabase.from('branch_products').insert({
              product_id: newProd.id,
              branch_id: branch,
              cost_price: Number(cost) || 0,
              price: Number(price) || 0,
              stock_quantity: Number(stock) || 0
            })
            importCount++;
          }
        }
        showToast(`${importCount} products imported successfully!`, 'success')
        loadInitialInventory()
      } catch (err) {
        showToast('Error importing CSV: ' + err.message, 'error')
      } finally {
        setLoading(false)
        if(fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  // ================= 📊 DOUGHNUT CHART GENERATOR =================
  const generateChartBase64 = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600; 
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 300);

    const data = [
      { val: totalAdded, color: '#10B981', label: 'Total Added' },
      { val: totalSold, color: '#EF4444', label: 'Total Sold' },
      { val: totalBalance, color: '#3B82F6', label: 'Current Balance' }
    ];

    const total = totalAdded + totalSold + totalBalance || 1; 
    let startAngle = -Math.PI / 2;
    const cx = 150, cy = 150, radius = 100, innerRadius = 60;

    data.forEach(d => {
      const sliceAngle = (d.val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Stock Movement Summary', 320, 100);

    data.forEach((d, i) => {
      ctx.fillStyle = d.color;
      ctx.fillRect(320, 140 + (i * 35), 20, 20);
      ctx.fillStyle = '#475569';
      ctx.font = '16px Arial';
      ctx.fillText(`${d.label}: ${d.val} Units`, 355, 156 + (i * 35));
    });

    return canvas.toDataURL('image/png');
  }

  // ================= 📝 EXCEL EXPORT LOGIC =================
  const exportExcel = async () => {
    if (movements.length === 0) return showToast('No data to export.', 'error')
    
    setReportLoading(true)
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Stock Report');

      worksheet.columns = [
        { header: 'SKU', key: 'sku', width: 20 },
        { header: 'Item Name', key: 'name', width: 45 },
        { header: 'Added (+)', key: 'added', width: 15 },
        { header: 'Added Value', key: 'added_value', width: 20 },
        { header: 'Sold (-)', key: 'sold', width: 15 },
        { header: 'Sold Value', key: 'sold_value', width: 20 },
        { header: 'Current Balance', key: 'balance', width: 20 },
        { header: 'Stock Value', key: 'balance_value', width: 20 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      movements.forEach(m => {
        worksheet.addRow({
          sku: m.sku, 
          name: m.name, 
          added: m.added, 
          added_value: m.added * m.cost,
          sold: m.sold, 
          sold_value: m.sold * m.price,
          balance: m.balance,
          balance_value: m.balance * m.cost
        });
      });

      worksheet.eachRow((row, rowNumber) => {
        if(rowNumber > 1) {
          row.getCell('added').font = { color: { argb: 'FF10B981' }, bold: true }; 
          row.getCell('added_value').font = { color: { argb: 'FF10B981' } }; 
          row.getCell('sold').font = { color: { argb: 'FFEF4444' }, bold: true };
          row.getCell('sold_value').font = { color: { argb: 'FFEF4444' } };
          row.getCell('balance').font = { color: { argb: 'FF3B82F6' }, bold: true };
          row.getCell('balance_value').font = { color: { argb: 'FF3B82F6' } };
          row.alignment = { vertical: 'middle' };
        }
      });

      const base64Image = generateChartBase64();
      const imageId = workbook.addImage({ base64: base64Image, extension: 'png' });
      
      worksheet.addImage(imageId, {
        tl: { col: 8, row: 1 }, 
        ext: { width: 500, height: 250 } 
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Stock_Movement_${dateFrom || 'All'}_to_${dateTo || 'All'}.xlsx`);
      showToast('Excel report generated beautifully!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Failed to export Excel', 'error')
    } finally {
      setReportLoading(false)
    }
  }

  const metrics = [
    { label: 'Total Stock Balance', value: totalBalance.toLocaleString(), icon: '📦' },
    { label: 'Period Stock Sold', value: totalSold.toLocaleString(), icon: '🛍️' },
    { label: 'Period Stock Added', value: totalAdded.toLocaleString(), icon: '📥' },
    { label: 'Fast Moving Items', value: fastMovingList.length, icon: '🔥' }
  ]

  return (
    <PageTemplate
      title="📦 Inventory & Stock Movement"
      subtitle="Monitor stock balance, analyze fast-moving products, and track movements"
      metrics={metrics}
    >
      <div className="space-y-6 pb-10">

        {/* HIGHLIGHTED FAST MOVING PRODUCTS */}
        {fastMovingList.length > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-5 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔥</span>
              <h3 className="font-extrabold text-orange-900 dark:text-orange-300 text-base">
                Fast Moving Products (Highest Lifetime Demand)
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {fastMovingList.map((item, idx) => (
                <div key={item.id} className="bg-white dark:bg-gray-800 p-3.5 rounded-lg border border-orange-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-2 py-0.5 rounded-full uppercase">
                        Rank #{idx + 1}
                      </span>
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

        {/* MAIN PRODUCTS INVENTORY TABLE */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
            <h3 className="font-bold text-gray-800 dark:text-white text-base">Current Product Stock Overview</h3>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} className="hidden" />
              
              <button onClick={() => fileInputRef.current.click()} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition flex items-center gap-1.5 border border-gray-300 dark:border-gray-600">
                <FiUpload size={14} /> Import CSV
              </button>
              
              <button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold shadow transition flex items-center gap-1.5">
                <FiPlus size={16} /> Add Product
              </button>

              <input
                type="text"
                placeholder="🔍 Search SKU or Name..."
                className="w-full sm:w-56 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[500px] custom-scrollbar border border-gray-100 dark:border-gray-700 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[1050px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 shadow-sm z-10">
                <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3 border-b dark:border-gray-600">SKU</th>
                  <th className="p-3 border-b dark:border-gray-600">Item Name</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right">Cost Price</th>
                  <th className="p-3 border-b dark:border-gray-600 text-right">Selling Price</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-green-600 bg-green-50/50 dark:bg-green-900/10">Added (+) & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-red-600 bg-red-50/50 dark:bg-red-900/10">Sold (-) & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">Balance & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {products
                  .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()))
                  .map(p => {
                    const isHot = fastMovingList.some(fm => fm.id === p.id);
                    return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 font-mono text-xs text-gray-500">{p.sku}</td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white max-w-[200px] truncate" title={p.name}>
                        {p.name}
                        {isHot && <span className="ml-2 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold border border-orange-200">🔥 HOT</span>}
                      </td>
                      <td className="p-3 text-right text-gray-600 dark:text-gray-400">{currency}{p.cost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="p-3 text-right font-bold text-gray-800 dark:text-white">{currency}{p.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      
                      <td className="p-3 text-center bg-green-50/30 dark:bg-green-900/10">
                        <div className="font-bold text-green-600">{p.lifetimeAdded > 0 ? `+${p.lifetimeAdded}` : '0'}</div>
                        {p.lifetimeAdded > 0 && <div className="text-[10px] text-green-700/70 dark:text-green-400/70 mt-0.5">{currency}{(p.lifetimeAdded * p.cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </td>
                      
                      <td className="p-3 text-center bg-red-50/30 dark:bg-red-900/10">
                        <div className="font-bold text-red-500">{p.lifetimeSold > 0 ? `-${p.lifetimeSold}` : '0'}</div>
                        {p.lifetimeSold > 0 && <div className="text-[10px] text-red-700/70 dark:text-red-400/70 mt-0.5">{currency}{(p.lifetimeSold * p.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </td>
                      
                      <td className="p-3 text-center bg-blue-50/30 dark:bg-blue-900/10">
                        <div className="font-extrabold text-blue-700 dark:text-blue-400">{p.stock}</div>
                        {p.stock > 0 && <div className="text-[10px] text-blue-700/70 dark:text-blue-400/70 mt-0.5">{currency}{(p.stock * p.cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleEdit(p)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-md transition"><FiEdit size={14}/></button>
                          <button onClick={() => handleDelete(p.product_id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 rounded-md transition"><FiTrash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
        </div>

        {/* 📈 STOCK MOVEMENT REPORT SECTION */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-5 border-b pb-4 dark:border-gray-700">
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white text-base flex items-center gap-2">
                📈 Stock Movement Report
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Filter by date range, track values and export beautifully</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">From:</span>
                <input
                  type="date"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-gray-500">To:</span>
                <input
                  type="date"
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-blue-500"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>

              <button 
                onClick={() => generateMovementReport(products, dateFrom, dateTo)} 
                disabled={reportLoading} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                <FiRefreshCw className={reportLoading ? 'animate-spin' : ''} /> Load
              </button>

              <button 
                onClick={handleClearDates} 
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold px-3 py-1.5 rounded-lg transition text-xs shadow-sm flex items-center gap-1"
              >
                <FiX /> Clear
              </button>

              <button 
                onClick={exportExcel} 
                disabled={movements.length === 0} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg transition text-xs shadow-sm disabled:opacity-50 flex items-center gap-1"
              >
                <FiDownload size={14}/> Export Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar border border-gray-100 dark:border-gray-700 rounded-lg">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 shadow-sm z-10">
                <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-3 border-b dark:border-gray-600">SKU</th>
                  <th className="p-3 border-b dark:border-gray-600">Item Name</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-green-600 bg-green-50/50 dark:bg-green-900/10">Added (+) & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center text-red-600 bg-red-50/50 dark:bg-red-900/10">Sold (-) & Value</th>
                  <th className="p-3 border-b dark:border-gray-600 text-center font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">Balance & Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-400 font-medium">
                      No stock movement to display. Set a date range or Clear to view all.
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 font-mono text-xs text-gray-500">{m.sku}</td>
                      <td className="p-3 font-semibold text-gray-900 dark:text-white max-w-[250px] truncate" title={m.name}>{m.name}</td>
                      
                      <td className="p-3 text-center bg-green-50/30 dark:bg-green-900/10">
                        <div className="font-bold text-green-600">{m.added > 0 ? `+${m.added}` : '0'}</div>
                        {m.added > 0 && <div className="text-[10px] text-green-700/70 dark:text-green-400/70 mt-0.5">{currency}{(m.added * m.cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </td>
                      
                      <td className="p-3 text-center bg-red-50/30 dark:bg-red-900/10">
                        <div className="font-bold text-red-500">{m.sold > 0 ? `-${m.sold}` : '0'}</div>
                        {m.sold > 0 && <div className="text-[10px] text-red-700/70 dark:text-red-400/70 mt-0.5">{currency}{(m.sold * m.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </td>
                      
                      <td className="p-3 text-center bg-blue-50/30 dark:bg-blue-900/10">
                        <div className="font-extrabold text-gray-900 dark:text-white">{m.balance}</div>
                        {m.balance > 0 && <div className="text-[10px] text-blue-700/70 dark:text-blue-400/70 mt-0.5">{currency}{(m.balance * m.cost).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= ZOBAZE-STYLE ADVANCED MODAL ================= */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 sm:p-0 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform animate-scaleIn flex flex-col max-h-[90vh]">
              
              <div className="flex justify-between items-center p-4 bg-blue-600 text-white">
                <div className="flex items-center gap-2">
                  {isEditing ? <FiEdit size={18} /> : <FiPlus size={18} />}
                  <h3 className="font-bold tracking-wide">{isEditing ? 'MANAGE ITEM' : 'ADD NEW ITEM'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-blue-100 hover:text-white transition bg-blue-700 p-1.5 rounded-lg">
                  <FiX size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-5 space-y-5 custom-scrollbar bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0 relative shadow-sm">
                    <FiBox size={20} />
                    <div className="absolute -bottom-1 -right-1 bg-white text-blue-600 rounded-full p-1 shadow">
                      <FiEdit size={10} />
                    </div>
                  </div>
                  <div className="w-full space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Item Name *</label>
                      <input 
                        type="text" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full font-bold text-lg bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none pb-1 text-gray-900 dark:text-white focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase">SKU (Auto-generated if empty)</label>
                      <input 
                        type="text" 
                        value={formData.sku} 
                        onChange={e => setFormData({...formData, sku: e.target.value})}
                        className="w-full font-mono text-sm bg-transparent border-b border-gray-300 dark:border-gray-600 outline-none pb-1 text-gray-500 dark:text-gray-400 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Cost Price</label>
                    <input 
                      type="number" 
                      value={formData.cost_price} 
                      onChange={e => setFormData({...formData, cost_price: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Selling Price *</label>
                    <input 
                      type="number" 
                      value={formData.selling_price} 
                      onChange={e => setFormData({...formData, selling_price: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">Stock Available</label>
                    <input 
                      type="number" 
                      value={formData.stock_quantity} 
                      onChange={e => setFormData({...formData, stock_quantity: e.target.value})}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md px-3 py-2 font-bold outline-none focus:border-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <label className="text-xs font-semibold text-gray-500 mb-2 block text-center">Track Profit?</label>
                    <button onClick={() => toggleFeature('track_profit')} className="text-2xl text-blue-600 dark:text-blue-400">
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

                  <div className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleFeature('low_stock_alerts')}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded"><FiAlertCircle size={16} /></div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Low stock alerts?</span>
                    </div>
                    <div className="text-xl text-blue-600 dark:text-blue-400">{formData.low_stock_alerts ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}</div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleFeature('has_barcode')}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-mono font-bold tracking-widest">|||||</div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Barcode?</span>
                    </div>
                    <div className="text-xl text-blue-600 dark:text-blue-400">{formData.has_barcode ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}</div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleFeature('track_expiry')}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded"><FiAlertCircle size={16} /></div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Track Expiry?</span>
                    </div>
                    <div className="text-xl text-blue-600 dark:text-blue-400">{formData.track_expiry ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}</div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleFeature('add_tax')}>
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded text-[10px] font-black uppercase">TAX</div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Add Tax</span>
                    </div>
                    <div className="text-xl text-blue-600 dark:text-blue-400">{formData.add_tax ? <FiCheckSquare /> : <FiSquare className="text-gray-400" />}</div>
                  </div>
                </div>
              </div>

              <div className="flex p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 gap-3">
                {isEditing && (
                  <button 
                    onClick={() => handleDelete(currentProductId)}
                    className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition shadow-sm uppercase tracking-wide"
                  >
                    Delete
                  </button>
                )}
                <button 
                  onClick={handleSaveModal}
                  className="flex-[2] py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-md uppercase tracking-wide"
                >
                  {isEditing ? 'Save Changes' : 'Add Item'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageTemplate>
  )
}