'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Customer {
  id: string; name: string; phone: string | null; createdAt: string;
  _count?: { sales: number; receivables: number };
}

interface Receivable {
  id: string; amountDue: number; amountPaid: number; status: string; createdAt: string;
  customer: { id: string; name: string; phone: string | null };
  sale: { id: string; receiptNo: string; total: number } | null;
}

function fmt(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

export default function CustomersPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'customers' | 'debt'>('customers');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [payModal, setPayModal] = useState<Receivable | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payType, setPayType] = useState('CASH');

  const { data: customers = [], isLoading: loadingCustomers } = useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: () => api.get<any>(`/customers?search=${search}`).then((r) => r.data ?? []),
  });

  const { data: receivables = [], isLoading: loadingDebt } = useQuery<Receivable[]>({
    queryKey: ['receivables'],
    queryFn: () => api.get<any>('/customers/receivables/all').then((r) => r.data ?? []),
    enabled: tab === 'debt',
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/customers', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowAdd(false); setForm({ name: '', phone: '' }); },
  });

  const payMut = useMutation({
    mutationFn: (data: { id: string; amount: number; type: string }) =>
      api.post(`/customers/receivables/${data.id}/pay`, { amount: data.amount, type: data.type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receivables'] });
      setPayModal(null);
    },
  });

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mijozlar va Qarzlar</h1>
        <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Mijoz qo'shish
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button onClick={() => setTab('customers')} className={`px-4 py-2 text-sm border-b-2 ${tab === 'customers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
          Mijozlar
        </button>
        <button onClick={() => setTab('debt')} className={`px-4 py-2 text-sm border-b-2 ${tab === 'debt' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
          Qarzlar
        </button>
      </div>

      {/* Customers Tab */}
      {tab === 'customers' && (
        <div>
          <input
            type="text"
            placeholder="Ism yoki telefon bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-4 py-2.5 text-sm mb-4"
          />
          {loadingCustomers ? (
            <p className="text-gray-400">Yuklanmoqda...</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50">
                    <th className="px-4 py-3">Ism</th>
                    <th className="px-4 py-3">Telefon</th>
                    <th className="px-4 py-3">Sana</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(c.createdAt).toLocaleDateString('uz-UZ')}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Mijozlar topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Debt Tab */}
      {tab === 'debt' && (
        <div>
          {loadingDebt ? (
            <p className="text-gray-400">Yuklanmoqda...</p>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50">
                    <th className="px-4 py-3">Mijoz</th>
                    <th className="px-4 py-3">Chek</th>
                    <th className="px-4 py-3 text-right">Qarz</th>
                    <th className="px-4 py-3 text-right">To'langan</th>
                    <th className="px-4 py-3 text-right">Qoldiq</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {receivables.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{r.customer.name}</td>
                      <td className="px-4 py-3 text-gray-500">{r.sale?.receiptNo || '—'}</td>
                      <td className="px-4 py-3 text-right">{fmt(r.amountDue)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt(r.amountPaid)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(r.amountDue - r.amountPaid)}</td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'OPEN' && (
                          <button
                            onClick={() => { setPayModal(r); setPayAmount(String(r.amountDue - r.amountPaid)); }}
                            className="text-blue-600 text-xs hover:underline"
                          >
                            To'lash
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {receivables.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Qarzlar yo'q</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Yangi mijoz</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Ism" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border rounded-lg px-4 py-2.5 text-sm" />
              <input type="tel" placeholder="Telefon" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full border rounded-lg px-4 py-2.5 text-sm" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="flex-1 border rounded-lg py-2 text-sm">Bekor qilish</button>
              <button onClick={() => createMut.mutate()} disabled={!form.name || createMut.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50">Saqlash</button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Debt Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Qarzni to'lash</h3>
            <p className="text-sm text-gray-500 mb-4">
              {payModal.customer.name} — Qoldiq: {fmt(payModal.amountDue - payModal.amountPaid)} so'm
            </p>
            <div className="space-y-3">
              <input type="number" placeholder="Summa" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full border rounded-lg px-4 py-2.5 text-sm" />
              <select value={payType} onChange={(e) => setPayType(e.target.value)} className="w-full border rounded-lg px-4 py-2.5 text-sm">
                <option value="CASH">Naqd</option>
                <option value="CARD">Karta</option>
              </select>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setPayModal(null)} className="flex-1 border rounded-lg py-2 text-sm">Bekor qilish</button>
              <button
                onClick={() => payMut.mutate({ id: payModal.id, amount: Number(payAmount), type: payType })}
                disabled={!payAmount || payMut.isPending}
                className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
              >
                To'lash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
