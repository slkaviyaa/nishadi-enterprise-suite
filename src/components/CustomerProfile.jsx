'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useRouter } from 'next/navigation'
import PageTemplate from './PageTemplate'

import { Capacitor } from '@capacitor/core';
import { printNativeBluetooth } from '../utils/printerUtils';

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
  const [loading, setLoading] = useState(true)
  const [billSettings, setBillSettings] = useState({})

  const [totalRevenue, setTotalRevenue] = useState(0)
  const [avgBill, setAvgBill] = useState(0)
  const [lastVisit, setLastVisit] = useState(null)
  const [paymentSplit, setPaymentSplit] = useState({})

  useEffect(() => {
    if (!customerId) return

    supabase.from('customers').select('*').eq('id', customerId).single()
      .then(({ data }) => { if (data) setCustomer(data) })

    let orderQuery = supabase.from('orders').select('created_at').eq('customer_id', customerId)
    if (branch) orderQuery = orderQuery.eq('branch_id', branch)
    orderQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data: last }) => { if (last) setLastVisit(last.created_at) })

    if (branch) {
      supabase.from('bill_settings').select('*').eq('branch_id', branch).maybeSingle()
        .then(({ data }) => { if (data) setBillSettings(data) })
    }

    loadTransactions()
    loadOrders()
    loadAnalytics()
  }, [customerId, branch, modeFilter])

  // 🔁 FIXED: Avoid duplicate credit sales in transactions
  const loadTransactions = async () => {
    try {
      // Credit transactions fetch (purchases, payments, returns)
      let creditQuery = supabase.from('credit_transactions')
        .select('*')
        .eq('customer_id', customerId)
      if (branch) creditQuery = creditQuery.eq('branch_id', branch)
      if (modeFilter !== 'all') creditQuery = creditQuery.eq('payment_mode', modeFilter)
      const { data: creditTrans, error: creditErr } = await creditQuery
      if (creditErr) console.error(creditErr)

      // Orders as transactions (sales)
      let orderQuery = supabase.from('orders')
        .select('id, total, created_at, payment_method, status')
        .eq('customer_id', customerId)
      if (branch) orderQuery = orderQuery.eq('branch_id', branch)
      
      if (modeFilter !== 'all') {
        if (modeFilter === 'return') {
          // No orders for return filter
          orderQuery = orderQuery.eq('id', '00000000-0000-0000-0000-000000000000')
        } else if (modeFilter === 'credit') {
          // No orders for credit filter (credit sales already in credit_transactions)
          orderQuery = orderQuery.eq('id', '00000000-0000-0000-0000-000000000000')
        } else {
          orderQuery = orderQuery.eq('payment_method', modeFilter)
        }
      } else {
        // For 'all': exclude credit orders to avoid duplication with credit_transactions
        orderQuery = orderQuery.neq('payment_method', 'credit')
      }

      const { data: ordersData, error: orderErr } = await orderQuery
      if (orderErr) console.error(orderErr)

      const orderTransactions = (ordersData || []).map(o => ({
        id: o.id,
        created_at: o.created_at,
        type: 'sale',
        amount: o.total,
        payment_mode: o.payment_method,
        note: `Order #${o.id.slice(0,6)}`,
        isOrder: true
      }))

      const creditTransFormatted = (creditTrans || []).map(t => ({
        id: t.id,
        created_at: t.created_at,
        type: t.type,
        amount: t.amount,
        payment_mode: t.payment_mode,
        note: t.note,
        isOrder: false
      }))

      const allTransactions = [...orderTransactions, ...creditTransFormatted]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      setTransactions(allTransactions)
    } catch (err) {
      console.error(err)
    }
  }

  const loadOrders = async () => {
    try {
      let query = supabase.from('orders')
        .select(`id, total, discount, created_at, status, payment_method, order_items(id, quantity, price, returned_quantity, branch_product_id)`)
        .eq('customer_id', customerId)

      if (branch) query = query.eq('branch_id', branch)

      const { data, error } = await query.order('created_at', { ascending: false })

      if (!error && data) {
        const formattedOrders = await Promise.all(data.map(async (ord) => {
          const enrichedItems = await Promise.all((ord.order_items || []).map(async (item) => {
            let productName = 'Unknown Item'
            if (item.branch_product_id) {
              const { data: bp } = await supabase.from('branch_products').select('products(name)').eq('id', item.branch_product_id).maybeSingle()
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
      let query = supabase.from('orders')
        .select('id, total, payment_method, status, order_items(quantity, returned_quantity, price)')
        .eq('customer_id', customerId)
        .in('status', ['completed', 'partially_returned'])
      if (branch) query = query.eq('branch_id', branch)

      const { data } = await query
      if (data) {
        let totalRevenue = 0
        const split = {}

        data.forEach(order => {
          let orderRevenue = 0
          ;(order.order_items || []).forEach(item => {
            const effectiveQty = Math.max(0, item.quantity - (item.returned_quantity || 0))
            orderRevenue += (item.price || 0) * effectiveQty
          })

          totalRevenue += orderRevenue

          const method = order.payment_method || 'cash'
          split[method] = (split[method] || 0) + orderRevenue
        })

        setTotalRevenue(totalRevenue)
        setAvgBill(data.length > 0 ? (totalRevenue / data.length).toFixed(2) : 0)
        setPaymentSplit(split)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // 🖨️ POS-style receipt printing (table layout, same font scaling)
  const printOrder = (order) => {
    const s = billSettings || {};
    const currency = 'Rs. ';
    const is58 = s.paper_size === '58mm';
    const printableWidthPx = is58 ? 384 : 576;

    const fontGreeting = (s.font_size_greeting || 14) * (is58 ? 1.5 : 2.2)
    const fontHeader = (s.font_size_header || 20) * (is58 ? 1.6 : 3.0)
    const fontContact = (s.font_size_contact || 12) * (is58 ? 1.3 : 2.0)
    const fontBody = (s.font_size_body || 12) * (is58 ? 1.4 : 2.2)
    const fontTotal = (s.font_size_total || 15) * (is58 ? 1.6 : 2.6)
    const fontFooter = (s.font_size_footer || 12) * (is58 ? 1.3 : 2.2)
    const fontWatermark = (s.font_size_watermark || 9) * (is58 ? 1.1 : 1.8)

    const validItems = order.order_items || [];
    const returnedItems = validItems.filter(i => i.returned_quantity > 0);
    const billSubtotal = validItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const billDiscount = order.discount || (billSubtotal - order.total);
    const totalRefund = returnedItems.reduce((sum, i) => sum + (i.price * i.returned_quantity), 0);
    const receiptId = order.id.slice(0,6).toUpperCase();
    const receiptDate = new Date(order.created_at).toLocaleString();
    const custName = customer?.name || '';
    const custPhone = customer?.phone || '';
    const totalQty = validItems.reduce((sum, i) => sum + i.quantity, 0);
    const billTotal = order.total;
    const paymentMethod = order.payment_method || 'CASH';

    // Build item rows HTML
    const itemsRowsHTML = validItems.map(item => `
      <tr>
        <td colspan="4" style="font-weight:800; padding:2px 0;">${item.name}</td>
      </tr>
      <tr>
        <td style="width:30%; text-align:left;">${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="width:25%; text-align:right;">${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="width:15%; text-align:center;">${item.quantity}</td>
        <td style="width:30%; text-align:right; font-weight:800;">${Number(item.price * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('')

    const returnedRowsHTML = returnedItems.map(item => `
      <tr>
        <td colspan="2" style="text-align:left;">${item.name}</td>
        <td style="width:20%; text-align:center;">${item.returned_quantity}</td>
        <td style="width:30%; text-align:right; font-weight:800;">-${Number(item.price * item.returned_quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `).join('')

    const receiptHTML = `
      <div style="
        width: 100%;
        max-width: ${printableWidthPx}px;
        margin: 0 auto;
        text-align: center;
        box-sizing: border-box;
        padding-top: ${s.margin_top !== undefined ? s.margin_top : 10}px;
        padding-bottom: ${s.margin_bottom !== undefined ? s.margin_bottom : 10}px;
        padding-left: ${s.margin_left !== undefined ? s.margin_left : 10}px;
        padding-right: ${s.margin_right !== undefined ? s.margin_right : 10}px;
        color: #000000;
        background-color: #ffffff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: ${fontBody}px;
        line-height: 1.35;
      ">
        ${s.show_logo !== false && s.logo_url ? `
          <div style="text-align: center; margin-bottom: 8px;">
            <img src="${s.logo_url}" style="width: ${(s.logo_size || 60) * 1.8}px; height: auto; filter: grayscale(100%) contrast(150%); display: inline-block;" />
          </div>` : ''}
        
        ${s.show_greeting !== false ? `<div style="text-align: center; font-size: ${fontGreeting}px; font-weight: bold; margin-bottom: 4px;">${s.greeting_text || 'ආයුබෝවන්'}</div>` : ''}
        ${s.show_header !== false ? `<div style="text-align: center; font-size: ${fontHeader}px; font-weight: 900; margin-bottom: 4px; text-transform: uppercase;">${s.header_text || 'SHOP NAME'}</div>` : ''}
        ${s.show_contact !== false ? `<div style="text-align: center; font-size: ${fontContact}px; margin-bottom: 8px; white-space: pre-wrap;">${s.contact_info || 'Address\\nPhone'}</div>` : ''}
        ${s.show_tax_no !== false && s.tax_number ? `<div style="text-align: center; font-size: ${fontContact}px; margin-bottom: 6px; font-weight: bold;">VAT/TAX: ${s.tax_number}</div>` : ''}

        <div style="margin-top: 8px;"></div>

        ${(s.show_bill_no !== false || s.show_date_time !== false) ? `
        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: ${fontBody}px; margin-bottom: 4px;">
          ${s.show_bill_no !== false ? `<div>${s.bill_number_prefix || 'Bill '}${receiptId}</div>` : '<div></div>'}
          ${s.show_date_time !== false ? `<div>${receiptDate}</div>` : ''}
        </div>` : ''}

        ${s.show_customer_info !== false && custName ? `
        <div style="margin-top: 2px; font-size: ${fontBody}px; font-weight: 600;">
          <div>Customer : "${custName}"</div>
          ${custPhone ? `<div>Phone: ${custPhone}</div>` : ''}
        </div>` : ''}

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        ${s.show_table_headers !== false ? `
        <table style="width:100%; border-collapse: collapse; table-layout: fixed; font-size: ${fontBody}px;">
          <thead>
            <tr>
              <th style="width:30%; text-align:left; font-weight:900; padding:2px 0;">උපරිම<br/>සිල්ලර<br/>මිල</th>
              <th style="width:25%; text-align:right; font-weight:900; padding:2px 0;">Rate</th>
              <th style="width:15%; text-align:center; font-weight:900; padding:2px 0;">Qty</th>
              <th style="width:30%; text-align:right; font-weight:900; padding:2px 0;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHTML}
          </tbody>
        </table>
        ` : `
        <table style="width:100%; border-collapse: collapse; table-layout: fixed; font-size: ${fontBody}px;">
          <tbody>
            ${itemsRowsHTML}
          </tbody>
        </table>
        `}

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        ${s.show_total_items !== false ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; font-weight: 600; margin-top: 4px;">
          <span>Total Items</span>
          <span>${totalQty}</span>
        </div>` : ''}

        ${s.show_subtotal !== false ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 3px;">
          <span>Subtotal</span>
          <span>${Number(billSubtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        ${billDiscount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 2px;">
          <span>Discount</span>
          <span>-${Number(billDiscount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>` : ''}
        ` : ''}

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontTotal}px; font-weight: 900; margin: 6px 0;">
          <span>Total Amount</span>
          <span>${currency}${Number(billTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 4px;">
          <span>Amount Received</span>
          <span>${Number(billTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        ${s.show_payment_details !== false ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 3px;">
          <span>Payment Details</span>
          <span>${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span>
        </div>` : ''}

        <div style="border-bottom: 2px dashed #000; margin-top: 8px;"></div>

        ${returnedItems.length > 0 ? `
        <div style="text-align: center; font-size: ${fontBody}px; font-weight: bold; margin-top: 10px;">--- RETURNED ITEMS ---</div>
        <table style="width:100%; border-collapse: collapse; table-layout: fixed; font-size: ${fontBody}px;">
          <thead>
            <tr>
              <th style="width:35%; text-align:left;">Item</th>
              <th style="width:25%; text-align:left;"></th>
              <th style="width:20%; text-align:center;">R.Qty</th>
              <th style="width:20%; text-align:right;">Refund</th>
            </tr>
          </thead>
          <tbody>
            ${returnedRowsHTML}
          </tbody>
        </table>
        <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 4px;">
          <span>Total Refund:</span>
          <span>-${currency}${Number(totalRefund).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>
        ` : ''}
        
        ${s.show_dynamic_qr !== false ? `
        <div style="text-align: center; margin: 10px 0;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${s.header_text || 'Shop'}\nBill: ${s.bill_number_prefix || 'INV-'}${receiptId}\nTotal: Rs.${billTotal.toFixed(2)}`)}" style="width: ${(s.qr_size || 80) * 1.6}px; height: ${(s.qr_size || 80) * 1.6}px; filter: contrast(150%); display: inline-block;" />
          <div style="font-size: ${fontWatermark}px; margin-top: 3px; font-weight: bold;">Scan for Details</div>
        </div>` : ''}

        ${s.show_footer !== false ? `
        <div style="text-align: center; font-size: ${fontFooter}px; margin-top: 10px; font-weight: 700;">
          <div>${s.footer_text || 'Thank You! Come Again...'}</div>
          <div>${s.footer_text_sinhala || 'ස්තුතියි! නැවත එන්න...'}</div>
        </div>` : ''}
        
        <div style="border-bottom: 1px dotted #000; margin-top: 12px;"></div>

        ${s.show_watermark !== false ? `
        <div style="text-align: center; font-size: ${fontWatermark}px; margin-top: 8px; color: #444;">
          <div>Powered by Nishadi Enterprise Suite.</div>
          <div>Design & Developed by Ceylon Digi Solutions</div>
        </div>` : ''}
      </div>
    `;
    
    if (Capacitor.isNativePlatform()) {
      showToast('Printing bill via Bluetooth...', 'info');
      printNativeBluetooth(receiptHTML, s.paper_size || '80mm')
        .then((msg) => showToast(msg, 'success'))
        .catch((err) => showToast(err, 'error'));
    } else {
      const iframeId = 'receipt-iframe-' + Date.now();
      const existingIframe = document.getElementById(iframeId);
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = iframeId;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><style>@media print { @page { margin: 0; size: ${s.paper_size || '80mm'} auto; } body { margin: 0; padding: 0; } }</style></head><body>${receiptHTML}</body></html>`);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => { 
          if (document.body.contains(iframe)) document.body.removeChild(iframe); 
        }, 1500);
      }, 400);
    }
  }

  // ✨ FIXED: Discount proportion in return calculation
  const processReturn = async () => {
    const { orderId, items, reason } = returnOrder
    let totalRefund = 0
    let allItemsReturned = true

    // Fetch original order to get payment method and total
    const { data: originalOrder } = await supabase
      .from('orders')
      .select('payment_method, total, discount')
      .eq('id', orderId)
      .single()

    // Calculate bill subtotal (sum of item price * quantity) from order_items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('id, price, quantity, returned_quantity')
      .eq('order_id', orderId)

    const billSubtotal = (orderItems || []).reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const orderTotal = originalOrder?.total || billSubtotal
    const discountRatio = billSubtotal > 0 ? (orderTotal / billSubtotal) : 1

    for (const item of items) {
      const newReturnedQty = item.returned_quantity + item.returnQty
      
      if (newReturnedQty < item.quantity) {
        allItemsReturned = false
      }

      if (item.returnQty > 0) {
        // Refund = item price * returnQty * discountRatio (proportional discount)
        const refundForItem = item.price * item.returnQty * discountRatio
        totalRefund += refundForItem
        await supabase.from('order_items').update({ returned_quantity: newReturnedQty }).eq('id', item.id)
        await supabase.rpc('decrement_stock', { bp_id: item.branch_product_id, qty: -item.returnQty })
      }
    }

    if (totalRefund > 0) {
      const newStatus = allItemsReturned ? 'returned' : 'partially_returned'
      await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)

      // Credit return: reduce customer's total_credit
      if (originalOrder?.payment_method === 'credit') {
        const currentCredit = customer?.total_credit || 0
        await supabase.from('customers').update({ total_credit: currentCredit - totalRefund }).eq('id', customerId)
        setCustomer(prev => ({ ...prev, total_credit: prev.total_credit - totalRefund }))
      }

      // Record return transaction
      await supabase.from('credit_transactions').insert({
        customer_id: customerId,
        branch_id: branch,
        amount: totalRefund,
        type: 'return',
        note: reason ? `Return: ${reason}` : `Return for order #${orderId.slice(0,6)}`,
        payment_mode: 'return'
      })

      showToast(`Return processed! Refund: Rs. ${totalRefund.toFixed(2)}`, 'success')
      loadTransactions()
      loadOrders()
      loadAnalytics()
    }
    setReturnOrder(null)
  }

  if (!customer) return <PageTemplate><div className="p-4">Loading customer...</div></PageTemplate>

  return (
    <PageTemplate>
      <div className="space-y-6 text-gray-900 dark:text-white">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/customers')} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition">← Back</button>
          <div>
            <h2 className="text-2xl font-bold">{customer.name}</h2>
            <p className="text-sm opacity-70">📞 {customer.phone} {customer.address && `• 📍 ${customer.address}`}</p>
            {lastVisit && <p className="text-xs opacity-50">Last visit: {new Date(lastVisit).toLocaleDateString()}</p>}
          </div>
        </div>

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

        <div className="flex gap-2 flex-wrap">
          {['all', 'credit', 'cash', 'return'].map(mode => (
            <button key={mode} onClick={() => setModeFilter(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                modeFilter === mode ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}>{mode}</button>
          ))}
        </div>

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
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                      t.type === 'sale' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      t.type === 'return' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                      t.type === 'purchase' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    }`}>{t.type}</span>
                  </td>
                  <td className="p-3 text-sm font-semibold">Rs. {t.amount?.toLocaleString()}</td>
                  <td className="p-3 text-sm capitalize">{t.payment_mode}</td>
                  <td className="p-3 text-sm opacity-70">{t.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        order.status === 'partially_returned' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        order.status === 'returned' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>{order.status.replace('_', ' ')}</span>
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
      </div>
    </PageTemplate>
  )
}