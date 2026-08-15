'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { FiUser, FiDollarSign, FiCreditCard, FiPlus, FiTrash2 } from 'react-icons/fi'

export default function Staff() {
  const { branch, user } = useAuth()
  const { showToast } = useToast()
  
  const [staff, setStaff] = useState([])
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseList, setExpenseList] = useState([])

  // Payroll States
  const [payrollList, setPayrollList] = useState([])
  const [selectedStaff, setSelectedStaff] = useState('')
  const [basicSalary, setBasicSalary] = useState('')
  const [allowances, setAllowances] = useState('')
  const [deductions, setDeductions] = useState('')
  const [payMonth, setPayMonth] = useState('August 2026')

  useEffect(() => {
    if (!branch) return
    loadData()
  }, [branch])

  const loadData = async () => {
    // Load staff
    const { data: staffData } = await supabase.from('staff').select('*').eq('branch_id', branch)
    setStaff(staffData || [])

    // Load expenses
    const { data: expData } = await supabase.from('expenses').select('*').eq('branch_id', branch).order('created_at', { ascending: false })
    setExpenseList(expData || [])

    // Load payroll
    const { data: payData } = await supabase.from('payroll').select('*, staff(display_name, username, role)').eq('branch_id', branch).order('created_at', { ascending: false })
    setPayrollList(payData || [])
  }

  const addExpense = async () => {
    if (!desc || !amount) { showToast('Description and amount required', 'error'); return }
    const { error } = await supabase.from('expenses').insert({ branch_id: branch, description: desc, amount: Number(amount), category: 'general' })
    if (error) { showToast(error.message, 'error'); return }
    showToast('Expense added!', 'success')
    setDesc(''); setAmount('')
    loadData()
  }

  const handleAddPayroll = async (e) => {
    e.preventDefault()
    if (!selectedStaff || !basicSalary || !payMonth) {
      showToast('Staff, basic salary and month are required', 'error')
      return
    }

    const basic = Number(basicSalary)
    const allow = Number(allowances || 0)
    const deduct = Number(deductions || 0)
    const net = basic + allow - deduct

    const { error } = await supabase.from('payroll').insert({
      branch_id: branch,
      staff_id: selectedStaff,
      basic_salary: basic,
      allowances: allow,
      deductions: deduct,
      net_salary: net,
      pay_month: payMonth
    })

    if (error) {
      showToast(error.message, 'error')
      return
    }

    showToast('Payroll record added successfully!', 'success')
    setSelectedStaff('')
    setBasicSalary('')
    setAllowances('')
    setDeductions('')
    loadData()
  }

  const handleDeletePayroll = async (id) => {
    if (!confirm('Delete this payroll record?')) return
    const { error } = await supabase.from('payroll').delete().eq('id', id)
    if (!error) {
      showToast('Payroll deleted', 'success')
      loadData()
    }
  }

  return (
    <PageTemplate>
      <div className="space-y-6 text-gray-900 dark:text-white pb-10">
        <div>
          <h2 className="text-2xl font-bold">Staff, Expenses & Payroll</h2>
          <p className="text-sm opacity-70">Manage branch team, record operational expenses, and process monthly salaries.</p>
        </div>

        {/* Staff & Expenses Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff Members Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FiUser className="text-blue-600 dark:text-blue-400" size={20} />
              <h3 className="text-lg font-bold">Staff Members</h3>
            </div>
            <div className="space-y-2">
              {staff.length === 0 ? (
                <p className="text-sm opacity-50 py-2">No staff found.</p>
              ) : (
                staff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                    <div>
                      <div className="font-semibold text-sm">{s.display_name || s.username}</div>
                      <div className="text-xs opacity-60 uppercase">{s.role}</div>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full capitalize">
                      {s.role}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expenses Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FiDollarSign className="text-green-600 dark:text-green-400" size={20} />
                <h3 className="text-lg font-bold">Branch Expenses</h3>
              </div>
              
              {user?.role === 'owner' && (
                <div className="flex gap-2 mb-4">
                  <input 
                    className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm flex-1 text-gray-900 dark:text-white" 
                    placeholder="Expense description..." 
                    value={desc} 
                    onChange={e => setDesc(e.target.value)} 
                  />
                  <input 
                    className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm w-28 text-gray-900 dark:text-white" 
                    type="number" 
                    placeholder="Amount" 
                    value={amount} 
                    onChange={e => setAmount(e.target.value)} 
                  />
                  <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow transition" onClick={addExpense}>
                    Add
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Description</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {expenseList.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-center opacity-50">No expenses recorded</td></tr>
                  ) : (
                    expenseList.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="p-2 opacity-70 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                        <td className="p-2">{e.description}</td>
                        <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">Rs. {e.amount?.toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Payroll / Salary Management Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiCreditCard className="text-purple-600 dark:text-purple-400" size={20} />
            <h3 className="text-lg font-bold">Payroll & Salary Management</h3>
          </div>

          {user?.role === 'owner' && (
            <form onSubmit={handleAddPayroll} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6 bg-gray-50 dark:bg-gray-700/40 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="lg:col-span-1">
                <select 
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                  value={selectedStaff}
                  onChange={e => setSelectedStaff(e.target.value)}
                >
                  <option value="">Select Staff</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.display_name || s.username}</option>)}
                </select>
              </div>
              <div className="lg:col-span-1">
                <input 
                  type="text" 
                  placeholder="Month (e.g. Aug 2026)" 
                  value={payMonth}
                  onChange={e => setPayMonth(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="lg:col-span-1">
                <input 
                  type="number" 
                  placeholder="Basic Salary" 
                  value={basicSalary}
                  onChange={e => setBasicSalary(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="lg:col-span-1">
                <input 
                  type="number" 
                  placeholder="Allowances" 
                  value={allowances}
                  onChange={e => setAllowances(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="lg:col-span-1">
                <input 
                  type="number" 
                  placeholder="Deductions" 
                  value={deductions}
                  onChange={e => setDeductions(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div className="lg:col-span-1">
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg px-4 py-2 text-sm shadow transition flex items-center justify-center gap-1">
                  <FiPlus size={16} /> Pay Salary
                </button>
              </div>
            </form>
          )}

          {/* Payroll History Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Month</th>
                  <th className="p-3 text-right">Basic</th>
                  <th className="p-3 text-right">Allowances</th>
                  <th className="p-3 text-right">Deductions</th>
                  <th className="p-3 text-right font-bold">Net Salary</th>
                  {user?.role === 'owner' && <th className="p-3 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payrollList.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center opacity-50">No payroll records found.</td></tr>
                ) : (
                  payrollList.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 font-medium">{p.staff?.display_name || p.staff?.username || 'Unknown'}</td>
                      <td className="p-3 opacity-80">{p.pay_month}</td>
                      <td className="p-3 text-right">Rs. {p.basic_salary?.toLocaleString()}</td>
                      <td className="p-3 text-right text-green-600 dark:text-green-400">+ Rs. {p.allowances?.toLocaleString()}</td>
                      <td className="p-3 text-right text-red-600 dark:text-red-400">- Rs. {p.deductions?.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-purple-600 dark:text-purple-400">Rs. {p.net_salary?.toLocaleString()}</td>
                      {user?.role === 'owner' && (
                        <td className="p-3 text-center">
                          <button onClick={() => handleDeletePayroll(p.id)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition" title="Delete Record">
                            <FiTrash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}