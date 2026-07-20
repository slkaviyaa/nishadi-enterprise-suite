'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function BillSettings() {
  const { branch, user } = useAuth()
  const [form, setForm] = useState({
    header_text: '',
    footer_text: '',
    logo_url: '',
    show_logo: false,
    show_customer_phone: true,
    paper_size: '80mm',
    bill_number_prefix: 'INV-',
    tax_number: '',
    contact_info: '',
    enable_email_receipt: false,
    enable_sms_receipt: false,
    printer_ip: ''
  })

  useEffect(() => {
    supabase.from('bill_settings').select('*').eq('branch_id', branch).single()
      .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
  }, [branch])

  const handleChange = (key, value) => setForm({ ...form, [key]: value })

  const save = async () => {
    await supabase.from('bill_settings').upsert({ branch_id: branch, ...form }, { onConflict: 'branch_id' })
    alert('Settings saved!')
  }

  if (user?.role !== 'owner') return <div className="alert alert-error">Access Denied</div>

  const Toggle = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between">
      <span className="text-gray-700 dark:text-gray-200 font-medium">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`min-w-[80px] px-4 py-1 rounded-full text-sm font-bold transition-colors ${
          value ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-700'
        }`}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">🧾 Bill Customization</h2>
      <div className="card bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Text Fields */}
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Header Text</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.header_text} onChange={e => handleChange('header_text', e.target.value)} placeholder="Nishadi Motors" />
          </div>
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Footer Text</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.footer_text} onChange={e => handleChange('footer_text', e.target.value)} placeholder="Thank you!" />
          </div>
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Logo URL</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.logo_url} onChange={e => handleChange('logo_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Bill Number Prefix</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.bill_number_prefix} onChange={e => handleChange('bill_number_prefix', e.target.value)} placeholder="INV-" />
          </div>
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Tax Number (VAT/GST)</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.tax_number} onChange={e => handleChange('tax_number', e.target.value)} placeholder="VAT123456" />
          </div>
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Contact Info</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.contact_info} onChange={e => handleChange('contact_info', e.target.value)} placeholder="Phone, Email" />
          </div>
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Printer IP (Thermal)</label>
            <input type="text" className="input input-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.printer_ip} onChange={e => handleChange('printer_ip', e.target.value)} placeholder="192.168.1.100" />
          </div>

          {/* Toggles */}
          <Toggle label="Show Logo on Bill" value={form.show_logo} onChange={(v) => handleChange('show_logo', v)} />
          <Toggle label="Show Customer Phone" value={form.show_customer_phone} onChange={(v) => handleChange('show_customer_phone', v)} />
          <Toggle label="Email Receipt" value={form.enable_email_receipt} onChange={(v) => handleChange('enable_email_receipt', v)} />
          <Toggle label="SMS Receipt" value={form.enable_sms_receipt} onChange={(v) => handleChange('enable_sms_receipt', v)} />

          {/* Paper Size */}
          <div>
            <label className="label text-gray-700 dark:text-gray-200">Paper Size</label>
            <select className="select select-bordered w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.paper_size} onChange={e => handleChange('paper_size', e.target.value)}>
              <option value="80mm">80mm Thermal</option>
              <option value="A4">A4</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <button className="btn btn-primary" onClick={save}>💾 Save Settings</button>
        </div>
      </div>
    </div>
  )
}