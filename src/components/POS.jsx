'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { Html5Qrcode } from 'html5-qrcode'
import { BsUpcScan, BsWhatsapp } from 'react-icons/bs'
import { FiEdit3, FiTrash2, FiPlus, FiMinus, FiX, FiUserCheck, FiUpload, FiBluetooth } from 'react-icons/fi'
import { Camera } from '@capacitor/camera'
import { Contacts } from '@capacitor/contacts'
import { jsPDF } from 'jspdf'

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

  // BLUETOOTH PRINTER STATES
  const [btModalOpen, setBtModalOpen] = useState(false)
  const [btDevices, setBtDevices] = useState([])
  const [isPrinting, setIsPrinting] = useState(false)
  const [printerSize, setPrinterSize] = useState(32) // 32 chars for 58mm, 48 chars for 80mm

  const [selectedCartItem, setSelectedCartItem] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editPrice, setEditPrice] = useState(0)
  const [editQty, setEditQty] = useState(1)
  const [applyOffer, setApplyOffer] = useState(true)

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerModal, setCustomerModal] = useState(false)
  const customerDropdownRef = useRef(null)

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
          id: p.id, sku: p.products?.sku, name: p.products?.name,
          price: p.price, stock: p.stock_quantity,
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

  const ensurePermission = async (type) => {
    if (typeof window === 'undefined' || !window.Capacitor || !window.Capacitor.isNativePlatform()) return true;
    try {
      if (type === 'camera') {
        let status = await Camera.checkPermissions();
        if (status.camera === 'granted') return true;
        status = await Camera.requestPermissions();
        if (status.camera === 'granted') return true;
        alert('⚠️ Camera Permission ලබා දී නැත!\n\nකරුණාකර Phone Settings -> Apps -> Nishadi Enterprise -> Permissions වෙත ගොස් Camera "Allow" කරන්න.');
        return false;
      }
      if (type === 'contacts') {
        let status = await Contacts.checkPermissions();
        if (status.contacts === 'granted') return true;
        status = await Contacts.requestPermissions();
        if (status.contacts === 'granted') return true;
        alert('⚠️ Contacts Permission ලබා දී නැත!\n\nකරුණාකර Phone Settings -> Apps -> Nishadi Enterprise -> Permissions වෙත ගොස් Contacts "Allow" කරන්න.');
        return false;
      }
    } catch (error) { console.error(`Permission Error (${type}):`, error); return false; }
  };

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
      showToast(`⚠️ Cannot add "${prod.name}". Out of stock!`, 'error')
      return
    }
    setCart(prev => {
      if (exist) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1, originalPrice: prod.price, applyOffer: true }]
    })
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

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
      showToast(`⚠️ Quantity exceeds stock limit`, 'error')
      return
    }
    setCart(prev => prev.map(item => {
      if (item.id === selectedCartItem.id) return { ...item, price: Number(editPrice), qty: Number(editQty), applyOffer: applyOffer }
      return item
    }))
    setEditModalOpen(false)
    setSelectedCartItem(null)
  }

  const subtotal = cart.reduce((s, i) => s + (i.applyOffer ? i.price : i.originalPrice) * i.qty, 0)
  const taxAmount = taxEnabled ? (subtotal * taxRate / 100) : 0
  const total = subtotal + taxAmount
  const final = total - discount
  const totalItemCount = cart.reduce((s, i) => s + i.qty, 0)

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

  const clearCustomer = () => { setSelectedCustomer(null); setCustomerPhone(''); setCustomerSearch('') }

  const createNewCustomer = async () => {
    if (!newCustName || !customerPhone) { showToast('Name and Phone required', 'error'); return }
    const { data: c, error: mainErr } = await supabase.from('customers').insert({ branch_id: branch, name: newCustName, phone: customerPhone, address: newCustAddress }).select().single()
    if (mainErr) { showToast('Failed to create customer', 'error'); return }
    try {
      const { data: existing } = await supabase.from('customers').select('id').eq('branch_id', PARALLEL_BRANCH_ID).eq('phone', customerPhone).maybeSingle()
      if (!existing) await supabase.from('customers').insert({ branch_id: PARALLEL_BRANCH_ID, name: newCustName, phone: customerPhone, address: newCustAddress })
    } catch (err) {}
    setCustomers(prev => [...prev, c])
    setSelectedCustomer(c)
    setNewCustName(''); setNewCustAddress(''); setNewCustomerForm(false)
    showToast('Customer created!')
  }

  const pickContact = async () => {
    const hasPermission = await ensurePermission('contacts');
    if (!hasPermission) { setCustomerModal(true); return; }
    try {
      const result = await Contacts.pickContact()
      if (result && result.contact) {
        const name = result.contact.name || ''
        const phone = result.contact.phoneNumbers?.[0]?.number || result.contact.telephone || ''
        const cleanPhone = phone.replace(/[^\d+]/g, '')
        if (cleanPhone) {
          const cust = customers.find(c => c.phone === cleanPhone || (c.phone && c.phone.endsWith(cleanPhone.slice(-9))))
          if (cust) selectCustomerFromSearch(cust)
          else { setCustomerPhone(cleanPhone); setNewCustName(name || 'Cust'); setNewCustomerForm(true) }
        }
      }
    } catch (err) { setCustomerModal(true) }
  }

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
        if (cust) selectCustomerFromSearch(cust)
        else { setCustomerPhone(phone); setNewCustName(name); setNewCustomerForm(true) }
        setCustomerModal(false)
      }
    }
    reader.readAsText(file)
  }

  const checkout = async (status = 'completed') => {
    if (cart.length === 0) return
    let cid = selectedCustomer?.id
    if (!cid && customerPhone) {
      const { data: nc } = await supabase.from('customers').insert({ branch_id: branch, phone: customerPhone, name: 'Cust ' + customerPhone.slice(-4) }).select().single()
      if (nc) { cid = nc.id; setCustomers(prev => [...prev, nc]); setSelectedCustomer(nc) }
    }
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      branch_id: branch, total: final, discount, status, customer_id: cid || null, payment_method: paymentMethod,
      cheque_number: paymentMethod === 'cheque' ? chequeNumber : null, cheque_date: paymentMethod === 'cheque' ? chequeDate : null,
      bank_reference: paymentMethod === 'bank_transfer' ? bankReference : null
    }).select().single()

    if (orderError) { showToast('Order failed', 'error'); return }
    if (order) {
      await supabase.from('order_items').insert(cart.map(i => ({ order_id: order.id, branch_product_id: i.id, quantity: i.qty, price: i.price })))
      for (const item of cart) { if (item.autoUpdateStock !== false) { await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty }) } }
      if (status === 'completed') { try { await supabase.rpc('create_parallel_order', { main_order_id: order.id, target_branch_id: PARALLEL_BRANCH_ID }); } catch (err) {} }
      
      setLastBill({ items: [...cart], total: final, paymentMethod, date: new Date().toLocaleString() })
      
      showToast('Bill Cut Successfully!')
      setCart([]); setDiscount(0); setSelectedCustomer(null); setCustomerPhone(''); setCustomerSearch('')
      setPaymentMethod('cash'); setChequeNumber(''); setChequeDate(''); setBankReference(''); setCreditDueDate('')
    }
  }

  const loadHold = async (id) => {
    const { data } = await supabase.from('order_items').select('branch_product_id, quantity, price, branch_products(products(name, prevent_out_of_stock_sale, auto_update_stock))').eq('order_id', id)
    if (data) setCart(data.map(i => ({ id: i.branch_product_id, name: i.branch_products?.products?.name, price: i.price, originalPrice: i.price, qty: i.quantity, preventOutOfStock: i.branch_products?.products?.prevent_out_of_stock_sale ?? false, autoUpdateStock: i.branch_products?.products?.auto_update_stock ?? true })))
  }

  const deleteHoldOrder = async (orderId) => {
    await supabase.from('orders').delete().eq('id', orderId)
    setHoldOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const startScanner = async () => {
    const hasPermission = await ensurePermission('camera');
    if (!hasPermission) return;
    if (scanRef.current) { try { await scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    const html5QrCode = new Html5Qrcode("reader")
    scanRef.current = html5QrCode
    try {
      await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { const prod = products.find(p => p.sku === decodedText); if (prod) addToCart(prod); else showToast(`Not found: ${decodedText}`, 'error'); stopScanner() },
        () => {})
      setScanner(html5QrCode)
    } catch (err) { setScanner(null) }
  }

  const stopScanner = () => {
    if (scanRef.current) { try { scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    setScanner(null)
  }

  const shareLastBill = async () => {
    if (!lastBill) return;
    try {
      showToast('Generating Receipt...', 'info');
      const doc = new jsPDF({ unit: 'mm', format: [80, 150] });
      doc.setFontSize(12); doc.text(billHeader, 10, 10);
      doc.setFontSize(8); doc.text(`Date: ${lastBill.date}`, 10, 16);
      doc.line(10, 18, 70, 18); 
      let y = 22;
      lastBill.items.forEach(i => { 
        doc.text(`${i.name} x${i.qty} - ${currency}${(i.price*i.qty).toFixed(2)}`, 10, y); 
        y += 4; 
      });
      doc.line(10, y, 70, y); y += 4;
      doc.text(`Subtotal: ${currency}${subtotal.toFixed(2)}`, 10, y); y += 4;
      if (taxEnabled) { doc.text(`Tax (${taxRate}%): ${currency}${taxAmount.toFixed(2)}`, 10, y); y += 4; }
      if (discount > 0) { doc.text(`Discount: -${currency}${discount.toFixed(2)}`, 10, y); y += 4; }
      doc.setFontSize(10); doc.text(`Total: ${currency}${lastBill.total.toFixed(2)}`, 10, y); y += 5;
      doc.setFontSize(8); doc.text(`Payment: ${lastBill.paymentMethod}`, 10, y); y += 5;
      doc.text('Designed & Developed by Ceylon Digi Solutions', 10, y);

      const pdfBlob = doc.output('blob');
      const formData = new FormData();
      formData.append('file', pdfBlob, `receipt_${Date.now()}.pdf`);
      
      const uploadUrl = 'https://nishadi-enterprise-suite.vercel.app/api/upload-receipt';
      const res = await fetch(uploadUrl, { method: 'POST', body: formData });
      
      if (!res.ok) throw new Error(`Upload Server Error: ${res.status}`);
      const { publicUrl, error } = await res.json();
      if (error) throw new Error(error);

      const message = `*${billHeader}*\nDate: ${lastBill.date}\nTotal: ${currency}${lastBill.total.toFixed(2)}\nPayment: ${lastBill.paymentMethod}\n\nReceipt: ${publicUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      showToast('Receipt link shared!');
    } catch (err) { showToast(`PDF Error: ${err.message || 'Check Network'}`, 'error'); console.error(err); }
  }

  // ==========================================
  // 🖨️ UNIVERSAL BLUETOOTH THERMAL PRINTING
  // ==========================================
  const loadBluetoothDevices = () => {
    if (typeof window === 'undefined' || !window.bluetoothSerial) {
      showToast('Bluetooth Plugin එක හමු නොවුණි. Mobile App එකක්දැයි පරීක්ෂා කරන්න.', 'error');
      return;
    }
    window.bluetoothSerial.list(
      (devices) => {
        setBtDevices(devices);
        setBtModalOpen(true);
      },
      (err) => {
        showToast('Bluetooth උපාංග සෙවීමේ දෝෂයකි. Bluetooth ON දැයි පරීක්ෂා කරන්න.', 'error');
        console.error(err);
      }
    );
  };

  const printViaBluetooth = (macAddress) => {
    if (!lastBill || !window.bluetoothSerial) return;
    setIsPrinting(true);

    const items = lastBill.items;
    const tot = lastBill.total;
    
    // UNIVERSAL ESC/POS Commands
    const ESC = "\x1B";
    const CENTER = ESC + "\x61\x01";
    const LEFT = ESC + "\x61\x00";
    const BOLD_ON = ESC + "\x45\x01";
    const BOLD_OFF = ESC + "\x45\x00";
    
    // Dynamic Line Generation based on selected printer size
    const LINE = "-".repeat(printerSize) + "\n";

    let textToPrint = "";
    textToPrint += CENTER + BOLD_ON + billHeader + "\n" + BOLD_OFF;
    textToPrint += lastBill.date + "\n";
    textToPrint += LINE + LEFT;
    
    // Dynamic column width calculations
    const qtyWidth = 4;
    const priceWidth = 10;
    const nameWidth = printerSize - qtyWidth - priceWidth; 

    items.forEach(i => {
      let name = i.name.substring(0, nameWidth - 1).padEnd(nameWidth, ' ');
      let qty = (i.qty + "x").padEnd(qtyWidth, ' ');
      let price = (i.price * i.qty).toFixed(2).padStart(priceWidth, ' ');
      textToPrint += `${name}${qty}${price}\n`;
    });
    
    textToPrint += LINE;
    textToPrint += `Subtotal: `.padEnd(printerSize - priceWidth, ' ') + `${subtotal.toFixed(2).padStart(priceWidth, ' ')}\n`;
    if (discount > 0) textToPrint += `Discount: `.padEnd(printerSize - priceWidth, ' ') + `-${discount.toFixed(2).padStart(priceWidth - 1, ' ')}\n`;
    textToPrint += BOLD_ON + `Total: `.padEnd(printerSize - priceWidth, ' ') + `${tot.toFixed(2).padStart(priceWidth, ' ')}\n` + BOLD_OFF;
    textToPrint += CENTER + `\nPayment: ${lastBill.paymentMethod}\n`;
    textToPrint += "\n" + billFooter + "\n\n\n\n"; // Added extra newlines to push paper out

    window.bluetoothSerial.connect(macAddress, 
      () => {
        window.bluetoothSerial.write(textToPrint, 
          () => {
            showToast('Printed Successfully!', 'success');
            setTimeout(() => window.bluetoothSerial.disconnect(), 1000);
            setIsPrinting(false);
            setBtModalOpen(false);
          },
          (err) => {
            showToast('Print failed.', 'error');
            setIsPrinting(false);
          }
        );
      },
      (err) => {
        showToast('Printer Connection Failed. Make sure it is paired and ON.', 'error');
        setIsPrinting(false);
      }
    );
  };

  const productPanel = (
    <div className="flex flex-col space-y-3 overflow-hidden min-h-0 flex-1">
      <div className="flex gap-2">
        <input className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="🔍 Search products..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={startScanner}><BsUpcScan size={18} /></button>
        {scanner && <button className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm" onClick={stopScanner}>Stop</button>}
      </div>
      <div id="reader" className={`w-full ${scanner ? '' : 'hidden'}`} />
      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center opacity-50">📦 No products found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).map(p => {
            const cartItem = cart.find(i => i.id === p.id)
            const inCartQty = cartItem ? cartItem.qty : 0
            const isOutOfStock = p.stock <= 0
            return (
              <button key={p.id} className={`relative p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left shadow-sm ${inCartQty > 0 ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-gray-700' : ''} ${isOutOfStock && p.preventOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={() => addToCart(p)}>
                {inCartQty > 0 && <span className="absolute top-2 right-2 bg-blue-600 text-white font-extrabold text-xs px-2 py-0.5 rounded-full shadow-md">x {inCartQty}</span>}
                {isOutOfStock && <span className={`absolute top-2 left-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${p.preventOutOfStock ? 'bg-red-600' : 'bg-orange-500'}`}>Out of Stock</span>}
                <div className="font-semibold text-sm sm:text-base mt-2 line-clamp-2">{p.name}</div>
                <div className="text-xs sm:text-sm opacity-70 mt-1">{currency}{p.price} | Stock: {p.stock}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const billingTerminal = (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-2xl p-4 flex flex-col overflow-y-auto flex-1">
      {isMobile && <button onClick={() => setMobileView('products')} className="mb-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg self-start">← Back</button>}
      
      <div className="relative mb-3" ref={customerDropdownRef}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="🔍 Search customer..." value={customerSearch} onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }} onFocus={() => setShowCustomerDropdown(true)} />
            {customerSearch && filteredCustomers.length > 0 && showCustomerDropdown && (
              <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.map(c => <li key={c.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm" onClick={() => selectCustomerFromSearch(c)}><span className="font-medium">{c.name}</span> <span className="text-xs opacity-70">({c.phone})</span></li>)}
              </ul>
            )}
          </div>
          <button onClick={pickContact} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg transition" title="Pick Contact">📇</button>
          <button className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg transition" onClick={() => setNewCustomerForm(true)}>➕</button>
          {selectedCustomer && <button onClick={clearCustomer} className="px-2 py-2 text-red-500 text-sm">✕</button>}
        </div>
      </div>

      {selectedCustomer && (
        <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
          <p className="font-bold">{selectedCustomer.name}</p>
          <p className={selectedCustomer.total_credit > 0 ? 'text-red-500 font-semibold' : ''}>Credit: {currency}{selectedCustomer.total_credit}</p>
        </div>
      )}

      {newCustomerForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-11/12 max-w-md">
            <h3 className="font-bold text-lg mb-4">New Customer</h3>
            <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Name" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
            <input type="tel" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium" onClick={createNewCustomer}>Create</button>
              <button className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-medium" onClick={() => setNewCustomerForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1">
        {cart.length === 0 ? <div className="text-center text-sm opacity-50 py-8">🛒 No items in cart</div> : (
          cart.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-100 dark:bg-gray-700 p-2.5 rounded-lg text-sm sm:text-base border border-gray-200 dark:border-gray-600">
              <div className="flex-1 pr-2"><span className="font-medium block line-clamp-1">{item.name}</span></div>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 bg-gray-300 dark:bg-gray-600 rounded font-bold" onClick={() => updateCartQty(item.id, item.qty - 1)}>−</button>
                <span className="w-8 text-center font-semibold text-sm">{item.qty}</span>
                <button className="px-2 py-0.5 bg-gray-300 dark:bg-gray-600 rounded font-bold" onClick={() => updateCartQty(item.id, item.qty + 1)}>+</button>
              </div>
              <span className="ml-2 font-bold w-20 text-right">{currency}{(item.price * item.qty).toFixed(2)}</span>
              <button onClick={() => openEditModal(item)} className="ml-2 p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-gray-600 rounded"><FiEdit3 size={16} /></button>
              <button className="ml-1 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-gray-600 rounded" onClick={() => removeFromCart(item.id)}>✕</button>
            </div>
          ))
        )}
      </div>

      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4 text-sm sm:text-base">
        <div className="flex justify-between text-lg sm:text-xl font-bold mt-1 pt-1 border-t border-gray-300 dark:border-gray-500"><span>Total</span> <span>{currency}{final.toFixed(2)}</span></div>
      </div>
      
      <div className="mb-4">
        <div className="grid grid-cols-3 gap-2">
          {[{ method: 'cash', label: 'Cash', color: 'bg-green-600' }, { method: 'card', label: 'Card', color: 'bg-blue-600' }, { method: 'credit', label: 'Credit', color: 'bg-orange-500' }].map(pm => (
            <button key={pm.method} className={`px-3 py-2 rounded-lg text-sm font-medium ${paymentMethod === pm.method ? `${pm.color} text-white` : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`} onClick={() => setPaymentMethod(pm.method)}>{pm.label}</button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-auto">
        <button className="flex-1 px-3 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50" onClick={() => checkout('completed')} disabled={cart.length === 0}>✅ Checkout ({totalItemCount})</button>
      </div>

      {lastBill && (
        <div className="flex gap-2 mt-2">
          <button onClick={shareLastBill} className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-bold shadow-md">
            <BsWhatsapp size={18} /> WhatsApp
          </button>
          <button onClick={loadBluetoothDevices} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-bold shadow-md">
            <FiBluetooth size={18} /> BT Print
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {!isMobile && (
        <div className="flex gap-4 h-[calc(100vh-120px)]">
          <div className="w-2/5">{productPanel}</div>
          <div className="w-3/5">{billingTerminal}</div>
        </div>
      )}
      {isMobile && mobileView === 'products' && (
        <div className="flex flex-col h-[calc(100vh-120px)]">
          <div className="flex-1 overflow-hidden">{productPanel}</div>
          <div className="p-3 flex-shrink-0">
            <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg" onClick={() => setMobileView('billing')}>🛒 Go to Counter ({totalItemCount})</button>
          </div>
        </div>
      )}
      {isMobile && mobileView === 'billing' && <div className="flex flex-col h-[calc(100vh-120px)]">{billingTerminal}</div>}

      {/* Edit Item Modal */}
      {editModalOpen && selectedCartItem && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-start border-b pb-3">
              <h3 className="text-lg font-bold">{selectedCartItem.name}</h3>
              <button onClick={() => setEditModalOpen(false)}><FiX size={20} /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Selling Price ({currency})</label>
              <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full border rounded-xl px-4 py-2.5 font-bold" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Quantity</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditQty(Math.max(1, editQty - 1))} className="p-3 bg-red-100 text-red-600 rounded-xl font-bold"><FiMinus size={18} /></button>
                <input type="number" min="1" value={editQty} onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))} className="flex-1 border rounded-xl py-2.5 text-center font-bold text-lg" />
                <button type="button" onClick={() => setEditQty(editQty + 1)} className="p-3 bg-green-100 text-green-600 rounded-xl font-bold"><FiPlus size={18} /></button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={handleUpdateCartItem} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl">Update Item</button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER PICKER MODAL */}
      {customerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">📇 Select Contact</h3>
              <button onClick={() => setCustomerModal(false)}><FiX size={20} /></button>
            </div>
            <label className="bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1">
              <FiUpload /> Import .VCF File
              <input type="file" accept=".vcf,.vcard" onChange={handleVcfUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* DYNAMIC BLUETOOTH PRINTER MODAL */}
      {btModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3 border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold">🖨️ Select Bluetooth Printer</h3>
              <button onClick={() => setBtModalOpen(false)}><FiX size={20} /></button>
            </div>
            
            {/* PAPER SIZE SELECTOR (58mm / 80mm) */}
            <div>
              <p className="text-xs font-semibold mb-2 text-gray-500">Select Paper Size:</p>
              <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1.5 rounded-lg">
                <button 
                  className={`flex-1 py-2 rounded-md font-bold text-sm transition ${printerSize === 32 ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`} 
                  onClick={() => setPrinterSize(32)}
                >
                  58mm (Small)
                </button>
                <button 
                  className={`flex-1 py-2 rounded-md font-bold text-sm transition ${printerSize === 48 ? 'bg-blue-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`} 
                  onClick={() => setPrinterSize(48)}
                >
                  80mm (Large)
                </button>
              </div>
            </div>

            {btDevices.length === 0 ? (
              <p className="text-center text-sm opacity-50 py-4">No paired printers found. Please pair your printer in phone settings first.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mt-2">
                {btDevices.map((device, idx) => (
                  <button key={idx} onClick={() => printViaBluetooth(device.address)} disabled={isPrinting} className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 flex justify-between items-center transition disabled:opacity-50">
                    <div>
                      <p className="font-bold">{device.name}</p>
                      <p className="text-xs opacity-70">{device.address}</p>
                    </div>
                    {isPrinting ? <span className="text-xs text-blue-500 animate-pulse">Connecting...</span> : <FiBluetooth className="text-blue-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}