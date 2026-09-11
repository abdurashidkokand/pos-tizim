'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Printer } from 'lucide-react';
import dynamic from 'next/dynamic';
const ReceiptPrint = dynamic(() => import('@/components/receipt-print'), { ssr: false });

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

export default function SalesPage() {
  const qc = useQueryClient();
  const [receiptSale, setReceiptSale] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: () => api.get<any>('/sales?limit=50'),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => api.post(`/sales/${id}/void`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sotuvlar</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Yuklanmoqda...</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Raqam</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Kassir</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Jami</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">To'lov</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Holat</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Sana</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.data?.map((s: any) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{s.receiptNo}</td>
                  <td className="px-4 py-3">{s.user?.username}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(s.total)} so'm</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.payments?.map((p: any) => p.type).join(', ')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.status === 'PAID'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {s.status === 'PAID' ? "To'langan" : 'Bekor'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(s.createdAt).toLocaleString('uz-UZ')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReceiptSale(s)}
                        className="text-blue-500 hover:text-blue-700 text-xs flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" /> Chek
                      </button>
                      {s.status === 'PAID' && (
                        <button
                          onClick={() => {
                            if (confirm(`#${s.receiptNo} ni bekor qilmoqchimisiz?`))
                              voidMutation.mutate(s.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          Bekor
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Sotuvlar topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {data && (
        <p className="text-xs text-gray-400 mt-3">Jami: {data.total} ta sotuv</p>
      )}

      {receiptSale && (
        <ReceiptPrint
          sale={receiptSale}
          onClose={() => setReceiptSale(null)}
        />
      )}
    </div>
  );
}
