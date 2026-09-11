'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  PackageX,
  BellRing,
  Package,
  User,
} from 'lucide-react';

interface AlertRule {
  id: string;
  alertType: string;
  productId: string | null;
  branchId: string | null;
  minQuantity: number | null;
  daysWithoutSale: number | null;
  velocityWindowDays: number | null;
  enabled: boolean;
  createdAt: string;
}

interface AlertSubscription {
  id: string;
  alertType: string;
  userId: string;
  telegramIdentityId: string | null;
  branchId: string | null;
  createdAt: string;
}

const ALERT_TYPES = [
  { value: 'LOW_STOCK', label: 'Kam zaxira', icon: <AlertTriangle className="w-4 h-4 text-yellow-500" /> },
  { value: 'OUT_OF_STOCK', label: 'Tugagan', icon: <PackageX className="w-4 h-4 text-red-500" /> },
  { value: 'DEAD_STOCK', label: "Sovuq zaxira (sotilmayapti)", icon: <Package className="w-4 h-4 text-gray-500" /> },
  { value: 'PRICE_CHANGE', label: 'Narx o\'zgardi', icon: <BellRing className="w-4 h-4 text-blue-500" /> },
  { value: 'NEGATIVE_STOCK', label: 'Minus zaxira', icon: <PackageX className="w-4 h-4 text-purple-500" /> },
];

