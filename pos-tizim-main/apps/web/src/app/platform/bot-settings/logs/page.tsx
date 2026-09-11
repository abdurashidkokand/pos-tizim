'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Bot,
  Ban,
  SkipForward,
} from 'lucide-react';

interface NotifLog {
  id: string;
  tenantId: string | null;
  notificationType: string;
  audience: string;
  messageTextSnapshot: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
  telegramIdentity: {
    telegramUsername: string | null;
    firstName: string | null;
  } | null;
}

interface QueueItem {
  id: string;
  tenantId: string | null;
  notificationType: string;
  audience: string;
  status: string;
  priority: string;
  retryCount: number;
  scheduledFor: string;
  lastError: string | null;
  createdAt: string;
}

const STATUS_ICON = {
  SENT: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  FAILED: <XCircle className="w-4 h-4 text-red-500" />,
  BLOCKED: <Ban className="w-4 h-4 text-red-400" />,
  SKIPPED: <SkipForward className="w-4 h-4 text-gray-400" />,
  PENDING: <Clock className="w-4 h-4 text-yellow-500" />,
  PROCESSING: <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  CANCELLED: <XCircle className="w-4 h-4 text-gray-400" />,
};

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-500',
};

export default function DeliveryLogsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'logs' | 'queue'>('logs');

  const { data: logs = [], isLoading: logsLoading } = useQuery<NotifLog[]>({
    queryKey: ['tg-admin-logs'],
    queryFn: () => api.get<NotifLog[]>('/telegram/notifications/logs'),
    enabled: tab === 'logs',
    refetchInterval: 30000,
  });

  const { data: queue = [], isLoading: queueLoading } = useQuery<QueueItem[]>({
    queryKey: ['tg-admin-queue'],
    queryFn: () => api.get<QueueItem[]>('/telegram/notifications/queue'),
    enabled: tab === 'queue',
    refetchInterval: 15000,
  });

  const fmtDate = (d: string) => new Date(d).toLocaleString('uz-UZ');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Yetkazib berish loglari</h1>
          <p className="text-sm text-gray-500">Barcha tenantlar bo'yicha bildirish tarixi</p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: tab === 'logs' ? ['tg-admin-logs'] : ['tg-admin-queue'] })}
          className="ml-auto text-gray-400 hover:text-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['logs', 'queue'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'logs' ? 'Yetkazish loglari' : 'Navbat (Queue)'}
          </button>
        ))}
      </div>

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {logsLoading ? (
            <p className="p-6 text-sm text-gray-400">Yuklanmoqda...</p>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Hali loglar yo'q</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Tur</th>
                    <th className="px-4 py-2 text-left">Oluvchi</th>
                    <th className="px-4 py-2 text-left">Xabar</th>
                    <th className="px-4 py-2 text-left">Sana</th>
                    <th className="px-4 py-2 text-left">Retry</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {STATUS_ICON[log.status as keyof typeof STATUS_ICON] ?? <AlertTriangle className="w-4 h-4 text-gray-400" />}
                          <span className="text-xs">{log.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{log.notificationType}</p>
                        <p className="text-xs text-gray-400">{log.audience}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {log.telegramIdentity?.firstName ?? '—'}
                        {log.telegramIdentity?.telegramUsername ? ` @${log.telegramIdentity.telegramUsername}` : ''}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs truncate text-gray-600">{log.messageTextSnapshot.replace(/<[^>]+>/g, '')}</p>
                        {log.errorMessage && (
                          <p className="text-xs text-red-500 truncate">{log.errorMessage}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {fmtDate(log.sentAt ?? log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-center text-gray-500">
                        {log.retryCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Queue tab */}
      {tab === 'queue' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {queueLoading ? (
            <p className="p-6 text-sm text-gray-400">Yuklanmoqda...</p>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Navbat bo'sh</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Prioritet</th>
                    <th className="px-4 py-2 text-left">Tur</th>
                    <th className="px-4 py-2 text-left">Rejalashtirilgan</th>
                    <th className="px-4 py-2 text-left">Xato</th>
                    <th className="px-4 py-2 text-left">Retry</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {queue.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {STATUS_ICON[item.status as keyof typeof STATUS_ICON] ?? <AlertTriangle className="w-4 h-4 text-gray-400" />}
                          <span className="text-xs">{item.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[item.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-xs">{item.notificationType}</p>
                        <p className="text-xs text-gray-400">{item.audience}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {fmtDate(item.scheduledFor)}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-500 max-w-xs truncate">
                        {item.lastError ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-center text-gray-500">
                        {item.retryCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
