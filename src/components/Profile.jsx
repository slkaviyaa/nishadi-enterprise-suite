'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import PageTemplate from './PageTemplate'
import { FiUser, FiSave, FiPhone, FiMapPin, FiCreditCard, FiCalendar, FiAlertCircle, FiCamera } from 'react-icons/fi'

export default function Profile() {
  const { user } = useAuth()
  const { showToast } = useToast()
  
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [nic, setNic] = useState('')
  const [birthday, setBirthday] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchLatestProfile()
    }
  }, [user])

  const fetchLatestProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setDisplayName(data.display_name || '')
        setUsername(data.username || '')
        setPhone(data.phone || '')
        setAddress(data.address || '')
        setNic(data.nic || '')
        setBirthday(data.birthday || '')
        setEmergencyContact(data.emergency_contact || '')
        setAvatarUrl(data.avatar_url || '')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    }
  }

  const handleImageUpload = async (e) => {
    try {
      setUploading(true)
      const file = e.target.files[0]
      if (!file) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const newAvatarUrl = data.publicUrl

      setAvatarUrl(newAvatarUrl)

      const { error: updateError } = await supabase
        .from('staff')
        .update({ avatar_url: newAvatarUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      showToast('Profile picture updated successfully!', 'success')
    } catch (err) {
      showToast('Error uploading image: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!displayName) {
      showToast('Display name is required', 'error')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('staff')
        .update({ 
          display_name: displayName,
          username: username,
          phone: phone,
          address: address,
          nic: nic,
          birthday: birthday || null,
          emergency_contact: emergencyContact,
          avatar_url: avatarUrl
        })
        .eq('id', user.id)

      if (error) throw error

      showToast('Profile updated successfully!', 'success')
      fetchLatestProfile()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTemplate>
      <div className="space-y-6 text-gray-900 dark:text-white pb-10 max-w-3xl">
        
        <div>
          <h2 className="text-2xl font-bold">My Personal Profile</h2>
          <p className="text-sm opacity-70">Manage your profile picture, personal details, and contact info.</p>
        </div>

        <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-blue-500 flex items-center justify-center shrink-0 shadow-inner">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <FiUser size={40} className="text-gray-400" />
              )}
            </div>
            
            <div className="space-y-2 text-center sm:text-left">
              <label className="text-sm font-bold block">Profile Picture</label>
              <p className="text-xs opacity-60">Upload a clear photo of yourself. PNG, JPG up to 5MB.</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold cursor-pointer transition">
                <FiCamera size={14} /> {uploading ? 'Uploading...' : 'Choose Photo'}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <FiUser size={14} /> Full Name / Display Name *
              </label>
              <input 
                type="text" 
                value={displayName} 
                onChange={e => setDisplayName(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                placeholder="e.g. Kavindu Dilhara"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <FiUser size={14} /> Username
              </label>
              <input 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                placeholder="username"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <FiPhone size={14} /> Phone Number
              </label>
              <input 
                type="text" 
                value={phone} 
                onChange={e => setPhone(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                placeholder="077 XXXXXXX"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <FiCreditCard size={14} /> NIC Number
              </label>
              <input 
                type="text" 
                value={nic} 
                onChange={e => setNic(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                placeholder="National Identity Card No"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                <FiCalendar size={14} /> Birthday
              </label>
              <input 
                type="date" 
                value={birthday} 
                onChange={e => setBirthday(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1 text-red-500">
                <FiAlertCircle size={14} /> Emergency Contact
              </label>
              <input 
                type="text" 
                value={emergencyContact} 
                onChange={e => setEmergencyContact(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
                placeholder="Relative / Friend phone number"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
              <FiMapPin size={14} /> Residential Address
            </label>
            <textarea 
              rows="2"
              value={address} 
              onChange={e => setAddress(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white"
              placeholder="Your home address..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">System Role (Read-only)</label>
            <input 
              type="text" 
              value={user?.role || ''} 
              disabled
              className="w-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/50 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed uppercase font-bold"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-4 py-3 text-sm shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
          >
            <FiSave size={18} /> {loading ? 'Saving Profile...' : 'Save Profile Details'}
          </button>
        </form>

      </div>
    </PageTemplate>
  )
}