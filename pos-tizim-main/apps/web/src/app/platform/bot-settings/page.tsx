'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import {
  Bot,
  Key,
  Globe,
  Webhook,
  Shield,
  Activity,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Save,
  FileText,
  Building2,
  LayoutTemplate,
  HeartPulse,
} from 'lucide-react';

interface BotConfig {
  id: string;
  name: string;
  botTokenEncrypted: string; // masked
  botUsername: string;
  webhookUrl: string | null;
  webhookSecret: string | null;
  miniAppUrl: string | null;
  isActive: boolean;
  status: string;
  lastWebhookSetAt: string | null;
  lastHealthCheckAt: string | null;
}

interface HealthResult {
  ok: boolean;
  result?: { id: number; username: string; first_name: string };
  description?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  UNCONFIGURED: { label: 'Sozlanmagan', color: 'text-gray-500' },
  CONFIGURED: { label: 'Sozlangan', color: 'text-blue-600' },
  WEBHOOK_SET: { label: 'Webhook ulangan', color: 'text-green-600' },
  WEBHOOK_FAILED: { label: 'Webhook xatosi', color: 'text-red-500' },
  HEALTHY: { label: 'Ishlayapti', color: 'text-green-600' },
  UNHEALTHY: { label: 'Ishlamayapti', color: 'text-red-500' },
};

