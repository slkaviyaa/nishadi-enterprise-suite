'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import PageTemplate from '../PageTemplate' // 👈 Fixed import

export default function JournalEntries() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState([{ account_id: '', debit: 0, credit: 0 }])

  useEffect(() => {
    if (!branch) return
    supabase.from('chart_of_accounts').select('id, account_name').eq('branch_id', branch)
      .then(({ data }) => setAccounts(data || []))
    supabase.from('journal_entries').select('id, date, description, created_at').eq('branch_id', branch)
      .order('date', { ascending: false }).then(({ data }) => setEntries(data || []))
  }, [branch])

  const addLine = () => setLines([...lines, { account_id: '', debit: 0, credit: 0 }])
  const updateLine = (idx, field, value) => {
    const newLines = [...lines]; newLines[idx][field] = value; setLines(newLines)
  }
  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx))

  const saveEntry = async () => {
    if (!description || lines.some(l => !l.account_id)) return showToast('Fill description and all accounts', 'error')
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) return showToast('Debits and credits must balance', 'error')

    const { data: entry, error } = await supabase.from('journal_entries').insert({ branch_id: branch, date, description }).select().single()
    if (error) return showToast('Error: ' + error.message, 'error')

    const linesData = lines.map(l => ({ journal_entry_id: entry.id, account_id: l.account_id, debit: Number(l.debit), credit: Number(l.credit) }))
    await supabase.from('journal_entry_lines').insert(linesData)

    showToast('Journal entry saved', 'success')
    setDescription(''); setLines([{ account_id: '', debit: 0, credit: 0 }])
    supabase.from('journal_entries').select('id, date, description, created_at').eq('branch_id', branch)
      .order('date', { ascending: false }).then(({ data }) => setEntries(data || []))
  }

  const metrics = [
    { label: 'Total Journal Entries', value: entries.length, icon: '📓' }
  ]

  return (
    <PageTemplate
      title="📓 Journal Entries"
      subtitle="Record manual double-entry accounting records"
      metrics={metrics}
    >
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-semibold mb-4 text-gray-800 dark:text-white">New Journal Entry</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            <input type="date" className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white" value={date} onChange={e => setDate(e.target.value)} />
            <input className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex-1 min-w-[250px]" placeholder="Description (e.g. Opening Balance)" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2 mb-4">
            {lines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border dark:border-gray-600">
                <select className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 flex-1" value={line.account_id} onChange={e => updateLine(idx, 'account_id', e.target.value)}>
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
                <input type="number" className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 w-28" placeholder="Debit" value={line.debit || ''} onChange={e => updateLine(idx, 'debit', Number(e.target.value))} />
                <input type="number" className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-gray-700 w-28" placeholder="Credit" value={line.credit || ''} onChange={e => updateLine(idx, 'credit', Number(e.target.value))} />
                <button className="text-red-500 hover:bg-red-50 p-2 rounded" onClick={() => removeLine(idx)}>✕</button>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 mt-4">
            <button className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors" onClick={addLine}>+ Add Line</button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors text-sm shadow-sm" onClick={saveEntry}>Save Entry</button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                  <th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Entry ID</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700 text-sm">
                {entries.length === 0 ? <tr><td colSpan="3" className="p-6 text-center text-gray-400">No journal entries found</td></tr> : entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3">{e.date}</td><td className="p-3">{e.description}</td><td className="p-3 font-mono text-xs text-gray-500">#{e.id.slice(0,8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTemplate>
  )
}