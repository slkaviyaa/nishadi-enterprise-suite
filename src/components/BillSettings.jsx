'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import PageTemplate from './PageTemplate';

export default function BillSettings() {
  const { branch, user } = useAuth()
  
  // 🚀 Full Customizable State with Dynamic QR
  const [form, setForm] = useState({
    // Texts
    greeting_text: 'ආයුබෝවන්',
    header_text: '', 
    contact_info: '',
    tax_number: '', 
    bill_number_prefix: 'Bill RBR-',
    footer_text: 'Thank You! Come Again...', 
    footer_text_sinhala: 'ස්තුතියි! නැවත එන්න...',
    
    // Config
    printer_ip: '',
    paper_size: '80mm',
    logo_url: '', 
    margin_top: 10, margin_bottom: 10, margin_left: 10, margin_right: 10,
    
    // Toggles
    show_logo: false,
    show_greeting: true,
    show_header: true,
    show_contact: true,
    show_bill_no: true,
    show_date_time: true,
    show_customer_info: true,
    show_tax_no: true,
    show_table_headers: true,
    show_total_items: true,
    show_subtotal: true,
    show_payment_details: true,
    show_dynamic_qr: false, // 👈 New Dynamic QR Toggle
    show_footer: true,
    show_watermark: true
  })
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (branch) {
      supabase.from('bill_settings').select('*').eq('branch_id', branch).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [branch])

  const handleChange = (key, value) => setForm({ ...form, [key]: value })

  const handleImageUpload = async (event) => {
    try {
      setUploading(true)
      const file = event.target.files[0]
      if (!file) return
      const fileExt = file.name.split('.').pop()
      const fileName = `qr-logo-${branch}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('logos').getPublicUrl(fileName)
      handleChange('logo_url', data.publicUrl)
      alert('QR/Logo uploaded successfully!')
    } catch (error) {
      alert('Error uploading image: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    await supabase.from('bill_settings').upsert({ branch_id: branch, ...form }, { onConflict: 'branch_id' })
    alert('Settings saved!')
  }

  if (user?.role !== 'owner') return <div className="p-8 text-center text-red-500 font-bold">Access Denied</div>

  // Compact Toggle Component
  const Toggle = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600">
      <span className="text-gray-700 dark:text-gray-200 text-xs font-semibold">{label}</span>
      <button onClick={() => onChange(!value)} className={`min-w-[50px] px-2 py-1 rounded text-[10px] font-bold transition-colors ${value ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  const actions = (
    <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-colors text-sm" onClick={save}>
      💾 Save Configurations
    </button>
  )

  return (
    <PageTemplate
      title="🧾 Ultimate Bill Customization"
      subtitle="Total control over your receipt layout, texts, and elements"
      actions={actions}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        
        {/* COLUMN 1: Text & Editable Info */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-4 overflow-y-auto max-h-[750px] custom-scrollbar">
          <h3 className="font-bold text-gray-800 dark:text-white border-b pb-2 sticky top-0 bg-white dark:bg-gray-800 z-10">Editable Texts</h3>
          
          <div>
            <label className="text-xs font-semibold text-gray-500">Greeting Text (Top)</label>
            <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.greeting_text} onChange={e => handleChange('greeting_text', e.target.value)} placeholder="ආයුබෝවන්" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Shop Name / Header</label>
            <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.header_text} onChange={e => handleChange('header_text', e.target.value)} placeholder="Nishadi Motors" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Contact Details (Address, Phone)</label>
            <textarea className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" rows="2" value={form.contact_info} onChange={e => handleChange('contact_info', e.target.value)} placeholder="Dehiattakandiya&#10;0775931285"></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500">Bill Prefix</label>
              <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.bill_number_prefix} onChange={e => handleChange('bill_number_prefix', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Tax/VAT No.</label>
              <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.tax_number} onChange={e => handleChange('tax_number', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Footer Message (English)</label>
            <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.footer_text} onChange={e => handleChange('footer_text', e.target.value)} placeholder="Thank You! Come Again..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500">Footer Message (Sinhala)</label>
            <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.footer_text_sinhala} onChange={e => handleChange('footer_text_sinhala', e.target.value)} placeholder="ස්තුතියි! නැවත එන්න..." />
          </div>

          <h3 className="font-bold text-gray-800 dark:text-white border-b pb-2 pt-2 sticky top-0 bg-white dark:bg-gray-800 z-10">Hardware Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500">Printer IP</label>
              <input type="text" className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.printer_ip} onChange={e => handleChange('printer_ip', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Paper Roll Size</label>
              <select className="w-full mt-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700" value={form.paper_size} onChange={e => handleChange('paper_size', e.target.value)}>
                <option value="80mm">80mm Thermal</option><option value="58mm">58mm Thermal</option><option value="A4">A4 Standard</option>
              </select>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Toggles & Margins (The Master Control Panel) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-4 overflow-y-auto max-h-[750px] custom-scrollbar">
          
          <h3 className="font-bold text-gray-800 dark:text-white border-b pb-2 sticky top-0 bg-white dark:bg-gray-800 z-10">Print Margins (px)</h3>
          <div className="grid grid-cols-4 gap-2">
            <div><label className="text-[10px] text-gray-500 block">Top</label><input type="number" className="w-full border rounded p-1 text-xs" value={form.margin_top} onChange={e => handleChange('margin_top', Number(e.target.value))} /></div>
            <div><label className="text-[10px] text-gray-500 block">Bottom</label><input type="number" className="w-full border rounded p-1 text-xs" value={form.margin_bottom} onChange={e => handleChange('margin_bottom', Number(e.target.value))} /></div>
            <div><label className="text-[10px] text-gray-500 block">Left</label><input type="number" className="w-full border rounded p-1 text-xs" value={form.margin_left} onChange={e => handleChange('margin_left', Number(e.target.value))} /></div>
            <div><label className="text-[10px] text-gray-500 block">Right</label><input type="number" className="w-full border rounded p-1 text-xs" value={form.margin_right} onChange={e => handleChange('margin_right', Number(e.target.value))} /></div>
          </div>

          <h3 className="font-bold text-gray-800 dark:text-white border-b pb-2 pt-2 sticky top-0 bg-white dark:bg-gray-800 z-10">Static Image Logo</h3>
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-700/30 text-center flex flex-col items-center">
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="block w-full text-[10px] text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700 cursor-pointer" />
            {form.logo_url && !uploading && <button onClick={() => handleChange('logo_url', '')} className="text-[10px] text-red-500 mt-2 hover:underline">Remove Image</button>}
          </div>

          <h3 className="font-bold text-gray-800 dark:text-white border-b pb-2 pt-2 sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between">
            <span>Element Toggles</span>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">God Mode</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Toggle label="Show Uploaded Logo" value={form.show_logo} onChange={v => handleChange('show_logo', v)} />
            <Toggle label="Auto-Generate QR" value={form.show_dynamic_qr} onChange={v => handleChange('show_dynamic_qr', v)} />
            <Toggle label="Show Greeting" value={form.show_greeting} onChange={v => handleChange('show_greeting', v)} />
            <Toggle label="Show Shop Name" value={form.show_header} onChange={v => handleChange('show_header', v)} />
            <Toggle label="Show Contact" value={form.show_contact} onChange={v => handleChange('show_contact', v)} />
            <Toggle label="Show Tax/VAT No" value={form.show_tax_no} onChange={v => handleChange('show_tax_no', v)} />
            <Toggle label="Show Bill No" value={form.show_bill_no} onChange={v => handleChange('show_bill_no', v)} />
            <Toggle label="Show Date & Time" value={form.show_date_time} onChange={v => handleChange('show_date_time', v)} />
            <Toggle label="Show Customer Details" value={form.show_customer_info} onChange={v => handleChange('show_customer_info', v)} />
            <Toggle label="Show Item Headers" value={form.show_table_headers} onChange={v => handleChange('show_table_headers', v)} />
            <Toggle label="Show Total Items" value={form.show_total_items} onChange={v => handleChange('show_total_items', v)} />
            <Toggle label="Show Subtotal & Disc." value={form.show_subtotal} onChange={v => handleChange('show_subtotal', v)} />
            <Toggle label="Show Payment Details" value={form.show_payment_details} onChange={v => handleChange('show_payment_details', v)} />
            <Toggle label="Show Footer Message" value={form.show_footer} onChange={v => handleChange('show_footer', v)} />
            <Toggle label="Show System Watermark" value={form.show_watermark} onChange={v => handleChange('show_watermark', v)} />
          </div>
        </div>

        {/* COLUMN 3: Live Preview (Dynamic based on toggles) */}
        <div className="bg-gray-100 dark:bg-gray-900 p-6 rounded-xl shadow-inner border border-gray-300 dark:border-gray-700 flex flex-col items-center overflow-y-auto max-h-[750px] custom-scrollbar">
          <h3 className="font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-widest text-xs sticky top-0">Live Receipt Preview</h3>
          
          <div 
            className="bg-white text-black font-mono shadow-2xl transition-all duration-200 text-[11px] leading-tight"
            style={{
              width: form.paper_size === '58mm' ? '220px' : form.paper_size === 'A4' ? '100%' : '300px',
              paddingTop: `${form.margin_top || 0}px`,
              paddingBottom: `${form.margin_bottom || 0}px`,
              paddingLeft: `${form.margin_left || 0}px`,
              paddingRight: `${form.margin_right || 0}px`,
            }}
          >
            {/* 1. Logo (Uploaded Image) */}
            {form.show_logo && form.logo_url && (
              <div className="flex justify-center mb-2">
                <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain grayscale" />
              </div>
            )}
            
            {/* 2. Header Block */}
            {form.show_greeting && <div className="text-center font-bold text-[14px] mb-1">{form.greeting_text || 'ආයුබෝවන්'}</div>}
            {form.show_header && <div className="text-center font-extrabold text-[15px] mb-1">{form.header_text || 'SHOP NAME'}</div>}
            {form.show_contact && <div className="text-center whitespace-pre-wrap mb-3 text-[10px]">{form.contact_info || 'Address\nPhone'}</div>}
            {form.show_tax_no && form.tax_number && <div className="text-center text-[10px] mb-2">VAT/TAX: {form.tax_number}</div>}
            
            {/* 3. Meta Block */}
            {(form.show_bill_no || form.show_date_time) && (
              <div className="flex justify-between items-end mb-1 text-[10px]">
                {form.show_bill_no ? <div>{form.bill_number_prefix}1161</div> : <div></div>}
                {form.show_date_time && <div>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>}
              </div>
            )}
            
            {/* 4. Customer Info */}
            {form.show_customer_info && (
              <div className="mb-2 text-[10px] break-words">
                <div>Customer : "Chandimal Diyawiddagama"</div>
                <div>Phone: +94761689175</div>
              </div>
            )}

            <div className="border-b border-dashed border-gray-400 my-1"></div>
            
            {/* 5. Table Headers */}
            {form.show_table_headers && (
              <>
                <div className="flex justify-between font-bold text-[9px] mb-1">
                  <div className="w-1/3 text-left">උපරිම<br/>සිල්ලර<br/>මිල</div>
                  <div className="w-1/4 text-center flex items-end justify-center">Rate</div>
                  <div className="w-1/6 text-center flex items-end justify-center">Qty</div>
                  <div className="w-1/4 text-right flex items-end justify-end">Amount</div>
                </div>
                <div className="border-b border-dashed border-gray-400 my-1"></div>
              </>
            )}
            
            {/* 6. Items */}
            <div className="space-y-2 mt-2">
              <div>
                <div className="truncate">Rollers RVB140...</div>
                <div className="flex justify-between mt-0.5">
                  <span className="w-1/3">8,500.00</span>
                  <span className="w-1/4 text-center">7,365.00</span>
                  <span className="w-1/6 text-center">1</span>
                  <span className="w-1/4 text-right">7,365.00</span>
                </div>
              </div>
              <div>
                <div className="truncate">Bearing 6306...</div>
                <div className="flex justify-between mt-0.5">
                  <span className="w-1/3">525.00</span>
                  <span className="w-1/4 text-center">525.00</span>
                  <span className="w-1/6 text-center">8</span>
                  <span className="w-1/4 text-right">4,200.00</span>
                </div>
              </div>
            </div>

            <div className="border-b border-dashed border-gray-400 my-1 mt-3"></div>
            
            {/* 7. Totals & Payment */}
            <div className="space-y-1 mt-2 text-[10px]">
              {form.show_total_items && <div className="flex justify-between"><span>Total Items</span><span>9</span></div>}
              
              {form.show_subtotal && (
                <>
                  <div className="flex justify-between"><span>Subtotal</span><span>50,885.00</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>0.00</span></div>
                </>
              )}
              
              <div className="flex justify-between items-center font-bold mt-2 pt-1 border-t border-dotted border-gray-400">
                <span>Total Amount</span>
                <span className="text-[13px]">රු58,885.00</span>
              </div>
              
              {form.show_payment_details && (
                <>
                  <div className="flex justify-between text-gray-600 mt-2"><span>Amount Received</span><span>60,000.00</span></div>
                  <div className="flex justify-between text-gray-600"><span>Payment details</span><span>Cash</span></div>
                </>
              )}
            </div>

            <div className="border-b border-dashed border-gray-400 my-2"></div>

            {/* 8. Auto-Generated QR Code */}
            {form.show_dynamic_qr && (
              <div className="flex flex-col items-center justify-center my-3">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${form.header_text || 'Shop'}\nBill: ${form.bill_number_prefix}1161\nTotal: Rs.58885.00`)}`} 
                  alt="Dynamic QR" 
                  className="h-16 w-16 grayscale" 
                />
                <span className="text-[8px] mt-1 text-gray-500 font-semibold">Scan for Details</span>
              </div>
            )}

            {/* 9. Footer */}
            {form.show_footer && (
              <div className="text-center font-semibold mt-2 whitespace-pre-wrap text-[10px]">
                {form.footer_text || 'Thank You! Come Again...'}{'\n'}
                {form.footer_text_sinhala || 'ස්තුතියි! නැවත එන්න...'}
              </div>
            )}
            
            {/* 10. Watermark */}
            {form.show_watermark && <div className="text-center text-[8px] text-gray-400 mt-3 opacity-70">System by Ceylon Digi Solutions</div>}
          </div>
        </div>

      </div>
    </PageTemplate>
  )
}