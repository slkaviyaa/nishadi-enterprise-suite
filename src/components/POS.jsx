'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { Html5Qrcode } from 'html5-qrcode'
import { BsUpcScan, BsWhatsapp } from 'react-icons/bs'
import { FiEdit3, FiTrash2, FiPlus, FiMinus, FiX, FiUserCheck, FiUpload } from 'react-icons/fi'
import jsPDF from 'jspdf'

// Tax system (parallel branch) ID
const PARALLEL_BRANCH_ID = '22222222-2222-2222-2222-222222222222';

export default function POS() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const { showToast } = useToast()
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState(0)
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [holdOrders, setHoldOrders] = useState([])
  const [scanner, setScanner] = useState(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [newCustomerForm, setNewCustomerForm] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [creditDueDate, setCreditDueDate] = useState('')
  const [printModal, setPrintModal] = useState(false)
  const [printContent, setPrintContent] = useState('')
  const [lastBill, setLastBill] = useState(null)
  const iframeRef = useRef(null)

  // Edit Item Modal States
  const [selectedCartItem, setSelectedCartItem] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editPrice, setEditPrice] = useState(0)
  const [editQty, setEditQty] = useState(1)
  const [applyOffer, setApplyOffer] = useState(true)

  // Customer search & Fallback Contact Modal
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerModal, setCustomerModal] = useState(false)
  const customerDropdownRef = useRef(null)

  // Mobile view state
  const [mobileView, setMobileView] = useState('products')
  const [isMobile, setIsMobile] = useState(false)

  const currency = settings?.currency_symbol || 'Rs. '
  const taxEnabled = settings?.tax_enabled || false
  const taxRate = settings?.tax_rate || 0
  const billHeader = settings?.bill_header || 'Nishadi Motors'
  const billFooter = settings?.bill_footer || 'Thank you!'
  const scanRef = useRef(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (!branch) return
    supabase.from('branch_products')
      .select('id, price, stock_quantity, products(sku, name, prevent_out_of_stock_sale, auto_update_stock)')
      .eq('branch_id', branch)
      .then(({ data, error }) => {
        if (error) { showToast('Failed to load products', 'error'); return }
        if (data) setProducts(data.map(p => ({
          id: p.id, 
          sku: p.products?.sku, 
          name: p.products?.name,
          price: p.price, 
          stock: p.stock_quantity,
          preventOutOfStock: p.products?.prevent_out_of_stock_sale ?? false,
          autoUpdateStock: p.products?.auto_update_stock ?? true
        })))
      })
    supabase.from('customers').select('*').eq('branch_id', branch).then(({ data }) => setCustomers(data || []))
    supabase.from('orders').select('id, total, hold_note, created_at')
      .eq('branch_id', branch).eq('status', 'hold')
      .order('created_at', { ascending: false })
      .then(({ data }) => setHoldOrders(data || []))
  }, [branch])

  useEffect(() => {
    const handler = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ====== CART QUANTITY & OUT OF STOCK LOGIC ======
  const updateCartQty = (id, newQty) => {
    if (newQty < 1) return
    const item = cart.find(i => i.id === id)
    
    if (item && item.preventOutOfStock && newQty > item.stock) {
      showToast(`Cannot set quantity to ${newQty}. Stock limit is ${item.stock}!`, 'error')
      return
    }
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: newQty } : item))
  }

  const addToCart = (prod) => {
    const exist = cart.find(i => i.id === prod.id)
    const currentCartQty = exist ? exist.qty : 0

    if (prod.preventOutOfStock && currentCartQty + 1 > prod.stock) {
      showToast(`⚠️ Cannot add "${prod.name}". Out of stock! (Available: ${prod.stock})`, 'error')
      return
    }

    setCart(prev => {
      if (exist) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1, originalPrice: prod.price, applyOffer: true }]
    })
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

  // ====== EDIT CART ITEM MODAL HANDLERS ======
  const openEditModal = (item) => {
    setSelectedCartItem(item)
    setEditPrice(item.price)
    setEditQty(item.qty)
    setApplyOffer(item.applyOffer ?? true)
    setEditModalOpen(true)
  }

  const handleUpdateCartItem = () => {
    if (!selectedCartItem) return

    if (selectedCartItem.preventOutOfStock && editQty > selectedCartItem.stock) {
      showToast(`⚠️ Quantity exceeds stock limit (${selectedCartItem.stock})`, 'error')
      return
    }

    setCart(prev => prev.map(item => {
      if (item.id === selectedCartItem.id) {
        return {
          ...item,
          price: Number(editPrice),
          qty: Number(editQty),
          applyOffer: applyOffer
        }
      }
      return item
    }))
    setEditModalOpen(false)
    setSelectedCartItem(null)
    showToast('Item updated!')
  }

  // Calculate totals
  const subtotal = cart.reduce((s, i) => s + (i.applyOffer ? i.price : i.originalPrice) * i.qty, 0)
  const taxAmount = taxEnabled ? (subtotal * taxRate / 100) : 0
  const total = subtotal + taxAmount
  const final = total - discount
  const totalItemCount = cart.reduce((s, i) => s + i.qty, 0)

  // Customer search functions
  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return false
    const s = customerSearch.toLowerCase()
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(customerSearch)
  })

  const selectCustomerFromSearch = (cust) => {
    setSelectedCustomer(cust)
    setCustomerPhone(cust.phone || '')
    setCustomerSearch('')
    setShowCustomerDropdown(false)
    setCustomerModal(false)
  }

  const clearCustomer = () => { 
    setSelectedCustomer(null)
    setCustomerPhone('')
    setCustomerSearch('') 
  }

  const createNewCustomer = async () => {
    if (!newCustName || !customerPhone) { showToast('Name and Phone required', 'error'); return }

    const { data: c, error: mainErr } = await supabase.from('customers')
      .insert({ branch_id: branch, name: newCustName, phone: customerPhone, address: newCustAddress })
      .select().single()
    if (mainErr) { showToast('Failed to create customer', 'error'); return }

    try {
      const { data: existing } = await supabase.from('customers')
        .select('id')
        .eq('branch_id', PARALLEL_BRANCH_ID)
        .eq('phone', customerPhone)
        .maybeSingle()
      if (!existing) {
        await supabase.from('customers')
          .insert({ branch_id: PARALLEL_BRANCH_ID, name: newCustName, phone: customerPhone, address: newCustAddress })
      }
    } catch (err) {
      console.error('Parallel customer sync failed:', err)
    }

    setCustomers(prev => [...prev, c])
    setSelectedCustomer(c)
    const vCard = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\n${c.address ? 'ADR:;;' + c.address + ';;;;' : ''}\nEND:VCARD`
    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${c.name.replace(/\s/g, '_')}.vcf`; a.click()
    setNewCustName(''); setNewCustAddress(''); setNewCustomerForm(false)
    showToast('Customer created & synced!')
  }

  // SMART CONTACT PICKER (Native Permission Prompt on Android + Popup Modal on iOS/PC)
  const pickContact = async () => {
    if (typeof window !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      try {
        const contacts = await navigator.contacts.select(['tel', 'name'], { multiple: false })
        if (contacts?.length) {
          const phone = contacts[0].tel?.[0]?.replace(/[^\d+]/g, '') || ''
          const name = contacts[0].name?.[0] || ''
          if (phone) {
            const cust = customers.find(c => c.phone === phone || (c.phone && c.phone.endsWith(phone.slice(-9))))
            if (cust) {
              selectCustomerFromSearch(cust)
            } else {
              setCustomerPhone(phone)
              setNewCustName(name || 'Cust ' + phone.slice(-4))
              setNewCustomerForm(true)
            }
            return
          }
        }
      } catch (err) {
        console.log('Native contact selection fallback triggered:', err)
      }
    }
    // Popup fallback for iOS, PC, Mac and Unsupported Web View Browsers
    setCustomerModal(true)
  }

  // Parse uploaded .VCF Contact File (For iPhone / PC)
  const handleVcfUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target.result
      const nameMatch = content.match(/FN:(.+)/i)
      const telMatch = content.match(/TEL.*:(.+)/i)
      const name = nameMatch ? nameMatch[1].trim() : ''
      const phone = telMatch ? telMatch[1].replace(/[^\d+]/g, '').trim() : ''

      if (phone || name) {
        const cust = customers.find(c => c.phone === phone)
        if (cust) {
          selectCustomerFromSearch(cust)
        } else {
          setCustomerPhone(phone)
          setNewCustName(name || 'Cust ' + phone.slice(-4))
          setNewCustomerForm(true)
        }
        setCustomerModal(false)
        showToast('Contact loaded from VCF file!')
      } else {
        showToast('Could not read contact from VCF file', 'error')
      }
    }
    reader.readAsText(file)
  }

  const checkout = async (status = 'completed') => {
    if (cart.length === 0) return

    for (const item of cart) {
      if (item.preventOutOfStock) {
        const { data: bp } = await supabase.from('branch_products').select('stock_quantity').eq('id', item.id).single()
        if (!bp || bp.stock_quantity < item.qty) { 
          showToast(`Insufficient stock for ${item.name}`, 'error')
          return 
        }
      }
    }

    let cid = selectedCustomer?.id
    if (!cid && customerPhone) {
      const { data: nc } = await supabase.from('customers')
        .insert({ branch_id: branch, phone: customerPhone, name: 'Cust ' + customerPhone.slice(-4) })
        .select().single()
      if (nc) { cid = nc.id; setCustomers(prev => [...prev, nc]); setSelectedCustomer(nc) }
    }

    const { data: order, error: orderError } = await supabase.from('orders')
      .insert({
        branch_id: branch, total: final, discount, status,
        customer_id: cid || null, payment_method: paymentMethod,
        cheque_number: paymentMethod === 'cheque' ? chequeNumber : null,
        cheque_date: paymentMethod === 'cheque' ? chequeDate : null,
        bank_reference: paymentMethod === 'bank_transfer' ? bankReference : null
      }).select().single()

    if (orderError) { showToast('Order failed: ' + orderError.message, 'error'); return }

    if (order) {
      await supabase.from('order_items').insert(cart.map(i => ({
        order_id: order.id, branch_product_id: i.id, quantity: i.qty, price: i.price
      })))

      for (const item of cart) {
        if (item.autoUpdateStock !== false) {
          const { error: stockErr } = await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty })
          if (stockErr) console.error(`Stock update failed for ${item.name}: ${stockErr.message}`)
        }
      }

      if (status === 'completed') {
        try {
          await supabase.rpc('create_parallel_order', {
            main_order_id: order.id,
            target_branch_id: PARALLEL_BRANCH_ID
          });
        } catch (err) {
          console.error('Parallel order sync failed:', err);
          showToast('Bill cut but tax system sync failed', 'warning');
        }
      }

      if (selectedCustomer && paymentMethod === 'credit' && status === 'completed') {
        await supabase.from('credit_transactions').insert({
          customer_id: selectedCustomer.id, branch_id: branch, amount: final,
          type: 'purchase', due_date: creditDueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          payment_mode: 'credit'
        })
        await supabase.from('customers').update({ total_credit: selectedCustomer.total_credit + final }).eq('id', selectedCustomer.id)
      }

      setLastBill({ items: [...cart], total: final, paymentMethod, date: new Date().toLocaleString() })
      generatePrintContent()
      showToast('Bill Cut!')
      setCart([]); setDiscount(0); setSelectedCustomer(null); setCustomerPhone(''); setCustomerSearch('')
      setPaymentMethod('cash'); setChequeNumber(''); setChequeDate(''); setBankReference(''); setCreditDueDate('')
      
      if (status === 'hold') {
        supabase.from('orders').select('id, total, hold_note, created_at')
          .eq('branch_id', branch).eq('status', 'hold')
          .order('created_at', { ascending: false })
          .then(({ data }) => setHoldOrders(data || []))
      }
      if (isMobile) setMobileView('products')
    }
  }

  const loadHold = async (id) => {
    const { data } = await supabase.from('order_items')
      .select('branch_product_id, quantity, price, branch_products(products(name, prevent_out_of_stock_sale, auto_update_stock))')
      .eq('order_id', id)
    if (data) {
      setCart(data.map(i => ({
        id: i.branch_product_id, name: i.branch_products?.products?.name,
        price: i.price, originalPrice: i.price, qty: i.quantity,
        preventOutOfStock: i.branch_products?.products?.prevent_out_of_stock_sale ?? false,
        autoUpdateStock: i.branch_products?.products?.auto_update_stock ?? true
      })))
    }
  }

  const deleteHoldOrder = async (orderId) => {
    await supabase.from('orders').delete().eq('id', orderId)
    setHoldOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const startScanner = async () => {
    if (scanRef.current) { try { await scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    const html5QrCode = new Html5Qrcode("reader")
    scanRef.current = html5QrCode
    try {
      await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { const prod = products.find(p => p.sku === decodedText); if (prod) addToCart(prod); else showToast(`Not found: ${decodedText}`, 'error'); stopScanner() },
        () => {})
      setScanner(html5QrCode)
    } catch (err) { showToast('Camera permission required', 'error'); setScanner(null) }
  }

  const stopScanner = () => {
    if (scanRef.current) { try { scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    setScanner(null)
  }

  useEffect(() => {
    return () => { if (scanRef.current) { try { scanRef.current.stop() } catch(e) {} } }
  }, [])

  const generatePrintContent = () => {
    const items = lastBill ? lastBill.items : cart
    const tot = lastBill ? lastBill.total : final
    const pay = lastBill ? lastBill.paymentMethod : paymentMethod
    setPrintContent(`
      <html><head><style> body { font-family:monospace; width:300px; margin:0 auto; padding:10px; } h4{text-align:center;} hr{border:1px dashed #ccc;} .item{display:flex;justify-content:space-between;} .total{font-weight:bold;} @media print{ body{width:80mm;} }</style></head>
      <body><h4>${billHeader}</h4><p style="text-align:center;font-size:12px;">${new Date().toLocaleString()}</p><hr>
      ${items.map(i => `<div class="item"><span>${i.name} x${i.qty}</span><span>${currency}${(i.price*i.qty).toFixed(2)}</span></div>`).join('')}<hr>
      <div class="item"><span>Subtotal</span><span>${currency}${subtotal.toFixed(2)}</span></div>${taxEnabled ? `<div class="item"><span>Tax</span><span>${currency}${taxAmount.toFixed(2)}</span></div>` : ''}${discount>0 ? `<div class="item"><span>Discount</span><span>-${currency}${discount.toFixed(2)}</span></div>` : ''}
      <div class="item total"><span>Total</span><span>${currency}${tot.toFixed(2)}</span></div><p style="text-align:center;">Payment: ${pay}</p>${pay==='cheque' ? `<p>Cheque: ${chequeNumber} | Date: ${chequeDate}</p>` : ''}${pay==='bank_transfer' ? `<p>Ref: ${bankReference}</p>` : ''}<p style="text-align:center;">${billFooter}</p>
      <p style="text-align:center;font-size:10px;margin-top:5px;">Designed & Developed by Ceylon Digi Solutions</p>
      </body></html>
    `)
    setPrintModal(true)
  }

  const shareLastBill = async () => {
    if (!lastBill) return
    try {
      const doc = new jsPDF({ unit: 'mm', format: [80, 150] })
      doc.setFontSize(12); doc.text(billHeader, 10, 10)
      doc.setFontSize(8); doc.text(`Date: ${lastBill.date}`, 10, 16)
      doc.line(10, 18, 70, 18); let y = 22
      lastBill.items.forEach(i => { doc.text(`${i.name} x${i.qty} - ${currency}${(i.price*i.qty).toFixed(2)}`, 10, y); y += 4 })
      doc.line(10, y, 70, y); y += 4
      doc.text(`Subtotal: ${currency}${subtotal.toFixed(2)}`, 10, y); y += 4
      if (taxEnabled) { doc.text(`Tax (${taxRate}%): ${currency}${taxAmount.toFixed(2)}`, 10, y); y += 4 }
      if (discount > 0) { doc.text(`Discount: -${currency}${discount.toFixed(2)}`, 10, y); y += 4 }
      doc.setFontSize(10); doc.text(`Total: ${currency}${lastBill.total.toFixed(2)}`, 10, y); y += 5
      doc.setFontSize(8); doc.text(`Payment: ${lastBill.paymentMethod}`, 10, y); y += 5
      doc.text('Designed & Developed by Ceylon Digi Solutions', 10, y)

      const pdfBlob = doc.output('blob')
      const formData = new FormData()
      formData.append('file', pdfBlob, `receipt_${Date.now()}.pdf`)
      const res = await fetch('/api/upload-receipt', { method: 'POST', body: formData })
      const { publicUrl, error } = await res.json()
      if (error) { showToast('Upload failed: ' + error, 'error'); return }
      const message = `*${billHeader}*\nDate: ${lastBill.date}\nTotal: ${currency}${lastBill.total.toFixed(2)}\nPayment: ${lastBill.paymentMethod}\n\nReceipt: ${publicUrl}`
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
      showToast('Receipt link shared!')
    } catch (err) { showToast('Error generating PDF', 'error'); console.error(err) }
  }

  // ====== RENDER HELPERS ======
  const productPanel = (
    <div className="flex flex-col space-y-3 overflow-hidden min-h-0 flex-1">
      <div className="flex gap-2">
        <input className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="🔍 Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={startScanner}><BsUpcScan size={18} /></button>
        {scanner && <button className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm" onClick={stopScanner}>Stop</button>}
      </div>
      <div id="reader" className={`w-full ${scanner ? '' : 'hidden'}`} />
      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center opacity-50">📦 No products found.<br/>Add products in Inventory.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).map(p => {
            const cartItem = cart.find(i => i.id === p.id)
            const inCartQty = cartItem ? cartItem.qty : 0
            const isOutOfStock = p.stock <= 0

            return (
              <button 
                key={p.id} 
                className={`relative p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left animate-scaleIn shadow-sm ${
                  inCartQty > 0 ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-gray-700' : ''
                } ${isOutOfStock && p.preventOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}`} 
                onClick={() => addToCart(p)}
              >
                {inCartQty > 0 && (
                  <span className="absolute top-2 right-2 bg-blue-600 text-white font-extrabold text-xs px-2 py-0.5 rounded-full shadow-md">
                    x {inCartQty}
                  </span>
                )}

                {isOutOfStock && (
                  <span className={`absolute top-2 left-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${
                    p.preventOutOfStock ? 'bg-red-600' : 'bg-orange-500'
                  }`}>
                    {p.preventOutOfStock ? 'Out of Stock (Blocked)' : 'Out of Stock'}
                  </span>
                )}

                <div className="font-semibold text-sm sm:text-base mt-2 line-clamp-2">{p.name}</div>
                <div className="text-xs sm:text-sm opacity-70 mt-1">{currency}{p.price} | Stock: {p.stock}</div>
              </button>
            )
          })}
        </div>
      )}
      {holdOrders.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mt-2">
          <h4 className="font-medium text-sm mb-2">📌 Hold Orders ({holdOrders.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {holdOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded text-sm">
                <div><span className="font-semibold">#{o.id.slice(0,6)}</span><span className="ml-2">{currency}{o.total}</span>{o.hold_note && <span className="ml-2 text-xs opacity-70">({o.hold_note})</span>}</div>
                <div className="flex gap-1">
                  <button className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition" onClick={() => loadHold(o.id)}>Load</button>
                  <button className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition" onClick={() => deleteHoldOrder(o.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const billingTerminal = (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-2xl p-4 flex flex-col animate-fadeInRight overflow-y-auto flex-1">
      {isMobile && (
        <button onClick={() => setMobileView('products')} className="mb-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg self-start">
          ← Back to Products
        </button>
      )}
      {/* Customer search bar */}
      <div className="relative mb-3" ref={customerDropdownRef}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="🔍 Search customer by name/phone..." value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }}
              onFocus={() => setShowCustomerDropdown(true)} />
            {customerSearch && filteredCustomers.length > 0 && showCustomerDropdown && (
              <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map(c => (
                  <li key={c.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm" onClick={() => selectCustomerFromSearch(c)}>
                    <span className="font-medium">{c.name}</span> <span className="text-xs opacity-70">({c.phone})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* CONTACT PICKER BUTTON (PROMPTS PERMISSION / OPEN POPUP) */}
          <button onClick={pickContact} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition" title="Pick Contact">
            📇
          </button>

          <button className="px-3 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition" onClick={() => setNewCustomerForm(true)}>
            ➕
          </button>
          {selectedCustomer && <button onClick={clearCustomer} className="px-2 py-2 text-red-500 text-sm">✕</button>}
        </div>
      </div>

      {selectedCustomer && (
        <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm animate-fadeIn">
          <p className="font-bold">{selectedCustomer.name}</p>
          {selectedCustomer.address && <p className="text-xs opacity-80">{selectedCustomer.address}</p>}
          <p className={selectedCustomer.total_credit > 0 ? 'text-red-500 font-semibold' : ''}>Credit: {currency}{selectedCustomer.total_credit}</p>
        </div>
      )}

      {/* New Customer Modal */}
      {newCustomerForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-11/12 max-w-md animate-scaleIn">
            <h3 className="font-bold text-lg mb-4">New Customer</h3>
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="Name" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
            <input type="tel" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="Address (optional)" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} />
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition text-base" onClick={createNewCustomer}>✅ Create</button>
              <button className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition text-base" onClick={() => setNewCustomerForm(false)}>❌ Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER / CONTACT PICKER MODAL FOR UNSUPPORTED BROWSERS */}
      {customerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl text-gray-900 dark:text-white space-y-4">
            <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                📇 Select Customer / Contact
              </h3>
              <button onClick={() => setCustomerModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FiX size={20} />
              </button>
            </div>

            {/* Quick VCF File Upload */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 p-3 rounded-xl flex items-center justify-between">
              <div className="text-xs">
                <p className="font-bold text-blue-600 dark:text-blue-300">Import .VCF Contact File</p>
                <p className="text-gray-500 dark:text-gray-400">Load contact directly from phone file</p>
              </div>
              <label className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1 transition">
                <FiUpload /> Upload
                <input type="file" accept=".vcf,.vcard" onChange={handleVcfUpload} className="hidden" />
              </label>
            </div>

            {/* Customers List Search */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Select Saved Customer:</p>
              <div className="max-h-52 overflow-y-auto space-y-1 pr-1 border border-gray-200 dark:border-gray-700 rounded-xl p-2">
                {customers.length === 0 ? (
                  <p className="text-center text-xs opacity-50 py-4">No customers found</p>
                ) : (
                  customers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomerFromSearch(c)}
                      className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition flex justify-between items-center text-sm"
                    >
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.phone || 'No Phone'}</p>
                      </div>
                      <FiUserCheck className="text-blue-500" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => { setCustomerModal(false); setNewCustomerForm(true); }}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-sm font-bold py-2.5 rounded-xl transition"
              >
                ➕ Add New Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1">
        {cart.length === 0 ? (
          <div className="text-center text-sm opacity-50 py-8">🛒 No items in cart</div>
        ) : (
          cart.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg animate-fadeIn text-sm sm:text-base border border-gray-200 dark:border-gray-600">
              <div className="flex-1 pr-2">
                <span className="font-medium block line-clamp-1">{item.name}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  {currency}{item.price} {item.applyOffer === false ? '(Original Price)' : ''}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 bg-gray-300 dark:bg-gray-600 rounded font-bold" onClick={() => updateCartQty(item.id, item.qty - 1)}>−</button>
                <input
                  type="number"
                  className="w-12 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 font-semibold text-sm py-0.5"
                  value={item.qty}
                  min="1"
                  onChange={(e) => updateCartQty(item.id, parseInt(e.target.value) || 1)}
                />
                <button className="px-2 py-0.5 bg-gray-300 dark:bg-gray-600 rounded font-bold" onClick={() => updateCartQty(item.id, item.qty + 1)}>+</button>
              </div>

              <span className="ml-2 font-bold w-20 text-right">{currency}{(item.price * item.qty).toFixed(2)}</span>
              
              <button 
                onClick={() => openEditModal(item)}
                className="ml-2 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-gray-600 rounded transition"
                title="Edit Item Price & Offer"
              >
                <FiEdit3 size={16} />
              </button>

              <button className="ml-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-gray-600 rounded transition" onClick={() => removeFromCart(item.id)} title="Remove">✕</button>
            </div>
          ))
        )}
      </div>

      {/* Discount, totals, payment method, checkout */}
      <div className="flex items-center gap-2 mb-3">
        <input type="number" placeholder="Discount" className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
        <span className="text-sm opacity-70">Discount</span>
      </div>
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4 text-sm sm:text-base">
        <div className="flex justify-between"><span>Subtotal</span> <span>{currency}{subtotal.toFixed(2)}</span></div>
        {taxEnabled && <div className="flex justify-between"><span>Tax ({taxRate}%)</span> <span>{currency}{taxAmount.toFixed(2)}</span></div>}
        {discount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span> <span>-{currency}{discount.toFixed(2)}</span></div>}
        <div className="flex justify-between text-lg sm:text-xl font-bold mt-1 pt-1 border-t border-gray-300 dark:border-gray-500"><span>Total</span> <span>{currency}{final.toFixed(2)}</span></div>
      </div>
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">💳 Payment Method</div>
        <div className="grid grid-cols-3 gap-2">
          {[{ method: 'cash', label: 'Cash', color: 'bg-green-600' }, { method: 'card', label: 'Card', color: 'bg-blue-600' }, { method: 'cheque', label: 'Cheque', color: 'bg-purple-600' }, { method: 'credit', label: 'Credit', color: 'bg-orange-500' }, { method: 'bank_transfer', label: 'Bank', color: 'bg-teal-600' }].map(pm => (
            <button key={pm.method} className={`px-3 py-2 rounded-lg text-sm sm:text-base font-medium transition-all hover:scale-105 ${paymentMethod === pm.method ? `${pm.color} text-white` : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`} onClick={() => setPaymentMethod(pm.method)}>{pm.label}</button>
          ))}
        </div>
      </div>
      {paymentMethod === 'cheque' && (
        <div className="grid grid-cols-2 gap-2 mb-3 animate-scaleIn">
          <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Cheque Number" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} />
          <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
        </div>
      )}
      {paymentMethod === 'bank_transfer' && (
        <div className="mb-3 animate-scaleIn"><input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Bank Reference" value={bankReference} onChange={e => setBankReference(e.target.value)} /></div>
      )}
      {paymentMethod === 'credit' && (
        <div className="mb-3 animate-scaleIn"><label className="block text-sm font-medium mb-1">Due Date</label><input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)} /></div>
      )}
      <div className="flex gap-2 mt-auto">
        <button className="flex-1 px-3 py-3 sm:px-6 sm:py-3 bg-green-600 text-white rounded-lg font-bold text-base sm:text-lg hover:bg-green-700 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => checkout('completed')} disabled={cart.length === 0}>✅ Checkout ({totalItemCount})</button>
        <button className="flex-1 px-3 py-3 sm:px-6 sm:py-3 bg-yellow-500 text-white rounded-lg font-bold text-base sm:text-lg hover:bg-yellow-600 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => checkout('hold')} disabled={cart.length === 0}>⏸️ Hold</button>
      </div>
      {lastBill && (
        <button onClick={shareLastBill} className="mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2">
          <BsWhatsapp size={18} /> Share Bill via WhatsApp
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop layout */}
      {!isMobile && (
        <div className="flex gap-4 animate-fadeIn h-[calc(100vh-120px)]">
          <div className="w-2/5">{productPanel}</div>
          <div className="w-3/5">{billingTerminal}</div>
        </div>
      )}

      {/* Mobile layout */}
      {isMobile && mobileView === 'products' && (
        <div className="flex flex-col h-[calc(100vh-120px)] animate-fadeIn">
          <div className="flex-1 overflow-hidden">{productPanel}</div>
          <div className="p-3 flex-shrink-0">
            <button
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition"
              onClick={() => setMobileView('billing')}
            >
              🛒 Go to Counter ({totalItemCount} items)
            </button>
          </div>
        </div>
      )}

      {isMobile && mobileView === 'billing' && (
        <div className="flex flex-col h-[calc(100vh-120px)] animate-fadeIn">
          {billingTerminal}
        </div>
      )}

      {/* EDIT ITEM MODAL */}
      {editModalOpen && selectedCartItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl text-gray-900 dark:text-white">
            
            <div className="flex justify-between items-start border-b border-gray-200 dark:border-gray-700 pb-3">
              <div>
                <h3 className="text-lg font-bold">{selectedCartItem.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Stock: {selectedCartItem.stock}</p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <FiX size={20} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Selling Price ({currency})
              </label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEditQty(Math.max(1, editQty - 1))}
                  className="p-3 bg-red-100 dark:bg-red-600/20 text-red-600 rounded-xl font-bold transition"
                >
                  <FiMinus size={18} />
                </button>
                <input
                  type="number"
                  min="1"
                  value={editQty}
                  onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))}
                  className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl py-2.5 text-center font-bold text-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setEditQty(editQty + 1)}
                  className="p-3 bg-green-100 dark:bg-green-600/20 text-green-600 rounded-xl font-bold transition"
                >
                  <FiPlus size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/60 p-3 rounded-xl border border-gray-200 dark:border-gray-600">
              <span className="text-sm font-medium">Apply Offer / Special Discount</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyOffer}
                  onChange={(e) => setApplyOffer(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { removeFromCart(selectedCartItem.id); setEditModalOpen(false); }}
                className="p-3 bg-red-100 dark:bg-red-600/20 hover:bg-red-200 text-red-600 rounded-xl transition flex items-center justify-center"
                title="Delete Item"
              >
                <FiTrash2 size={20} />
              </button>
              <button
                type="button"
                onClick={handleUpdateCartItem}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-md"
              >
                Update Item
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Print Modal */}
      {printModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn" onClick={() => setPrintModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-11/12 sm:w-[450px] max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="font-bold text-lg">🖨️ Print Receipt</h3>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm" onClick={() => iframeRef.current?.contentWindow?.print()}>Print</button>
                <button className="px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition text-sm" onClick={() => setPrintModal(false)}>✕</button>
              </div>
            </div>
            <iframe ref={iframeRef} srcDoc={printContent} className="w-full h-[60vh]" title="Receipt Preview" />
          </div>
        </div>
      )}
    </>
  )
}