'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface DailyReport {
  date: string;
  salesCount: number;
  voidCount: number;
  totalRevenue: number;
  totalDiscount: number;
  totalItemsSold: number;
  totalProfit: number | null;
  paymentBreakdown: Record<string, number>;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [mounted, setMounted] = useState(false);
  const user = mounted ? getUser() : null;

  useEffect(() => { setMounted(true); }, []);

  const { data: report, isLoading } = useQuery<DailyReport>({
    queryKey: ['daily-report', today],
    queryFn: () => api.get<DailyReport>(`/reports/daily?date=${today}`),
    enabled: user?.role !== 'CASHIER',
  });

  const { data: session } = useQuery({
    queryKey: ['active-session'],
    queryFn: () => api.get('/cash-sessions/active'),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('uz-UZ').format(n) + ' so\'m';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Kassa holati */}
      <div
        className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
          (session as any)?.id
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}
      >
        {(session as any)?.id ? (
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            {`Kassa ochiq — ochilgan: ${new Date((session as any).openedAt).toLocaleTimeString('uz-UZ')}`}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
            Kassa yopiq — avval kassani oching
          </span>
        )}
      </div>

      {/* Hisobot kartochkalari */}
      {user?.role !== 'CASHIER' && (
        <>
          {isLoading ? (
            <p className="text-gray-400">Yuklanmoqda...</p>
          ) : report ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Bugungi sotuvlar"
                value={report.salesCount}
                sub={`${report.voidCount} ta bekor qilingan`}
              />
              <StatCard
                label="Jami daromad"
                value={fmt(report.totalRevenue)}
              />
              <StatCard
                label="Chegirma"
                value={fmt(report.totalDiscount)}
              />
              <StatCard
                label="Foyda"
                value={
                  report.totalProfit !== null
                    ? fmt(report.totalProfit)
                    : 'Tan narх kiritilmagan'
                }
              />
            </div>
          ) : null}

          {report?.paymentBreakdown && (
            <div className="mt-6 bg-white rounded-xl shadow-sm p-5 border border-gray-100">
              <h2 className="font-semibold mb-3">To'lov usullari</h2>
              <div className="flex gap-6">
                {Object.entries(report.paymentBreakdown).map(([type, amount]) => (
                  <div key={type}>
                    <p className="text-sm text-gray-500">{type}</p>
                    <p className="font-bold">{fmt(amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
