'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { CheckCircle2 } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

export default function CashSessionsPage() {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const user = mounted ? getUser() : null;

  useEffect(() => { setMounted(true); }, []);
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('');
  const [moveType, setMoveType] = useState<'IN' | 'OUT'>('IN');
  const [moveAmount, setMoveAmount] = useState('');
  const [moveNote, setMoveNote] = useState('');
  const [error, setError] = useState('');

  const { data: activeSession, isLoading } = useQuery({
    queryKey: ['active-session'],
    queryFn: () => api.get<any>('/cash-sessions/active'),
  });

  const openMutation = useMutation({
    mutationFn: () =>
      api.post('/cash-sessions/open', { openingCash: Number(openingCash) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session'] });
      setError('');
    },
    onError: (e: any) => setError(e.message),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/cash-sessions/${id}/close`, {
        closingCash: Number(closingCash),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session'] });
      setClosingCash('');
      setError('');
    },
    onError: (e: any) => setError(e.message),
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, ...body }: any) =>
      api.post(`/cash-sessions/${id}/move`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-session'] });
      setMoveAmount('');
      setMoveNote('');
      setError('');
    },
    onError: (e: any) => setError(e.message),
  });

  const session = activeSession as any;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-6">Kassa</h1>

      {error && (
        <p className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm mb-4">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : !session?.id ? (
        // Kassa yopiq — ochish
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold mb-4">Kassani ochish</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                Boshlang'ich naqd pul (so'm)
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                min="0"
              />
            </div>
            <button
              onClick={() => openMutation.mutate()}
              disabled={openMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {openMutation.isPending ? 'Ochilmoqda...' : 'Kassani ochish'}
            </button>
          </div>
        </div>
      ) : (
        // Kassa ochiq
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-green-800 flex items-center gap-1.5">Kassa ochiq <CheckCircle2 className="w-4 h-4" /></p>
                <p className="text-sm text-green-600 mt-1">
                  Ochilgan:{' '}
                  {new Date(session.openedAt).toLocaleString('uz-UZ')}
                </p>
                <p className="text-sm text-green-600">
                  Boshlang'ich: {fmt(session.openingCash)} so'm
                </p>
              </div>
            </div>
          </div>

          {/* Cash harakatlar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3">Kassa harakati</h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['IN', 'OUT'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMoveType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                      moveType === t
                        ? t === 'IN'
                          ? 'bg-green-600 text-white'
                          : 'bg-red-500 text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {t === 'IN' ? '+ Kirim' : '- Chiqim'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Summa (so'm)"
                value={moveAmount}
                onChange={(e) => setMoveAmount(e.target.value)}
                min="1"
              />
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Izoh (ixtiyoriy)"
                value={moveNote}
                onChange={(e) => setMoveNote(e.target.value)}
              />
              <button
                onClick={() =>
                  moveMutation.mutate({
                    id: session.id,
                    type: moveType,
                    amount: Number(moveAmount),
                    note: moveNote || undefined,
                  })
                }
                disabled={moveMutation.isPending || !moveAmount}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {moveMutation.isPending ? 'Yuklanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>

          {/* Harakatlar tarixi */}
          {session.movements?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold mb-3">Bugungi harakatlar</h2>
              <div className="space-y-2">
                {session.movements.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span
                      className={m.type === 'IN' ? 'text-green-600' : 'text-red-500'}
                    >
                      {m.type === 'IN' ? '+ ' : '- '}
                      {fmt(m.amount)} so'm
                    </span>
                    <span className="text-gray-400 text-xs">
                      {m.note && `${m.note} · `}
                      {new Date(m.createdAt).toLocaleTimeString('uz-UZ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kassani yopish */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold mb-3 text-red-600">Kassani yopish</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">
                  Yakuniy naqd pul (so'm)
                </label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  min="0"
                />
              </div>
              <button
                onClick={() => {
                  if (confirm('Kassani yopmoqchimisiz?'))
                    closeMutation.mutate(session.id);
                }}
                disabled={closeMutation.isPending || !closingCash}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {closeMutation.isPending ? 'Yopilmoqda...' : 'Kassani yopish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
