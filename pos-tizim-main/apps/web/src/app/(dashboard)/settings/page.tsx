'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import Link from 'next/link';

const ROLE_LEVEL: Record<string, number> = {
  CASHIER: 1, MANAGER: 2, ADMIN: 3, OWNER: 4, SUPERADMIN: 5,
};

export default function SettingsPage() {
  const user = getUser();
  const userLevel = ROLE_LEVEL[user?.role ?? 'CASHIER'] ?? 1;
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 6) {
      setError("Yangi parol kamida 6 ta belgi bo'lishi kerak");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yangi parol va tasdiqlash mos kelmadi');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword,
        newPassword,
      });
      setMessage("Parol muvaffaqiyatli o'zgartirildi!");
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Xato yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = (r?: string): string => {
    const labels: Record<string, string> = {
      SUPERADMIN: 'Super Admin', OWNER: 'Egasi', ADMIN: 'Admin', MANAGER: 'Menejer', CASHIER: 'Kassir',
    };
    return labels[r || ''] || r || '';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Sozlamalar</h1>

      {/* Sub-navigation */}
      {userLevel >= 3 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link href="/settings" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Profil
          </Link>
          <Link href="/settings/branches" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
            Filiallar
          </Link>
        </div>
      )}

      {/* User info */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold mb-3">Profil</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Foydalanuvchi:</span>
            <span className="font-medium">{user?.fullName || user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Login:</span>
            <span className="font-medium">{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Rol:</span>
            <span className="font-medium">{roleLabel(user?.role)}</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold mb-3">Parolni o&apos;zgartirish</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-600">Joriy parol</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Yangi parol</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">Yangi parolni tasdiqlang</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mt-1 text-sm"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? 'Saqlanmoqda...' : "Parolni o'zgartirish"}
          </button>
        </form>
      </div>
    </div>
  );
}
