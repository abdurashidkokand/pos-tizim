'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Bot } from 'lucide-react';

interface DashboardData {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalSales: number;
  openInvoices: number;
}

interface Tenant {
  id: string; name: string; slug: string; isActive: boolean; createdAt: string;
  subscription: { status: string; plan: { name: string; displayName: string } } | null;
  _count: { users: number; branches: number };
}

interface Plan {
  id: string; name: string; displayName: string; priceMonthly: number; priceYearly: number;
  maxBranches: number; maxUsers: number; maxProducts: number; maxCashiers: number;
  maxRegisters: number; monthlyReceipts: number; storageMB: number; isActive: boolean;
  sortOrder: number; features: Record<string, boolean>;
}

type PlanForm = Omit<Plan, 'id'> & { id?: string };

const emptyPlan: PlanForm = {
  name: '', displayName: '', priceMonthly: 0, priceYearly: 0,
  maxBranches: 1, maxUsers: 1, maxCashiers: 1, maxRegisters: 1,
  maxProducts: 50, monthlyReceipts: 300, storageMB: 100,
  isActive: true, sortOrder: 0, features: {},
};

function fmt(n: number) { return new Intl.NumberFormat('uz-UZ').format(n); }

export default function PlatformPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'dashboard' | 'tenants' | 'plans'>('dashboard');
  const [search, setSearch] = useState('');
  const [planForm, setPlanForm] = useState<PlanForm | null>(null);
  const [isNewPlan, setIsNewPlan] = useState(false);
  const [changePlanTenant, setChangePlanTenant] = useState<Tenant | null>(null);

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['platform-dashboard'],
    queryFn: () => api.get('/platform/dashboard'),
    enabled: tab === 'dashboard',
  });

  const { data: tenantsData } = useQuery<{ data: Tenant[] }>({
    queryKey: ['platform-tenants', search],
    queryFn: () => api.get(`/platform/tenants?search=${encodeURIComponent(search)}`),
    enabled: tab === 'tenants',
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans'),
  });

  const updatePlanMut = useMutation({
    mutationFn: (body: Partial<Plan> & { id: string }) =>
      api.patch(`/platform/plans/${body.id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      setPlanForm(null);
    },
  });

  const createPlanMut = useMutation({
    mutationFn: (body: PlanForm) => api.post('/platform/plans', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-plans'] });
      setPlanForm(null);
      setIsNewPlan(false);
    },
  });

  const updateTenantMut = useMutation({
    mutationFn: (body: { id: string; isActive?: boolean; extendTrialDays?: number; changePlanCode?: string; makeVip?: boolean }) => {
      const { id, ...data } = body;
      return api.patch(`/platform/tenants/${id}`, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      setChangePlanTenant(null);
    },
  });

  const openCreatePlan = () => {
    setPlanForm({ ...emptyPlan });
    setIsNewPlan(true);
  };

  const openEditPlan = (plan: Plan) => {
    setPlanForm({ ...plan });
    setIsNewPlan(false);
  };

  const savePlan = () => {
    if (!planForm) return;
    if (isNewPlan) {
      createPlanMut.mutate(planForm);
    } else {
      updatePlanMut.mutate(planForm as Plan);
    }
  };

  const isVip = (t: Tenant) => t.subscription?.plan?.name === 'VIP';

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Platform Admin</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b flex-wrap">
        {(['dashboard', 'tenants', 'plans'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm border-b-2 capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
            {t === 'dashboard' ? 'Dashboard' : t === 'tenants' ? "Do'konlar" : 'Tariflar'}
          </button>
        ))}
        <Link
          href="/platform/bot-settings"
          className="flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 transition"
        >
          <Bot className="w-3.5 h-3.5" /> Bot Sozlamalari
        </Link>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Jami do&apos;konlar</p>
            <p className="text-2xl font-bold">{dashboard.totalTenants}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Aktiv</p>
            <p className="text-2xl font-bold text-green-600">{dashboard.activeTenants}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Foydalanuvchilar</p>
            <p className="text-2xl font-bold text-blue-600">{dashboard.totalUsers}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Sotuvlar</p>
            <p className="text-2xl font-bold">{fmt(dashboard.totalSales)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <p className="text-sm text-gray-500">Ochiq fakturalar</p>
            <p className="text-2xl font-bold text-orange-600">{dashboard.openInvoices}</p>
          </div>
        </div>
      )}

      {/* Tenants Tab */}
      {tab === 'tenants' && (
        <div>
          <input type="text" placeholder="Do'kon nomi bo'yicha qidirish..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full border rounded-lg px-4 py-2.5 text-sm mb-4" />
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50">
                  <th className="px-4 py-3">Nomi</th>
                  <th className="px-4 py-3">Tarif</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-4 py-3">Foydalanuvchilar</th>
                  <th className="px-4 py-3">Filiallar</th>
                  <th className="px-4 py-3">Sana</th>
                  <th className="px-4 py-3">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {tenantsData?.data.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {t.name}
                      {isVip(t) && <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 font-bold">VIP</span>}
                    </td>
                    <td className="px-4 py-3">{t.subscription?.plan.displayName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        t.subscription?.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        t.subscription?.status === 'TRIAL' ? 'bg-yellow-100 text-yellow-700' :
                        t.subscription?.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {t.subscription?.status === 'ACTIVE' ? 'Aktiv' : t.subscription?.status === 'TRIAL' ? 'Sinov' : t.subscription?.status === 'SUSPENDED' ? "To'xtatilgan" : "Yo'q"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{t._count.users}</td>
                    <td className="px-4 py-3">{t._count.branches}</td>
                    <td className="px-4 py-3 text-gray-400">{new Date(t.createdAt).toLocaleDateString('uz-UZ')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap justify-end">
                        {t.subscription?.status === 'ACTIVE' && (
                          <button onClick={() => updateTenantMut.mutate({ id: t.id, isActive: false })} className="text-red-600 text-xs hover:underline">To&apos;xtatish</button>
                        )}
                        {t.subscription?.status === 'SUSPENDED' && (
                          <button onClick={() => updateTenantMut.mutate({ id: t.id, isActive: true })} className="text-green-600 text-xs hover:underline">Faollashtirish</button>
                        )}
                        {t.subscription?.status === 'TRIAL' && (
                          <button onClick={() => updateTenantMut.mutate({ id: t.id, extendTrialDays: 7 })} className="text-blue-600 text-xs hover:underline">+7 kun</button>
                        )}
                        <button onClick={() => setChangePlanTenant(t)} className="text-indigo-600 text-xs hover:underline">Tarif</button>
                        {!isVip(t) ? (
                          <button onClick={() => { if (confirm(`"${t.name}" ni VIP qilmoqchimisiz? Barcha limitlar cheksiz bo'ladi.`)) updateTenantMut.mutate({ id: t.id, makeVip: true }); }} className="text-yellow-600 text-xs hover:underline font-semibold">VIP qilish</button>
                        ) : (
                          <span className="text-yellow-600 text-xs font-bold">⭐ VIP</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {tab === 'plans' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={openCreatePlan} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">+ Yangi tarif</button>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className={`bg-white rounded-xl shadow-sm border p-6 ${plan.name === 'VIP' ? 'border-yellow-400 ring-2 ring-yellow-200' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold">{plan.displayName}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {plan.isActive ? 'Aktiv' : 'Nofaol'}
                  </span>
                </div>
                <p className="text-2xl font-bold">{fmt(plan.priceMonthly)} <span className="text-sm text-gray-400 font-normal">so&apos;m/oy</span></p>
                <p className="text-sm text-gray-500">{fmt(plan.priceYearly)} so&apos;m/yil</p>

                <ul className="text-sm text-gray-600 mt-3 space-y-1">
                  <li>{plan.maxUsers >= 999999 ? 'Cheksiz' : plan.maxUsers} foydalanuvchi</li>
                  <li>{plan.maxProducts >= 999999 ? 'Cheksiz' : plan.maxProducts} mahsulot</li>
                  <li>{plan.maxBranches >= 999999 ? 'Cheksiz' : plan.maxBranches} filial</li>
                  <li>{plan.maxCashiers >= 999999 ? 'Cheksiz' : plan.maxCashiers} kassir</li>
                  <li>{plan.maxRegisters >= 999999 ? 'Cheksiz' : plan.maxRegisters} kassa</li>
                  <li>{plan.monthlyReceipts >= 999999 ? 'Cheksiz' : fmt(plan.monthlyReceipts)} chek/oy</li>
                </ul>

                <button onClick={() => openEditPlan(plan)} className="w-full mt-4 border border-blue-600 text-blue-600 py-2 rounded-lg text-sm hover:bg-blue-50">
                  Tahrirlash
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Plan Modal */}
      {planForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-auto py-8">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">{isNewPlan ? 'Yangi tarif yaratish' : `Tarifni tahrirlash — ${planForm.displayName}`}</h3>
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              <div className="grid grid-cols-2 gap-3">
                {isNewPlan && (
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Kod (unikal)</label>
                    <input type="text" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} placeholder="masalan: STARTER" className="w-full border rounded-lg px-3 py-2 text-sm font-mono" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nomi</label>
                  <input type="text" value={planForm.displayName} onChange={(e) => setPlanForm({ ...planForm, displayName: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Oylik narx (so&apos;m)</label>
                  <input type="number" value={planForm.priceMonthly} onChange={(e) => setPlanForm({ ...planForm, priceMonthly: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Yillik narx (so&apos;m)</label>
                  <input type="number" value={planForm.priceYearly} onChange={(e) => setPlanForm({ ...planForm, priceYearly: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Maks foydalanuvchilar</label>
                  <input type="number" value={planForm.maxUsers} onChange={(e) => setPlanForm({ ...planForm, maxUsers: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Maks mahsulotlar</label>
                  <input type="number" value={planForm.maxProducts} onChange={(e) => setPlanForm({ ...planForm, maxProducts: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Maks filiallar</label>
                  <input type="number" value={planForm.maxBranches} onChange={(e) => setPlanForm({ ...planForm, maxBranches: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Maks kassirlar</label>
                  <input type="number" value={planForm.maxCashiers} onChange={(e) => setPlanForm({ ...planForm, maxCashiers: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Maks kassalar</label>
                  <input type="number" value={planForm.maxRegisters} onChange={(e) => setPlanForm({ ...planForm, maxRegisters: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Oylik cheklar</label>
                  <input type="number" value={planForm.monthlyReceipts} onChange={(e) => setPlanForm({ ...planForm, monthlyReceipts: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Xotira (MB)</label>
                  <input type="number" value={planForm.storageMB} onChange={(e) => setPlanForm({ ...planForm, storageMB: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tartib raqami</label>
                  <input type="number" value={planForm.sortOrder} onChange={(e) => setPlanForm({ ...planForm, sortOrder: Number(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setPlanForm(null); setIsNewPlan(false); }} className="flex-1 border rounded-lg py-2 text-sm">Bekor qilish</button>
              <button
                onClick={savePlan}
                disabled={createPlanMut.isPending || updatePlanMut.isPending || (isNewPlan && !planForm.name)}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm disabled:opacity-50"
              >
                {isNewPlan ? 'Yaratish' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {changePlanTenant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Tarif o&apos;zgartirish — {changePlanTenant.name}</h3>
            <p className="text-sm text-gray-500 mb-3">Hozirgi: {changePlanTenant.subscription?.plan.displayName || "Yo'q"}</p>
            <div className="space-y-2">
              {plans.filter(p => p.isActive && p.name !== changePlanTenant.subscription?.plan?.name).map((p) => (
                <button
                  key={p.id}
                  onClick={() => updateTenantMut.mutate({ id: changePlanTenant.id, changePlanCode: p.name })}
                  disabled={updateTenantMut.isPending}
                  className="w-full text-left border rounded-lg px-4 py-3 text-sm hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50"
                >
                  <span className="font-medium">{p.displayName}</span>
                  <span className="text-gray-400 ml-2">{fmt(p.priceMonthly)} so&apos;m/oy</span>
                </button>
              ))}
            </div>
            <button onClick={() => setChangePlanTenant(null)} className="w-full mt-4 border rounded-lg py-2 text-sm">Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
}
