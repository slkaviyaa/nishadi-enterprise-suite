'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { FiClock, FiCheckCircle, FiXCircle } from 'react-icons/fi'

export default function Attendance() {
  const { branch, user } = useAuth()
  const { showToast } = useToast()
  
  const [todayAttendance, setTodayAttendance] = useState(null)
  const [allAttendance, setAllAttendance] = useState([])
  const [loading, setLoading] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (branch && user) {
      loadAttendanceData()
    }
  }, [branch, user])

  const loadAttendanceData = async () => {
    // Load current user's today attendance
    const { data: myData } = await supabase
      .from('attendance')
      .select('*')
      .eq('staff_id', user.id)
      .eq('date', todayStr)
      .maybeSingle()

    setTodayAttendance(myData)

    // Load branch attendance list for today
    const { data: listData } = await supabase
      .from('attendance')
      .select('*, staff(display_name, username, role)')
      .eq('branch_id', branch)
      .eq('date', todayStr)
      .order('created_at', { ascending: false })

    setAllAttendance(listData || [])
  }

  const handleDutyToggle = async () => {
    setLoading(true)
    try {
      if (!todayAttendance || todayAttendance.status === 'off') {
        // Clock In (Duty On)
        const payload = {
          branch_id: branch,
          staff_id: user.id,
          date: todayStr,
          clock_in: new Date().toISOString(),
          status: 'on'
        }

        if (todayAttendance) {
          // Update existing record for today
          const { error } = await supabase
            .from('attendance')
            .update({ clock_in: new Date().toISOString(), status: 'on', clock_out: null })
            .eq('id', todayAttendance.id)
          if (error) throw error
        } else {
          // Insert new record
          const { error } = await supabase.from('attendance').insert(payload)
          if (error) throw error
        }

        showToast('Duty ON - Have a great shift!', 'success')
      } else {
        // Clock Out (Duty Off)
        const { error } = await supabase
          .from('attendance')
          .update({ clock_out: new Date().toISOString(), status: 'off' })
          .eq('id', todayAttendance.id)

        if (error) throw error
        showToast('Duty OFF - Good job today!', 'success')
      }

      loadAttendanceData()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const isOnDuty = todayAttendance?.status === 'on'

  return (
    <PageTemplate>
      <div className="space-y-6 text-gray-900 dark:text-white pb-10">
        <div>
          <h2 className="text-2xl font-bold">Staff Attendance</h2>
          <p className="text-sm opacity-70">Mark your daily duty status and view branch attendance logs.</p>
        </div>

        {/* Duty Control Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${isOnDuty ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
              <FiClock size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Your Status: {isOnDuty ? 'On Duty 🟢' : 'Off Duty 🔴'}</h3>
              <p className="text-xs opacity-70">
                {isOnDuty 
                  ? `Clocked in at ${new Date(todayAttendance.clock_in).toLocaleTimeString()}` 
                  : 'You are currently not on duty.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDutyToggle}
            disabled={loading}
            className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition flex items-center gap-2 ${
              isOnDuty 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                : 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
            }`}
          >
            {isOnDuty ? <FiXCircle size={20} /> : <FiCheckCircle size={20} />}
            {isOnDuty ? 'Clock Out (Duty Off)' : 'Clock In (Duty On)'}
          </button>
        </div>

        {/* Branch Attendance History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold mb-4">Today's Branch Attendance ({todayStr})</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Clock In</th>
                  <th className="p-3">Clock Out</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {allAttendance.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center opacity-50">No attendance records for today.</td></tr>
                ) : (
                  allAttendance.map(att => (
                    <tr key={att.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="p-3 font-semibold">{att.staff?.display_name || att.staff?.username}</td>
                      <td className="p-3 uppercase text-xs opacity-75">{att.staff?.role}</td>
                      <td className="p-3">{att.clock_in ? new Date(att.clock_in).toLocaleTimeString() : '-'}</td>
                      <td className="p-3">{att.clock_out ? new Date(att.clock_out).toLocaleTimeString() : '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase ${
                          att.status === 'on' 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {att.status === 'on' ? 'Active' : 'Off'}
                        </span>
                      </td>
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