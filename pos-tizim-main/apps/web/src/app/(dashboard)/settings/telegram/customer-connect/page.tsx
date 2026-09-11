'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  QrCode,
  User,
  Link2,
  Link2Off,
  Copy,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface CustomerProfile {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  telegramLinked: boolean;
  telegramIdentity: {
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    telegramChatId: string;
    lastSeenAt: string | null;
  } | null;
  cashbackCards: {
    id: string;
    cardNumber: string;
    balance: number;
    totalEarned: number;
    totalSpent: number;
  }[];
}

interface DeepLinkResult {
  token: string;
  deepLink: string | null;
  expiresAt: string;
}

export default function CustomerConnectPage() {
  const [entityId, setEntityId] = useState('');
  const [searched, setSearched] = useState(false);
  const [deepLink, setDeepLink] = useState<DeepLinkResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const {
    data: customer,
    isLoading,
    refetch,
    isError,
  } = useQuery<CustomerProfile>({
    queryKey: ['tg-customer-me', entityId],
    queryFn: () => api.get<CustomerProfile>(`/telegram/customer/me?entityId=${entityId}`),
    enabled: searched && !!entityId,
    retry: false,
  });

  const deepLinkMut = useMutation({
    mutationFn: (data: { entityId: string; entityType: string }) =>
      api.post<DeepLinkResult>('/telegram/customer/deep-link', data),
    onSuccess: (res) => {
      setDeepLink(res as DeepLinkResult);
      setMsg({ type: 'ok', text: 'Deep link yaratildi' });
    },
    onError: (e: any) => setMsg({ type: 'err', text: e.message }),
  });

  const handleSearch = () => {
    if (!entityId) return;
    setSearched(true);
    setDeepLink(null);
    refetch();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const cashback = customer?.cashbackCards?.[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <QrCode className="w-7 h-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Mijoz Telegram Ulanishi</h1>
          <p className="text-sm text-gray-500">
            Mijoz Telegram akkauntini bog'lash uchun havola yaratish
          </p>
        </div>
      </div>

      {msg && (
        <div
          className={`px-4 py-2 rounded text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Customer Search */}
      <section className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <User className="w-5 h-5 text-gray-500" />
          Mijoz qidirish
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            className="flex-1 border rounded px-3 py-2 text-sm"
            placeholder="Mijoz ID kiriting..."
            value={entityId}
            onChange={(e) => { setEntityId(e.target.value); setSearched(false); setDeepLink(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={!entityId || isLoading}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Yuklash
          </button>
        </div>

        {searched && isError && (
          <p className="text-sm text-red-500">Mijoz topilmadi yoki xato yuz berdi.</p>
        )}
      </section>

      {/* Customer Profile */}
      {customer && (
        <section className="bg-white rounded-xl border p-6 space-y-5">
          {/* Basic info */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-gray-800">{customer.name}</h3>
              {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
              <p className="text-xs text-gray-400">
                Ro'yxatdan o'tgan: {new Date(customer.createdAt).toLocaleDateString('uz-UZ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {customer.telegramLinked ? (
                <span className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full">
                  <Link2 className="w-3.5 h-3.5" />
                  Telegram ulangan
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full">
                  <Link2Off className="w-3.5 h-3.5" />
                  Telegram ulanmagan
                </span>
              )}
            </div>
          </div>

          {/* Telegram identity */}
          {customer.telegramLinked && customer.telegramIdentity && (
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs font-medium text-blue-700 mb-2">Ulangan Telegram akkount</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Telegram ID</p>
                  <p className="font-mono font-medium">{customer.telegramIdentity.telegramChatId}</p>
                </div>
                {customer.telegramIdentity.telegramUsername && (
                  <div>
                    <p className="text-xs text-gray-500">Username</p>
                    <p className="font-medium">@{customer.telegramIdentity.telegramUsername}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Ism</p>
                  <p className="font-medium">
                    {customer.telegramIdentity.firstName} {customer.telegramIdentity.lastName ?? ''}
                  </p>
                </div>
                {customer.telegramIdentity.lastSeenAt && (
                  <div>
                    <p className="text-xs text-gray-500">Oxirgi faollik</p>
                    <p className="font-medium">
                      {new Date(customer.telegramIdentity.lastSeenAt).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cashback card */}
          {cashback && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-600 mb-2">Cashback kartasi</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-green-600">{cashback.balance.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Balans</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-600">{cashback.totalEarned.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Jami olingan</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-600">{cashback.totalSpent.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Sarflangan</p>
                </div>
              </div>
              <p className="text-xs text-center text-gray-400 mt-2">Karta: {cashback.cardNumber}</p>
            </div>
          )}

          {/* Generate Deep Link */}
          <div className="pt-2 border-t">
            <button
              onClick={() => deepLinkMut.mutate({ entityId: customer.id, entityType: 'CUSTOMER' })}
              disabled={deepLinkMut.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <QrCode className="w-4 h-4" />
              {deepLinkMut.isPending ? 'Yaratilmoqda...' : 'Ulanish havolasi yaratish'}
            </button>

            {deepLink && (
              <div className="mt-4 space-y-3">
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Havola tayyor (24 soat amal qiladi)
                    </p>
                  </div>
                  {deepLink.deepLink ? (
                    <div className="flex gap-2">
                      <a
                        href={deepLink.deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-xs font-mono bg-white border rounded px-3 py-2 text-blue-700 truncate hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        {deepLink.deepLink}
                      </a>
                      <button
                        onClick={() => handleCopy(deepLink.deepLink!)}
                        className={`px-3 py-2 rounded border text-xs flex items-center gap-1 transition ${
                          copied
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Nusxalandi' : 'Nusxalash'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Token (bot konfiguratsiya kerak):</p>
                      <div className="flex gap-2">
                        <code className="flex-1 text-xs bg-white border rounded px-3 py-2 font-mono truncate">
                          {deepLink.token}
                        </code>
                        <button
                          onClick={() => handleCopy(deepLink.token)}
                          className="px-3 py-2 rounded border text-xs flex items-center gap-1 bg-white text-gray-600 hover:bg-gray-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Muddati: {new Date(deepLink.expiresAt).toLocaleString('uz-UZ')}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Mijoz ushbu havolani bosib Telegram botiga ulanadi va akkauntlari bog'lanadi.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
