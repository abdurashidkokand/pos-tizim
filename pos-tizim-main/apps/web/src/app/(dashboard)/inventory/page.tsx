'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Camera } from 'lucide-react';
import dynamic from 'next/dynamic';
const BarcodeScanner = dynamic(() => import('@/components/barcode-scanner'), { ssr: false });

interface Product {
  id: string;
  name: string;
  sku: string | null;
  stock: { quantity: number } | null;
  variants: { id: string; size: string | null; color: string | null; quantity: number }[];
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    productId: '',
    variantId: '',
    qtyDelta: '',
    reason: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const { data: products } = useQuery<{ data: Product[] }>({
    queryKey: ['products-simple'],
    queryFn: () => api.get<{ data: Product[] }>('/products?limit=200'),
  });

  const { data: movements, isLoading } = useQuery({
    queryKey: ['movements'],
    queryFn: () => api.get('/inventory/movements?limit=50'),
  });

  const adjustMutation = useMutation({
    mutationFn: (body: unknown) => api.post('/inventory/adjust', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movements'] });
      qc.invalidateQueries({ queryKey: ['products-simple'] });
      setMessage(`Stock muvaffaqiyatli yangilandi`);
      setError('');
      setForm({ productId: '', variantId: '', qtyDelta: '', reason: '' });
    },
    onError: (err: any) => {
      setError(err.message);
      setMessage('');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    adjustMutation.mutate({
      productId: form.productId,
      variantId: form.variantId || undefined,
      qtyDelta: Number(form.qtyDelta),
      reason: form.reason,
    });
  }

  // Barcode scan handler: look up product and auto-select it
  function handleScan(code: string) {
    setShowScanner(false);
    api
      .get<{ id: string; name: string; matchedVariantId?: string }>(`/products/by-barcode/${encodeURIComponent(code)}`)
      .then((p) => {
        setForm((f) => ({ ...f, productId: p.id, variantId: p.matchedVariantId || '' }));
        setMessage(`Topildi: ${p.name}`);
        setTimeout(() => setMessage(''), 3000);
      })
      .catch(() => {
        setError('Barcode topilmadi: ' + code);
        setTimeout(() => setError(''), 3000);
      });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Ombor</h1>

      {/* Adjust form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Stock moslash</h2>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg border border-gray-200 transition"
          >
            <Camera className="w-3.5 h-3.5" /> Barcode skanerlash
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Mahsulot *</label>
            <select
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.productId}
              onChange={(e) => setForm({ ...form, productId: e.target.value, variantId: '' })}
              required
            >
              <option value="">— Tanlang —</option>
              {products?.data.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (hozirgi: {p.stock?.quantity ?? 0})
                </option>
              ))}
            </select>
          </div>
          {form.productId && (() => {
            const selectedProduct = products?.data.find((product) => product.id === form.productId);
            return selectedProduct?.variants?.length ? (
              <div>
                <label className="text-sm font-medium">Variant</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={form.variantId}
                  onChange={(e) => setForm({ ...form, variantId: e.target.value })}
                  required
                >
                  <option value="">- Rang / o&apos;lchamni tanlang -</option>
                  {selectedProduct.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {[variant.color, variant.size].filter(Boolean).join(' / ') || 'Standart'} ({variant.quantity} dona)
                    </option>
                  ))}
                </select>
              </div>
            ) : null;
          })()}
          <div>
            <label className="text-sm font-medium">
              Miqdor (+kirim / -chiqim) *
            </label>
            <input
              type="number"
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.qtyDelta}
              onChange={(e) => setForm({ ...form, qtyDelta: e.target.value })}
              placeholder="+50 yoki -10"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Sabab *</label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Kirim, Qaytarma, Inventarizatsiya..."
              required
            />
          </div>
          {message && <p className="text-green-600 text-sm">{message}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={adjustMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {adjustMutation.isPending ? 'Yuklanmoqda...' : 'Saqlash'}
          </button>
        </form>
      </div>

      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* Movements table */}
      <h2 className="font-semibold mb-3">Harakatlar tarixi</h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Yuklanmoqda...</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Mahsulot</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Delta</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Sabab</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Sana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(movements as any)?.data?.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{m.product?.name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${m.qtyDelta > 0 ? 'text-green-600' : 'text-red-500'}`}
                    >
                      {m.qtyDelta > 0 ? '+' : ''}
                      {m.qtyDelta}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.reason}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(m.createdAt).toLocaleString('uz-UZ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>          </div>        )}
      </div>
    </div>
  );
}
