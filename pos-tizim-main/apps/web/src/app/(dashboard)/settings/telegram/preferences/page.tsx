'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Bell, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState } from 'react';

interface NotificationPreference {
  id: string;
  entityType: string;
  entityId: string;
  notificationType: string;
  enabled: boolean;
  deliveryMode: string | null;
}

interface DeliveryStats {
  sent: number;
  failed: number;
  pending: number;
  blocked: number;
  total: number;
}

const NOTIFICATION_TYPES = [
  { key: 'SALE_CREATED', label: 'Yangi sotuv' },
  { key: 'REFUND', label: 'Qaytarish' },
  { key: 'LOW_STOCK', label: 'Kam zaxira' },
  { key: 'OUT_OF_STOCK', label: 'Tugagan zaxira' },
  { key: 'DAILY_SUMMARY', label: 'Kunlik xulosa' },
  { key: 'WEEKLY_SUMMARY', label: 'Haftalik xulosa' },
  { key: 'MONTHLY_SUMMARY', label: 'Oylik xulosa' },
  { key: 'CASHBACK_EARNED', label: 'Cashback olingan' },
  { key: 'CASHBACK_REDEEMED', label: 'Cashback sarflangan' },
  { key: 'RECEIPT', label: 'Chek (mijozga)' },
  { key: 'PROMO', label: 'Aksiya' },
  { key: 'DEBT_REMINDER', label: 'Qarz eslatma' },
  { key: 'BONUS_EXPIRY', label: 'Bonus muddati tugashi' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="shrink-0">
      {checked
        ? <ToggleRight className="w-8 h-8 text-blue-600" />
        : <ToggleLeft className="w-8 h-8 text-gray-300" />}
    </button>
  );
}

export default function NotificationPreferencesPage() {
  const qc = useQueryClient();
  const [entityType, setEntityType] = useState('OWNER');
  const [entityId, setEntityId] = useState('');
  const [searched, setSearched] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: stats } = useQuery<DeliveryStats>({
    queryKey: ['tg-delivery-stats'],
    queryFn: () => api.get<DeliveryStats>('/telegram/notifications/stats'),
  });

  const { data: prefs = [], isLoading: prefsLoading, refetch } = useQuery<NotificationPreference[]>({
    queryKey: ['tg-prefs', entityType, entityId],
    queryFn: () =>
      api.get<NotificationPreference[]>(
        `/telegram/notifications/preferences?entityType=${entityType}&entityId=${entityId}`,
      ),
    enabled: searched && !!entityId,
  });

  const upsertMut = useMutation({
    mutationFn: (data: {
      entityType: string;
      entityId: string;
      notificationType: string;
      enabled: boolean;
    }) => api.post('/telegram/notifications/preferences', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-prefs'] });
      setMsg({ type: 'ok', text: 'Sozlama saqlandi' });
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const isEnabled = (notificationType: string) => {
    const pref = prefs.find((p) => p.notificationType === notificationType);
    return pref ? pref.enabled : true; // default on
  };

  const toggle = (notificationType: string, enabled: boolean) => {
    upsertMut.mutate({ entityType, entityId, notificationType, enabled });
  };

  const handleSearch = () => {
    if (!entityId) return;
    setSearched(true);
    refetch();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Bildirishnoma Sozlamalari</h1>
          <p className="text-sm text-gray-500">
            Foydalanuvchi yoki mijoz bo'yicha bildirishnoma turlarini boshqarish
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`px-4 py-2 rounded text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Delivery Stats */}
      {stats && (
        <section className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Umumiy yetkazib berish statistikasi</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Yuborilgan', value: stats.sent, color: 'text-green-600' },
              { label: 'Xato', value: stats.failed, color: 'text-red-600' },
              { label: 'Kutmoqda', value: stats.pending, color: 'text-yellow-600' },
              { label: 'Bloklangan', value: stats.blocked, color: 'text-gray-500' },
              { label: 'Jami', value: stats.total, color: 'text-blue-600' },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Entity Selector */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-700">Entity tanlash</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Entity turi</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={entityType}
              onChange={(e) => { setEntityType(e.target.value); setSearched(false); }}
            >
              <option value="OWNER">Owner</option>
              <option value="STAFF">Staff</option>
              <option value="USER">Foydalanuvchi</option>
              <option value="CUSTOMER">Mijoz</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 font-medium block mb-1">Entity ID</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="ID kiriting..."
              value={entityId}
              onChange={(e) => { setEntityId(e.target.value); setSearched(false); }}
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={!entityId}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Yuklash
        </button>
      </section>

      {/* Preferences List */}
      {searched && entityId && (
        <section className="bg-white rounded-xl border p-6 space-y-2">
          <h2 className="font-semibold text-gray-700 mb-4">
            Bildirishnoma turlari — {entityType} / <span className="text-blue-600">{entityId.slice(0, 12)}...</span>
          </h2>
          {prefsLoading ? (
            <p className="text-sm text-gray-400">Yuklanmoqda...</p>
          ) : (
            <div className="divide-y">
              {NOTIFICATION_TYPES.map((nt) => (
                <div key={nt.key} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-gray-700">{nt.label}</span>
                  <Toggle
                    checked={isEnabled(nt.key)}
                    onChange={(v) => toggle(nt.key, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
