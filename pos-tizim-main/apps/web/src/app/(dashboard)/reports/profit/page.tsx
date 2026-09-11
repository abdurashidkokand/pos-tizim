'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface ProfitReport {
  period: { from: string; to: string };
  salesCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalDiscount: number;
  profitMargin: number;
  daily: Array<{ date: string; revenue: number; profit: number; count: number }>;
}

interface DebtReport {
  totalDebt: number;
  count: number;
  receivables: Array<{
    id: string; amountDue: number; amountPaid: number; status: string;
    customer: { id: string; name: string; phone: string | null };
    sale: { id: string; receiptNo: string; total: number } | null;
  }>;
}

function fmt(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

export default function ProfitPage() {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data: profit, isLoading: loadingProfit } = useQuery<ProfitReport>({
    queryKey: ['profit', from, to],
    queryFn: () => api.get(`/reports/profit?from=${from}&to=${to}`),
  });

  const { data: debt, isLoading: loadingDebt } = useQuery<DebtReport>({
    queryKey: ['debt-report'],
    queryFn: () => api.get('/reports/debt'),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Foyda hisoboti</h1>

      {/* Date filter */}
      <div className="flex gap-3 items-center">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <span className="text-gray-400">—</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
      </div>

      {loadingProfit ? (
        <div className="animate-pulse text-gray-400">Yuklanmoqda...</div>
      ) : profit ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Jami savdo</p>
              <p className="text-2xl font-bold">{fmt(profit.totalRevenue)} <span className="text-sm font-normal text-gray-400">so'm</span></p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Sof foyda</p>
              <p className="text-2xl font-bold text-green-600">{fmt(profit.totalProfit)} <span className="text-sm font-normal text-gray-400">so'm</span></p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Foyda margini</p>
              <p className="text-2xl font-bold">{profit.profitMargin}%</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <p className="text-sm text-gray-500">Sotuvlar soni</p>
              <p className="text-2xl font-bold">{profit.salesCount}</p>
              <p className="text-xs text-gray-400 mt-1">Chegirma: {fmt(profit.totalDiscount)} so'm</p>
            </div>
          </div>

          {/* Debt Summary */}
          {debt && (
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Ochiq qarzlar</p>
                  <p className="text-2xl font-bold text-red-600">{fmt(debt.totalDebt)} so'm</p>
                </div>
                <span className="text-sm text-gray-400">{debt.count} ta qarz</span>
              </div>
            </div>
          )}

          {/* Daily Breakdown Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <h3 className="font-semibold px-4 py-3 border-b">Kunlik taqsimot</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 bg-gray-50">
                    <th className="px-4 py-3">Sana</th>
                    <th className="px-4 py-3 text-right">Sotuvlar</th>
                    <th className="px-4 py-3 text-right">Savdo</th>
                    <th className="px-4 py-3 text-right">Foyda</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {profit.daily.map((d) => (
                    <tr key={d.date} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{d.date}</td>
                      <td className="px-4 py-2 text-right">{d.count}</td>
                      <td className="px-4 py-2 text-right">{fmt(d.revenue)}</td>
                      <td className="px-4 py-2 text-right text-green-600">{fmt(d.profit)}</td>
                      <td className="px-4 py-2 text-right">{d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0}%</td>
                    </tr>
                  ))}
                  {profit.daily.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">Ma'lumot yo'q</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
