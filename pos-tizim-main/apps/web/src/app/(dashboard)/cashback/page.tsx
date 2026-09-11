'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { X } from 'lucide-react';

interface CashbackCard {
  id: string; cardNumber: string; balance: number; totalEarned: number; totalSpent: number;
  isActive: boolean; customer: { id: string; name: string; phone: string | null };
}

interface CbTransaction {
  id: string; amount: number; type: 'EARN' | 'REDEEM'; note: string | null; createdAt: string;
}

function fmt(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

export default function CashbackPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [selectedCard, setSelectedCard] = useState<CashbackCard | null>(null);

  const { data: cards = [], isLoading } = useQuery<CashbackCard[]>({
    queryKey: ['cashback-cards', search],
    queryFn: () => api.get<any>(`/cashback/cards?search=${search}`).then((r) => r.data ?? []),
  });

  const { data: transactions = [] } = useQuery<CbTransaction[]>({
    queryKey: ['cashback-tx', selectedCard?.id],
    queryFn: () => api.get(`/cashback/cards/${selectedCard!.id}/transactions`),
    enabled: !!selectedCard,
  });

  const createMut = useMutation({
    mutationFn: () => api.post('/cashback/cards', { customerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashback-cards'] });
      setShowCreate(false);
      setCustomerId('');
    },
  });

  const totalBalance = cards.reduce((s, c) => s + c.balance, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cashback</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + Yangi karta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Kartalar soni</p>
          <p className="text-2xl font-bold">{cards.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Umumiy balans</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalBalance)} so'm</p>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Karta raqami, mijoz ismi bo'yicha qidirish..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-lg px-4 py-2.5 text-sm"
      />

      {/* Cards List */}
      {isLoading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50">
                <th className="px-4 py-3">Karta raqami</th>
                <th className="px-4 py-3">Mijoz</th>
                <th className="px-4 py-3 text-right">Balans</th>
                <th className="px-4 py-3 text-right">Yig'ilgan</th>
                <th className="px-4 py-3 text-right">Ishlatilgan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => (
                <tr key={card.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{card.cardNumber}</td>
                  <td className="px-4 py-3">{card.customer.name}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(card.balance)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(card.totalEarned)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmt(card.totalSpent)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelectedCard(card)} className="text-blue-600 text-xs hover:underline">
                      Tarix
                    </button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Kartalar topilmadi</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Card Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Yangi cashback karta</h3>
            <input type="text" placeholder="Mijoz ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full border rounded-lg px-4 py-2.5 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Mijoz ID sini mijozlar sahifasidan oling</p>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowCreate(false)} className="flex-1 border rounded-lg py-2 text-sm">Bekor qilish</button>
              <button onClick={() => createMut.mutate()} disabled={!customerId || createMut.isPending} className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50">Yaratish</button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selectedCard.cardNumber} — Tarix</h3>
              <button onClick={() => setSelectedCard(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {transactions.length === 0 ? (
              <p className="text-gray-400 text-sm">Tranzaksiyalar yo'q</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2">Sana</th>
                    <th className="pb-2">Tur</th>
                    <th className="pb-2 text-right">Summa</th>
                    <th className="pb-2">Izoh</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(tx.createdAt).toLocaleDateString('uz-UZ')}</td>
                      <td className="py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${tx.type === 'EARN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {tx.type === 'EARN' ? "Yig'ildi" : 'Ishlatildi'}
                        </span>
                      </td>
                      <td className={`py-2 text-right font-medium ${tx.type === 'EARN' ? 'text-green-600' : 'text-orange-600'}`}>
                        {tx.type === 'EARN' ? '+' : '-'}{fmt(tx.amount)}
                      </td>
                      <td className="py-2 text-gray-500">{tx.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