export default function BotSettingsPage() {
  const qc = useQueryClient();
  const [tokenValue, setTokenValue] = useState('');
  const [usernameValue, setUsernameValue] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [miniAppUrl, setMiniAppUrl] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testChatId, setTestChatId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [showRotateModal, setShowRotateModal] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthResult | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: config, isLoading } = useQuery<BotConfig | null>({
    queryKey: ['tg-bot-config'],
    queryFn: () => api.get<BotConfig | null>('/telegram/admin/config'),
  });

  useEffect(() => {
    if (config) {
      setUsernameValue(config.botUsername ?? '');
      setWebhookUrl(config.webhookUrl ?? '');
      setWebhookSecret(config.webhookSecret ?? '');
      setMiniAppUrl(config.miniAppUrl ?? '');
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: (data: object) => api.patch('/telegram/admin/config', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-bot-config'] });
      setMsg({ type: 'ok', text: 'Bot sozlamalari saqlandi' });
      setTokenValue('');
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const webhookSetMut = useMutation({
    mutationFn: () => api.post('/telegram/admin/config/webhook/set', {}),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ['tg-bot-config'] });
      setMsg({ type: r.ok ? 'ok' : 'err', text: r.ok ? 'Webhook ulandi' : (r.description ?? 'Xato') });
    },
  });

  const webhookDelMut = useMutation({
    mutationFn: () => api.post('/telegram/admin/config/webhook/delete', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-bot-config'] });
      setMsg({ type: 'ok', text: 'Webhook o\'chirildi' });
    },
  });

  const rotateMut = useMutation({
    mutationFn: (token: string) => api.post('/telegram/admin/config/token/rotate', { token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tg-bot-config'] });
      setMsg({ type: 'ok', text: 'Token yangilandi' });
      setShowRotateModal(false);
      setNewToken('');
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const testMut = useMutation({
    mutationFn: (chatId: string) => api.post('/telegram/admin/config/test', { chatId }),
    onSuccess: (r: any) => setMsg({ type: r.ok !== false ? 'ok' : 'err', text: r.ok !== false ? 'Test xabar yuborildi' : (r.description ?? 'Xato') }),
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const handleHealthCheck = async () => {
    const res = await api.get('/telegram/admin/health') as HealthResult;
    setHealthResult(res);
    qc.invalidateQueries({ queryKey: ['tg-bot-config'] });
  };

  const handleSave = () => {
    if (!tokenValue && !config) {
      setMsg({ type: 'err', text: 'Bot token kiritilishi shart' });
      return;
    }
    saveMut.mutate({
      botToken: tokenValue || '__KEEP__',
      botUsername: usernameValue,
      webhookUrl: webhookUrl || undefined,
      webhookSecret: webhookSecret || undefined,
      miniAppUrl: miniAppUrl || undefined,
      isActive: true,
    });
  };

  if (isLoading) return <div className="p-6 text-gray-400">Yuklanmoqda...</div>;

  const statusInfo = STATUS_LABELS[config?.status ?? 'UNCONFIGURED'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Bot Sozlamalari</h1>
          <p className="text-sm text-gray-500">Global Telegram bot konfiguratsiyasi</p>
        </div>
        {config && (
          <span className={`ml-auto text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        )}
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href="/platform/bot-settings/logs" className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition text-sm font-medium text-gray-700 group">
          <FileText className="w-5 h-5 text-blue-400 group-hover:text-blue-600" />
          <span>Yetkazish loglari</span>
        </Link>
        <Link href="/platform/bot-settings/tenants" className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition text-sm font-medium text-gray-700 group">
          <Building2 className="w-5 h-5 text-blue-400 group-hover:text-blue-600" />
          <span>Tenant holati</span>
        </Link>
        <Link href="/platform/bot-settings/templates" className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:border-blue-200 hover:bg-blue-50 transition text-sm font-medium text-gray-700 group">
          <LayoutTemplate className="w-5 h-5 text-blue-400 group-hover:text-blue-600" />
          <span>Shablonlar</span>
        </Link>
        <Link href="/platform/bot-settings/health" className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:border-green-200 hover:bg-green-50 transition text-sm font-medium text-gray-700 group">
          <HeartPulse className="w-5 h-5 text-green-400 group-hover:text-green-600" />
          <span>Tizim holati</span>
        </Link>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto text-xs underline">Yopish</button>
        </div>
      )}

      {/* Token & Username Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
          <Key className="w-4 h-4" /> Bot Token va Username
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Bot Token</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono pr-10"
                placeholder={config ? '••••••••••• (yangilash uchun kiriting)' : 'BotFather dan olingan token'}
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {config && (
            <p className="text-xs text-gray-400 mt-1">
              Saqlangan token: <span className="font-mono">{config.botTokenEncrypted}</span>
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Bot Username (@ belgisisiz)</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="myposbot"
            value={usernameValue}
            onChange={(e) => setUsernameValue(e.target.value)}
          />
        </div>
      </div>

      {/* Webhook Card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
          <Webhook className="w-4 h-4" /> Webhook Sozlamalari
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Webhook URL</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="https://api.example.com/telegram/webhook"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Webhook Secret Token</label>
          <input
            type="password"
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
            placeholder="Tasodifiy maxfiy so'z"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
        </div>

        {config?.lastWebhookSetAt && (
          <p className="text-xs text-gray-400">
            Oxirgi ulangan: {new Date(config.lastWebhookSetAt).toLocaleString('uz-UZ')}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => webhookSetMut.mutate()}
            disabled={webhookSetMut.isPending}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            <Webhook className="w-3.5 h-3.5" />
            {webhookSetMut.isPending ? 'Ulanmoqda...' : 'Webhook Ulash'}
          </button>
          <button
            onClick={() => webhookDelMut.mutate()}
            disabled={webhookDelMut.isPending}
            className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-600 transition"
          >
            Webhook o&apos;chirish
          </button>
        </div>
      </div>

      {/* Mini App URL */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
          <Globe className="w-4 h-4" /> Mini App URL
        </div>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="https://t.me/myposbot/app"
          value={miniAppUrl}
          onChange={(e) => setMiniAppUrl(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-1">
          <Activity className="w-4 h-4" /> Bot Holati va Testlar
        </div>

        <div className="flex gap-2 flex-wrap items-start">
          <button
            onClick={handleHealthCheck}
            className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm text-gray-700 transition"
          >
            <Activity className="w-3.5 h-3.5" /> Health Check
          </button>
          <button
            onClick={() => setShowRotateModal(true)}
            className="flex items-center gap-1.5 border border-orange-200 text-orange-600 hover:bg-orange-50 px-3 py-2 rounded-lg text-sm transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Token Yangilash
          </button>
        </div>

        {healthResult && (
          <div className={`p-3 rounded-lg text-sm ${healthResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {healthResult.ok
              ? `Bot ishlayapti: @${healthResult.result?.username} (ID: ${healthResult.result?.id})`
              : `Xato: ${healthResult.description}`}
          </div>
        )}

        <div className="border-t pt-4">
          <label className="text-xs font-medium text-gray-500 block mb-1">Test Xabar Yuborish</label>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-lg px-3 py-2 text-sm"
              placeholder="Chat ID (masalan: 123456789)"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
            />
            <button
              onClick={() => testMut.mutate(testChatId)}
              disabled={!testChatId || testMut.isPending}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {testMut.isPending ? 'Yuborilmoqda...' : 'Yuborish'}
            </button>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saveMut.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>

      {/* Rotate Token Modal */}
      {showRotateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-2 text-orange-600 font-semibold">
              <Shield className="w-5 h-5" />
              Token Yangilash
            </div>
            <p className="text-sm text-gray-600">
              Yangi bot tokenini kiriting. Eski token o&apos;chiriladi va webhook qayta sozlanishi kerak bo&apos;ladi.
            </p>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="Yangi Bot Token"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowRotateModal(false); setNewToken(''); }}
                className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Bekor
              </button>
              <button
                onClick={() => rotateMut.mutate(newToken)}
                disabled={!newToken || rotateMut.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {rotateMut.isPending ? 'Yangilanmoqda...' : 'Yangilash'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
