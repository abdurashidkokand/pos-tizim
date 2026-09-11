'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { User, Package, Building2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  maxUsers: number;
  maxProducts: number;
  maxBranches: number;
}

interface Subscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  plan: Plan;
}

interface TenantInfo {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  subscription: Subscription | null;
  _count: {
    users: number;
    products: number;
    branches: number;
  };
}

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

const statusLabels: Record<string, { label: string; color: string }> = {
  TRIAL: { label: 'Sinov', color: 'bg-yellow-100 text-yellow-700' },
  ACTIVE: { label: 'Faol', color: 'bg-green-100 text-green-700' },
  PAST_DUE: { label: 'To\'lov kutilmoqda', color: 'bg-red-100 text-red-600' },
  CANCELED: { label: 'Bekor qilingan', color: 'bg-gray-100 text-gray-600' },
  EXPIRED: { label: 'Muddati tugagan', color: 'bg-red-100 text-red-600' },
};

export default function SubscriptionPage() {
  const { data: tenant, isLoading: loadingTenant } = useQuery<TenantInfo>({
    queryKey: ['tenant-me'],
    queryFn: () => api.get<TenantInfo>('/tenants/me'),
  });

  const { data: plans, isLoading: loadingPlans } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get<Plan[]>('/tenants/plans'),
  });

  const sub = tenant?.subscription;
  const currentPlan = sub?.plan;
  const counts = tenant?._count;
  const status = statusLabels[sub?.status || ''] || { label: sub?.status, color: 'bg-gray-100 text-gray-600' };

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
        <Link href="/settings/branches" className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition">
          Filiallar
        </Link>
        <Link href="/settings/subscription" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Tarif rejasi
        </Link>
      </div>

      {loadingTenant ? (
        <p className="text-gray-400">Yuklanmoqda...</p>
      ) : (
        <>
          {/* Current subscription info */}
          {sub && currentPlan && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg">Joriy tarif: {currentPlan.name}</h2>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Narxi</p>
                  <p className="font-semibold">
                    {currentPlan.price === 0 ? 'Bepul' : `${fmt(currentPlan.price)} so'm/oy`}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Foydalanuvchilar</p>
                  <p className="font-semibold">
                    {counts?.users ?? 0} / {currentPlan.maxUsers}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, ((counts?.users ?? 0) / currentPlan.maxUsers) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Mahsulotlar</p>
                  <p className="font-semibold">
                    {counts?.products ?? 0} / {currentPlan.maxProducts}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, ((counts?.products ?? 0) / currentPlan.maxProducts) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Filiallar</p>
                  <p className="font-semibold">
                    {counts?.branches ?? 0} / {currentPlan.maxBranches}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, ((counts?.branches ?? 0) / currentPlan.maxBranches) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              {sub.endDate && (
                <p className="text-xs text-gray-500 mt-3">
                  Muddat: {new Date(sub.startDate).toLocaleDateString('uz')} — {new Date(sub.endDate).toLocaleDateString('uz')}
                </p>
              )}
            </div>
          )}

          {/* Available plans */}
          <h2 className="font-semibold text-lg mb-4">Mavjud tariflar</h2>
          {loadingPlans ? (
            <p className="text-gray-400">Yuklanmoqda...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {plans?.map((plan) => {
                const isCurrent = currentPlan?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`bg-white rounded-xl border p-5 ${
                      isCurrent
                        ? 'border-blue-400 ring-2 ring-blue-100'
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      {isCurrent && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Joriy
                        </span>
                      )}
                    </div>
                    <p className="text-2xl font-bold mb-3">
                      {plan.price === 0 ? (
                        'Bepul'
                      ) : (
                        <>
                          {fmt(plan.price)} <span className="text-sm font-normal text-gray-500">so&apos;m/oy</span>
                        </>
                      )}
                    </p>
                    <ul className="space-y-1.5 text-sm text-gray-600">
                      <li className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" />{plan.maxUsers} foydalanuvchi</li>
                      <li className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-gray-400" />{fmt(plan.maxProducts)} mahsulot</li>
                      <li className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-gray-400" />{plan.maxBranches} filial</li>
                    </ul>
                    {!isCurrent && (
                      <button
                        className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition"
                        onClick={() => alert('Tarif rejasini o\'zgartirish uchun admin bilan bog\'laning')}
                      >
                        Tanlash
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
