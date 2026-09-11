'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Download, FileText } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

export default function DailyReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ['daily-report', date],
    queryFn: () => api.get<any>(`/reports/daily?date=${date}`),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Kunlik hisobot</h1>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <input
          type="date"
          className="border rounded-lg px-3 py-2 text-sm"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button
          onClick={() => refetch()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          Ko'rsatish
        </button>
        <a
          href={`/api/reports/daily.xlsx?date=${date}`}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5"
          download
        >
          <Download className="w-4 h-4" /> Excel
        </a>
        <a
          href={`/api/reports/daily.pdf?date=${date}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-1.5"
        >
          <FileText className="w-4 h-4" /> PDF
        </a>
      </div>

      {isLoading ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500">Sotuvlar soni</p>
              <p className="text-3xl font-bold mt-1">{report.salesCount}</p>
              <p className="text-xs text-gray-400">
                {report.voidCount} ta bekor
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500">Jami daromad</p>
              <p className="text-2xl font-bold mt-1">
                {fmt(report.totalRevenue)}
              </p>
              <p className="text-xs text-gray-400">so'm</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500">Chegirmalar</p>
              <p className="text-2xl font-bold mt-1">
                {fmt(report.totalDiscount)}
              </p>
              <p className="text-xs text-gray-400">so'm</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500">Foyda</p>
              <p className="text-2xl font-bold mt-1">
                {report.totalProfit !== null
                  ? fmt(report.totalProfit)
                  : '—'}
              </p>
              <p className="text-xs text-gray-400">so'm</p>
            </div>
          </div>

          {report.paymentBreakdown &&
            Object.keys(report.paymentBreakdown).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="font-semibold mb-3">To'lov usullari bo'yicha</h2>
                <div className="flex gap-6">
                  {Object.entries(report.paymentBreakdown).map(
                    ([type, amount]) => (
                      <div key={type} className="text-center">
                        <p className="text-sm text-gray-500">{type}</p>
                        <p className="text-xl font-bold">
                          {fmt(amount as number)} so'm
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
        </div>
      ) : null}
    </div>
  );
}
