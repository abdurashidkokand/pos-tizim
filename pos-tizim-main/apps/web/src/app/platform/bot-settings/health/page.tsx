'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  HeartPulse,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Bot,
  Send,
  Clock,
} from 'lucide-react';

interface BotHealth {
  ok: boolean;
  result?: {
    id: number;
    username: string;
    first_name: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  };
  description?: string;
}

interface DeliveryStats {
  sent: number;
  failed: number;
  pending: number;
  blocked: number;
  total: number;
}

interface TenantOverview {
  tenantId: string;
  tenantName: string;
  botEnabled: boolean;
  ownerAlertsEnabled: boolean;
  customerBotEnabled: boolean;
  linkedAccounts: number;
  queue: {
    PENDING: number;
    PROCESSING: number;
    SENT: number;
    FAILED: number;
    CANCELLED: number;
    SKIPPED: number;
  };
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border p-5 text-center">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function BotHealthPage() {
  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery<BotHealth>({
    queryKey: ['tg-admin-health'],
    queryFn: () => api.get<BotHealth>('/telegram/admin/health'),
    refetchInterval: 60000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<DeliveryStats>({
    queryKey: ['tg-delivery-stats-admin'],
    queryFn: () => api.get<DeliveryStats>('/telegram/notifications/stats'),
    refetchInterval: 30000,
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<TenantOverview[]>({
    queryKey: ['tg-admin-tenants'],
    queryFn: () => api.get<TenantOverview[]>('/telegram/admin/tenants'),
    refetchInterval: 30000,
  });

  const failRate = stats && stats.total > 0
    ? Math.round((stats.failed / stats.total) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <HeartPulse className="w-7 h-7 text-green-600" />
        <div>
          <h1 className="text-2xl font-bold">Bot tizim holati</h1>
          <p className="text-sm text-gray-500">Real-time monitoring va yetkazib berish statistikasi</p>
        </div>
        <button
          onClick={() => refetchHealth()}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Bot Health Card */}
      <section className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-blue-500" />
          Telegram Bot holati
        </h2>
        {healthLoading ? (
          <p className="text-sm text-gray-400">Tekshirilmoqda...</p>
        ) : !health ? (
          <p className="text-sm text-red-500">Bot konfiguratsiyasi topilmadi</p>
        ) : health.ok && health.result ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <p className="font-medium text-green-700">Bot ishlayapti</p>
                <p className="text-sm text-gray-500">
                  @{health.result.username} · ID: {health.result.id}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center text-xs">
                <p className="font-medium text-gray-700">Guruhga qo'shilish</p>
                <p className={health.result.can_join_groups ? 'text-green-600' : 'text-gray-400'}>
                  {health.result.can_join_groups ? 'Ha' : "Yo'q"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center text-xs">
                <p className="font-medium text-gray-700">Guruh xabarlar</p>
                <p className={health.result.can_read_all_group_messages ? 'text-green-600' : 'text-gray-400'}>
                  {health.result.can_read_all_group_messages ? 'Ha' : "Yo'q"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center text-xs">
                <p className="font-medium text-gray-700">Inline so'rovlar</p>
                <p className={health.result.supports_inline_queries ? 'text-green-600' : 'text-gray-400'}>
                  {health.result.supports_inline_queries ? 'Ha' : "Yo'q"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-red-600">
            <XCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">Bot ishlamayapti</p>
              <p className="text-sm text-gray-500">{health.description ?? 'Noma\'lum xato'}</p>
            </div>
          </div>
        )}
      </section>

      {/* Delivery Stats */}
      {!statsLoading && stats && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-800">Yetkazib berish statistikasi (jami)</h2>
            {failRate > 10 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <AlertTriangle className="w-3.5 h-3.5" />
                Xato darajasi: {failRate}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard label="Yuborilgan" value={stats.sent} color="text-green-600" />
            <StatCard label="Xato" value={stats.failed} color="text-red-600" />
            <StatCard label="Kutmoqda" value={stats.pending} color="text-yellow-600" />
            <StatCard label="Bloklangan" value={stats.blocked} color="text-gray-500" />
            <StatCard label="Jami" value={stats.total} color="text-blue-600" />
          </div>
        </section>
      )}

      {/* Tenant Overview */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          Tenant navbat holati
        </h2>
        {tenantsLoading ? (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Ma'lumot topilmadi</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-gray-500">
                  <th className="pb-2 font-medium">Tenant</th>
                  <th className="pb-2 font-medium text-center">Bot</th>
                  <th className="pb-2 font-medium text-center">Bog'langan</th>
                  <th className="pb-2 font-medium text-center text-yellow-600">Kutmoqda</th>
                  <th className="pb-2 font-medium text-center text-green-600">Yuborilgan</th>
                  <th className="pb-2 font-medium text-center text-red-500">Xato</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tenants.map((t) => (
                  <tr key={t.tenantId} className="hover:bg-gray-50">
                    <td className="py-2.5">
                      <p className="font-medium text-gray-800">{t.tenantName}</p>
                      <p className="text-xs text-gray-400">{t.tenantId.slice(0, 12)}...</p>
                    </td>
                    <td className="py-2.5 text-center">
                      {t.botEnabled
                        ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}
                    </td>
                    <td className="py-2.5 text-center text-gray-700">{t.linkedAccounts}</td>
                    <td className="py-2.5 text-center text-yellow-600 font-medium">
                      {(t.queue.PENDING ?? 0) + (t.queue.PROCESSING ?? 0)}
                    </td>
                    <td className="py-2.5 text-center text-green-600 font-medium">
                      {t.queue.SENT ?? 0}
                    </td>
                    <td className="py-2.5 text-center text-red-500 font-medium">
                      {t.queue.FAILED ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
