'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useRouter } from 'next/navigation'
import PageTemplate from './PageTemplate';

export default function CustomerProfile({ customerId }) {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const router = useRouter()
  const [customer, setCustomer] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [orders, setOrders] = useState([])
  const [modeFilter, setModeFilter] = useState('all')
  const [viewItems, setViewItems] = useState(null)
  const [returnOrder, setReturnOrder] = useState(null)
  const [printModal, setPrintModal] = useState(false)
  const [printContent, setPrintContent] = useState('')
  const [loading, setLoading] = useState(true)

  // Analytics
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [avgBill, setAvgBill] = useState(0)
  const [lastVisit, setLastVisit] = useState(null)
  const [paymentSplit, setPaymentSplit] = useState({})

  useEffect(() => {
    if (!customerId) return

    // Load Customer Info
    supabase.from('customers').select('*').eq('id', customerId).single()
      .then(({ data }) => { if (data) setCustomer(data) })

    // Load Last Visit
    let orderQuery = supabase.from('orders').select('created_at').eq('customer_id', customerId)
    if (branch) orderQuery = orderQuery.eq('branch_id', branch)
    orderQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data: last }) => { if (last) setLastVisit(last.created_at) })

    loadTransactions()
    loadOrders()
    loadAnalytics()
  }, [customerId, branch, modeFilter])

  const loadTransactions = async () => {
    try {
      let query = supabase.from('credit_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      
      if (modeFilter !== 'all') query = query.eq('payment_mode', modeFilter)
      
      const { data, error } = await query
      if (!error) setTransactions(data || [])
    } catch (err) { 
      console.error(err) 
    }
  }

  const loadOrders = async () => {
    try {
      let query = supabase.from('orders')
        .select(`
          id, total, created_at, status, payment_method, 
          order_items(id, quantity, price, returned_quantity, branch_product_id)
        `)
        .eq('customer_id', customerId)

      if (branch) query = query.eq('branch_id', branch)

      const { data, error } = await query.order('created_at', { ascending: false })

      if (!error && data) {
        const formattedOrders = await Promise.all(data.map(async (ord) => {
          const enrichedItems = await Promise.all((ord.order_items || []).map(async (item) => {
            let productName = 'Unknown Item'
            if (item.branch_product_id) {
              const { data: bp } = await supabase
                .from('branch_products')
                .select('products(name)')
                .eq('id', item.branch_product_id)
                .maybeSingle()
              
              if (bp?.products?.name) productName = bp.products.name
            }
            return { ...item, name: productName }
          }))
          return { ...ord, order_items: enrichedItems }
        }))
        setOrders(formattedOrders)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      let query = supabase.from('orders').select('total, payment_method').eq('customer_id', customerId).eq('status', 'completed')
      if (branch) query = query.eq('branch_id', branch)
      
      const { data } = await query
      if (data) {
        const total = data.reduce((sum, o) => sum + o.total, 0)
        setTotalRevenue(total)
        setAvgBill(data.length > 0 ? (total / data.length).toFixed(2) : 0)

        const split = {}
        data.forEach(o => {
          const method = o.payment_method || 'cash'
          split[method] = (split[method] || 0) + o.total
        })
        setPaymentSplit(split)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const printOrder = (order) => {
    const itemsHtml = order.order_items.map(i =>
      `<div class="item"><span>${i.name} x${i.quantity}</span><span>Rs. ${(i.price * i.quantity).toFixed(2)}</span></div>`
    ).join('')

    const content = `
      <html><head><style>
        body { font-family: 'Courier New', monospace; width: 300px; margin:0 auto; padding:10px; }
        h4 { text-align:center; } hr { border:1px dashed #ccc; }
        .item { display:flex; justify-content:space-between; } .total { font-weight:bold; }
        @media print { body { width:80mm; } }
      </style></head>
      <body>
        <h4>Nishadi Motors</h4>
        <p style="text-align:center;font-size:12px;">Order #${order.id.slice(0,6)}</p>
        <p style="text-align:center;font-size:12px;">${new Date(order.created_at).toLocaleString()}</p>
        <hr>
        ${itemsHtml}
        <hr>
        <div class="item total"><span>Total</span><span>Rs. ${order.total.toFixed(2)}</span></div>
        <p style="text-align:center;font-size:12px;">Payment: ${order.payment_method}</p>
        <p style="text-align:center;font-size:12px;">Status: ${order.status}</p>
        <p style="text-align:center;margin-top:20px;font-size:10px;">System by Ceylon Digi Solutions</p>
      </body></html>
    `
    setPrintContent(content)
    setPrintModal(true)
  }

  const initiateReturn = (order) => {
    setReturnOrder({
      orderId: order.id,
      items: order.order_items.map(i => ({ ...i, returnQty: 0 })),
      reason: ''
    })
  }

  const processReturn = async () => {
    const { orderId, items, reason } = returnOrder
    let totalRefund = 0
    for (const item of items) {
      if (item.returnQty > 0) {
        totalRefund += item.returnQty * item.price
        await supabase.from('order_items').update({ returned_quantity: item.returned_quantity + item.returnQty }).eq('id', item.id)
        await supabase.rpc('decrement_stock', { bp_id: item.branch_product_id, qty: -item.returnQty })
      }
    }
    if (totalRefund > 0) {
      await supabase.from('orders').update({ status: 'returned' }).eq('id', orderId)
      await supabase.from('customers').update({ total_credit: customer.total_credit - totalRefund }).eq('id', customerId)
      await supabase.from('credit_transactions').insert({
        customer_id: customerId, branch_id: branch, amount: totalRefund,
        type: 'payment', note: reason ? `Return: ${reason}` : `Return for order #${orderId.slice(0,6)}`,
        payment_mode: 'return'
      })
      showToast(`Return processed! Refund: Rs. ${totalRefund}`, 'success')
      setCustomer(prev => ({ ...prev, total_credit: prev.total_credit - totalRefund }))
      loadTransactions()
      loadOrders()
      loadAnalytics()
    }
    setReturnOrder(null)
  }

  if (!customer) return <div className="p-4">Loading customer...</div>

  return (
    <div className="space-y-6 text-gray-900 dark:text-white">
      {/* Back + Customer Name */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/customers')} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">← Back</button>
        <div>
          <h2 className="text-2xl font-bold">{customer.name}</h2>
          <p className="text-sm opacity-70">📞 {customer.phone} {customer.address && `• 📍 ${customer.address}`}</p>
          {lastVisit && <p className="text-xs opacity-50">Last visit: {new Date(lastVisit).toLocaleDateString()}</p>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-blue-600 text-white rounded-xl p-4 shadow">
          <div className="text-sm text-blue-100">Total Credit</div>
          <div className="text-xl font-bold">Rs. {customer.total_credit?.toLocaleString() || 0}</div>
        </div>
        <div className="bg-green-600 text-white rounded-xl p-4 shadow">
          <div className="text-sm text-green-100">Total Revenue</div>
          <div className="text-xl font-bold">Rs. {totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-purple-600 text-white rounded-xl p-4 shadow">
          <div className="text-sm text-purple-100">Avg. Bill</div>
          <div className="text-xl font-bold">Rs. {avgBill}</div>
        </div>
        <div className="bg-orange-500 text-white rounded-xl p-4 shadow">
          <div className="text-sm text-orange-100">Orders</div>
          <div className="text-xl font-bold">{orders.length}</div>
        </div>
        <div className="bg-teal-600 text-white rounded-xl p-4 shadow">
          <div className="text-sm text-teal-100">Payment Modes</div>
          <div className="text-xs space-y-1 mt-1">
            {Object.entries(paymentSplit).map(([method, amount]) => (
              <div key={method} className="flex justify-between capitalize">
                <span>{method}</span><span>Rs. {amount.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(paymentSplit).length === 0 && <span>No data</span>}
          </div>
        </div>
      </div>

      {/* Transaction Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'credit', 'cash', 'return'].map(mode => (
          <button key={mode} onClick={() => setModeFilter(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
              modeFilter === mode ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}>{mode}</button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 uppercase">
              <th className="p-3">Date</th>
              <th className="p-3">Type</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Mode</th>
              <th className="p-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr> : transactions.length === 0 ? <tr><td colSpan={5} className="p-4 text-center opacity-50">No transactions found</td></tr> : transactions.map(t => (
              <tr key={t.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <td className="p-3 text-sm">{new Date(t.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'purchase' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{t.type}</span></td>
                <td className="p-3 text-sm font-semibold">Rs. {t.amount?.toLocaleString()}</td>
                <td className="p-3 text-sm capitalize">{t.payment_mode}</td>
                <td className="p-3 text-sm opacity-70">{t.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Orders Table */}
      <h3 className="text-xl font-bold mt-6">Orders</h3>
      {orders.length === 0 ? (
        <div className="text-center py-4 opacity-50">No orders yet</div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 uppercase">
                <th className="p-3">Order #</th>
                <th className="p-3">Date</th>
                <th className="p-3">Items</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="p-3 text-sm font-mono">#{order.id.slice(0,6)}</td>
                  <td className="p-3 text-sm">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-3 text-sm">
                    <button
                      onClick={() => setViewItems(order.order_items)}
                      className="text-blue-600 dark:text-blue-400 underline text-xs hover:no-underline"
                    >
                      {order.order_items.length} item(s)
                    </button>
                  </td>
                  <td className="p-3 text-sm text-right font-semibold">Rs. {order.total.toFixed(2)}</td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      order.status === 'returned' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>{order.status}</span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => printOrder(order)} className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition">🖨️</button>
                      {order.status !== 'returned' && (
                        <button onClick={() => initiateReturn(order)} className="px-2 py-1 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded hover:bg-orange-200 transition">↩️</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* View Items Modal */}
      {viewItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewItems(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-11/12 max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Order Items</h3>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {viewItems.map((item, idx) => (
                <li key={idx} className="flex justify-between py-2 text-sm">
                  <span className="truncate pr-2">{item.name} x{item.quantity}</span>
                  <span className="font-semibold whitespace-nowrap">Rs. {(item.price * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => setViewItems(null)} className="mt-4 w-full py-2 bg-gray-200 dark:bg-gray-700 rounded-lg font-bold transition hover:bg-gray-300 dark:hover:bg-gray-600">Close</button>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg">
            <h3 className="font-bold text-lg mb-4">Return Items (Order #{returnOrder.orderId.slice(0,6)})</h3>
            <textarea className="w-full border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded p-2 mb-3 text-sm" placeholder="Reason for return (optional)" value={returnOrder.reason} onChange={e => setReturnOrder({ ...returnOrder, reason: e.target.value })} />
            {returnOrder.items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3 mb-2">
                <span className="flex-1 text-sm truncate">{item.name} (Sold: {item.quantity}, Returned: {item.returned_quantity})</span>
                <input type="number" min={0} max={item.quantity - item.returned_quantity} value={item.returnQty} onChange={e => { const newItems = [...returnOrder.items]; newItems[idx].returnQty = Math.min(item.quantity - item.returned_quantity, Math.max(0, Number(e.target.value))); setReturnOrder({ ...returnOrder, items: newItems }) }} className="w-20 border dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded px-2 py-1 text-sm text-center" />
              </div>
            ))}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={processReturn} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition">Confirm Return</button>
              <button onClick={() => setReturnOrder(null)} className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {printModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPrintModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-11/12 max-w-md p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-2"><h3 className="font-bold">Print Order</h3><button onClick={() => { const iframe = document.getElementById('printFrame'); if (iframe) iframe.contentWindow.print() }} className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition">Print</button></div>
            <iframe id="printFrame" srcDoc={printContent} className="w-full h-96 bg-white rounded border border-gray-200" title="Receipt Preview" />
          </div>
        </div>
      )}
    </div>
  )
}