export default function InventoryAlertsPage() {
  const qc = useQueryClient();
  const [ruleForm, setRuleForm] = useState({
    alertType: 'LOW_STOCK',
    minQuantity: '5',
    daysWithoutSale: '30',
  });
  const [subForm, setSubForm] = useState({ alertType: 'LOW_STOCK', userId: '' });
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [showSubForm, setShowSubForm] = useState(false);

  const { data: rules = [], isLoading: rulesLoading, refetch: refetchRules } = useQuery<AlertRule[]>({
    queryKey: ['tg-alert-rules'],
    queryFn: () => api.get<AlertRule[]>('/telegram/inventory-alerts/rules'),
  });

  const { data: subs = [], isLoading: subsLoading, refetch: refetchSubs } = useQuery<AlertSubscription[]>({
    queryKey: ['tg-alert-subs'],
    queryFn: () => api.get<AlertSubscription[]>('/telegram/inventory-alerts/subscriptions'),
  });

  const createRuleMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/telegram/inventory-alerts/rules', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-alert-rules'] });
      setMsg({ type: 'ok', text: 'Qoida yaratildi' });
      setShowRuleForm(false);
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const deleteRuleMut = useMutation({
    mutationFn: (id: string) => api.delete(`/telegram/inventory-alerts/rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-alert-rules'] });
      setMsg({ type: 'ok', text: "Qoida o'chirildi" });
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const createSubMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post('/telegram/inventory-alerts/subscriptions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-alert-subs'] });
      setMsg({ type: 'ok', text: 'Obuna yaratildi' });
      setShowSubForm(false);
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const deleteSubMut = useMutation({
    mutationFn: (id: string) => api.delete(`/telegram/inventory-alerts/subscriptions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-alert-subs'] });
      setMsg({ type: 'ok', text: "Obuna o'chirildi" });
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const alertLabel = (type: string) =>
    ALERT_TYPES.find((t) => t.value === type)?.label ?? type;

  const handleCreateRule = () => {
    const payload: Record<string, unknown> = { alertType: ruleForm.alertType };
    if (ruleForm.alertType === 'LOW_STOCK' && ruleForm.minQuantity)
      payload.minQuantity = parseInt(ruleForm.minQuantity);
    if (ruleForm.alertType === 'DEAD_STOCK' && ruleForm.daysWithoutSale)
      payload.daysWithoutSale = parseInt(ruleForm.daysWithoutSale);
    createRuleMut.mutate(payload);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-bold">Inventar Alertlari</h1>
          <p className="text-sm text-gray-500">
            Zaxira ogohlantirishlarini sozlash va obunalar
          </p>
        </div>
        <button
          onClick={() => { refetchRules(); refetchSubs(); }}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
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

      {/* Alert Rules */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <BellRing className="w-5 h-5 text-blue-500" />
            Alert Qoidalari
          </h2>
          <button
            onClick={() => setShowRuleForm((v) => !v)}
            className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Yangi qoida
          </button>
        </div>

        {showRuleForm && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Alert turi</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={ruleForm.alertType}
                onChange={(e) => setRuleForm({ ...ruleForm, alertType: e.target.value })}
              >
                {ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {ruleForm.alertType === 'LOW_STOCK' && (
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-1">
                  Minimum miqdor (shundan pastda ogohlantirish)
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={ruleForm.minQuantity}
                  onChange={(e) => setRuleForm({ ...ruleForm, minQuantity: e.target.value })}
                  min="1"
                />
              </div>
            )}
            {ruleForm.alertType === 'DEAD_STOCK' && (
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-1">
                  Sotilmagan kunlar soni
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2 text-sm"
                  value={ruleForm.daysWithoutSale}
                  onChange={(e) => setRuleForm({ ...ruleForm, daysWithoutSale: e.target.value })}
                  min="1"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreateRule}
                disabled={createRuleMut.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {createRuleMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={() => setShowRuleForm(false)}
                className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        )}

        {rulesLoading ? (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Qoida topilmadi. Yangi qoida qo'shing.
          </p>
        ) : (
          <div className="divide-y">
            {rules.map((rule) => (
              <div key={rule.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {ALERT_TYPES.find((t) => t.value === rule.alertType)?.icon}
                  <div>
                    <p className="text-sm font-medium">{alertLabel(rule.alertType)}</p>
                    <p className="text-xs text-gray-500">
                      {rule.minQuantity != null && `Min miqdor: ${rule.minQuantity}`}
                      {rule.daysWithoutSale != null && `${rule.daysWithoutSale} kundan ko'p sotilmagan`}
                      {rule.productId && ` · Mahsulot ID: ${rule.productId.slice(0, 8)}...`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${rule.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {rule.enabled ? 'Faol' : "Nofaol"}
                  </span>
                  <button
                    onClick={() => deleteRuleMut.mutate(rule.id)}
                    disabled={deleteRuleMut.isPending}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Subscriptions */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <User className="w-5 h-5 text-purple-500" />
            Obunalar (kim qaysi alertni oladi)
          </h2>
          <button
            onClick={() => setShowSubForm((v) => !v)}
            className="flex items-center gap-1 text-sm bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Yangi obuna
          </button>
        </div>

        {showSubForm && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border">
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">Alert turi</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={subForm.alertType}
                onChange={(e) => setSubForm({ ...subForm, alertType: e.target.value })}
              >
                {ALERT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium block mb-1">
                Foydalanuvchi ID
              </label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="User ID kiriting"
                value={subForm.userId}
                onChange={(e) => setSubForm({ ...subForm, userId: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => createSubMut.mutate({ alertType: subForm.alertType, userId: subForm.userId })}
                disabled={createSubMut.isPending || !subForm.userId}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {createSubMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
              <button
                onClick={() => setShowSubForm(false)}
                className="px-4 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        )}

        {subsLoading ? (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        ) : subs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            Hali hech kim obuna bo'lmagan.
          </p>
        ) : (
          <div className="divide-y">
            {subs.map((sub) => (
              <div key={sub.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{alertLabel(sub.alertType)}</p>
                  <p className="text-xs text-gray-500">
                    User: {sub.userId.slice(0, 12)}...
                    {sub.branchId && ` · Filial: ${sub.branchId.slice(0, 8)}...`}
                  </p>
                </div>
                <button
                  onClick={() => deleteSubMut.mutate(sub.id)}
                  disabled={deleteSubMut.isPending}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
