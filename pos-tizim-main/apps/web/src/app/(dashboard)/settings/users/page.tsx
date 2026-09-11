'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
import { Pencil, Ban, CheckCircle2 } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  branch?: { id: string; name: string } | null;
  createdAt: string;
}

const ROLES = ['ADMIN', 'MANAGER', 'CASHIER'] as const;
const roleLabels: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  OWNER: 'Egasi',
  ADMIN: 'Admin',
  MANAGER: 'Menejer',
  CASHIER: 'Kassir',
};

export default function UsersPage() {
  const qc = useQueryClient();
  const currentUser = getUser();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'CASHIER' as string,
    branchId: '' as string,
  });
  const [formError, setFormError] = useState('');

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get<User[]>('/users'),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/tenants/branches'),
  });

  const createMutation = useMutation({
    mutationFn: (body: unknown) => api.post('/users', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api.patch(`/users/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
      resetForm();
    },
    onError: (err: any) => setFormError(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  function resetForm() {
    setForm({ username: '', password: '', fullName: '', role: 'CASHIER', branchId: '' });
    setFormError('');
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({
      username: u.username,
      password: '',
      fullName: u.fullName || '',
      role: u.role,
      branchId: u.branch?.id || '',
    });
    setFormError('');
    setShowForm(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (editUser) {
      const body: Record<string, unknown> = {
        fullName: form.fullName || undefined,
        role: form.role,
        branchId: form.branchId || undefined,
      };
      if (form.password) body.password = form.password;
      updateMutation.mutate({ id: editUser.id, body });
    } else {
      if (!form.username || !form.password) {
        setFormError('Login va parol majburiy');
        return;
      }
      createMutation.mutate({
        username: form.username,
        password: form.password,
        fullName: form.fullName || undefined,
        role: form.role,
        branchId: form.branchId || undefined,
      });
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
        <Link href="/settings/users" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Foydalanuvchilar
        </Link>
        <Link href="/settings/branches" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
          Filiallar
        </Link>
        <Link href="/settings/subscription" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
          Tarif rejasi
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Foydalanuvchilar</h2>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditUser(null);
            resetForm();
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Yangi foydalanuvchi
        </button>
      </div>

      {/* Create/Edit form */}
      {(showForm || editUser) && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <h3 className="font-semibold">
            {editUser ? `"${editUser.username}" ni tahrirlash` : 'Yangi foydalanuvchi'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Login {!editUser && '*'}</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                disabled={!!editUser}
                required={!editUser}
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Parol {!editUser ? '*' : '(bo\'sh qoldiring o\'zgartirmaslik uchun)'}
              </label>
              <input
                type="password"
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editUser}
                minLength={6}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Ism</label>
              <input
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rol</label>
              <select
                className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{roleLabels[r]}</option>
                ))}
              </select>
            </div>
            {branches && branches.length > 1 && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Filial</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                >
                  <option value="">Tanlanmagan</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
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
              onClick={() => { setShowForm(false); setEditUser(null); resetForm(); }}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Bekor
            </button>
          </div>
        </form>
      )}

      {/* Users list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-gray-400">Yuklanmoqda...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ism</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Login</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Filial</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Holat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users?.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium">{u.fullName || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'OWNER' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'ADMIN' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'MANAGER' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.branch?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {u.isActive ? 'Faol' : 'Bloklangan'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Tahrirlash
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => {
                              if (confirm(`${u.username} ni ${u.isActive ? 'bloklash' : 'faollashtirish'}?`))
                                toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive });
                            }}
                            className={`text-xs ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                          >
                            {u.isActive ? <><Ban className="w-3.5 h-3.5" /> Bloklash</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Faollashtirish</>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Foydalanuvchi topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
