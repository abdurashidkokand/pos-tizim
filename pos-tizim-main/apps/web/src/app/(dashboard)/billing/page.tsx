'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Check, X } from 'lucide-react';

interface BillingData {
  plan: { id: string; code: string; displayName: string; priceMonthly: number; priceYearly: number };
  subscription: { status: string; trialEndsAt: string | null; currentPeriodEnd: string | null };
  usage: { users: number; products: number; branches: number; registers: number; receiptsThisMonth: number };
  limits: { maxUsers: number; maxProducts: number; maxBranches: number; maxRegisters: number; monthlyReceipts: number };
  features: Record<string, boolean>;
  invoices: Array<{ id: string; amount: number; status: string; dueDate: string; createdAt: string }>;
}

interface Plan {
  id: string; code: string; displayName: string; priceMonthly: number; priceYearly: number;
  maxBranches: number; maxUsers: number; maxProducts: number; maxCashiers: number;
  maxRegisters: number; monthlyReceipts: number; features: Record<string, boolean>;
}

function fmt(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(n);
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{used} / {max}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const qc = useQueryClient();
  const [showPlans, setShowPlans] = useState(false);

  const { data: billing, isLoading } = useQuery<BillingData>({
    queryKey: ['billing'],
    queryFn: () => api.get('/billing/me'),
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['plans'],
    queryFn: () => api.get('/platform/plans'),
    enabled: showPlans,
  });

  const subscribeMut = useMutation({
    mutationFn: (body: { planId: string; period: string }) =>
      api.post<{ paymentUrl: string }>('/billing/subscribe', body),
    onSuccess: (data) => {
      window.open(data.paymentUrl, '_blank');
    },
  });

  if (isLoading) {
    return <div className="p-6"><div className="animate-pulse text-gray-400">Yuklanmoqda...</div></div>;
  }

  if (!billing) return null;

  const isTrialing = billing.subscription.status === 'TRIALING';
  const isActive = billing.subscription.status === 'ACTIVE';
  const trialEnd = billing.subscription.trialEndsAt
    ? new Date(billing.subscription.trialEndsAt).toLocaleDateString('uz-UZ')
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Tarif va to'lov</h1>

      {/* Current Plan */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{billing.plan.displayName}</h2>
            <p className="text-sm text-gray-500">
              {isTrialing && trialEnd && `Sinov davri: ${trialEnd} gacha`}
              {isActive && billing.subscription.currentPeriodEnd &&
                `Keyingi to'lov: ${new Date(billing.subscription.currentPeriodEnd).toLocaleDateString('uz-UZ')}`}
              {!isTrialing && !isActive && `Holat: ${billing.subscription.status}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{fmt(billing.plan.priceMonthly)} so'm</p>
            <p className="text-xs text-gray-400">oyiga</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <UsageBar label="Foydalanuvchilar" used={billing.usage.users} max={billing.limits.maxUsers} />
          <UsageBar label="Mahsulotlar" used={billing.usage.products} max={billing.limits.maxProducts} />
          <UsageBar label="Filiallar" used={billing.usage.branches} max={billing.limits.maxBranches} />
          <UsageBar label="Kassalar" used={billing.usage.registers} max={billing.limits.maxRegisters} />
          <UsageBar label="Oylik cheklar" used={billing.usage.receiptsThisMonth} max={billing.limits.monthlyReceipts} />
        </div>

        <button
          onClick={() => setShowPlans(!showPlans)}
          className="mt-4 text-blue-600 text-sm hover:underline"
        >
          {showPlans ? "Tariflarni yashirish" : "Tarifni o'zgartirish →"}
        </button>
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="font-semibold mb-3">Imkoniyatlar</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
          {Object.entries(billing.features).map(([key, enabled]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={enabled ? 'text-green-500' : 'text-gray-300'}>{enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}</span>
              <span className={enabled ? 'text-gray-700' : 'text-gray-400'}>{featureLabel(key)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Plans */}
      {showPlans && plans && (
        <div className="grid md:grid-cols-3 gap-4">
          {plans.filter(p => p.code !== billing.plan.code).map((plan) => (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-bold">{plan.displayName}</h3>
              <p className="text-2xl font-bold mt-2">{fmt(plan.priceMonthly)} <span className="text-sm text-gray-400 font-normal">so'm/oy</span></p>
              <ul className="text-sm text-gray-600 mt-3 space-y-1">
                <li>{plan.maxUsers} foydalanuvchi</li>
                <li>{plan.maxProducts} mahsulot</li>
                <li>{plan.maxBranches} filial</li>
                <li>{plan.maxRegisters} kassa</li>
                <li>{fmt(plan.monthlyReceipts)} chek/oy</li>
              </ul>
              <button
                onClick={() => subscribeMut.mutate({ planId: plan.id, period: 'MONTHLY' })}
                disabled={subscribeMut.isPending}
                className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
              >
                Tanlash
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invoices */}
      {billing.invoices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-semibold mb-3">Hisob-fakturalar</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Sana</th>
                  <th className="pb-2">Summa</th>
                  <th className="pb-2">Holat</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {billing.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(inv.createdAt).toLocaleDateString('uz-UZ')}</td>
                    <td className="py-2">{fmt(inv.amount)} so'm</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {inv.status === 'PAID' ? "To'langan" : 'Kutilmoqda'}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {inv.status === 'OPEN' && (
                        <button
                          onClick={async () => {
                            const r = await api.post<{paymentUrl:string}>(`/billing/invoices/${inv.id}/pay`);
                            window.open(r.paymentUrl, '_blank');
                          }}
                          className="text-blue-600 text-xs hover:underline"
                        >
                          To'lash
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function featureLabel(key: string): string {
  const labels: Record<string, string> = {
    cashback: 'Cashback',
    debtTracking: 'Qarz hisobi',
    advancedReports: "Kengaytirilgan hisobot",
    multiBranch: "Ko'p filial",
    excelExport: 'Excel eksport',
    apiAccess: 'API kirish',
  };
  return labels[key] || key;
}
