'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Download, Upload, DollarSign, X, Camera, Pencil, Tag } from 'lucide-react';
import dynamic from 'next/dynamic';
const BarcodeScanner = dynamic(() => import('@/components/barcode-scanner'), { ssr: false });
const BarcodeLabel = dynamic(() => import('@/components/barcode-label'), { ssr: false });

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number | null;
  isActive: boolean;
  barcodes: { id: string; code: string }[];
  images: { id: string; url: string; alt: string | null; sortOrder: number }[];
  stock: { quantity: number } | null;
}

interface ProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    price: '',
    cost: '',
    barcode: '',
    variants: [] as { size: string; color: string; price: string; quantity: string; barcode: string }[],
  });
  const [formError, setFormError] = useState('');
  // Barcode scanner for new product form
  const [showScannerForNew, setShowScannerForNew] = useState(false);
  // Barcode scanner for adding barcode to existing product
  const [addBcProductId, setAddBcProductId] = useState<string | null>(null);
  const [addBcInput, setAddBcInput] = useState('');
  const [showScannerForExisting, setShowScannerForExisting] = useState(false);
  // Barcode label printing
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [labelFormat, setLabelFormat] = useState<'40x30' | '58mm'>('58mm');
  // Excel import
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  // Bulk price update
  const [showBulkPrice, setShowBulkPrice] = useState(false);
  const [bulkPercent, setBulkPercent] = useState('');
  const [bulkFilter, setBulkFilter] = useState('');
  const [bulkResult, setBulkResult] = useState<{ updated: number; total: number } | null>(null);
  // Edit product
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', sku: '', price: '', cost: '' });
  const [editError, setEditError] = useState('');

  // Image upload handler
  const uploadImage = async (productId: string, file: File) => {
    const token = localStorage.getItem('access_token');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const uploadRes = await fetch('/api/uploads/image', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => null);
        throw new Error(err?.message || `Upload xatosi (${uploadRes.status})`);
      }
      const { url } = await uploadRes.json();
      const addRes = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url }),
      });
      if (!addRes.ok) {
        const err = await addRes.json().catch(() => null);
        throw new Error(err?.message || `Rasm qo'shish xatosi (${addRes.status})`);
      }
      qc.invalidateQueries({ queryKey: ['products'] });
    } catch (e: any) {
      alert(e.message || 'Upload xatosi');
    }
  };

  const deleteImage = async (productId: string, imageId: string) => {
    const token = localStorage.getItem('access_token');
    await fetch(`/api/products/${productId}/images/${imageId}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    qc.invalidateQueries({ queryKey: ['products'] });
  };

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['products', search],
    queryFn: () =>
      api.get<ProductsResponse>(
        `/products${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post('/products', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setForm({ name: '', sku: '', price: '', cost: '', barcode: '', variants: [] });
      setFormError('');
    },
    onError: (err: any) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api.patch(`/products/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setEditProduct(null);
      setEditError('');
    },
    onError: (err: any) => setEditError(err.message),
  });

  function openEdit(p: Product) {
    setEditProduct(p);
    setEditForm({
      name: p.name,
      sku: p.sku || '',
      price: String(p.price),
      cost: p.cost != null ? String(p.cost) : '',
    });
    setEditError('');
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProduct) return;
    setEditError('');
    editMutation.mutate({
      id: editProduct.id,
      body: {
        name: editForm.name,
        sku: editForm.sku || undefined,
        price: Number(editForm.price),
        cost: editForm.cost ? Number(editForm.cost) : undefined,
      },
    });
  }

  // Add barcode to existing product
  const addBarcodeMut = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      api.post(`/products/${id}/barcodes`, { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setAddBcProductId(null);
      setAddBcInput('');
    },
    onError: (e: any) => alert(e.message),
  });

  // Remove barcode from product
  const removeBarcodeMut = useMutation({
    mutationFn: ({ productId, barcodeId }: { productId: string; barcodeId: string }) =>
      api.delete(`/products/${productId}/barcodes/${barcodeId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    createMutation.mutate({
      name: form.name,
      sku: form.sku || undefined,
      price: Number(form.price),
      cost: form.cost ? Number(form.cost) : undefined,
      barcodes: form.barcode ? [form.barcode] : [],
      variants: form.variants.length
        ? form.variants.map((variant) => ({
            size: variant.size || undefined,
            color: variant.color || undefined,
            price: variant.price ? Number(variant.price) : undefined,
            quantity: Number(variant.quantity) || 0,
            barcode: variant.barcode || undefined,
          }))
        : undefined,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Mahsulotlar</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const token = localStorage.getItem('access_token');
              fetch('/api/products/export/excel', {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'mahsulotlar.xlsx';
                  a.click();
                  URL.revokeObjectURL(url);
                });
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Excel eksport
          </button>
          <label className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition cursor-pointer flex items-center gap-1.5">
            <Upload className="w-4 h-4" /> Excel import
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append('file', file);
                const token = localStorage.getItem('access_token');
                fetch('/api/products/import/excel', {
                  method: 'POST',
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                  body: fd,
                })
                  .then((r) => r.json())
                  .then((result) => {
                    setImportResult(result);
                    qc.invalidateQueries({ queryKey: ['products'] });
                  })
                  .catch((err) => alert('Import xatosi: ' + err.message));
                e.target.value = '';
              }}
            />
          </label>
          <button
            onClick={() => setShowBulkPrice(!showBulkPrice)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4" /> Ommaviy narx
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            + Yangi mahsulot
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-blue-800">Import natijasi</p>
              <p className="text-blue-600 mt-1">
                Yaratildi: {importResult.created} ta | O&apos;tkazildi: {importResult.skipped} ta
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                  {importResult.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => setImportResult(null)}
              className="text-blue-400 hover:text-blue-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk price update panel */}
      {showBulkPrice && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-purple-800 text-sm mb-3 flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Ommaviy narx o&apos;zgartirish</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-purple-700">Foiz (musbat=oshirish, manfiy=tushirish)</label>
              <input
                type="number"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                placeholder="mos. 10 yoki -5"
                className="block w-32 border border-purple-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-purple-700">Filter (ixtiyoriy, nomi bo&apos;yicha)</label>
              <input
                value={bulkFilter}
                onChange={(e) => setBulkFilter(e.target.value)}
                placeholder="nomi..."
                className="block w-40 border border-purple-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <button
              onClick={() => {
                const pct = Number(bulkPercent);
                if (!pct) return;
                if (!confirm(`Barcha ${bulkFilter || 'mahsulotlar'}ga ${pct > 0 ? '+' : ''}${pct}% narx o'zgartirish. Davom etasizmi?`)) return;
                api.post<{ updated: number; total: number }>('/products/bulk-price', {
                  percentage: pct,
                  filter: bulkFilter ? { search: bulkFilter } : undefined,
                }).then((result) => {
                  setBulkResult(result);
                  qc.invalidateQueries({ queryKey: ['products'] });
                  setBulkPercent('');
                }).catch((err: any) => alert(err.message));
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Qo&apos;llash
            </button>
          </div>
          {bulkResult && (
            <p className="text-sm text-purple-700 mt-2">
              {bulkResult.updated}/{bulkResult.total} ta mahsulot yangilandi
            </p>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3"
        >
          <h2 className="font-semibold">Yangi mahsulot qo&apos;shish</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Nomi *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">SKU</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Narx (so&apos;m) *</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Tan narxi (so&apos;m)</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Barcode</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="8000000000000"
                />
                <button
                  type="button"
                  onClick={() => setShowScannerForNew(true)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 text-sm transition"
                  title="Kamera bilan skanerlash"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="sm:col-span-2 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Rang va o&apos;lcham variantlari</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, variants: [...form.variants, { size: '', color: '', price: '', quantity: '0', barcode: '' }] })}
                  className="text-xs text-blue-600 font-medium"
                >
                  + Variant qo&apos;shish
                </button>
              </div>
              {form.variants.map((variant, index) => (
                <div key={index} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                  {(['color', 'size', 'price', 'quantity', 'barcode'] as const).map((field) => (
                    <input
                      key={field}
                      type={field === 'price' || field === 'quantity' ? 'number' : 'text'}
                      value={variant[field]}
                      placeholder={{ color: 'Rang', size: "O'lcham", price: 'Narx', quantity: 'Miqdor', barcode: 'Barcode (avto)' }[field]}
                      onChange={(event) => setForm({ ...form, variants: form.variants.map((current, currentIndex) => currentIndex === index ? { ...current, [field]: event.target.value } : current) })}
                      className="border rounded-lg px-3 py-2 text-sm"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Bekor
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-full md:w-72"
          placeholder="Nomi yoki SKU bo'yicha qidirish..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── MOBILE CARDS (md dan kichik) ─────────────────────────── */}
      <div className="md:hidden space-y-3 mb-4">
        {isLoading ? (
          <p className="text-gray-400 text-sm p-4 text-center">Yuklanmoqda...</p>
        ) : data?.data.length === 0 ? (
          <p className="text-gray-400 text-sm p-4 text-center">Mahsulot topilmadi</p>
        ) : (
          data?.data.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              {/* name + delete */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex gap-2 items-start">
                  {p.images?.[0] && (
                    <img src={p.images[0].url} alt={p.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-base leading-tight">{p.name}</p>
                    {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>}
                  </div>
                </div>
                <button
                  onClick={() => openEdit(p)}
                  className="text-blue-400 hover:text-blue-600 text-xs shrink-0 border border-blue-100 rounded px-2 py-1"
                >
                  <Pencil className="w-3.5 h-3.5 inline mr-0.5" /> Tahrirlash
                </button>
                <button
                  onClick={() => {
                    if (confirm(`"${p.name}" mahsulotini o'chirmoqchimisiz?`))
                      deleteMutation.mutate(p.id);
                  }}
                  className="text-red-400 hover:text-red-600 text-xs shrink-0 border border-red-100 rounded px-2 py-1"
                >
                  O&apos;chirish
                </button>
              </div>
              {/* price + stock */}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm font-medium">{fmt(p.price)} so&apos;m</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    (p.stock?.quantity ?? 0) > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}
                >
                  {p.stock?.quantity ?? 0} dona
                </span>
              </div>
              {/* barcodes */}
              <div className="mt-2">
                <p className="text-xs text-gray-400 mb-1">Barcode:</p>
                <div className="flex flex-wrap gap-1">
                  {p.barcodes.map((b) => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-mono"
                    >
                      {b.code}
                      <button
                        onClick={() => {
                          if (confirm(`"${b.code}" barcodeni o'chirasizmi?`))
                            removeBarcodeMut.mutate({ productId: p.id, barcodeId: b.id });
                        }}
                        className="text-gray-400 hover:text-red-500 transition ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {addBcProductId === p.id ? (
                    <div className="w-full flex items-center gap-2 mt-1">
                      <input
                        autoFocus
                        value={addBcInput}
                        onChange={(e) => setAddBcInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && addBcInput.trim())
                            addBarcodeMut.mutate({ id: p.id, code: addBcInput.trim() });
                          if (e.key === 'Escape') { setAddBcProductId(null); setAddBcInput(''); }
                        }}
                        placeholder="barcode..."
                        className="flex-1 border rounded px-3 py-1.5 text-sm font-mono"
                      />
                      <button
                        onClick={() => setShowScannerForExisting(true)}
                        className="bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded border border-gray-200 text-sm"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (addBcInput.trim())
                            addBarcodeMut.mutate({ id: p.id, code: addBcInput.trim() });
                        }}
                        className="text-sm text-blue-600 font-medium"
                      >
                        Qo&apos;sh
                      </button>
                      <button
                        onClick={() => { setAddBcProductId(null); setAddBcInput(''); }}
                        className="text-sm text-gray-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddBcProductId(p.id); setAddBcInput(''); }}
                      className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200 hover:border-blue-400 transition"
                    >
                      + barcode
                    </button>
                  )}
                </div>
              </div>
              {/* images */}
              <div className="mt-2 flex flex-wrap gap-1 items-center">
                {p.images?.map((img) => (
                  <div key={img.id} className="relative group">
                    <img src={img.url} alt={img.alt || p.name} className="w-10 h-10 rounded object-cover" />
                    <button
                      onClick={() => deleteImage(p.id, img.id)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="w-10 h-10 rounded border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 cursor-pointer transition text-sm">
                  +
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(p.id, file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Yuklanmoqda...</p>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nomi</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Rasm</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">SKU</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Narx</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Ombor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Barcodes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.data.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {p.images?.[0] ? (
                        <img src={p.images[0].url} alt={p.name} className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                      <label className="w-6 h-6 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 cursor-pointer text-xs transition">
                        +
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage(p.id, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.sku ?? '—'}</td>
                  <td className="px-4 py-3">{fmt(p.price)} so&apos;m</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        (p.stock?.quantity ?? 0) > 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-600'
                      }`}
                    >
                      {p.stock?.quantity ?? 0} dona
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 items-center">
                      {p.barcodes.map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-mono"
                        >
                          {b.code}
                          <button
                            onClick={() => {
                              if (confirm(`"${b.code}" barcodeni o'chirasizmi?`))
                                removeBarcodeMut.mutate({ productId: p.id, barcodeId: b.id });
                            }}
                            className="text-gray-400 hover:text-red-500 transition ml-0.5"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      {/* Add barcode inline */}
                      {addBcProductId === p.id ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            autoFocus
                            value={addBcInput}
                            onChange={(e) => setAddBcInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && addBcInput.trim()) {
                                addBarcodeMut.mutate({ id: p.id, code: addBcInput.trim() });
                              }
                              if (e.key === 'Escape') {
                                setAddBcProductId(null);
                                setAddBcInput('');
                              }
                            }}
                            placeholder="barcode..."
                            className="border rounded px-2 py-0.5 text-xs w-28 font-mono"
                          />
                          <button
                            onClick={() => setShowScannerForExisting(true)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded border border-gray-200"
                            title="Kamera bilan skanerlash"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (addBcInput.trim())
                                addBarcodeMut.mutate({ id: p.id, code: addBcInput.trim() });
                            }}
                            className="text-xs text-blue-600 font-medium hover:underline"
                          >
                            Qo&apos;sh
                          </button>
                          <button
                            onClick={() => { setAddBcProductId(null); setAddBcInput(''); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Bekor
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAddBcProductId(p.id); setAddBcInput(''); }}
                          className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200 hover:border-blue-400 transition"
                        >
                          + barcode
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                        title="Tahrirlash"
                      >
                        <Pencil className="w-3.5 h-3.5 inline mr-0.5" /> Tahrirlash
                      </button>
                      <button
                        onClick={() => setLabelProduct(p)}
                        className="text-blue-500 hover:text-blue-700 text-xs"
                        title="Etiketka chop etish"
                      >
                        <Tag className="w-3.5 h-3.5 inline mr-0.5" /> Etiketka
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`"${p.name}" mahsulotini o'chirmoqchimisiz?`))
                            deleteMutation.mutate(p.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        O&apos;chirish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Mahsulot topilmadi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {data && (
        <p className="text-xs text-gray-400 mt-3">Jami: {data.total} ta mahsulot</p>
      )}

      {/* Scanner for new product form barcode field */}
      {showScannerForNew && (
        <BarcodeScanner
          onScan={(code) => {
            setForm((f) => ({ ...f, barcode: code }));
            setShowScannerForNew(false);
          }}
          onClose={() => setShowScannerForNew(false)}
        />
      )}

      {/* Scanner for adding barcode to existing product (shared, mobile+desktop) */}
      {showScannerForExisting && (
        <BarcodeScanner
          onScan={(code) => {
            setShowScannerForExisting(false);
            setAddBcInput(code);
          }}
          onClose={() => setShowScannerForExisting(false)}
        />
      )}

      {/* Barcode label print modal */}
      {labelProduct && (
        <BarcodeLabel
          products={[
            {
              name: labelProduct.name,
              price: labelProduct.price,
              barcode: labelProduct.barcodes[0]?.code,
            },
          ]}
          format={labelFormat}
          onClose={() => setLabelProduct(null)}
        />
      )}

      {/* Edit product modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditProduct(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-4">Mahsulotni tahrirlash</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">Nomi *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">SKU</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Narx (so&apos;m) *</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tan narxi (so&apos;m)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={editForm.cost}
                  onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                />
              </div>
              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={editMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {editMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
                >
                  Bekor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

