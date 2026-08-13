'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import PageTemplate from './PageTemplate';

export default function BackupRestore() {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [tableStats, setTableStats] = useState({ products: 0, customers: 0, orders: 0 });
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchStats();
    const savedDate = localStorage.getItem('last_backup_date');
    if (savedDate) setLastBackup(savedDate);
  }, []);

  const fetchStats = async () => {
    try {
      const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
      const { count: cCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      const { count: oCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
      
      setTableStats({
        products: pCount || 0,
        customers: cCount || 0,
        orders: oCount || 0,
      });
    } catch (e) {
      console.error('Stats fetch error:', e);
    }
  };

  const handleDownloadBackup = async () => {
    setLoading(true);
    try {
      const tables = ['products', 'customers', 'suppliers', 'orders', 'order_items', 'branch_settings'];
      const backupData = {};

      for (const table of tables) {
        const { data } = await supabase.from(table).select('*');
        backupData[table] = data || [];
      }

      backupData['_metadata'] = {
        exported_at: new Date().toISOString(),
        version: '1.0.0',
        app: 'Nishadi Enterprise Suite',
      };

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const downloadAnchor = document.createElement('a');
      const filename = `nishadi_backup_${new Date().toISOString().split('T')[0]}.json`;
      
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      const nowStr = new Date().toLocaleString();
      setLastBackup(nowStr);
      localStorage.setItem('last_backup_date', nowStr);
      alert('Backup downloaded successfully!');
    } catch (err) {
      alert('Backup failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedFile) {
      alert('Please select a .json backup file first');
      return;
    }

    const confirmRestore = confirm('⚠️ Warning: Restoring data will overwrite existing records. Do you want to continue?');
    if (!confirmRestore) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target.result);
        if (!backupData._metadata) {
          alert('Invalid backup file format');
          return;
        }

        // Restore tables
        const tables = ['products', 'customers', 'suppliers', 'branch_settings'];
        for (const table of tables) {
          if (backupData[table] && backupData[table].length > 0) {
            await supabase.from(table).upsert(backupData[table]);
          }
        }

        alert('Database restored successfully!');
        fetchStats();
      } catch (err) {
        alert('Restore error: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(selectedFile);
  };

  const metrics = [
    { label: 'Database Health', value: 'Connected', icon: '🟢' },
    { label: 'Total Products', value: `${tableStats.products} Items`, icon: '📦' },
    { label: 'Total Orders', value: `${tableStats.orders} Bills`, icon: '🧾' },
    { label: 'Last Backup', value: lastBackup ? lastBackup.split(',')[0] : 'None', icon: '💾' },
  ];

  const actions = (
    <button
      onClick={handleDownloadBackup}
      disabled={loading}
      className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition flex items-center gap-2 disabled:opacity-50 text-sm"
    >
      {loading ? 'Processing...' : '📥 Export Backup (.JSON)'}
    </button>
  );

  return (
    <PageTemplate
      title="💾 Backup & Restore System Data"
      subtitle="Export database backups, restore JSON files, and manage system data safety"
      metrics={metrics}
      actions={actions}
    >
      <div className="space-y-6">
        {/* Export Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
            <div>
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                📥 System Data Export (දත්ත උපස්ථ කිරීම)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Download a complete JSON backup copy of products, customers, suppliers, and order history
              </p>
            </div>
            <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full dark:bg-green-900/40 dark:text-green-300">
              Auto JSON Format
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Products Records:</span>
              <span className="font-bold text-gray-800 dark:text-white">{tableStats.products} Products</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Customers Records:</span>
              <span className="font-bold text-gray-800 dark:text-white">{tableStats.customers} Customers</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500 dark:text-gray-400 block text-xs">Orders History:</span>
              <span className="font-bold text-gray-800 dark:text-white">{tableStats.orders} Orders</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleDownloadBackup}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
            >
              {loading ? 'Exporting...' : '📥 Create & Download Full Backup'}
            </button>
          </div>
        </div>

        {/* Restore Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
          <div className="border-b pb-3 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              📤 Restore Database (දත්ත ප්‍රතිස්ථාපනය කිරීම)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Select a previously downloaded JSON backup file to restore products and settings
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center bg-gray-50/50 dark:bg-gray-700/20">
              <input
                type="file"
                accept=".json"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 dark:file:bg-gray-700 dark:file:text-white hover:file:bg-blue-100 cursor-pointer"
              />
              {selectedFile && (
                <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">
                  Selected File: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              ⚠️ <b>අවවාදයයි:</b> Backup ගොනුව ප්‍රතිස්ථාපනය කිරීමේදී දැනට පද්ධතියේ ඇති දත්ත යාවත්කාලීන විය හැක. නැවතත් Backup එකක් ගෙන තබා ගැනීම නිර්දේශ කෙරේ.
            </div>

            <button
              onClick={handleRestoreBackup}
              disabled={loading || !selectedFile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
            >
              {loading ? 'Restoring...' : '📤 Restore Database from File'}
            </button>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}