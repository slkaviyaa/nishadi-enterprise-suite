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
      console.error("Error loading bills:", err.message || err)
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
    const total = parseFloat(bill.total_amount || bill.total || bill.grand_total || bill.subtotal || bill.amount || 0)
    const paid = parseFloat(bill.paid_amount || bill.amount_paid || bill.paid || 0)
    const due = total - paid
    
    setBillTotalInput(total > 0 ? total.toString() : '')
    setPaymentAmount(due > 0 ? due.toString() : '0')
    setIsModalOpen(true)
  }

  // 🖨️ UNIVERSAL RECEIPT PRINTING FOR PAYMENTS
  const printPaymentReceipt = (bill, paidNow, finalTotal) => {
    const s = billSettings || {};
    const receiptNo = 'PR-' + Date.now().toString().slice(-6);
    const receiptId = bill.id ? bill.id.slice(0,6).toUpperCase() : 'REC';
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`PR:${receiptNo}|Bill:${bill.bill_no || receiptId}|Total:${finalTotal}`)}`;
    const balanceDue = Math.max(0, finalTotal - ((bill.paid_amount || 0) + paidNow));

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { margin: 0; size: ${s.paper_size || '80mm'} auto; } 
          body { 
            font-family: 'Courier New', Courier, monospace; 
            width: ${s.paper_size === '58mm' ? '48mm' : '72mm'}; 
            margin: 0 auto; 
            padding-top: ${s.margin_top !== undefined ? s.margin_top : 10}px;
            padding-bottom: ${s.margin_bottom !== undefined ? s.margin_bottom : 10}px;
            padding-left: ${s.margin_left !== undefined ? s.margin_left : 10}px;
            padding-right: ${s.margin_right !== undefined ? s.margin_right : 10}px;
            color: black; 
            font-size: 11px;
            line-height: 1.2;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .flex { display: flex; justify-content: space-between; align-items: flex-end; }
          .border-b { border-bottom: 1px dashed black; margin: 4px 0; padding-bottom: 2px; }
          .text-xs { font-size: 9px; }
          .receipt-title { font-size: 14px; font-weight: bold; margin: 8px 0; background: #000; color: #fff; padding: 3px; text-align: center; }
        </style>
      </head>
      <body>
        ${s.show_logo !== false && s.logo_url ? `<div class="text-center" style="margin-bottom: 5px;"><img src="${s.logo_url}" style="height: 50px; filter: grayscale(100%);" /></div>` : ''}
        ${s.show_greeting !== false ? `<div class="text-center font-bold" style="font-size: 14px; margin-bottom: 2px;">${s.greeting_text || 'ආයුබෝවන්'}</div>` : ''}
        ${s.show_header !== false ? `<div class="text-center font-bold" style="font-size: 16px; margin-bottom: 5px;">${s.header_text || 'Nishadi Motors'}</div>` : ''}
        ${s.show_contact !== false ? `<div class="text-center text-xs" style="margin-bottom: 8px; white-space: pre-wrap;">${s.contact_info || ''}</div>` : ''}

        <div class="receipt-title">PAYMENT RECEIPT</div>
        
        <div class="border-b"></div>
        <div><strong>Receipt No:</strong> ${receiptNo}</div>
        <div><strong>Bill No:</strong> #${bill.bill_no || receiptId}</div>
        <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
        <div><strong>Customer:</strong> ${bill.customers?.name || 'Walk-in'}</div>
        ${bill.customers?.phone ? `<div><strong>Phone:</strong> ${bill.customers.phone}</div>` : ''}
        <div class="border-b"></div>

        <div class="flex"><span>Bill Total:</span> <span>${currency}${parseFloat(finalTotal).toLocaleString()}</span></div>
        <div class="flex"><span>Prev. Paid:</span> <span>${currency}${parseFloat(bill.paid_amount || 0).toLocaleString()}</span></div>
        <div class="flex font-bold" style="margin-top: 4px;"><span>Paid Now:</span> <span>${currency}${parseFloat(paidNow).toLocaleString()}</span></div>
        
        <div class="border-b"></div>
        <div class="flex font-bold" style="font-size: 13px;"><span>Balance Due:</span> <span>${currency}${balanceDue.toLocaleString()}</span></div>
        <div class="border-b"></div>

        ${s.show_dynamic_qr !== false ? `
        <div class="text-center" style="margin: 10px 0;">
          <img src="${qrUrl}" style="height: 60px; width: 60px; filter: grayscale(100%);" />
          <div style="font-size: 8px; margin-top: 3px; color: #555;">Scan QR for Receipt Info</div>
        </div>` : ''}

        ${s.show_footer !== false ? `
        <div class="text-center font-bold text-xs" style="margin-top: 8px; white-space: pre-wrap;">${s.footer_text || 'Thank You! Come Again.'}\n${s.footer_text_sinhala || 'ස්තුතියි! නැවත එන්න...'}</div>` : ''}

        <div class="text-center" style="font-size: 8px; margin-top: 15px; border-top: 1px dotted #000; padding-top: 5px; color: #000;">
          Powered by Nishadi Enterprise Suite.<br/>
          Design & Developed by Ceylon Digi Solutions
        </div>
      </body>
      </html>
    `;

    // 📱 Device Detection & Universal Printing
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /android/i.test(userAgent);

    if (isAndroid) {
      try {
        const base64Html = btoa(unescape(encodeURIComponent(receiptHTML)));
        const rawbtIntentUrl = `intent:base64,${base64Html}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
        window.location.href = rawbtIntentUrl;
      } catch (e) {
        console.error('RawBT Print Error:', e);
        if (typeof showToast === 'function') {
           showToast('Printing failed. Please ensure RawBT app is installed.', 'error');
        }
      }
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
      doc.write(receiptHTML);
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
      newStatus = 'Completed'
    } else if (newPaidAmount > 0) {
      newStatus = 'Partial'
    }

    try {
      setLoading(true)
      
      const updatePayload = {
        total_amount: confirmedTotal,
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
        console.log("Optional receipt table error:", receiptErr)
      }

      showToast('Payment processed & receipt printed!', 'success')
      setIsModalOpen(false)
      
      printPaymentReceipt(selectedBill, amountToPay, confirmedTotal)
      
      const updatedList = allBills.map(b => 
        b.id === selectedBill.id ? { ...b, total_amount: confirmedTotal, paid_amount: newPaidAmount, status: newStatus } : b
      )
      setAllBills(updatedList)
      setFilteredBills(filteredBills.map(b => 
        b.id === selectedBill.id ? { ...b, total_amount: confirmedTotal, paid_amount: newPaidAmount, status: newStatus } : b
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
              onClick={() => {
                setIsScannerOpen(true)
                showToast('QR Scanner camera triggered', 'success')
              }}
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
                  const total = parseFloat(bill.total_amount || bill.total || bill.grand_total || bill.subtotal || bill.amount || 0)
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
                <button onClick={() => setIsScannerOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <FiX size={22} />
                </button>
              </div>
              <div className="h-48 bg-gray-100 dark:bg-gray-900 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700">
                <FiMaximize size={48} className="text-blue-500 animate-bounce mb-2" />
                <p className="text-sm font-semibold text-gray-500">Position QR code inside the frame</p>
              </div>
              <p className="text-xs text-gray-400">Physical USB/Bluetooth barcode and QR scanners will automatically type the code into the search box above.</p>
              <button 
                onClick={() => setIsScannerOpen(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
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