'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Html5Qrcode } from 'html5-qrcode'
import { BsUpcScan, BsPrinter, BsWhatsapp } from 'react-icons/bs'
import jsPDF from 'jspdf'

export default function POS() {
  const { branch } = useAuth()
  const { settings } = useSettings()
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
  const [holdNote, setHoldNote] = useState('')

  const currency = settings?.currency_symbol || 'Rs. '
  const taxEnabled = settings?.tax_enabled || false
  const taxRate = settings?.tax_rate || 0
  const billHeader = settings?.bill_header || 'Nishadi Motors'
  const billFooter = settings?.bill_footer || 'Thank you!'
  const scanRef = useRef(null)

  // ---------------- DATA FETCH ----------------
  useEffect(() => {
    if (!branch) return
    supabase.from('branch_products')
      .select('id, price, products(sku, name)')
      .eq('branch_id', branch)
      .then(({ data }) => {
        if (data) setProducts(data.map(p => ({ id: p.id, sku: p.products?.sku, name: p.products?.name, price: p.price })))
      })
    supabase.from('customers').select('*').eq('branch_id', branch).then(({ data }) => setCustomers(data || []))
    fetchHoldOrders()
  }, [branch])

  const fetchHoldOrders = () => {
    supabase.from('orders')
      .select('id, total, hold_note, created_at')
      .eq('branch_id', branch)
      .eq('status', 'hold')
      .order('created_at', { ascending: false })
      .then(({ data }) => setHoldOrders(data || []))
  }

  // ---------------- CART OPERATIONS ----------------
  const addToCart = (prod) => {
    setCart(prev => {
      const exist = prev.find(i => i.id === prod.id)
      if (exist) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1 }]
    })
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const taxAmount = taxEnabled ? (subtotal * taxRate / 100) : 0
  const total = subtotal + taxAmount
  const final = total - discount

  // ---------------- CUSTOMER ----------------
  const createNewCustomer = async () => {
    if (!newCustName || !customerPhone) return alert('Name and Phone required')
    const { data: c } = await supabase.from('customers').insert({
      branch_id: branch, name: newCustName, phone: customerPhone, address: newCustAddress
    }).select().single()
    if (c) {
      setCustomers(prev => [...prev, c])
      setSelectedCustomer(c)
      setNewCustName('')
      setNewCustAddress('')
      setNewCustomerForm(false)
    }
  }

  // ---------------- CHECKOUT (includes HOLD) ----------------
  const checkout = async (status = 'completed') => {
    if (cart.length === 0) return
    let cid = selectedCustomer?.id
    if (!cid && customerPhone) {
      const { data: nc } = await supabase.from('customers').insert({
        branch_id: branch, phone: customerPhone, name: 'Cust ' + customerPhone.slice(-4)
      }).select().single()
      if (nc) { cid = nc.id; setCustomers(prev => [...prev, nc]); setSelectedCustomer(nc) }
    }
    const { data: order } = await supabase.from('orders').insert({
      branch_id: branch,
      total: final,
      discount,
      status,
      customer_id: cid,
      payment_method: status === 'hold' ? 'cash' : paymentMethod,
      cheque_number: status === 'hold' ? null : (paymentMethod === 'cheque' ? chequeNumber : null),
      cheque_date: status === 'hold' ? null : (paymentMethod === 'cheque' ? chequeDate : null),
      bank_reference: status === 'hold' ? null : (paymentMethod === 'bank_transfer' ? bankReference : null),
      hold_note: status === 'hold' ? holdNote : null,
    }).select().single()
    if (order) {
      await supabase.from('order_items').insert(cart.map(i => ({
        order_id: order.id, branch_product_id: i.id, quantity: i.qty, price: i.price
      })))
      if (status !== 'hold') {
        for (const item of cart) await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty })
        if (selectedCustomer && paymentMethod === 'credit' && status === 'completed') {
          await supabase.from('credit_transactions').insert({
            customer_id: selectedCustomer.id, branch_id: branch, amount: final,
            type: 'purchase', due_date: creditDueDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
          })
          await supabase.from('customers').update({ total_credit: selectedCustomer.total_credit + final }).eq('id', selectedCustomer.id)
        }
      }
      alert(status === 'hold' ? 'Bill Held!' : 'Bill Cut!')
      setCart([])
      setDiscount(0)
      setSelectedCustomer(null)
      setCustomerPhone('')
      setPaymentMethod('cash')
      setChequeNumber('')
      setChequeDate('')
      setBankReference('')
      setCreditDueDate('')
      setHoldNote('')
      if (status === 'hold') fetchHoldOrders()
    }
  }

  // ---------------- LOAD HOLD ORDER (copy to cart, keep in list) ----------------
  const loadHold = async (orderId) => {
    const { data } = await supabase.from('order_items')
      .select('branch_product_id, quantity, price, branch_products(products(name))')
      .eq('order_id', orderId)
    if (data) {
      setCart(data.map(i => ({
        id: i.branch_product_id,
        name: i.branch_products?.products?.name,
        price: i.price,
        qty: i.quantity
      })))
    }
  }

  // ---------------- DELETE HOLD ORDER ----------------
  const deleteHoldOrder = async (orderId) => {
    await supabase.from('orders').delete().eq('id', orderId)
    setHoldOrders(prev => prev.filter(o => o.id !== orderId))
  }

  // ---------------- BARCODE SCANNER ----------------
  const startScanner = async () => {
    if (scanRef.current) { try { await scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    const html5QrCode = new Html5Qrcode("reader")
    scanRef.current = html5QrCode
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const prod = products.find(p => p.sku === decodedText)
          if (prod) addToCart(prod)
          else alert(`Product not found: ${decodedText}`)
          stopScanner()
        },
        () => {}
      )
      setScanner(html5QrCode)
    } catch (err) {
      alert('Camera permission required')
      console.error(err)
      setScanner(null)
      if (scanRef.current) { try { scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    }
  }

  const stopScanner = () => {
    if (scanRef.current) { try { scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    setScanner(null)
  }

  useEffect(() => {
    return () => { if (scanRef.current) { try { scanRef.current.stop() } catch(e) {} } }
  }, [])

  const handlePhoneChange = (e) => {
    const phone = e.target.value
    setCustomerPhone(phone)
    setSelectedCustomer(phone ? customers.find(c => c.phone === phone) || null : null)
  }

  // ---------------- WHATSAPP PDF ----------------
  const whatsappShare = async () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 150] })
    doc.setFontSize(12); doc.text(billHeader, 10, 10)
    doc.setFontSize(8); doc.text(`Date: ${new Date().toLocaleString()}`, 10, 16)
    doc.line(10, 18, 70, 18)
    let y = 22
    cart.forEach(i => {
      doc.text(`${i.name} x${i.qty} - ${currency}${(i.price * i.qty).toFixed(2)}`, 10, y)
      y += 4
    })
    doc.line(10, y, 70, y); y += 4
    doc.text(`Subtotal: ${currency}${subtotal.toFixed(2)}`, 10, y); y += 4
    if (taxEnabled) { doc.text(`Tax (${taxRate}%): ${currency}${taxAmount.toFixed(2)}`, 10, y); y += 4 }
    if (discount > 0) { doc.text(`Discount: -${currency}${discount.toFixed(2)}`, 10, y); y += 4 }
    doc.setFontSize(10); doc.text(`Total: ${currency}${final.toFixed(2)}`, 10, y); y += 5
    doc.setFontSize(8); doc.text(`Payment: ${paymentMethod}`, 10, y)
    if (paymentMethod === 'cheque') { y += 4; doc.text(`Cheque: ${chequeNumber}`, 10, y); y += 4; doc.text(`Date: ${chequeDate}`, 10, y) }
    if (paymentMethod === 'bank_transfer') { y += 4; doc.text(`Ref: ${bankReference}`, 10, y) }
    y += 6; doc.text(billFooter, 10, y)
    const blob = doc.output('blob')
    const fileName = `rec_${Date.now()}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(fileName, blob, { contentType: 'application/pdf', upsert: true })
    if (uploadError) { alert('Upload failed'); return }
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
    window.open(`https://wa.me/?text=${encodeURIComponent(`*${billHeader}*\nReceipt: ${publicUrl}\nTotal: ${currency}${final.toFixed(2)}`)}`, '_blank')
  }

  const printReceipt = () => {
    const content = `
      <html><body style="font-family:monospace">
        <h4>${billHeader}</h4><p>${new Date().toLocaleString()}</p><hr>
        ${cart.map(i => `<p>${i.name} x${i.qty} - ${currency}${(i.price * i.qty).toFixed(2)}</p>`).join('')}
        <hr><p>Subtotal: ${currency}${subtotal.toFixed(2)}</p>
        ${taxEnabled ? `<p>Tax (${taxRate}%): ${currency}${taxAmount.toFixed(2)}</p>` : ''}
        <p>Discount: ${currency}${discount.toFixed(2)}</p>
        <h3>Total: ${currency}${final.toFixed(2)}</h3>
        <p>Payment: ${paymentMethod}</p>
        ${paymentMethod === 'cheque' ? `<p>Cheque: ${chequeNumber} | Date: ${chequeDate}</p>` : ''}
        ${paymentMethod === 'bank_transfer' ? `<p>Ref: ${bankReference}</p>` : ''}
        <p>${billFooter}</p>
      </body></html>
    `
    const win = window.open('', '', 'width=300,height=400')
    win.document.write(content)
    win.print()
  }

  // ---------------- UI RENDER ----------------
  return (
    <div className="flex flex-col lg:flex-row gap-4 animate-fadeIn h-[calc(100vh-120px)]">
      {/* LEFT PANEL */}
      <div className="lg:w-2/5 flex flex-col space-y-3 overflow-hidden">
        <div className="flex gap-2">
          <input className="input input-bordered flex-1" placeholder="🔍 Search products..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-outline btn-square" onClick={startScanner}><BsUpcScan size={18} /></button>
          {scanner && <button className="btn btn-error btn-sm" onClick={stopScanner}>Stop</button>}
        </div>
        <div id="reader" className={`w-full ${scanner ? '' : 'hidden'}`} />
        {products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center opacity-50">📦 No products found.<br/>Add products in Inventory.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
            {products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())).map(p => (
              <button key={p.id} className="btn btn-outline btn-sm h-auto py-3 flex-col hover:scale-105 animate-scaleIn" onClick={() => addToCart(p)}>
                <span className="font-semibold text-sm leading-tight">{p.name}</span>
                <span className="text-xs opacity-80">{currency}{p.price}</span>
              </button>
            ))}
          </div>
        )}

        {/* HOLD ORDERS SECTION */}
        {holdOrders.length > 0 && (
          <div className="collapse collapse-arrow bg-base-200">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-medium">📌 Hold Orders ({holdOrders.length})</div>
            <div className="collapse-content space-y-1 max-h-40 overflow-y-auto">
              {holdOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between bg-base-100 p-2 rounded text-sm">
                  <div>
                    <span className="font-semibold">#{o.id.slice(0,6)}</span>
                    <span className="ml-2">{currency}{o.total}</span>
                    {o.hold_note && <span className="ml-2 text-xs opacity-70">({o.hold_note})</span>}
                  </div>
                  <div className="flex gap-1">
                    <button className="btn btn-xs btn-info" onClick={() => loadHold(o.id)}>📋 Load</button>
                    <button className="btn btn-xs btn-error" onClick={() => deleteHoldOrder(o.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL – BILLING TERMINAL */}
      <div className="lg:w-3/5 bg-[var(--card)] text-[var(--text)] rounded-xl shadow-2xl p-4 lg:p-6 flex flex-col animate-fadeInRight">
        {/* Customer */}
        <div className="flex items-center gap-2 mb-3">
          <input type="tel" className="input input-bordered flex-1 text-lg" placeholder="📞 Phone number" value={customerPhone} onChange={handlePhoneChange} />
          <button className="btn btn-ghost btn-sm text-lg" onClick={() => setNewCustomerForm(true)}>➕</button>
        </div>
        {selectedCustomer && (
          <div className="mb-3 p-2 bg-[var(--bg)] rounded text-sm animate-fadeIn">
            <p className="font-bold">{selectedCustomer.name}</p>
            {selectedCustomer.address && <p className="text-xs opacity-80">{selectedCustomer.address}</p>}
            <p className={selectedCustomer.total_credit > 0 ? 'text-error font-semibold' : ''}>Credit: {currency}{selectedCustomer.total_credit}</p>
          </div>
        )}

        {/* New Customer Modal */}
        {newCustomerForm && (
          <div className="modal modal-open animate-scaleIn">
            <div className="modal-box">
              <h3 className="font-bold text-lg mb-2">New Customer</h3>
              <input type="text" className="input input-bordered w-full mb-2" placeholder="Name" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
              <input type="tel" className="input input-bordered w-full mb-2" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              <input type="text" className="input input-bordered w-full mb-2" placeholder="Address (optional)" value={newCustAddress} onChange={e => setNewCustAddress(e.target.value)} />
              <div className="modal-action flex gap-2">
                <button className="btn btn-success flex-1" onClick={createNewCustomer}>✅ Create</button>
                <button className="btn btn-error flex-1" onClick={() => setNewCustomerForm(false)}>❌ Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto space-y-1 mb-3">
          {cart.length === 0 ? (
            <div className="text-center text-sm opacity-50 py-8">🛒 No items in cart</div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-[var(--bg)] p-2 rounded animate-fadeIn" style={{ animationDelay: `${idx * 0.05}s` }}>
                <span className="font-medium">{item.name} <span className="text-xs opacity-70">x{item.qty}</span></span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{currency}{(item.price * item.qty).toFixed(2)}</span>
                  <button className="btn btn-ghost btn-xs text-error hover:scale-110" onClick={() => removeFromCart(item.id)}>✕</button>
                </span>
              </div>
            ))
          )}
        </div>

        {/* Discount */}
        <div className="flex items-center gap-2 mb-3">
          <input type="number" placeholder="Discount" className="input input-bordered w-28" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
          <span className="text-sm opacity-70">Discount</span>
        </div>

        {/* Totals */}
        <div className="bg-[var(--bg)] rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm"><span>Subtotal</span> <span>{currency}{subtotal.toFixed(2)}</span></div>
          {taxEnabled && <div className="flex justify-between text-sm"><span>Tax ({taxRate}%)</span> <span>{currency}{taxAmount.toFixed(2)}</span></div>}
          {discount > 0 && <div className="flex justify-between text-sm text-error"><span>Discount</span> <span>-{currency}{discount.toFixed(2)}</span></div>}
          <div className="flex justify-between text-xl font-bold mt-1 pt-1 border-t border-[var(--border)]"><span>Total</span> <span>{currency}{final.toFixed(2)}</span></div>
        </div>

        {/* Payment Method (only for checkout, not hold) */}
        <div className="mb-4">
          <div className="text-sm font-medium mb-1">💳 Payment Method</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { method: 'cash', label: 'Cash', color: 'bg-green-600' },
              { method: 'card', label: 'Card', color: 'bg-blue-600' },
              { method: 'cheque', label: 'Cheque', color: 'bg-purple-600' },
              { method: 'credit', label: 'Credit', color: 'bg-orange-500' },
              { method: 'bank_transfer', label: 'Bank', color: 'bg-teal-600' },
            ].map(pm => (
              <button key={pm.method} className={`btn btn-sm capitalize transition-all hover:scale-105 ${paymentMethod === pm.method ? `${pm.color} text-white border-0` : 'btn-outline'}`}
                onClick={() => setPaymentMethod(pm.method)}>{pm.label}</button>
            ))}
          </div>
        </div>

        {/* Conditional payment fields */}
        {paymentMethod === 'cheque' && (
          <div className="grid grid-cols-2 gap-2 mb-3 animate-scaleIn">
            <input type="text" className="input input-bordered" placeholder="Cheque Number" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} />
            <input type="date" className="input input-bordered" value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
          </div>
        )}
        {paymentMethod === 'bank_transfer' && (
          <div className="mb-3 animate-scaleIn"><input type="text" className="input input-bordered w-full" placeholder="Bank Reference" value={bankReference} onChange={e => setBankReference(e.target.value)} /></div>
        )}
        {paymentMethod === 'credit' && (
          <div className="mb-3 animate-scaleIn"><label className="text-sm font-medium block mb-1">Due Date</label><input type="date" className="input input-bordered w-full" value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)} /></div>
        )}

        {/* Hold Note (shown when holding, we'll use a simple prompt or we can add a small input) */}
        <div className="mb-3">
          <input type="text" className="input input-bordered w-full" placeholder="Hold note (optional)" value={holdNote} onChange={e => setHoldNote(e.target.value)} />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-auto">
          <button className="btn btn-success flex-1 btn-lg text-lg font-bold transition-transform hover:scale-105" onClick={() => checkout('completed')} disabled={cart.length === 0}>✅ Checkout</button>
          <button className="btn btn-warning flex-1 btn-lg text-lg font-bold transition-transform hover:scale-105" onClick={() => checkout('hold')} disabled={cart.length === 0}>⏸️ Hold</button>
          <button className="btn btn-secondary btn-lg" onClick={printReceipt} disabled={cart.length === 0} title="Print"><BsPrinter size={20} /></button>
          <button className="btn btn-info btn-lg text-white" onClick={whatsappShare} disabled={cart.length === 0} title="WhatsApp PDF"><BsWhatsapp size={20} /></button>
        </div>
      </div>
    </div>
  )
}