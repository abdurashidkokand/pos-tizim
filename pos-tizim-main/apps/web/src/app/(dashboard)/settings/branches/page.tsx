'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Phone, MapPin, Pencil } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [formError, setFormError] = useState('');

  const { data: branches, isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/tenants/branches'),
  });

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post('/tenants/branches', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api.patch(`/tenants/branches/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setEditBranch(null);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message),
  });

  function resetForm() {
    setForm({ name: '', phone: '', address: '' });
    setFormError('');
  }

  function openEdit(b: Branch) {
    setEditBranch(b);
    setForm({
      name: b.name,
      phone: b.phone || '',
      address: b.address || '',
    });
    setFormError('');
    setShowForm(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const body = {
      name: form.name,
      phone: form.phone || undefined,
      address: form.address || undefined,
    };

    if (editBranch) {
      updateMutation.mutate({ id: editBranch.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Sozlamalar</h1>

      {/* Sub-navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/settings" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
          Profil
        </Link>
        <Link href="/settings/users" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
          Foydalanuvchilar
        </Link>
        <Link href="/settings/branches" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Filiallar
        </Link>
        <Link href="/settings/subscription" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
          Tarif rejasi
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Filiallar</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditBranch(null);
            resetForm();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Yangi filial
        </button>
      </div>

      {/* Create/Edit form */}
      {(showForm || editBranch) && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-semibold">
            {editBranch ? `"${editBranch.name}" ni tahrirlash` : 'Yangi filial'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Nomi *</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Telefon</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Manzil</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
          {formError && <p className="text-red-500 text-sm">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {(createMutation.isPending || updateMutation.isPending) ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setEditBranch(null); resetForm(); }}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Bekor
            </button>
          </div>
        </form>
      )}

      {/* Branches list */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-gray-400 p-6">Yuklanmoqda...</p>
        ) : branches?.length === 0 ? (
          <p className="text-gray-400 p-6 text-center">Filial topilmadi</p>
        ) : (
          branches?.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{b.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                  {b.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</span>}
                  {b.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.address}</span>}
                </div>
              </div>
              <button
                onClick={() => openEdit(b)}
                className="text-blue-500 hover:text-blue-700 text-xs"
              >
                <Pencil className="w-3.5 h-3.5" /> Tahrirlash
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
