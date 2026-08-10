'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Quotations() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*');
    if (data) setCustomers(data);
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
    } else {
      setCart((prev) =>
        prev.map((item) => (item.id === id ? { ...item, qty } : item))
      );
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price || 0) * item.qty, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Quotations (මිල ගණන් කැඳවීම්)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create & Manage Customer Quotations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Product Selector */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Select Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
            {products.map((p) => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-gray-700/50 cursor-pointer transition-all duration-150"
              >
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">{p.name}</p>
                  <p className="text-xs text-gray-400">SKU: {p.sku || 'N/A'}</p>
                </div>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  Rs. {Number(p.price || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Quotation Summary & Details */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Quotation Details</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Customer</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Select Customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No phone'})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 dark:border-gray-700 space-y-2 max-h-[220px] overflow-y-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase">Selected Items</p>
            {cart.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No items added to quotation</p>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-sm py-1 border-b dark:border-gray-700">
                  <div className="truncate max-w-[140px]">
                    <p className="font-medium text-gray-800 dark:text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">Rs. {Number(item.price).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">-</button>
                    <span className="font-semibold">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 dark:border-gray-700 space-y-2">
            <div className="flex justify-between font-bold text-lg text-gray-800 dark:text-white">
              <span>Total:</span>
              <span>Rs. {subtotal.toLocaleString()}</span>
            </div>
            <button
              disabled={cart.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Generate Quotation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}