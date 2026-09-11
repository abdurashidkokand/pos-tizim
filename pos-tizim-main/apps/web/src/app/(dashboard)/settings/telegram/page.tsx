'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Bot,
  Link2,
  Link2Off,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  User,
  Users,
  ShoppingCart,
  QrCode,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface TelegramSettings {
  id: string;
  enabled: boolean;
  ownerNotificationsEnabled: boolean;
  customerBotEnabled: boolean;
  staffBotEnabled: boolean;
  miniAppEnabled: boolean;
  defaultLanguage: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  alertDailySummary: boolean;
  alertWeeklySummary: boolean;
  alertLowStock: boolean;
  alertOutOfStock: boolean;
  alertRefund: boolean;
  alertDebt: boolean;
  alertCashSession: boolean;
  alertLargeDiscount: boolean;
  customerReceiptMessage: boolean;
  customerCashbackNotif: boolean;
  customerBonusExpiry: boolean;
  customerStampProgress: boolean;
  customerPromoEnabled: boolean;
}

interface LinkedAccount {
  id: string;
  entityType: string;
  entityId: string;
  linkSource: string;
  verified: boolean;
  createdAt: string;
  telegramIdentity: {
    telegramUserId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    isBlocked: boolean;
    lastSeenAt: string | null;
  };
}

interface LinkTokenResult {
  token: string;
  deepLink: string | null;
  expiresAt: string;
}

type TabValue = 'general' | 'alerts' | 'customer' | 'accounts';

const TAB_LABELS: { value: TabValue; label: string }[] = [
  { value: 'general', label: 'Umumiy' },
  { value: 'alerts', label: 'Owner Alertlari' },
  { value: 'customer', label: 'Mijoz Boti' },
  { value: 'accounts', label: "Bog'langan Akkountlar" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="shrink-0">
      {checked
        ? <ToggleRight className="w-8 h-8 text-blue-600" />
        : <ToggleLeft className="w-8 h-8 text-gray-300" />}
    </button>
  );
}

