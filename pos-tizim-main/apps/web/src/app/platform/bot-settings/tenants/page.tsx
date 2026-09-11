'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Users,
  Clock,
  RefreshCw,
  Bot,
} from 'lucide-react';

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

export default function TenantsOverviewPage() {
  const { data = [], isLoading, refetch } = useQuery<TenantOverview[]>({
    queryKey: ['tg-admin-tenants'],
    queryFn: () => api.get<TenantOverview[]>('/telegram/admin/tenants'),
    refetchInterval: 30000,
  });

  const total = (q: TenantOverview['queue']) =>
    Object.values(q).reduce((s, v) => s + v, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Tenant holati</h1>
          <p className="text-sm text-gray-500">Barcha tenantlar bo'yicha Telegram integratsiya holati</p>
        </div>
        <button
          onClick={() => refetch()}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Yuklanmoqda...</p>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Hali tenantlar yo'q</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {data.map((t) => (
            <div key={t.tenantId} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-gray-800">{t.tenantName}</h2>
                  <p className="text-xs text-gray-400 font-mono">{t.tenantId}</p>
                </div>
                <span
                  className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                    t.botEnabled
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {t.botEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {t.botEnabled ? 'Yoqilgan' : "O'chirilgan"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>{t.linkedAccounts} ulangan</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  {t.ownerAlertsEnabled ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-300" />
                  )}
                  <span>Owner alertlar</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  {t.customerBotEnabled ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-300" />
                  )}
                  <span>Mijoz bot</span>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span>{total(t.queue)} jami xabar</span>
                </div>
              </div>

              {/* Queue breakdown */}
              <div className="mt-3 flex flex-wrap gap-2">
                {t.queue.PENDING > 0 && (
                  <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-2.5 py-0.5">
                    {t.queue.PENDING} kutmoqda
                  </span>
                )}
                {t.queue.PROCESSING > 0 && (
                  <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-0.5">
                    {t.queue.PROCESSING} yuborilmoqda
                  </span>
                )}
                {t.queue.SENT > 0 && (
                  <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                    {t.queue.SENT} yuborildi
                  </span>
                )}
                {t.queue.FAILED > 0 && (
                  <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5">
                    {t.queue.FAILED} muvaffaqiyatsiz
                  </span>
                )}
                {t.queue.CANCELLED > 0 && (
                  <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded-full px-2.5 py-0.5">
                    {t.queue.CANCELLED} bekor
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
