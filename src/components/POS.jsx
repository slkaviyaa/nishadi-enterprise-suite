'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { Html5Qrcode } from 'html5-qrcode'
import { BsUpcScan, BsWhatsapp } from 'react-icons/bs'
import { FiEdit3, FiTrash2, FiPlus, FiMinus, FiX, FiUserCheck, FiUpload, FiBluetooth } from 'react-icons/fi'
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

  const [isPrinting, setIsPrinting] = useState(false)
  const [printerSize, setPrinterSize] = useState(32)

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

  // 🔴 FIXED: Ghost Items Filter & Live Stock Fetching
  const fetchProducts = async () => {
    if (!branch) return;
    
    // products!inner used to completely filter out soft/hard deleted products
    const { data, error } = await supabase.from('branch_products')
      .select('id, price, stock_quantity, products!inner(sku, name, prevent_out_of_stock_sale, auto_update_stock)')
      .eq('branch_id', branch)
      
    if (error) { showToast('Failed to load products', 'error'); return; }
    if (data) {
      const validProducts = data.filter(p => p.products !== null);
      setProducts(validProducts.map(p => ({
        id: p.id, sku: p.products?.sku, name: p.products?.name,
        price: p.price, stock: p.stock_quantity,
        preventOutOfStock: p.products?.prevent_out_of_stock_sale ?? false,
        autoUpdateStock: p.products?.auto_update_stock ?? true
      })))
    }
  }

  useEffect(() => {
    fetchProducts();
    
    if (branch) {
      supabase.from('customers').select('*').eq('branch_id', branch).then(({ data }) => setCustomers(data || []))
      supabase.from('orders').select('id, total, hold_note, created_at')
        .eq('branch_id', branch).eq('status', 'hold')
        .order('created_at', { ascending: false })
        .then(({ data }) => setHoldOrders(data || []))
    }
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

  const updateCartQty = (id, newQty) => {
    if (newQty < 1) return
    const item = cart.find(i => i.id === id)
    const product = products.find(p => p.id === id)
    
    if (item && item.preventOutOfStock && newQty > product.stock) {
      showToast(`ඔබට ${newQty} ක් ලබාදිය නොහැක. දැනට ඇත්තේ ${product.stock} යි!`, 'error')
      return
    }
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: newQty } : item))
  }

  const addToCart = (prod) => {
    const exist = cart.find(i => i.id === prod.id)
    const currentCartQty = exist ? exist.qty : 0
    
    if (prod.preventOutOfStock && currentCartQty + 1 > prod.stock) {
      showToast(`⚠️ "${prod.name}" තොග අවසන්! (Available: ${prod.stock})`, 'error')
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
    const product = products.find(p => p.id === selectedCartItem.id)
    
    if (selectedCartItem.preventOutOfStock && editQty > product.stock) {
      showToast(`⚠️ ප්‍රමාණය තොගයට වඩා වැඩියි. (ඇත්තේ ${product.stock} යි)`, 'error')
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
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'tel'];
        const opts = { multiple: false };
        const contacts = await navigator.contacts.select(props, opts);
        
        if (contacts && contacts.length > 0) {
          const contact = contacts[0];
          const name = contact.name ? contact.name[0] : 'Cust';
          const phone = contact.tel ? contact.tel[0].replace(/[^\d+]/g, '') : '';
          
          if (phone) {
            const cust = customers.find(c => c.phone === phone || (c.phone && c.phone.endsWith(phone.slice(-9))));
            if (cust) {
              selectCustomerFromSearch(cust);
            } else { 
              setCustomerPhone(phone); 
              setNewCustName(name); 
              setNewCustomerForm(true); 
            }
          } else {
            showToast('තෝරාගත් Contact එකෙහි දුරකථන අංකයක් නොමැත!', 'error');
          }
        }
      } catch (err) {
        console.error(err);
        setCustomerModal(true);
      }
    } else {
      setCustomerModal(true);
    }
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
    
    // Live Database Stock Check Before Checkout
    for (const item of cart) {
      if (item.preventOutOfStock) {
        const { data: bp } = await supabase.from('branch_products').select('stock_quantity').eq('id', item.id).single()
        if (!bp || bp.stock_quantity < item.qty) { showToast(`අවවාදයයි: ${item.name} සඳහා ප්‍රමාණවත් තොග නොමැත!`, 'error'); return }
      }
    }

    let cid = selectedCustomer?.id
    
    // 🔴 FIXED: Walk-in Customer Auto Creation Logic
    if (!cid && customerPhone) {
      const { data: nc } = await supabase.from('customers').insert({ branch_id: branch, phone: customerPhone, name: 'Cust ' + customerPhone.slice(-4) }).select().single()
      if (nc) { cid = nc.id; setCustomers(prev => [...prev, nc]); setSelectedCustomer(nc) }
    } else if (!cid && !customerPhone) {
      // Find or Create "Walk-in Customer"
      const { data: walkIn } = await supabase.from('customers')
        .select('id').eq('branch_id', branch).ilike('name', 'Walk-in Customer').maybeSingle();
        
      if (walkIn) {
        cid = walkIn.id;
      } else {
        const { data: newWalkIn } = await supabase.from('customers')
          .insert({ branch_id: branch, name: 'Walk-in Customer', phone: '0000000000', address: 'Walk-in' }).select().single();
        if (newWalkIn) {
          cid = newWalkIn.id;
          // Sync Walk-in to Parallel Branch
          try {
            const { data: exPar } = await supabase.from('customers').select('id').eq('branch_id', PARALLEL_BRANCH_ID).ilike('name', 'Walk-in Customer').maybeSingle()
            if (!exPar) await supabase.from('customers').insert({ branch_id: PARALLEL_BRANCH_ID, name: 'Walk-in Customer', phone: '0000000000', address: 'Walk-in' })
          } catch(e) {}
        }
      }
    }
    
    const { data: order, error: orderError } = await supabase.from('orders').insert({
      branch_id: branch, total: final, discount, status, customer_id: cid || null, payment_method: paymentMethod,
      cheque_number: paymentMethod === 'cheque' ? chequeNumber : null, cheque_date: paymentMethod === 'cheque' ? chequeDate : null,
      bank_reference: paymentMethod === 'bank_transfer' ? bankReference : null
    }).select().single()

    if (orderError) { showToast('Order failed: ' + orderError.message, 'error'); return }
    
    if (order) {
      await supabase.from('order_items').insert(cart.map(i => ({ order_id: order.id, branch_product_id: i.id, quantity: i.qty, price: i.price })))
      for (const item of cart) { if (item.autoUpdateStock !== false) { await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty }) } }
      if (status === 'completed') { try { await supabase.rpc('create_parallel_order', { main_order_id: order.id, target_branch_id: PARALLEL_BRANCH_ID }); } catch (err) {} }
      
      if (selectedCustomer && paymentMethod === 'credit' && status === 'completed') {
        await supabase.from('credit_transactions').insert({
          customer_id: selectedCustomer.id, branch_id: branch, amount: final, type: 'purchase',
          due_date: creditDueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], payment_mode: 'credit'
        })
        await supabase.from('customers').update({ total_credit: selectedCustomer.total_credit + final }).eq('id', selectedCustomer.id)
      }

      setLastBill({ items: [...cart], total: final, paymentMethod, date: new Date().toLocaleString() })
      if (status === 'hold') {
        supabase.from('orders').select('id, total, hold_note, created_at').eq('branch_id', branch).eq('status', 'hold').order('created_at', { ascending: false }).then(({ data }) => setHoldOrders(data || []))
      }

      showToast('Bill Cut Successfully!', 'success')
      setCart([]); setDiscount(0); setSelectedCustomer(null); setCustomerPhone(''); setCustomerSearch('')
      setPaymentMethod('cash'); setChequeNumber(''); setChequeDate(''); setBankReference(''); setCreditDueDate('')
      
      await fetchProducts();
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
    if (scanRef.current) { try { await scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    const html5QrCode = new Html5Qrcode("reader")
    scanRef.current = html5QrCode
    try {
      await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => { const prod = products.find(p => p.sku === decodedText); if (prod) addToCart(prod); else showToast(`Not found: ${decodedText}`, 'error'); stopScanner() },
        () => {})
      setScanner(html5QrCode)
    } catch (err) { 
      console.error("Scanner Error: ", err);
      showToast('කැමරාව ආරම්භ කිරීමට නොහැක. Browser එකෙන් අවසර දී ඇත්දැයි බලන්න.', 'error');
      setScanner(null) 
    }
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
      const fileName = `receipt_${Date.now()}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Nishadi Motors Receipt',
          text: `*${billHeader}*\nDate: ${lastBill.date}\nTotal: ${currency}${lastBill.total.toFixed(2)}\nPayment: ${lastBill.paymentMethod}`,
          files: [file]
        });
        showToast('Receipt shared successfully!', 'success');
      } else {
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        const message = `*${billHeader}*\nDate: ${lastBill.date}\nTotal: ${currency}${lastBill.total.toFixed(2)}\nPayment: ${lastBill.paymentMethod}\n\n(Receipt has been downloaded to your device)`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        showToast('Receipt downloaded!', 'success');
      }
    } catch (err) { 
      showToast(`Share Error: ${err.message}`, 'error'); 
      console.error(err); 
    }
  }

  const printViaWebBluetooth = async () => {
    if (!lastBill) return;
    if (!navigator.bluetooth) {
      showToast('ඔබගේ Browser එක Web Bluetooth API සඳහා සහාය නොදක්වයි. කරුණාකර Google Chrome භාවිතා කරන්න.', 'error');
      return;
    }
    setIsPrinting(true);
    try {
      showToast('ප්‍රින්ටරය තෝරන්න...', 'info');
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
      });

      const server = await device.gatt.connect();
      let service, characteristic;
      const services = await server.getPrimaryServices();
      
      for (const srv of services) {
        const characteristics = await srv.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            service = srv;
            characteristic = char;
            break;
          }
        }
        if (characteristic) break;
      }

      if (!characteristic) {
        throw new Error('ප්‍රින්ටරයේ අදාළ සේවාව (Characteristic) සොයාගත නොහැක.');
      }

      const items = lastBill.items;
      const tot = lastBill.total;
      const ESC = "\x1B";
      const CENTER = ESC + "\x61\x01";
      const LEFT = ESC + "\x61\x00";
      const BOLD_ON = ESC + "\x45\x01";
      const BOLD_OFF = ESC + "\x45\x00";
      const LINE = "-".repeat(printerSize) + "\n";

      let textToPrint = "";
      textToPrint += CENTER + BOLD_ON + billHeader + "\n" + BOLD_OFF;
      textToPrint += lastBill.date + "\n";
      textToPrint += LINE + LEFT;
      
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
      textToPrint += "\n" + billFooter + "\n\n\n\n";

      const encoder = new TextEncoder();
      const data = encoder.encode(textToPrint);
      
      const CHUNK_SIZE = 512;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await characteristic.writeValue(chunk);
      }

      showToast('Printed Successfully!', 'success');
      setTimeout(() => device.gatt.disconnect(), 1000);

    } catch (error) {
      console.error(error);
      showToast('Print failed or user cancelled. Please make sure printer is ON and paired.', 'error');
    } finally {
      setIsPrinting(false);
    }
  };

  const productPanel = (
    <div className="flex flex-col space-y-3 overflow-hidden min-h-0 flex-1">
      <div className="flex gap-2">
        {/* 🔴 FIXED: Changed placeholder to "I want to sell..." */}
        <input className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base" placeholder="🔍 I want to sell..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={startScanner}><BsUpcScan size={18} /></button>
        {scanner && <button className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm" onClick={stopScanner}>Stop</button>}
      </div>
      <div id="reader" className={`w-full ${scanner ? '' : 'hidden'}`} />
      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center opacity-50">📦 No products found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {/* 🔴 FIXED: Search by BOTH Name and SKU */}
          {products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())).map(p => {
            const cartItem = cart.find(i => i.id === p.id)
            const inCartQty = cartItem ? cartItem.qty : 0
            const currentLiveStock = p.stock - inCartQty
            const isOutOfStock = currentLiveStock <= 0

            return (
              <button key={p.id} className={`relative p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left shadow-sm flex flex-col justify-between ${inCartQty > 0 ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-gray-700' : ''} ${isOutOfStock && p.preventOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={() => addToCart(p)}>
                {inCartQty > 0 && <span className="absolute top-2 right-2 bg-blue-600 text-white font-extrabold text-xs px-2 py-0.5 rounded-full shadow-md">x {inCartQty}</span>}
                {isOutOfStock && <span className={`absolute top-2 left-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${p.preventOutOfStock ? 'bg-red-600' : 'bg-orange-500'}`}>Out of Stock</span>}
                
                <div>
                  <div className="font-semibold text-sm sm:text-base mt-2 line-clamp-2">{p.name}</div>
                  {/* 🔴 FIXED: Show SKU visually under the product name */}
                  <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 opacity-80">SKU: {p.sku || 'N/A'}</div>
                </div>
                
                <div className="text-xs sm:text-sm opacity-70 mt-2">{currency}{p.price} | Live Stock: <span className={isOutOfStock ? "text-red-500 font-bold" : "font-bold text-blue-600"}>{currentLiveStock}</span></div>
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

      {/* 🔴 FIXED: Visual Indicator for Walk-in Customers */}
      {selectedCustomer ? (
        <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm">
          <p className="font-bold">{selectedCustomer.name}</p>
          <p className={selectedCustomer.total_credit > 0 ? 'text-red-500 font-semibold' : ''}>Credit: {currency}{selectedCustomer.total_credit}</p>
        </div>
      ) : (
        !customerPhone && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs text-center border border-blue-100 dark:border-blue-800/50">
            ℹ️ No customer selected. Sale will be saved as <b>Walk-in Customer</b>.
          </div>
        )
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1 mt-2">
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
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Cheque Number" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} />
          <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
        </div>
      )}
      {paymentMethod === 'bank_transfer' && (
        <div className="mb-3"><input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="Bank Reference" value={bankReference} onChange={e => setBankReference(e.target.value)} /></div>
      )}
      {paymentMethod === 'credit' && (
        <div className="mb-3"><label className="block text-sm font-medium mb-1">Due Date</label><input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)} /></div>
      )}

      <div className="flex gap-2 mt-auto">
        <button className="flex-1 px-3 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50" onClick={() => checkout('completed')} disabled={cart.length === 0}>✅ Checkout ({totalItemCount})</button>
        <button className="flex-1 px-3 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50" onClick={() => checkout('hold')} disabled={cart.length === 0}>⏸️ Hold</button>
      </div>

      {lastBill && (
        <div className="flex gap-2 mt-2">
          <button onClick={shareLastBill} className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center gap-2 font-bold shadow-md">
            <BsWhatsapp size={18} /> Share Receipt
          </button>
          
          <div className="flex-1 flex gap-2">
            <select 
              className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-2 text-xs font-bold text-gray-700 dark:text-white"
              value={printerSize}
              onChange={(e) => setPrinterSize(Number(e.target.value))}
            >
              <option value={32}>58mm</option>
              <option value={48}>80mm</option>
            </select>
            <button onClick={printViaWebBluetooth} disabled={isPrinting} className="flex-1 px-2 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-bold shadow-md disabled:opacity-50">
              {isPrinting ? 'Printing...' : <><FiBluetooth size={18} /> BT Print</>}
            </button>
          </div>
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

      {customerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold">📇 Import Contact</h3>
              <button onClick={() => setCustomerModal(false)}><FiX size={20} /></button>
            </div>
            <p className="text-sm opacity-80 text-center">ඔබගේ දුරකථනයේ Web Contacts API සඳහා සහාය නොදක්වයි. කරුණාකර VCF ෆයිල් එකක් හරහා අප්ලෝඩ් කරන්න.</p>
            <label className="bg-blue-600 text-white text-sm font-bold px-4 py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2">
              <FiUpload /> VCF / VCard එකක් තෝරන්න
              <input type="file" accept=".vcf,.vcard" onChange={handleVcfUpload} className="hidden" />
            </label>
          </div>
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
    </>
  )
}