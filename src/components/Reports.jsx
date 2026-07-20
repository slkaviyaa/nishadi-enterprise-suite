'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Reports() {
  const { branch } = useAuth()
  const [sales, setSales] = useState(0)
  const [expenses, setExpenses] = useState(0)
  const [top, setTop] = useState([])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [invLogs, setInvLogs] = useState([])

  useEffect(() => {
    supabase.from('orders').select('total').eq('branch_id', branch).eq('status','completed').then(({ data }) => {
      if (data) setSales(data.reduce((s,o) => s + o.total, 0))
    })
    supabase.from('expenses').select('amount').eq('branch_id', branch).then(({ data }) => {
      if (data) setExpenses(data.reduce((s,e) => s + e.amount, 0))
    })
    supabase.rpc('top_products', { bid: branch }).then(({ data }) => setTop(data || []))
  }, [branch])

  const loadInvLogs = async () => {
    if (!fromDate || !toDate) return alert('Select date range')
    const { data } = await supabase.from('inventory_logs')
      .select('*, products(name)')
      .eq('branch_id', branch)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false })
    setInvLogs(data || [])
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reports</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat bg-success text-success-content rounded-box p-4">
          <div className="stat-title">Total Sales</div>
          <div className="stat-value text-2xl">Rs. {sales.toLocaleString()}</div>
        </div>
        <div className="stat bg-warning text-warning-content rounded-box p-4">
          <div className="stat-title">Total Expenses</div>
          <div className="stat-value text-2xl">Rs. {expenses.toLocaleString()}</div>
        </div>
        <div className="stat bg-info text-info-content rounded-box p-4">
          <div className="stat-title">Net Profit</div>
          <div className="stat-value text-2xl">Rs. {(sales - expenses).toLocaleString()}</div>
        </div>
      </div>
      <div className="card bg-base-100 p-4">
        <h3 className="text-lg font-semibold mb-2">Top Selling Products</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={top}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="quantity" fill="#8884d8" /></BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card bg-base-100 p-4">
        <h3 className="text-lg font-semibold mb-2">Inventory Changes (by Date)</h3>
        <div className="flex gap-2 mb-2">
          <input type="date" className="input input-bordered" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          <input type="date" className="input input-bordered" value={toDate} onChange={e => setToDate(e.target.value)} />
          <button className="btn btn-primary" onClick={loadInvLogs}>Load</button>
        </div>
        {invLogs.length > 0 && (
          <table className="table">
            <thead><tr><th>Date</th><th>Product</th><th>Change</th><th>Qty</th></tr></thead>
            <tbody>
              {invLogs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleDateString()}</td>
                  <td>{log.products?.name}</td>
                  <td className={log.change_type === 'add' ? 'text-success' : 'text-error'}>{log.change_type}</td>
                  <td>{log.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}