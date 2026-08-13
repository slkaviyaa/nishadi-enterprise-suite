'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import PageTemplate from './PageTemplate';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    if (data) setSuppliers(data);
  };

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);

    const { error } = await supabase.from('suppliers').insert([
      { name, phone, email, company }
    ]);

    if (!error) {
      setName('');
      setPhone('');
      setEmail('');
      setCompany('');
      fetchSuppliers();
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Suppliers Management (සැපයුම්කරුවන්)</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage supplier directory & contact details</p>
        </div>
      </div>

      {/* Add Supplier Form */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200 mb-4">Add New Supplier</h2>
        <form onSubmit={handleAddSupplier} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Supplier Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ABC Trading"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company name"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="077XXXXXXX"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors text-sm shadow-sm"
            >
              {loading ? 'Adding...' : '+ Add Supplier'}
            </button>
          </div>
        </form>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200">Supplier Directory ({suppliers.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase border-b dark:border-gray-700">
                <th className="p-3">Supplier Name</th>
                <th className="p-3">Company</th>
                <th className="p-3">Phone</th>
                <th className="p-3">Email</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700 text-sm">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-6 text-center text-gray-400">No suppliers found</td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                    <td className="p-3 font-medium text-gray-800 dark:text-white">{s.name}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{s.company || '—'}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{s.phone || '—'}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{s.email || '—'}</td>
                    <td className="p-3 text-right space-x-2">
                      <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}