'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

export default function JournalEntries() {
  const { branch } = useAuth()
  const { showToast } = useToast()
  const [accounts, setAccounts] = useState([])
  const [entries, setEntries] = useState([])
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState([{ account_id: '', debit: 0, credit: 0 }])

  useEffect(() => {
    supabase.from('chart_of_accounts').select('id, account_name').eq('branch_id', branch)
      .then(({ data }) => setAccounts(data || []))
    supabase.from('journal_entries').select('id, date, description, created_at').eq('branch_id', branch)
      .order('date', { ascending: false }).then(({ data }) => setEntries(data || []))
  }, [branch])

  const addLine = () => setLines([...lines, { account_id: '', debit: 0, credit: 0 }])

  const updateLine = (idx, field, value) => {
    const newLines = [...lines]
    newLines[idx][field] = value
    setLines(newLines)
  }

  const removeLine = (idx) => setLines(lines.filter((_, i) => i !== idx))

  const saveEntry = async () => {
    if (!description || lines.some(l => !l.account_id))
      return showToast('Fill description and all accounts', 'error')
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0)
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01)
      return showToast('Debits and credits must balance', 'error')

    // Insert journal entry
    const { data: entry, error } = await supabase.from('journal_entries').insert({
      branch_id: branch, date, description
    }).select().single()
    if (error) return showToast('Error: ' + error.message, 'error')

    // Insert lines
    const linesData = lines.map(l => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: Number(l.debit),
      credit: Number(l.credit)
    }))
    await supabase.from('journal_entry_lines').insert(linesData)

    showToast('Journal entry saved')
    setDescription(''); setLines([{ account_id: '', debit: 0, credit: 0 }])
    supabase.from('journal_entries').select('id, date, description, created_at').eq('branch_id', branch)
      .order('date', { ascending: false }).then(({ data }) => setEntries(data || []))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Journal Entries</h2>
      <div className="card bg-white dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="flex gap-2 mb-4">
          <input type="date" className="input input-bordered" value={date} onChange={e => setDate(e.target.value)} />
          <input className="input input-bordered flex-1" placeholder="Description" value={description}
            onChange={e => setDescription(e.target.value)} />
        </div>

        {lines.map((line, idx) => (
          <div key={idx} className="flex gap-2 mb-2 items-center">
            <select className="select select-bordered flex-1" value={line.account_id}
              onChange={e => updateLine(idx, 'account_id', e.target.value)}>
              <option value="">Select Account</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
            </select>
            <input type="number" className="input input-bordered w-28" placeholder="Debit" value={line.debit}
              onChange={e => updateLine(idx, 'debit', Number(e.target.value))} />
            <input type="number" className="input input-bordered w-28" placeholder="Credit" value={line.credit}
              onChange={e => updateLine(idx, 'credit', Number(e.target.value))} />
            <button className="btn btn-xs btn-outline text-error" onClick={() => removeLine(idx)}>✕</button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <button className="btn btn-sm btn-outline" onClick={addLine}>+ Add Line</button>
          <button className="btn btn-primary" onClick={saveEntry}>Save Entry</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>Date</th><th>Description</th><th>Entry #</th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="hover">
                <td>{e.date}</td><td>{e.description}</td>
                <td className="font-mono">#{e.id.slice(0,6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}