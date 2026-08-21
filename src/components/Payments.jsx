'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { 
  FiSearch, FiMaximize, FiUser, FiFileText, FiPhone, FiDollarSign, FiCheckCircle, FiClock, FiX, FiCamera, FiPrinter
} from 'react-icons/fi'
import { Html5Qrcode } from 'html5-qrcode' 

import { Capacitor } from '@capacitor/core';
import { printNativeBluetooth } from '../utils/printerUtils';

export default function Payments() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const { showToast } = useToast()

  const [allBills, setAllBills] = useState([])
  const [filteredBills, setFilteredBills] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [billSettings, setBillSettings] = useState({}) 
  const searchInputRef = useRef(null)

  const [selectedBill, setSelectedBill] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [billTotalInput, setBillTotalInput] = useState('') 
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scanner, setScanner] = useState(null)
  const scanRef = useRef(null)

  const currency = settings?.currency_symbol || 'Rs. '

  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (branch) {
      fetchAllBranchData()
    }
  }, [branch])

  const fetchAllBranchData = async () => {
    setLoading(true)
    try {
      let { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('*')
        .eq('branch_id', branch)
        .order('created_at', { ascending: false })
        .limit(200)

      if (ordersErr) throw ordersErr

      let { data: customersData } = await supabase
        .from('customers')
        .select('id, name, phone')

      const customerMap = {}
      ;(customersData || []).forEach(c => {
        customerMap[c.id] = c
      })

      const mergedBills = (ordersData || []).map(order => ({
        ...order,
        customers: customerMap[order.customer_id] || { name: 'Walk-in Customer', phone: '' }
      }))

      setAllBills(mergedBills)

      const { data: bSettings } = await supabase
        .from('bill_settings')
        .select('*')
        .eq('branch_id', branch)
        .maybeSingle()
      
      if (bSettings) setBillSettings(bSettings)

    } catch (err) {
      showToast('Error loading bills data', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBills([])
      return
    }

    const term = searchTerm.toLowerCase().trim()
    
    const matched = allBills.filter(bill => {
      const billId = String(bill.id || '').toLowerCase()
      const billNo = String(bill.bill_no || '').toLowerCase()
      const custName = String(bill.customers?.name || '').toLowerCase()
      const custPhone = String(bill.customers?.phone || '').toLowerCase()

      return billId.includes(term) || billNo.includes(term) || custName.includes(term) || custPhone.includes(term)
    })

    setFilteredBills(matched)
  }, [searchTerm, allBills])

  const openPaymentModal = (bill) => {
    setSelectedBill(bill)
    const total = parseFloat(bill.total || bill.total_amount || bill.grand_total || bill.subtotal || bill.amount || 0)
    const paid = parseFloat(bill.paid_amount || bill.amount_paid || bill.paid || 0)
    const due = total - paid
    
    setBillTotalInput(total > 0 ? total.toString() : '')
    setPaymentAmount(due > 0 ? due.toString() : '0')
    setIsModalOpen(true)
  }

  const startScanner = async () => {
    setIsScannerOpen(true)
    if (scanRef.current) { 
      try { await scanRef.current.stop() } catch(e) {}; 
      scanRef.current = null 
    }

    setTimeout(async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          stream.getTracks().forEach(track => track.stop());
        }

        const html5QrCode = new Html5Qrcode("reader-payments")
        scanRef.current = html5QrCode
        
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => { 
            setSearchTerm(decodedText);
            stopScanner();
            showToast(`Scanned successfully!`, 'success');
          },
          () => {}
        )
        setScanner(html5QrCode)
      } catch (err) { 
        showToast('කැමරාව ආරම්භ කිරීමට නොහැක. (Camera Permission ලබා දෙන්න)', 'error'); 
        setScanner(null) 
      }
    }, 300);
  }

  const stopScanner = () => {
    if (scanRef.current) { try { scanRef.current.stop() } catch(e) {}; scanRef.current = null }
    setScanner(null)
    setIsScannerOpen(false)
  }

  // 🖨️ POS-style receipt printing for payments (table layout, centered, font scaling)
  const printPaymentReceipt = (bill, paidNow, finalTotal) => {
    const s = billSettings || {};
    const is58 = s.paper_size === '58mm';
    const printableWidthPx = is58 ? 384 : 576;

    const fontGreeting = (s.font_size_greeting || 14) * (is58 ? 1.5 : 2.2)
    const fontHeader = (s.font_size_header || 20) * (is58 ? 1.6 : 3.0)
    const fontContact = (s.font_size_contact || 12) * (is58 ? 1.3 : 2.0)
    const fontBody = (s.font_size_body || 12) * (is58 ? 1.4 : 2.2)
    const fontTotal = (s.font_size_total || 15) * (is58 ? 1.6 : 2.6)
    const fontFooter = (s.font_size_footer || 12) * (is58 ? 1.3 : 2.2)
    const fontWatermark = (s.font_size_watermark || 9) * (is58 ? 1.1 : 1.8)

    const receiptNo = 'PR-' + Date.now().toString().slice(-6);
    const billNo = bill.bill_no || bill.id.slice(0,6).toUpperCase();
    const balanceDue = Math.max(0, finalTotal - ((bill.paid_amount || 0) + paidNow));
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`PR:${receiptNo}|Bill:${billNo}|Total:${finalTotal}`)}`;

    // Build HTML fragment (not full document)
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

        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: ${fontBody}px; margin-bottom: 4px;">
          <div>Receipt No: ${receiptNo}</div>
          <div>Bill No: #${billNo}</div>
        </div>
        <div style="margin-top: 2px; font-size: ${fontBody}px;">Date: ${new Date().toLocaleString()}</div>

        <div style="margin-top: 4px; font-size: ${fontBody}px; font-weight: 600;">
          <div>Customer : "${bill.customers?.name || 'Walk-in'}"</div>
          ${bill.customers?.phone ? `<div>Phone: ${bill.customers.phone}</div>` : ''}
        </div>

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 4px;">
          <span>Bill Total</span>
          <span>${currency}${Number(finalTotal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 2px;">
          <span>Prev. Paid</span>
          <span>${currency}${Number(bill.paid_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontTotal}px; font-weight: 900; margin: 6px 0;">
          <span>Paid Now</span>
          <span>${currency}${Number(paidNow).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; font-weight: bold;">
          <span>Balance Due</span>
          <span>${currency}${Number(balanceDue).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
        </div>

        <div style="border-bottom: 2px dashed #000; margin-top: 8px;"></div>
        
        ${s.show_dynamic_qr !== false ? `
        <div style="text-align: center; margin: 10px 0;">
          <img src="${qrUrl}" style="width: ${(s.qr_size || 80) * 1.6}px; height: ${(s.qr_size || 80) * 1.6}px; filter: contrast(150%); display: inline-block;" />
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
      showToast('Printing payment receipt via Bluetooth...', 'info');
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

  const handleProcessPayment = async () => {
    const amountToPay = parseFloat(paymentAmount)
    const confirmedTotal = parseFloat(billTotalInput)

    if (isNaN(amountToPay) || amountToPay <= 0) {
      showToast('Enter a valid payment amount', 'error')
      return
    }

    if (isNaN(confirmedTotal) || confirmedTotal <= 0) {
      showToast('Enter a valid total bill amount', 'error')
      return
    }

    const currentPaid = parseFloat(selectedBill.paid_amount || selectedBill.amount_paid || selectedBill.paid || 0)
    const newPaidAmount = currentPaid + amountToPay

    let newStatus = selectedBill.status
    if (newPaidAmount >= confirmedTotal) {
      newStatus = 'completed'   // lowercase to match POS
    } else if (newPaidAmount > 0) {
      newStatus = 'partial'
    }

    try {
      setLoading(true)
      
      const updatePayload = {
        total: confirmedTotal,            // POS orders table uses 'total'
        paid_amount: newPaidAmount,
        status: newStatus
      }

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', selectedBill.id)

      if (error) throw error

      try {
        await supabase.from('payment_receipts').insert({
          order_id: selectedBill.id,
          customer_id: selectedBill.customer_id,
          branch_id: branch,
          amount_paid: amountToPay
        })
      } catch (receiptErr) {
        console.error('Failed to insert payment_receipt:', receiptErr)
      }

      showToast('Payment processed & receipt printed!', 'success')
      setIsModalOpen(false)
      
      printPaymentReceipt(selectedBill, amountToPay, confirmedTotal)
      
      const updatedList = allBills.map(b => 
        b.id === selectedBill.id ? { ...b, total: confirmedTotal, paid_amount: newPaidAmount, status: newStatus } : b
      )
      setAllBills(updatedList)
      setFilteredBills(filteredBills.map(b => 
        b.id === selectedBill.id ? { ...b, total: confirmedTotal, paid_amount: newPaidAmount, status: newStatus } : b
      ))
      
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTemplate>
      <div className="space-y-6 pb-10 max-w-5xl mx-auto">
        
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            💳 Search & Settle Bills
          </h2>
          <p className="text-sm opacity-70">Type customer name, phone digit, bill number, or scan QR to search instantly.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400" size={20} />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type name, phone, bill no, or scan QR..."
                className="w-full pl-11 pr-10 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-blue-100 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition text-lg"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <FiX size={20} />
                </button>
              )}
            </div>

            <button 
              onClick={startScanner}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-lg whitespace-nowrap"
            >
              <FiCamera size={22} /> Scan QR
            </button>
          </div>
          {loading && <div className="text-xs text-blue-500 font-bold mt-2 animate-pulse">Loading branch bills...</div>}
        </div>

        {searchTerm.trim().length > 0 && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 ml-1">Matching Bills ({filteredBills.length})</h3>
            
            {filteredBills.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 p-8 rounded-xl text-center text-gray-400 font-medium border border-gray-200 dark:border-gray-700">
                No bills found matching &quot;{searchTerm}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBills.map(bill => {
                  const total = parseFloat(bill.total || bill.total_amount || bill.grand_total || bill.subtotal || bill.amount || 0)
                  const paid = parseFloat(bill.paid_amount || bill.amount_paid || bill.paid || 0)
                  const due = total - paid
                  const isPaid = due <= 0

                  return (
                    <div key={bill.id} className={`bg-white dark:bg-gray-800 rounded-xl border-l-4 p-5 shadow-sm transition hover:shadow-md ${isPaid ? 'border-green-500' : 'border-orange-500'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 mb-1">
                            <FiFileText /> #{bill.bill_no || bill.id.substring(0, 8).toUpperCase()}
                            <span className="text-gray-300">•</span>
                            <span>{new Date(bill.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
                            <FiUser className="text-blue-500" />
                            {bill.customers?.name || 'Walk-in Customer'}
                          </div>
                          {bill.customers?.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                              <FiPhone size={12} /> {bill.customers.phone}
                            </div>
                          )}
                        </div>
                        
                        <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isPaid ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                          {isPaid ? <FiCheckCircle /> : <FiClock />}
                          {isPaid ? 'PAID' : 'PENDING'}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg mb-4">
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase">Bill Total</div>
                          <div className="font-bold">{currency}{total.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 uppercase">Paid So Far</div>
                          <div className="font-bold text-green-600">{currency}{paid.toLocaleString()}</div>
                        </div>
                        <div className="border-l border-gray-200 dark:border-gray-700 pl-2">
                          <div className="text-[10px] font-bold text-red-500 uppercase">Due Amount</div>
                          <div className="font-extrabold text-red-600">{currency}{due > 0 ? due.toLocaleString() : '0'}</div>
                        </div>
                      </div>

                      <button
                        onClick={() => openPaymentModal(bill)}
                        disabled={isPaid}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition ${isPaid ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
                      >
                        <FiDollarSign />
                        {isPaid ? 'Fully Settled' : 'Settle Payment'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {isScannerOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
              <div className="flex justify-between items-center border-b pb-3 dark:border-gray-700">
                <h3 className="font-bold text-lg flex items-center gap-2"><FiCamera /> Scan Bill QR Code</h3>
                <button onClick={stopScanner} className="text-gray-400 hover:text-gray-600">
                  <FiX size={22} />
                </button>
              </div>
              
              <div id="reader-payments" className="w-full overflow-hidden rounded-xl bg-black min-h-[250px] border-2 border-dashed border-gray-300 dark:border-gray-700"></div>

              <p className="text-xs text-gray-400">Position QR code inside the frame to search instantly. Physical USB/Bluetooth barcode and QR scanners will automatically type the code into the search box above.</p>
              
              <button 
                onClick={stopScanner}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition"
              >
                Close Scanner
              </button>
            </div>
          </div>
        )}

        {isModalOpen && selectedBill && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform animate-scaleIn">
              
              <div className="flex justify-between items-center p-4 bg-green-600 text-white">
                <h3 className="flex items-center gap-2 font-bold"><FiDollarSign /> Settle Payment</h3>
                <button onClick={() => setIsModalOpen(false)} className="bg-green-700 hover:bg-green-800 p-1.5 rounded-lg transition">
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400 font-bold">
                    Bill for: {selectedBill.customers?.name || 'Walk-in'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Total Bill Amount</label>
                  <input 
                    type="number" 
                    value={billTotalInput}
                    onChange={(e) => setBillTotalInput(e.target.value)}
                    placeholder="Enter total bill amount"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Enter Paying Amount</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-bold text-gray-500">
                      {currency}
                    </div>
                    <input 
                      type="number" 
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-green-200 dark:border-gray-700 rounded-xl font-bold text-gray-900 dark:text-white focus:border-green-500 outline-none text-2xl"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProcessPayment}
                  disabled={loading}
                  className="flex-[2] py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FiPrinter size={18} /> {loading ? 'Processing...' : 'Confirm & Print'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </PageTemplate>
  )
}