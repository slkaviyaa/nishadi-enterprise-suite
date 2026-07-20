'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export default function Customers() {
  const { branch } = useAuth()
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [customerOrders, setCustomerOrders] = useState([])
  const [returnMode, setReturnMode] = useState(null) // { orderId, items: [] }

  useEffect(() => {
    supabase.from('customers').select('*').eq('branch_id', branch).then(({ data }) => setCustomers(data || []))
  }, [branch])

  const openHistory = async (cust) => {
    setSelectedCustomer(cust)
    const { data: orders } = await supabase.from('orders')
      .select('id, total, created_at, status, order_items(branch_product_id, quantity, price, branch_products(products(name)))')
      .eq('branch_id', branch)
      .eq('customer_id', cust.id)
      .order('created_at', { ascending: false })
    setCustomerOrders(orders || [])
  }

  const addPayment = async (custId, amt) => {
    await supabase.from('credit_transactions').insert({ customer_id: custId, branch_id: branch, amount: amt, type: 'payment' })
    await supabase.rpc('update_customer_credit', { cust_id: custId, payment: amt })
    window.location.reload()
  }

  const initiateReturn = (order) => {
    setReturnMode({ orderId: order.id, items: order.order_items.map(i => ({ ...i, returnQty: 0 })) })
  }

  const processReturn = async () => {
    const { orderId, items } = returnMode
    let totalRefund = 0
    for (const item of items) {
      if (item.returnQty > 0) {
        totalRefund += item.returnQty * item.price
        await supabase.rpc('decrement_stock', { bp_id: item.branch_product_id, qty: -item.returnQty }) // add back stock
      }
    }
    if (totalRefund > 0) {
      await supabase.from('orders').update({ status: 'returned', total: totalRefund }).eq('id', orderId)
      await supabase.from('customers').update({ total_credit: selectedCustomer.total_credit - totalRefund }).eq('id', selectedCustomer.id)
      alert(`Return processed. Refund: Rs. ${totalRefund}`)
      setReturnMode(null)
      openHistory(selectedCustomer)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Customer Management</h2>
      <div className="overflow-x-auto">
        <table className="table w-full">
          <thead><tr><th>Name</th><th>Phone</th><th>Credit</th><th>Loyalty</th><th>Action</th></tr></thead>
          <tbody>
            {customers.map(c => (
              <tr key={c.id} className="transition-colors hover:bg-base-200 cursor-pointer" onClick={() => openHistory(c)}>
                <td>{c.name}</td><td>{c.phone}</td>
                <td className={c.total_credit > 0 ? 'text-error font-bold' : ''}>Rs. {c.total_credit}</td>
                <td>{c.loyalty_points} pts</td>
                <td>
                  <button className="btn btn-xs btn-success" onClick={(e) => { e.stopPropagation(); const amt = prompt('Payment amount:'); if (amt) addPayment(c.id, Number(amt)) }}>Add Payment</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Customer History Modal */}
      {selectedCustomer && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-2">{selectedCustomer.name} - History</h3>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead><tr><th>Date</th><th>Order ID</th><th>Items</th><th>Total</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {customerOrders.map(order => (
                    <tr key={order.id} className="transition-colors hover:bg-base-100">
                      <td>{new Date(order.created_at).toLocaleDateString()}</td>
                      <td>#{order.id.slice(0,6)}</td>
                      <td className="text-sm">
                        {order.order_items.map(i => `${i.branch_products?.products?.name} x${i.quantity}`).join(', ')}
                      </td>
                      <td>Rs. {order.total}</td>
                      <td className={order.status === 'returned' ? 'text-error' : ''}>{order.status}</td>
                      <td>
                        {order.status === 'completed' && (
                          <button className="btn btn-xs btn-warning" onClick={() => initiateReturn(order)}>Return</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setSelectedCustomer(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnMode && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-2">Process Return</h3>
            {returnMode.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1">
                <span className="flex-1">{item.branch_products?.products?.name} (x{item.quantity})</span>
                <input type="number" className="input input-bordered input-xs w-20" min={0} max={item.quantity} value={item.returnQty}
                  onChange={e => {
                    const newItems = [...returnMode.items]
                    newItems[idx].returnQty = Math.min(item.quantity, Math.max(0, Number(e.target.value)))
                    setReturnMode({ ...returnMode, items: newItems })
                  }} />
              </div>
            ))}
            <div className="modal-action">
              <button className="btn btn-primary" onClick={processReturn}>Confirm Return</button>
              <button className="btn" onClick={() => setReturnMode(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}