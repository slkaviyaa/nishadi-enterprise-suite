'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { useToast } from '../context/ToastContext'
import { Html5Qrcode } from 'html5-qrcode'
import { BsUpcScan, BsWhatsapp } from 'react-icons/bs'
import { FiEdit3, FiMinus, FiPlus, FiX, FiUpload, FiCamera } from 'react-icons/fi'
import { jsPDF } from 'jspdf'
import PageTemplate from './PageTemplate'

import { Capacitor } from '@capacitor/core'
import { Contacts } from '@capacitor-community/contacts'
import { printNativeBluetooth } from '../utils/printerUtils'

const MAIN_BRANCH_ID = '11111111-1111-1111-1111-111111111111'
const PARALLEL_BRANCH_ID = '22222222-2222-2222-2222-222222222222'

export default function POS() {
  const { branch } = useAuth()
  const { settings } = useSettings()
  const { showToast } = useToast()

  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [discount, setDiscount] = useState(0)
  const [customers, setCustomers] = useState([])
  const [deviceContacts, setDeviceContacts] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [holdOrders, setHoldOrders] = useState([])

  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const scanRef = useRef(null)

  const [billSettings, setBillSettings] = useState({})

  const [customerPhone, setCustomerPhone] = useState('')
  const [newCustomerForm, setNewCustomerForm] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newCustAddress, setNewCustAddress] = useState('')

  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeDate, setChequeDate] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [creditDueDate, setCreditDueDate] = useState('')
  const [cashTendered, setCashTendered] = useState('')

  const [lastBill, setLastBill] = useState(null)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)

  const [selectedCartItem, setSelectedCartItem] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editPrice, setEditPrice] = useState(0)
  const [editQty, setEditQty] = useState(1)
  const [applyOffer, setApplyOffer] = useState(true)

  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [customerModal, setCustomerModal] = useState(false)
  const customerDropdownRef = useRef(null)

  const [mobileView, setMobileView] = useState('products')
  const [isMobile, setIsMobile] = useState(false)

  const currency = settings?.currency_symbol || 'Rs. '
  const taxEnabled = settings?.tax_enabled || false
  const taxRate = settings?.tax_rate || 0

  const getSyncBranchId = () => {
    if (!branch) return null
    if (branch === MAIN_BRANCH_ID) return PARALLEL_BRANCH_ID
    if (branch === PARALLEL_BRANCH_ID) return MAIN_BRANCH_ID
    return null
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const requestAppPermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const contactPerm = await Contacts.requestPermissions()
          if (contactPerm.contacts === 'granted') {
            const result = await Contacts.getContacts({ projection: { name: true, phones: true } })
            if (result && result.contacts) {
              const formatted = result.contacts
                .filter(c => c.phones && c.phones.length > 0)
                .map(c => ({
                  id: 'dev_' + Math.random(),
                  name: c.name?.display || 'Unknown Contact',
                  phone: c.phones[0].number.replace(/[^\d+]/g, ''),
                  isDeviceContact: true
                }))
              setDeviceContacts(formatted)
            }
          }
        } catch (err) {
          console.error(err)
        }
      }
    }
    requestAppPermissions()
  }, [])

  const syncToParallelBranch = async (syncCart, mainDiscount, mainStatus, mainPaymentMethod) => {
    const targetBranchId = getSyncBranchId()
    if (!targetBranchId || syncCart.length === 0) return

    try {
      const productIds = syncCart.map(item => item.product_id).filter(Boolean)
      if (productIds.length === 0) return

      const { data: targetBps } = await supabase
        .from('branch_products')
        .select('id, product_id, price')
        .eq('branch_id', targetBranchId)
        .in('product_id', productIds)

      if (!targetBps || targetBps.length === 0) return

      let parallelTotal = 0
      const parallelItemsToInsert = []
      const parallelStockUpdates = []

      syncCart.forEach(item => {
        const targetBp = targetBps.find(bp => bp.product_id === item.product_id)
        if (targetBp) {
          const targetPrice = targetBp.price || item.price
          parallelTotal += targetPrice * item.qty

          parallelItemsToInsert.push({
            branch_product_id: targetBp.id,
            quantity: item.qty,
            price: targetPrice
          })

          if (item.autoUpdateStock !== false) {
            parallelStockUpdates.push({ id: targetBp.id, qty: item.qty })
          }
        }
      })

      if (parallelItemsToInsert.length === 0) return
      const finalParallelTotal = Math.max(0, parallelTotal - mainDiscount)

      const { data: pWalkIn } = await supabase
        .from('customers')
        .select('id')
        .eq('branch_id', targetBranchId)
        .ilike('name', 'Walk-in Customer')
        .maybeSingle()

      let targetCustId = pWalkIn ? pWalkIn.id : null
      if (!targetCustId) {
        const { data: newCw } = await supabase
          .from('customers')
          .insert({ branch_id: targetBranchId, name: 'Walk-in Customer', phone: '0000000000' })
          .select()
          .single()
        if (newCw) targetCustId = newCw.id
      }

      const { data: pOrder, error: pOrderErr } = await supabase
        .from('orders')
        .insert({
          branch_id: targetBranchId,
          total: finalParallelTotal,
          discount: mainDiscount,
          status: mainStatus,
          customer_id: targetCustId,
          payment_method: mainPaymentMethod
        })
        .select()
        .single()

      if (pOrderErr || !pOrder) return

      const finalItems = parallelItemsToInsert.map(i => ({ ...i, order_id: pOrder.id }))
      await supabase.from('order_items').insert(finalItems)

      if (mainStatus === 'completed') {
        for (const update of parallelStockUpdates) {
          const { error: rpcErr } = await supabase.rpc('decrement_stock', { bp_id: update.id, qty: update.qty })
          if (rpcErr) {
            const { data: curr } = await supabase
              .from('branch_products')
              .select('stock_quantity')
              .eq('id', update.id)
              .single()
            if (curr) {
              await supabase
                .from('branch_products')
                .update({ stock_quantity: Math.max(0, curr.stock_quantity - update.qty) })
                .eq('id', update.id)
            }
          }
        }
      }
    } catch (error) {
      console.error('Parallel Auto-Sync Failed:', error)
    }
  }

  const fetchProducts = async () => {
    if (!branch) return
    const { data, error } = await supabase
      .from('branch_products')
      .select('id, product_id, price, stock_quantity, track_profit, auto_update_stock, prevent_out_of_stock_sale, products!inner(sku, barcode, name, category, deleted_at)')
      .eq('branch_id', branch)
      .is('products.deleted_at', null)

    if (error) {
      const cached = localStorage.getItem(`cached_products_${branch}`)
      if (cached) setProducts(JSON.parse(cached))
      return
    }

    if (data) {
      const validProducts = data.filter(p => p.products !== null)
      const mapped = validProducts.map(p => ({
        id: p.id,
        product_id: p.product_id,
        sku: p.products?.sku || 'N/A',
        barcode: p.products?.barcode || '',
        name: p.products?.name || 'Unnamed',
        price: Number(p.price) || 0,
        stock: Number(p.stock_quantity) || 0,
        preventOutOfStock: p.prevent_out_of_stock_sale ?? false,
        autoUpdateStock: p.auto_update_stock ?? true
      }))
      setProducts(mapped)
      localStorage.setItem(`cached_products_${branch}`, JSON.stringify(mapped))
    }
  }

  useEffect(() => {
    const handleOnlineSync = async () => {
      const offlineBills = JSON.parse(localStorage.getItem('offline_bills') || '[]')
      if (offlineBills.length === 0) return
      showToast('🌐 Internet connected! Syncing offline bills...', 'info')
      const remainingBills = []

      for (const billData of offlineBills) {
        try {
          let resolvedCid = billData.cid
          if (!resolvedCid && (billData.customerPhone || billData.customerName)) {
            const phoneToLookup = billData.customerPhone || '0000000000'
            const { data: existingCust } = await supabase
              .from('customers')
              .select('id')
              .eq('branch_id', billData.branch)
              .eq('phone', phoneToLookup)
              .maybeSingle()
            if (existingCust) {
              resolvedCid = existingCust.id
            } else {
              const { data: newCust, error: newCustErr } = await supabase
                .from('customers')
                .insert({
                  branch_id: billData.branch,
                  name: billData.customerName || 'Walk-in Customer',
                  phone: phoneToLookup,
                  address: 'Offline Customer'
                })
                .select()
                .single()
              if (!newCustErr && newCust) resolvedCid = newCust.id
            }
          }

          const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
              branch_id: billData.branch,
              total: billData.final,
              discount: billData.discount,
              status: billData.status,
              customer_id: resolvedCid || null,
              payment_method: billData.paymentMethod,
              cheque_number: billData.chequeNumber,
              cheque_date: billData.chequeDate,
              bank_reference: billData.bankReference
            })
            .select()
            .single()

          if (orderError || !order) {
            remainingBills.push(billData)
            continue
          }

          const { error: itemInsertError } = await supabase.from('order_items').insert(
            billData.cart.map(i => ({
              order_id: order.id,
              branch_product_id: i.id,
              quantity: i.qty,
              price: i.price
            }))
          )

          if (itemInsertError) {
            await supabase.from('orders').delete().eq('id', order.id)
            remainingBills.push(billData)
            continue
          }

          if (billData.status === 'completed') {
            for (const item of billData.cart) {
              if (item.autoUpdateStock === false) continue
              await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty })
            }
            await syncToParallelBranch(billData.cart, billData.discount, billData.status, billData.paymentMethod)
          }
        } catch (err) {
          remainingBills.push(billData)
        }
      }

      localStorage.setItem('offline_bills', JSON.stringify(remainingBills))
      if (remainingBills.length === 0) showToast('✅ All offline bills successfully synced!', 'success')
      else showToast(`⚠️ Some bills failed to sync. Remaining: ${remainingBills.length}`, 'error')
      fetchProducts()
    }

    window.addEventListener('online', handleOnlineSync)
    if (navigator.onLine) handleOnlineSync()
    return () => window.removeEventListener('online', handleOnlineSync)
  }, [branch])

  useEffect(() => {
    fetchProducts()
    if (branch) {
      supabase.from('customers').select('*').eq('branch_id', branch).then(({ data }) => setCustomers(data || []))
      supabase.from('orders').select('id, total, created_at').eq('branch_id', branch).eq('status', 'hold').order('created_at', { ascending: false }).then(({ data }) => setHoldOrders(data || []))
      supabase.from('bill_settings').select('*').eq('branch_id', branch).order('created_at', { ascending: false }).limit(1).maybeSingle().then(({ data }) => { if (data) setBillSettings(data) })
    }
  }, [branch])

  useEffect(() => {
    const handler = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const updateCartQty = (id, newQty) => {
    if (newQty < 1) return
    const item = cart.find(i => i.id === id)
    const product = products.find(p => p.id === id)
    if (item && item.preventOutOfStock && (!product || newQty > product.stock)) {
      showToast(`ඔබට ${newQty} ක් ලබාදිය නොහැක. දැනට ඇත්තේ ${product?.stock ?? 0} යි!`, 'error')
      return
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: newQty } : i))
  }

  const addToCart = (prod) => {
    const exist = cart.find(i => i.id === prod.id)
    const currentCartQty = exist ? exist.qty : 0
    if (prod.preventOutOfStock && currentCartQty + 1 > prod.stock) {
      showToast(`⚠️ "${prod.name}" තොග අවසන්! (Available: ${prod.stock})`, 'error')
      return
    }
    setCart(prev => {
      if (exist) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1, originalPrice: prod.price, applyOffer: true }]
    })
  }

  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id))

  const openEditModal = (item) => {
    setSelectedCartItem(item)
    setEditPrice(item.price)
    setEditQty(item.qty)
    setApplyOffer(item.applyOffer ?? true)
    setEditModalOpen(true)
  }

  const handleUpdateCartItem = () => {
    if (!selectedCartItem) return
    const product = products.find(p => p.id === selectedCartItem.id)
    if (selectedCartItem.preventOutOfStock && (!product || editQty > product.stock)) {
      showToast(`⚠️ ප්‍රමාණය තොගයට වඩා වැඩියි. (ඇත්තේ ${product?.stock ?? 0} යි)`, 'error')
      return
    }
    setCart(prev =>
      prev.map(item =>
        item.id === selectedCartItem.id
          ? { ...item, price: Number(editPrice), qty: Number(editQty), applyOffer }
          : item
      )
    )
    setEditModalOpen(false)
    setSelectedCartItem(null)
  }

  const subtotal = cart.reduce((s, i) => s + (i.applyOffer ? i.price : i.originalPrice) * i.qty, 0)
  const taxAmount = taxEnabled ? (subtotal * taxRate / 100) : 0
  const total = subtotal + taxAmount
  const final = Math.max(0, total - discount)
  const totalItemCount = cart.reduce((s, i) => s + i.qty, 0)
  const tenderedNum = parseFloat(cashTendered) || 0
  const balanceDue = paymentMethod === 'cash' ? Math.max(0, tenderedNum - final) : 0

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch.trim()) return false
    const s = customerSearch.toLowerCase()
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(customerSearch)
  })

  const filteredDeviceContacts = deviceContacts.filter(c => {
    if (!customerSearch.trim()) return false
    const existsInDB = customers.some(dbCust => dbCust.phone === c.phone)
    if (existsInDB) return false
    const s = customerSearch.toLowerCase()
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(customerSearch)
  }).slice(0, 5)

  const selectCustomerFromSearch = (cust) => {
    if (cust.isDeviceContact) {
      setCustomerPhone(cust.phone || '')
      setNewCustName(cust.name || '')
      setNewCustomerForm(true)
      setCustomerSearch('')
      setShowCustomerDropdown(false)
      showToast('Please add an address to save this contact to the system.', 'info')
    } else {
      setSelectedCustomer(cust)
      setCustomerPhone(cust.phone || '')
      setCustomerSearch('')
      setShowCustomerDropdown(false)
      setCustomerModal(false)
    }
  }

  const clearCustomer = () => {
    setSelectedCustomer(null)
    setCustomerPhone('')
    setCustomerSearch('')
  }

  const createNewCustomer = async () => {
    try {
      if (!newCustName || !customerPhone) {
        showToast('Name and Phone required', 'error')
        return
      }
      if (!branch) {
        alert('❌ Error: Branch ID එක ඇවිත් නෑ.')
        return
      }
      const { data: c, error: mainErr } = await supabase
        .from('customers')
        .insert({ branch_id: branch, name: newCustName, phone: customerPhone, address: newCustAddress || 'No Address' })
        .select()
        .single()

      if (mainErr) {
        alert(`🔴 DATABASE ERROR:\n${mainErr.message}`)
        return
      }

      const syncBranchId = getSyncBranchId()
      if (syncBranchId) {
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('branch_id', syncBranchId)
          .eq('phone', customerPhone)
          .maybeSingle()

        if (!existing) {
          await supabase.from('customers').insert({
            branch_id: syncBranchId,
            name: newCustName,
            phone: customerPhone,
            address: newCustAddress || 'No Address'
          })
        }
      }

      setCustomers(prev => [...prev, c])
      setSelectedCustomer(c)
      setNewCustName('')
      setNewCustAddress('')
      setNewCustomerForm(false)
      showToast('Customer created!', 'success')
    } catch (e) {
      alert('🔴 SYSTEM ERROR:\n' + e.message)
    }
  }

  const pickContact = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await Contacts.requestPermissions()
        if (permission.contacts === 'granted') {
          const result = await Contacts.pickContact()
          if (result && result.contact) {
            const name = result.contact.name?.display || 'Cust'
            const phone = result.contact.phones?.[0]?.number?.replace(/[^\d+]/g, '') || ''
            if (phone) {
              const cust = customers.find(c => c.phone === phone)
              if (cust) selectCustomerFromSearch(cust)
              else {
                setCustomerPhone(phone)
                setNewCustName(name)
                setNewCustomerForm(true)
              }
            }
          }
        } else {
          setCustomerModal(true)
        }
      } catch (err) {
        setCustomerModal(true)
      }
    } else {
      if ('contacts' in navigator && 'ContactsManager' in window) {
        try {
          const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false })
          if (contacts && contacts.length > 0) {
            const name = contacts[0].name ? contacts[0].name[0] : 'Cust'
            const phone = contacts[0].tel ? contacts[0].tel[0].replace(/[^\d+]/g, '') : ''
            if (phone) {
              const cust = customers.find(c => c.phone === phone)
              if (cust) selectCustomerFromSearch(cust)
              else {
                setCustomerPhone(phone)
                setNewCustName(name)
                setNewCustomerForm(true)
              }
            }
          }
        } catch (err) {
          setCustomerModal(true)
        }
      } else {
        setCustomerModal(true)
      }
    }
  }

  const handlePickContactForModal = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const permission = await Contacts.requestPermissions()
        if (permission.contacts === 'granted') {
          const result = await Contacts.pickContact()
          if (result && result.contact) {
            setNewCustName(result.contact.name?.display || '')
            setCustomerPhone(result.contact.phones?.[0]?.number?.replace(/[^0-9+]/g, '') || '')
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleVcfUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target.result
      const nameMatch = content.match(/FN:(.+)/i)
      const telMatch = content.match(/TEL.*:(.+)/i)
      const name = nameMatch ? nameMatch[1].trim() : ''
      const phone = telMatch ? telMatch[1].replace(/[^\d+]/g, '').trim() : ''
      if (phone || name) {
        const cust = customers.find(c => c.phone === phone)
        if (cust) selectCustomerFromSearch(cust)
        else {
          setCustomerPhone(phone)
          setNewCustName(name)
          setNewCustomerForm(true)
        }
        setCustomerModal(false)
      }
    }
    reader.readAsText(file)
  }

  const checkout = async (status = 'completed') => {
    if (cart.length === 0 || !branch) return
    let cid = selectedCustomer?.id
    let customerForCredit = selectedCustomer

    if (!navigator.onLine) {
      const offlineBill = {
        branch,
        cart,
        final,
        discount,
        status,
        cid: cid || null,
        customerPhone: customerPhone || selectedCustomer?.phone || '',
        customerName: selectedCustomer?.name || (customerPhone ? 'Cust ' + customerPhone.slice(-4) : 'Walk-in Customer'),
        paymentMethod,
        chequeNumber: paymentMethod === 'cheque' ? chequeNumber : null,
        chequeDate: paymentMethod === 'cheque' ? chequeDate : null,
        bank_reference: paymentMethod === 'bank_transfer' ? bankReference : null,
        date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: 'OFFLINE-' + Date.now(),
        customer: selectedCustomer || { name: customerPhone ? 'Cust ' + customerPhone.slice(-4) : 'Walk-in Customer', phone: customerPhone },
        cashTendered: tenderedNum,
        balanceDue: balanceDue
      }

      const existingOffline = JSON.parse(localStorage.getItem('offline_bills') || '[]')
      existingOffline.push(offlineBill)
      localStorage.setItem('offline_bills', JSON.stringify(existingOffline))
      setLastBill(offlineBill)

      if (status === 'completed') {
        setReceiptModalOpen(true)
        setTimeout(() => { printReceiptWindow(offlineBill) }, 200)
      }

      showToast('📴 Offline: Bill saved locally and will sync when internet returns!', 'success')
      setCart([])
      setDiscount(0)
      setPaymentMethod('cash')
      setChequeNumber('')
      setChequeDate('')
      setBankReference('')
      setCreditDueDate('')
      setCashTendered('')
      return
    }

    for (const item of cart) {
      if (item.preventOutOfStock) {
        const { data: bp, error: stockError } = await supabase
          .from('branch_products')
          .select('stock_quantity')
          .eq('id', item.id)
          .eq('branch_id', branch)
          .maybeSingle()

        if (stockError || !bp || Number(bp.stock_quantity) < Number(item.qty)) {
          showToast(`අවවාදයයි: ${item.name} සඳහා ප්‍රමාණවත් තොග නොමැත!`, 'error')
          return
        }
      }
    }

    if (!cid && customerPhone) {
      const { data: nc, error: customerError } = await supabase
        .from('customers')
        .insert({ branch_id: branch, phone: customerPhone, name: 'Cust ' + customerPhone.slice(-4) })
        .select()
        .single()
      if (customerError) {
        showToast('Customer creation failed: ' + customerError.message, 'error')
        return
      }
      if (nc) {
        cid = nc.id
        customerForCredit = nc
        setCustomers(prev => [...prev, nc])
        setSelectedCustomer(nc)
      }
    } else if (!cid && !customerPhone) {
      const { data: walkIn, error: walkInLookupError } = await supabase
        .from('customers')
        .select('id, name, phone, total_credit')
        .eq('branch_id', branch)
        .ilike('name', 'Walk-in Customer')
        .maybeSingle()

      if (walkInLookupError) {
        showToast('Walk-in customer lookup failed: ' + walkInLookupError.message, 'error')
        return
      }

      if (walkIn) {
        cid = walkIn.id
        customerForCredit = walkIn
      } else {
        const { data: newWalkIn, error: walkInCreateError } = await supabase
          .from('customers')
          .insert({ branch_id: branch, name: 'Walk-in Customer', phone: '0000000000', address: 'Walk-in' })
          .select()
          .single()
        if (walkInCreateError) {
          showToast('Walk-in customer creation failed: ' + walkInCreateError.message, 'error')
          return
        }
        if (newWalkIn) {
          cid = newWalkIn.id
          customerForCredit = newWalkIn
        }
      }
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        branch_id: branch,
        total: final,
        discount: discount,
        status,
        customer_id: cid || null,
        payment_method: paymentMethod,
        cheque_number: paymentMethod === 'cheque' ? chequeNumber : null,
        cheque_date: paymentMethod === 'cheque' ? chequeDate : null,
        bank_reference: paymentMethod === 'bank_transfer' ? bankReference : null
      })
      .select()
      .single()

    if (orderError || !order) {
      showToast('Order failed: ' + (orderError?.message || 'Unknown error'), 'error')
      return
    }

    const { error: itemInsertError } = await supabase.from('order_items').insert(
      cart.map(i => ({
        order_id: order.id,
        branch_product_id: i.id,
        quantity: i.qty,
        price: i.price
      }))
    )

    if (itemInsertError) {
      await supabase.from('orders').delete().eq('id', order.id)
      showToast('Bill failed: items could not be saved. No partial bill was kept.', 'error')
      return
    }

    if (status === 'completed') {
      for (const item of cart) {
        if (item.autoUpdateStock === false) continue
        const { error: stockRpcError } = await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty })
        if (stockRpcError) {
          const { data: current } = await supabase
            .from('branch_products')
            .select('stock_quantity')
            .eq('id', item.id)
            .eq('branch_id', branch)
            .maybeSingle()
          if (current) {
            const nextStock = Math.max(0, Number(current.stock_quantity || 0) - Number(item.qty || 0))
            await supabase.from('branch_products').update({ stock_quantity: nextStock }).eq('id', item.id)
          }
        }
      }

      await syncToParallelBranch(cart, discount, status, paymentMethod)
    }

    if (cid && paymentMethod === 'credit' && status === 'completed') {
      const currentCredit = Number(customerForCredit?.total_credit || 0)
      const nextCredit = currentCredit + Number(final || 0)
      await supabase.from('credit_transactions').insert({
        customer_id: cid,
        branch_id: branch,
        amount: final,
        type: 'purchase',
        due_date: creditDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        payment_mode: 'credit'
      })
      await supabase.from('customers').update({ total_credit: nextCredit }).eq('id', cid).eq('branch_id', branch)
    }

    const currentBillData = {
      items: [...cart],
      total: final,
      discount: discount,
      paymentMethod,
      cashTendered: tenderedNum,
      balanceDue: balanceDue,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id: order.id,
      customer: selectedCustomer || { name: 'Walk-in Customer', phone: customerPhone }
    }

    setLastBill(currentBillData)

    if (status === 'completed') {
      setReceiptModalOpen(true)
      setTimeout(() => { printReceiptWindow(currentBillData) }, 200)
    }

    if (status === 'hold') {
      supabase.from('orders').select('id, total, created_at').eq('branch_id', branch).eq('status', 'hold').order('created_at', { ascending: false }).then(({ data }) => setHoldOrders(data || []))
    }

    showToast('Bill Cut Successfully!', 'success')
    setCart([])
    setDiscount(0)
    setPaymentMethod('cash')
    setChequeNumber('')
    setChequeDate('')
    setBankReference('')
    setCreditDueDate('')
    setCashTendered('')
    await fetchProducts()
  }

  const loadHold = async (id) => {
    const { data, error } = await supabase
      .from('order_items')
      .select('branch_product_id, quantity, price, branch_products(product_id, auto_update_stock, prevent_out_of_stock_sale, products(sku, barcode, name))')
      .eq('order_id', id)

    if (error) {
      showToast('Failed to load held order: ' + error.message, 'error')
      return
    }

    if (data) {
      setCart(
        data.map(i => ({
          id: i.branch_product_id,
          product_id: i.branch_products?.product_id,
          name: i.branch_products?.products?.name,
          price: i.price,
          originalPrice: i.price,
          qty: i.quantity,
          preventOutOfStock: i.branch_products?.prevent_out_of_stock_sale ?? false,
          autoUpdateStock: i.branch_products?.auto_update_stock ?? true
        }))
      )
    }
  }

  const deleteHoldOrder = async (orderId) => {
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) {
      showToast('Failed to delete hold order: ' + error.message, 'error')
      return
    }
    setHoldOrders(prev => prev.filter(o => o.id !== orderId))
  }

  const startScanner = async () => {
    setIsScannerOpen(true)
    if (scanRef.current) {
      try { await scanRef.current.stop() } catch (e) {}
      scanRef.current = null
    }

    setTimeout(async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          stream.getTracks().forEach(track => track.stop())
        }

        const html5QrCode = new Html5Qrcode('reader-pos')
        scanRef.current = html5QrCode

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 5, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const prod = products.find(p => p.sku === decodedText || p.barcode === decodedText)
            if (prod) addToCart(prod)
            else showToast(`Not found: ${decodedText}`, 'error')
            stopScanner()
          },
          () => {}
        )
      } catch (err) {
        showToast('කැමරාව ආරම්භ කිරීමට නොහැක. (Camera Permission අවශ්‍යයි)', 'error')
        setIsScannerOpen(false)
      }
    }, 300)
  }

  const stopScanner = () => {
    if (scanRef.current) {
      try { scanRef.current.stop() } catch (e) {}
      scanRef.current = null
    }
    setIsScannerOpen(false)
  }

  const shareLastBill = async () => {
    if (!lastBill) return
    try {
      const doc = new jsPDF({ unit: 'mm', format: [80, 150] })
      doc.setFontSize(12)
      doc.text(billSettings?.header_text || billSettings?.store_name || 'Nishadi Motors', 10, 10)
      doc.setFontSize(8)
      doc.text(`Date: ${lastBill.date}`, 10, 16)
      doc.line(10, 18, 70, 18)
      let y = 22
      lastBill.items.forEach(i => {
        doc.text(`${i.name} x${i.qty} - ${currency}${(i.price * i.qty).toFixed(2)}`, 10, y)
        y += 4
      })
      doc.line(10, y, 70, y)
      y += 4
      doc.text(`Total: ${currency}${lastBill.total.toFixed(2)}`, 10, y)
      const pdfBlob = doc.output('blob')
      const file = new File([pdfBlob], 'receipt.pdf', { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Receipt', files: [file] })
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(`*${billSettings?.header_text || billSettings?.store_name || 'Shop'}*\nTotal: ${currency}${lastBill.total.toFixed(2)}`)}`, '_blank')
      }
    } catch (err) {
      showToast('Share Error', 'error')
    }
  }

  const printReceiptWindow = (billData = lastBill) => {
    if (!billData) return
    const s = billSettings || {}
    const is58 = s.paper_size === '58mm'
    const printableWidthPx = is58 ? 384 : 576

    const fontGreeting = (s.font_size_greeting || 14) * (is58 ? 1.5 : 1.8)
    const fontHeader = (s.font_size_header || 20) * (is58 ? 1.6 : 2.0)
    const fontContact = (s.font_size_contact || 12) * (is58 ? 1.3 : 1.5)
    const fontBody = (s.font_size_body || 12) * (is58 ? 1.4 : 1.6)
    const fontTotal = (s.font_size_total || 15) * (is58 ? 1.6 : 1.9)
    const fontFooter = (s.font_size_footer || 12) * (is58 ? 1.3 : 1.5)
    const fontWatermark = (s.font_size_watermark || 9) * (is58 ? 1.1 : 1.3)

    const billSubtotal = billData.items.reduce((sum, i) => sum + ((i.originalPrice || i.price) * i.qty), 0)
    const billDiscount = billData.discount || (billSubtotal - billData.total)
    const receiptId = billData.id ? String(billData.id).slice(0, 6).toUpperCase() : Math.floor(Math.random() * 9000) + 1000
    const receiptDate = billData.date
    const custName = billData.customer?.name || 'Walk-in Customer'
    const custPhone = billData.customer?.phone || ''
    const validItems = billData.items
    const totalQty = validItems.reduce((sum, i) => sum + i.qty, 0)
    const billTotal = billData.total
    const paymentMethodVal = billData.paymentMethod
    const cashTenderedVal = paymentMethodVal === 'cash' ? (billData.cashTendered || billTotal) : billTotal
    const qrText = `INV:${s.bill_number_prefix || 'INV-'}${receiptId}|Total:${billTotal.toFixed(2)}|Date:${receiptDate}`
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`

    const receiptHTML = `
      <div style="
        width: 100%;
        max-width: ${printableWidthPx}px;
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

        ${(s.show_bill_no !== false || s.show_date_time !== false) ? `
        <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: ${fontBody}px; margin-bottom: 4px;">
          ${s.show_bill_no !== false ? `<div>${s.bill_number_prefix || 'Bill '}${receiptId}</div>` : '<div></div>'}
          ${s.show_date_time !== false ? `<div>${receiptDate}</div>` : ''}
        </div>` : ''}

        ${s.show_customer_info !== false && custName ? `
        <div style="margin-top: 2px; font-size: ${fontBody}px; font-weight: 600;">
          <div>Customer : "${custName}"</div>
          ${custPhone ? `<div>Phone: ${custPhone}</div>` : ''}
        </div>` : ''}

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        ${s.show_table_headers !== false ? `
        <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: ${fontBody}px; margin-bottom: 4px;">
          <div style="width: 32%; text-align: left;">උපරිම සිල්ලර මිල</div>
          <div style="width: 24%; text-align: right;">Rate</div>
          <div style="width: 16%; text-align: center;">Qty</div>
          <div style="width: 28%; text-align: right;">Amount</div>
        </div>
        <div style="border-bottom: 2px dashed #000; margin: 6px 0;"></div>
        ` : ''}

        <div style="margin-top: 6px;">
          ${validItems.map(item => `
            <div style="margin-bottom: 8px;">
              <div style="font-weight: 800; font-size: ${fontBody + 1}px; margin-bottom: 2px;">${item.name}</div>
              <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; font-weight: 600;">
                <div style="width: 32%; text-align: left;">${Number(item.originalPrice || item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="width: 24%; text-align: right;">${Number(item.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="width: 16%; text-align: center;">${item.qty}</div>
                <div style="width: 28%; text-align: right; font-weight: 800;">${Number(item.price * item.qty).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        ${s.show_total_items !== false ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; font-weight: 600; margin-top: 4px;">
          <span>Total Items</span>
          <span>${totalQty}</span>
        </div>` : ''}

        ${s.show_subtotal !== false ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 3px;">
          <span>Subtotal</span>
          <span>${Number(billSubtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        ${billDiscount > 0 ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 2px;">
          <span>Discount</span>
          <span>-${Number(billDiscount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>` : ''}
        ` : ''}

        <div style="border-bottom: 2px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontTotal}px; font-weight: 900; margin: 6px 0;">
          <span>Total Amount</span>
          <span>${currency}${Number(billTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 4px;">
          <span>Amount Received</span>
          <span>${Number(cashTenderedVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>

        ${s.show_payment_details !== false ? `
        <div style="display: flex; justify-content: space-between; font-size: ${fontBody}px; margin-top: 3px;">
          <span>Payment Details</span>
          <span>${paymentMethodVal.charAt(0).toUpperCase() + paymentMethodVal.slice(1)}</span>
        </div>` : ''}

        <div style="border-bottom: 2px dashed #000; margin-top: 8px;"></div>
        
        ${s.show_dynamic_qr !== false ? `
        <div style="text-align: center; margin: 10px 0;">
          <img src="${qrUrl}" style="width: ${(s.qr_size || 80) * 1.6}px; height: ${(s.qr_size || 80) * 1.6}px; filter: contrast(150%); display: inline-block;" />
          <div style="font-size: ${fontWatermark}px; margin-top: 3px; font-weight: bold;">Scan for Details</div>
        </div>` : ''}

        ${s.show_footer !== false ? `
        <div style="text-align: center; font-size: ${fontFooter}px; margin-top: 10px; font-weight: 700; white-space: pre-wrap;">${s.footer_text || 'Thank You! Come Again...'}\\n${s.footer_text_sinhala || 'ස්තුතියි! නැවත එන්න...'}</div>` : ''}
        
        <div style="border-bottom: 1px dotted #000; margin-top: 12px;"></div>

        ${s.show_watermark !== false ? `
        <div style="text-align: center; font-size: ${fontWatermark}px; margin-top: 8px; color: #444;">Powered by Nishadi Enterprise Suite.<br/>Design & Developed by Ceylon Digi Solutions</div>` : ''}
      </div>
    `

    if (Capacitor.isNativePlatform()) {
      showToast('Printing bill directly via Bluetooth...', 'info')
      printNativeBluetooth(receiptHTML, s.paper_size || '80mm')
        .then((msg) => showToast(msg, 'success'))
        .catch((err) => showToast(err, 'error'))
    } else {
      const iframeId = 'receipt-iframe-' + Date.now()
      const existingIframe = document.getElementById(iframeId)
      if (existingIframe) existingIframe.remove()
      const iframe = document.createElement('iframe')
      iframe.id = iframeId
      iframe.style.display = 'none'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow.document
      doc.open()
      doc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @media print {
              @page { margin: 0; size: ${s.paper_size || '80mm'} auto; }
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>${receiptHTML}</body>
        </html>
      `)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
        }, 1500)
      }, 400)
    }
  }

  const productPanel = (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-2xl p-4 flex flex-col space-y-3 overflow-hidden min-h-0 flex-1">
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base outline-none"
          placeholder="🔍 Search Item, Part No or Barcode..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition" onClick={startScanner}>
          <BsUpcScan size={18} />
        </button>
      </div>

      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center opacity-50 dark:text-gray-400">📦 No products found.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {products
            .filter(p =>
              p.name?.toLowerCase().includes(search.toLowerCase()) ||
              p.sku?.toLowerCase().includes(search.toLowerCase()) ||
              (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase()))
            )
            .map(p => {
              const cartItem = cart.find(i => i.id === p.id)
              const inCartQty = cartItem ? cartItem.qty : 0
              const currentLiveStock = p.stock - inCartQty
              const isOutOfStock = currentLiveStock <= 0
              return (
                <button
                  key={p.id}
                  className={`relative p-3 aspect-square border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:bg-gray-700 transition text-left shadow-sm flex flex-col justify-between ${
                    inCartQty > 0 ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-gray-700' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                  } ${isOutOfStock && p.preventOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={() => addToCart(p)}
                >
                  {inCartQty > 0 && <span className="absolute top-2 right-2 bg-blue-600 text-white font-extrabold text-xs px-2 py-0.5 rounded-full">x {inCartQty}</span>}
                  <div>
                    <div className="font-semibold text-sm sm:text-base mt-2 line-clamp-2">{p.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{p.sku || 'N/A'}</div>
                    {p.barcode && <div className="text-[9px] text-blue-500 dark:text-blue-400 mt-0.5 font-bold">Part: {p.barcode}</div>}
                  </div>
                  <div className="text-xs sm:text-sm opacity-70 mt-2">
                    {currency}{p.price} | Stock: <span className={isOutOfStock ? 'text-red-500 font-bold' : 'font-bold text-blue-400'}>{currentLiveStock}</span>
                  </div>
                </button>
              )
            })}
        </div>
      )}

      {holdOrders.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mt-2 border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-sm mb-2 text-gray-900 dark:text-white">📌 Hold Orders ({holdOrders.length})</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {holdOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 text-sm">
                <div className="text-gray-900 dark:text-white">
                  <span className="font-semibold">#{o.id.slice(0, 6)}</span>
                  <span className="ml-2">{currency}{o.total}</span>
                </div>
                <div className="flex gap-1">
                  <button className="px-2 py-1 bg-blue-500 text-white rounded text-xs" onClick={() => loadHold(o.id)}>Load</button>
                  <button className="px-2 py-1 bg-red-500 text-white rounded text-xs" onClick={() => deleteHoldOrder(o.id)}>Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const billingTerminal = (
    <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-2xl p-4 flex flex-col overflow-y-auto flex-1">
      {isMobile && <button onClick={() => setMobileView('products')} className="mb-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg self-start">← Back</button>}

      <div className="relative mb-3" ref={customerDropdownRef}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base outline-none"
              placeholder="🔍 Search customer or phone contact..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setShowCustomerDropdown(true)
              }}
              onFocus={() => setShowCustomerDropdown(true)}
            />
            {customerSearch && (filteredCustomers.length > 0 || filteredDeviceContacts.length > 0) && showCustomerDropdown && (
              <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto text-gray-900 dark:text-white">
                {filteredCustomers.map(c => (
                  <li key={c.id} className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm" onClick={() => selectCustomerFromSearch(c)}>
                    <span className="font-medium">{c.name}</span> <span className="text-xs opacity-70">({c.phone})</span>
                  </li>
                ))}
                {filteredDeviceContacts.map(c => (
                  <li key={c.id} className="px-3 py-2 hover:bg-blue-100 dark:hover:bg-blue-900 cursor-pointer text-sm bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-gray-600" onClick={() => selectCustomerFromSearch(c)}>
                    <span className="font-medium flex items-center gap-1">📱 {c.name}</span>
                    <span className="text-xs opacity-70">({c.phone}) - Save to System</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button onClick={pickContact} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg transition text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600">📇</button>
          <button className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg transition text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600" onClick={() => setNewCustomerForm(true)}>➕</button>
          {selectedCustomer && <button onClick={clearCustomer} className="px-2 py-2 text-red-500 text-sm">✕</button>}
        </div>
      </div>

      {selectedCustomer ? (
        <div className="mb-3 p-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-white">
          <p className="font-bold">{selectedCustomer.name}</p>
          <p className={selectedCustomer.total_credit > 0 ? 'text-red-500 font-semibold' : ''}>Credit: {currency}{selectedCustomer.total_credit || 0}</p>
        </div>
      ) : (
        !customerPhone && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs text-center border border-blue-100 dark:border-blue-800/50">
            ℹ️ No customer selected. Sale will be saved as <b>Walk-in Customer</b>.
          </div>
        )
      )}

      <div className="flex-1 overflow-y-auto space-y-1.5 mb-3 pr-1 mt-2">
        {cart.length === 0 ? (
          <div className="text-center text-sm opacity-50 dark:text-gray-400 py-8">🛒 No items in cart</div>
        ) : (
          cart.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2.5 rounded-lg text-sm sm:text-base border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white">
              <div className="flex-1 pr-2"><span className="font-medium block line-clamp-1">{item.name}</span></div>
              <div className="flex items-center gap-1">
                <button className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded font-bold" onClick={() => updateCartQty(item.id, item.qty - 1)}>−</button>
                <span className="w-8 text-center font-semibold text-sm">{item.qty}</span>
                <button className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded font-bold" onClick={() => updateCartQty(item.id, item.qty + 1)}>+</button>
              </div>
              <span className="ml-2 font-bold w-20 text-right">{currency}{(item.price * item.qty).toFixed(2)}</span>
              <button onClick={() => openEditModal(item)} className="ml-2 p-1 text-blue-500 hover:bg-blue-100 dark:hover:bg-gray-600 rounded"><FiEdit3 size={16} /></button>
              <button className="ml-1 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-gray-600 rounded" onClick={() => removeFromCart(item.id)}>✕</button>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          type="number"
          placeholder="Discount"
          className="w-24 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base outline-none"
          value={discount}
          onChange={e => setDiscount(Number(e.target.value))}
        />
        <span className="text-sm opacity-70">Discount</span>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-4 text-sm sm:text-base text-gray-900 dark:text-white">
        <div className="flex justify-between"><span>Subtotal</span> <span>{currency}{subtotal.toFixed(2)}</span></div>
        {taxEnabled && <div className="flex justify-between"><span>Tax ({taxRate}%)</span> <span>{currency}{taxAmount.toFixed(2)}</span></div>}
        {discount > 0 && <div className="flex justify-between text-red-500 dark:text-red-400"><span>Discount</span> <span>-{currency}{discount.toFixed(2)}</span></div>}
        <div className="flex justify-between text-lg sm:text-xl font-bold mt-1 pt-1 border-t border-gray-300 dark:border-gray-500"><span>Total</span> <span>{currency}{final.toFixed(2)}</span></div>
      </div>

      <div className="mb-4">
        <div className="text-sm font-medium mb-2 text-gray-900 dark:text-white">💳 Payment Method</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { method: 'cash', label: 'Cash', color: 'bg-green-600 dark:bg-green-700' },
            { method: 'card', label: 'Card', color: 'bg-blue-600 dark:bg-blue-700' },
            { method: 'cheque', label: 'Cheque', color: 'bg-purple-600 dark:bg-purple-700' },
            { method: 'credit', label: 'Credit', color: 'bg-orange-500 dark:bg-orange-600' },
            { method: 'bank_transfer', label: 'Bank', color: 'bg-teal-600 dark:bg-teal-700' }
          ].map(pm => (
            <button
              key={pm.method}
              className={`px-3 py-2 rounded-lg text-sm sm:text-base font-medium transition-all hover:scale-105 ${
                paymentMethod === pm.method ? `${pm.color} text-white` : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-transparent dark:border-gray-600'
              }`}
              onClick={() => setPaymentMethod(pm.method)}
            >
              {pm.label}
            </button>
          ))}
        </div>
      </div>

      {paymentMethod === 'cash' && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Cash Tendered (මුදල් ලැබුණි)</label>
          <input
            type="number"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base font-bold outline-none"
            placeholder="Enter Cash Given"
            value={cashTendered}
            onChange={e => setCashTendered(e.target.value)}
          />
          {tenderedNum > 0 && (
            <div className="mt-1 text-sm font-bold text-green-600 dark:text-green-400">
              Balance to Return (ඉතුරු මුදල): {currency}{balanceDue.toFixed(2)}
            </div>
          )}
        </div>
      )}

      {paymentMethod === 'cheque' && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none" placeholder="Cheque Number" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} />
          <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none" value={chequeDate} onChange={e => setChequeDate(e.target.value)} />
        </div>
      )}
      {paymentMethod === 'bank_transfer' && (
        <div className="mb-3">
          <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none" placeholder="Bank Reference" value={bankReference} onChange={e => setBankReference(e.target.value)} />
        </div>
      )}
      {paymentMethod === 'credit' && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-white">Due Date</label>
          <input type="date" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm outline-none" value={creditDueDate} onChange={e => setCreditDueDate(e.target.value)} />
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button className="flex-1 px-3 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50" onClick={() => checkout('completed')} disabled={cart.length === 0}>
          ✅ Checkout ({totalItemCount})
        </button>
        <button className="flex-1 px-3 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 disabled:opacity-50" onClick={() => checkout('hold')} disabled={cart.length === 0}>
          ⏸️ Hold
        </button>
      </div>
    </div>
  )

  return (
    <PageTemplate>
      <div className="text-gray-900 dark:text-white h-full">
        {!isMobile && (
          <div className="flex gap-4 h-[calc(100vh-120px)]">
            <div className="w-2/5 flex flex-col">{productPanel}</div>
            <div className="w-3/5 flex flex-col">{billingTerminal}</div>
          </div>
        )}
        {isMobile && mobileView === 'products' && (
          <div className="flex flex-col h-[calc(100vh-120px)]">
            <div className="flex-1 overflow-hidden flex flex-col">{productPanel}</div>
            <div className="p-3 flex-shrink-0">
              <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg" onClick={() => setMobileView('billing')}>
                🛒 Go to Counter ({totalItemCount})
              </button>
            </div>
          </div>
        )}
        {isMobile && mobileView === 'billing' && <div className="flex flex-col h-[calc(100vh-120px)]">{billingTerminal}</div>}

        {isScannerOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 text-center space-y-4">
              <div className="flex justify-between items-center border-b pb-3 dark:border-gray-700">
                <h3 className="font-bold text-lg flex items-center gap-2"><FiCamera /> Scan Product Barcode</h3>
                <button onClick={stopScanner} className="text-gray-400 hover:text-gray-600"><FiX size={22} /></button>
              </div>
              <div id="reader-pos" className="w-full overflow-hidden rounded-xl bg-black min-h-[250px] border-2 border-dashed border-gray-300 dark:border-gray-700"></div>
              <p className="text-xs text-gray-400">Position barcode inside the frame to add to cart.</p>
              <button onClick={stopScanner} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition">
                Close Scanner
              </button>
            </div>
          </div>
        )}

        {receiptModalOpen && lastBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4 animate-scaleIn">
              <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-3">
                <span className="text-3xl">🧾</span>
                <h3 className="text-xl font-extrabold mt-1">{billSettings?.header_text || 'Nishadi Motors'}</h3>
                <p className="text-xs text-gray-500">Order Completed & Auto-Printed!</p>
                <p className="text-xs text-gray-400 mt-1">{lastBill.date}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl max-h-60 overflow-y-auto space-y-2 border border-gray-100 dark:border-gray-700">
                {lastBill.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="font-medium truncate max-w-[200px]">{item.name} <span className="text-xs text-gray-400">x{item.qty}</span></span>
                    <span className="font-bold">{currency}{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2 flex justify-between font-extrabold text-base">
                  <span>Total Amount:</span>
                  <span className="text-green-600 dark:text-green-400">{currency}{lastBill.total.toFixed(2)}</span>
                </div>
                {lastBill.paymentMethod === 'cash' && (
                  <>
                    <div className="flex justify-between text-sm text-gray-500"><span>Cash Tendered:</span><span>{currency}{Number(lastBill.cashTendered || 0).toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm font-bold text-blue-600 dark:text-blue-400"><span>Balance Due:</span><span>{currency}{Number(lastBill.balanceDue || 0).toFixed(2)}</span></div>
                  </>
                )}
                <div className="text-xs text-center text-gray-500 pt-1 uppercase">Payment: {lastBill.paymentMethod}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => printReceiptWindow(lastBill)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm">🖨️ Print Again</button>
                <button onClick={shareLastBill} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-sm"><BsWhatsapp size={16} /> WhatsApp</button>
              </div>
              <button onClick={() => setReceiptModalOpen(false)} className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-bold py-3 rounded-xl transition text-sm">✅ Done / New Sale</button>
            </div>
          </div>
        )}

        {editModalOpen && selectedCartItem && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl border dark:border-gray-700">
              <div className="flex justify-between items-start border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-bold">{selectedCartItem.name}</h3>
                <button onClick={() => setEditModalOpen(false)} className="hover:text-red-500"><FiX size={20} /></button>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Selling Price ({currency})</label>
                <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl px-4 py-2.5 font-bold outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Quantity</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setEditQty(Math.max(1, editQty - 1))} className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-xl font-bold"><FiMinus size={18} /></button>
                  <input type="number" min="1" value={editQty} onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))} className="flex-1 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl py-2.5 text-center font-bold text-lg outline-none" />
                  <button type="button" onClick={() => setEditQty(editQty + 1)} className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-xl font-bold"><FiPlus size={18} /></button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleUpdateCartItem} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700">Update Item</button>
              </div>
            </div>
          </div>
        )}

        {customerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 border dark:border-gray-700">
              <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-3">
                <h3 className="text-lg font-bold">📇 Import Contact</h3>
                <button onClick={() => setCustomerModal(false)} className="hover:text-red-500"><FiX size={20} /></button>
              </div>
              <p className="text-sm opacity-80 text-center">කරුණාකර VCF ෆයිල් එකක් හරහා අප්ලෝඩ් කරන්න.</p>
              <label className="bg-blue-600 text-white text-sm font-bold px-4 py-3 rounded-lg cursor-pointer flex items-center justify-center gap-2 hover:bg-blue-700">
                <FiUpload /> VCF / VCard එකක් තෝරන්න
                <input type="file" accept=".vcf,.vcard" onChange={handleVcfUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {newCustomerForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow-2xl p-6 w-full max-w-md border dark:border-gray-700">
              <h3 className="text-lg font-bold mb-4">New Customer</h3>
              <div className="mb-4">
                <button type="button" onClick={handlePickContactForModal} className="w-full py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold rounded-lg border border-blue-300 dark:border-blue-800 hover:bg-blue-200 transition flex items-center justify-center gap-2">📱 Pick from Phone Contacts</button>
              </div>
              <input type="text" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none" placeholder="Name" value={newCustName} onChange={e => setNewCustName(e.target.value)} />
              <input type="tel" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 mb-4 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white outline-none" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium" onClick={createNewCustomer}>Create</button>
                <button className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium" onClick={() => setNewCustomerForm(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTemplate>
  )
}