function SettingRow({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default function TelegramSettingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabValue>('general');
  const [settings, setSettings] = useState<TelegramSettings | null>(null);
  const [linkResult, setLinkResult] = useState<LinkTokenResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: settingsData, isLoading: settingsLoading } = useQuery<TelegramSettings>({
    queryKey: ['tg-tenant-settings'],
    queryFn: () => api.get<TelegramSettings>('/telegram/settings'),
  });

  useEffect(() => {
    if (settingsData) setSettings(settingsData);
  }, [settingsData]);

  const { data: linkedAccounts = [], isLoading: accountsLoading } = useQuery<LinkedAccount[]>({
    queryKey: ['tg-linked-accounts'],
    queryFn: () => api.get<LinkedAccount[]>('/telegram/linked-accounts'),
    enabled: tab === 'accounts',
  });

  const saveMut = useMutation({
    mutationFn: (data: Partial<TelegramSettings>) => api.patch('/telegram/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-tenant-settings'] });
      setMsg({ type: 'ok', text: 'Sozlamalar saqlandi' });
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const linkTokenMut = useMutation({
    mutationFn: (data: { entityType: string; entityId: string }) =>
      api.post('/telegram/link-token', data) as Promise<LinkTokenResult>,
    onSuccess: (res) => setLinkResult(res),
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const unlinkMut = useMutation({
    mutationFn: ({ entityType, entityId }: { entityType: string; entityId: string }) =>
      api.delete(`/telegram/link/${entityType}/${entityId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-linked-accounts'] });
      setMsg({ type: 'ok', text: "Ulash o'chirildi" });
    },
  });

  const testSendMut = useMutation({
    mutationFn: (id: string) => api.post(`/telegram/linked-accounts/${id}/test`, {}),
    onSuccess: (r: any) => setMsg({ type: r.ok !== false ? 'ok' : 'err', text: r.ok !== false ? 'Test xabar yuborildi' : (r.description ?? 'Xato') }),
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const setSetting = (key: keyof TelegramSettings, value: boolean) => {
    setSettings((s) => s ? { ...s, [key]: value } : s);
  };

  const handleSave = () => {
    if (settings) saveMut.mutate(settings);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const entityTypeLabel = (t: string) => ({ USER: 'Foydalanuvchi', CUSTOMER: 'Mijoz', OWNER: 'Egasi', STAFF: 'Xodim' }[t] ?? t);
  const entityTypeIcon = (t: string) => {
    switch (t) {
      case 'CUSTOMER': return <ShoppingCart className="w-3.5 h-3.5" />;
      case 'STAFF': return <Users className="w-3.5 h-3.5" />;
      default: return <User className="w-3.5 h-3.5" />;
    }
  };

  if (settingsLoading) return <div className="p-6 text-gray-400">Yuklanmoqda...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Telegram Sozlamalari</h1>
          <p className="text-sm text-gray-500">Bot integratsiyasi va bildirishnomalar</p>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto text-xs underline">Yopish</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b flex-wrap">
        {TAB_LABELS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm border-b-2 ${tab === t.value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {tab === 'general' && settings && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 space-y-0 divide-y">
            <SettingRow
              label="Telegram integratsiya yoqilgan"
              desc="Barcha bot xususiyatlarini yoqish/o'chirish"
              checked={settings.enabled}
              onChange={(v) => setSetting('enabled', v)}
            />
            <SettingRow
              label="Owner bildirishnomalari"
              desc="Egaga savdo, ombor, qarz alertlari"
              checked={settings.ownerNotificationsEnabled}
              onChange={(v) => setSetting('ownerNotificationsEnabled', v)}
            />
            <SettingRow
              label="Mijoz boti"
              desc="Mijozlarga chek, bonus va stamp xabarlari"
              checked={settings.customerBotEnabled}
              onChange={(v) => setSetting('customerBotEnabled', v)}
            />
            <SettingRow
              label="Xodim boti"
              desc="Kassir va omborchilarga operatsion xabarlar"
              checked={settings.staffBotEnabled}
              onChange={(v) => setSetting('staffBotEnabled', v)}
            />
            <SettingRow
              label="Mini App yoqilgan"
              desc="Telegram Mini App orqali kirish"
              checked={settings.miniAppEnabled}
              onChange={(v) => setSetting('miniAppEnabled', v)}
            />

            <div className="py-3">
              <p className="text-sm font-medium mb-2">Jimlik soatlari</p>
              <div className="flex items-center gap-2 mt-1">
                <Toggle checked={settings.quietHoursEnabled} onChange={(v) => setSetting('quietHoursEnabled', v)} />
                <span className="text-xs text-gray-500">Muayyan soatlarda bildirmaslik</span>
              </div>
              {settings.quietHoursEnabled && (
                <div className="flex gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-400">Boshlash</label>
                    <input type="time" defaultValue={settings.quietHoursStart ?? '22:00'} className="block border rounded px-2 py-1 text-sm mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Tugash</label>
                    <input type="time" defaultValue={settings.quietHoursEnd ?? '08:00'} className="block border rounded px-2 py-1 text-sm mt-0.5" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {tab === 'alerts' && settings && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b">
            <h3 className="font-semibold text-sm">Owner Alert Sozlamalari</h3>
            <p className="text-xs text-gray-400 mt-0.5">Egaga qaysi alertlar yuborilsin</p>
          </div>
          <div className="p-5 space-y-0 divide-y">
            <SettingRow label="Kunlik hisobot" checked={settings.alertDailySummary} onChange={(v) => setSetting('alertDailySummary', v)} />
            <SettingRow label="Haftalik hisobot" checked={settings.alertWeeklySummary} onChange={(v) => setSetting('alertWeeklySummary', v)} />
            <SettingRow label="Kam qolgan mahsulot" desc="Belgilangan chegaragacha kamaysa" checked={settings.alertLowStock} onChange={(v) => setSetting('alertLowStock', v)} />
            <SettingRow label="Mahsulot tugadi" desc="Ombor 0 ga yetganda" checked={settings.alertOutOfStock} onChange={(v) => setSetting('alertOutOfStock', v)} />
            <SettingRow label="Qaytarish alerti" checked={settings.alertRefund} onChange={(v) => setSetting('alertRefund', v)} />
            <SettingRow label="Qarz alerti" checked={settings.alertDebt} onChange={(v) => setSetting('alertDebt', v)} />
            <SettingRow label="Kassa sessiya" desc="Ochildi/yopildi" checked={settings.alertCashSession} onChange={(v) => setSetting('alertCashSession', v)} />
            <SettingRow label="Katta chegirma" checked={settings.alertLargeDiscount} onChange={(v) => setSetting('alertLargeDiscount', v)} />
          </div>
        </div>
      )}

      {/* Customer Bot Tab */}
      {tab === 'customer' && settings && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b">
            <h3 className="font-semibold text-sm">Mijoz Bot Sozlamalari</h3>
            <p className="text-xs text-gray-400 mt-0.5">Mijozlarga qaysi xabarlar yuborilsin</p>
          </div>
          <div className="p-5 space-y-0 divide-y">
            <SettingRow label="Chek xabari" desc="Har bir xariddan keyin" checked={settings.customerReceiptMessage} onChange={(v) => setSetting('customerReceiptMessage', v)} />
            <SettingRow label="Cashback bildirish" desc="Bonus yig'ilganda" checked={settings.customerCashbackNotif} onChange={(v) => setSetting('customerCashbackNotif', v)} />
            <SettingRow label="Bonus muddati" desc="Bonus tugashidan oldin ogohlantirish" checked={settings.customerBonusExpiry} onChange={(v) => setSetting('customerBonusExpiry', v)} />
            <SettingRow label="Stamp progress" desc="Stamp karta yangilanganda" checked={settings.customerStampProgress} onChange={(v) => setSetting('customerStampProgress', v)} />
            <SettingRow label="Promokampaniyalar" desc="Marketing xabarlar" checked={settings.customerPromoEnabled} onChange={(v) => setSetting('customerPromoEnabled', v)} />
          </div>
        </div>
      )}

      {/* Linked Accounts Tab */}
      {tab === 'accounts' && (
        <div className="space-y-4">
          {/* Generate Link Token */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Telegram Akkount Ulash
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Foydalanuvchi yoki egaga Telegram akkauntini ulash uchun bir martalik havola yarating.
              Havola 15 daqiqa amal qiladi.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => linkTokenMut.mutate({ entityType: 'OWNER', entityId: 'self' })}
                disabled={linkTokenMut.isPending}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition"
              >
                <User className="w-3.5 h-3.5" />
                Egaim uchun havola
              </button>
            </div>

            {linkResult && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                  <QrCode className="w-4 h-4" /> Telegram Deep Link
                </div>
                {linkResult.deepLink ? (
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-xs bg-white border px-3 py-2 rounded-lg break-all font-mono">
                      {linkResult.deepLink}
                    </code>
                    <button
                      onClick={() => handleCopy(linkResult.deepLink!)}
                      className="shrink-0 border border-blue-200 hover:bg-blue-100 px-2 py-2 rounded-lg text-blue-600 transition"
                      title="Nusxa olish"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-yellow-700">
                    <AlertTriangle className="w-4 h-4" />
                    Bot username sozlanmagan — admin paneldan sozlang
                  </div>
                )}
                <p className="text-xs text-blue-600">
                  Token: <code className="font-mono">{linkResult.token}</code>
                </p>
                <p className="text-xs text-gray-400">
                  Muddati: {new Date(linkResult.expiresAt).toLocaleString('uz-UZ')}
                </p>
              </div>
            )}
          </div>

          {/* Linked Accounts List */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4" /> Ulangan Akkountlar
              </h3>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ['tg-linked-accounts'] })}
                className="text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {accountsLoading ? (
              <p className="p-5 text-sm text-gray-400">Yuklanmoqda...</p>
            ) : linkedAccounts.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Hali ulangan akkountlar yo&apos;q
              </div>
            ) : (
              <div className="divide-y">
                {linkedAccounts.map((acc) => (
                  <div key={acc.id} className="px-5 py-4 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${acc.telegramIdentity.isBlocked ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-600'}`}>
                      {entityTypeIcon(acc.entityType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {acc.telegramIdentity.firstName ?? ''} {acc.telegramIdentity.lastName ?? ''}
                        </span>
                        {acc.telegramIdentity.telegramUsername && (
                          <span className="text-xs text-gray-400">@{acc.telegramIdentity.telegramUsername}</span>
                        )}
                        {acc.telegramIdentity.isBlocked && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Bloklangan</span>
                        )}
                        {acc.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {entityTypeLabel(acc.entityType)} · ID: {acc.telegramIdentity.telegramUserId}
                        {acc.telegramIdentity.lastSeenAt && (
                          <> · {new Date(acc.telegramIdentity.lastSeenAt).toLocaleDateString('uz-UZ')}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => testSendMut.mutate(acc.id)}
                        disabled={testSendMut.isPending}
                        title="Test xabar yuborish"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Bu ulashni o'chirasizmi?"))
                            unlinkMut.mutate({ entityType: acc.entityType, entityId: acc.entityId });
                        }}
                        title="Ulashni o'chirish"
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Link2Off className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Button (except accounts tab) */}
      {tab !== 'accounts' && settings && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {saveMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      )}
    </div>
  );
}
