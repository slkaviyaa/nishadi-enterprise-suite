'use client';

import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AuthProvider } from '../context/AuthContext';
import { SettingsProvider } from '../context/SettingsContext';
import { ToastProvider, useToast } from '../context/ToastContext';
import ThemeProvider from './ThemeProvider';

function SyncManager() {
  const { showToast } = useToast();

  useEffect(() => {
    const handleOnlineSync = async () => {
      const offlineBills = JSON.parse(localStorage.getItem('offline_bills') || '[]');
      if (offlineBills.length === 0) return;

      showToast('🌐 Internet connected! Syncing offline bills globally...', 'info');
      const remainingBills = [];

      for (const billData of offlineBills) {
        try {
          const { data: order, error: orderError } = await supabase.from('orders').insert({
            branch_id: billData.branch,
            total: billData.final,
            discount: billData.discount,
            status: billData.status,
            customer_id: billData.cid || null,
            payment_method: billData.paymentMethod,
            cheque_number: billData.chequeNumber,
            cheque_date: billData.chequeDate,
            bank_reference: billData.bank_reference
          }).select().single();

          if (orderError || !order) {
            remainingBills.push(billData);
            continue;
          }

          const { error: itemInsertError } = await supabase.from('order_items').insert(billData.cart.map(i => ({
            order_id: order.id,
            branch_product_id: i.id,
            quantity: i.qty,
            price: i.price
          })));

          if (itemInsertError) {
            await supabase.from('orders').delete().eq('id', order.id);
            remainingBills.push(billData);
            continue;
          }

          if (billData.status === 'completed') {
            for (const item of billData.cart) {
              if (item.autoUpdateStock === false) continue;
              await supabase.rpc('decrement_stock', { bp_id: item.id, qty: item.qty });
            }

            const syncBranchId = billData.syncBranchId;
            if (syncBranchId) {
              await supabase.rpc('create_parallel_order', {
                main_order_id: order.id,
                target_branch_id: syncBranchId
              });
            }
          }
        } catch (err) {
          remainingBills.push(billData);
        }
      }

      localStorage.setItem('offline_bills', JSON.stringify(remainingBills));
      if (remainingBills.length === 0) {
        showToast('✅ All offline bills successfully synced!', 'success');
      } else {
        showToast(`⚠️ Some bills failed to sync. Remaining: ${remainingBills.length}`, 'error');
      }
    };

    window.addEventListener('online', handleOnlineSync);
    if (navigator.onLine) {
      handleOnlineSync();
    }

    return () => {
      window.removeEventListener('online', handleOnlineSync);
    };
  }, [showToast]);

  return null;
}

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <ToastProvider>
            <SyncManager />
            {children}
          </ToastProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}