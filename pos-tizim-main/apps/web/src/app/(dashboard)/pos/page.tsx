'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  cacheProducts,
  decrementCachedStock,
  getCachedProductByBarcode,
  getPendingSales,
  queuePendingSale,
} from '@/lib/offline-db';
import { flushPendingSales } from '@/lib/offline-sync';
import {
  AlertTriangle, Camera, ShoppingCart, X,
  Banknote, CreditCard, ArrowLeftRight, ClipboardList,
  CheckCircle2, Printer, Phone, User, Wallet,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const BarcodeScanner = dynamic(() => import('@/components/barcode-scanner'), { ssr: false });
const ReceiptPrint = dynamic(() => import('@/components/receipt-print'), { ssr: false });

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: { quantity: number } | null;
  barcodes: { code: string }[];
  images?: { url: string }[];
  matchedVariantId?: string;
  variants: { id: string; size: string | null; color: string | null; price: number | null; quantity: number }[];
}

interface CartItem {
  lineId: string;
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  qty: number;
  available: number;
}

interface ActiveSession {
  id: string;
  openedAt: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

type PayType = 'CASH' | 'CARD' | 'MIXED' | 'DEBT';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

export default function PosPage() {
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const user = mounted ? getUser() : null;

  useEffect(() => { setMounted(true); }, []);

  // UI state
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [showScanner, setShowScanner] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payType, setPayType] = useState<PayType>('CASH');
  const [cashGiven, setCashGiven] = useState('');
  const [cardGiven, setCardGiven] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [showReceiptPrint, setShowReceiptPrint] = useState(false);
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);

  // Debt (qarz) state
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [debtPaidAmount, setDebtPaidAmount] = useState('');
  const [debtPayMethod, setDebtPayMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Active cash session
  const { data: sessionRaw } = useQuery({
    queryKey: ['active-session'],
    queryFn: () => api.get<ActiveSession>('/cash-sessions/active').catch(() => null),
    refetchInterval: 30000,
  });
  const session = sessionRaw as ActiveSession | null;

  // Products (search)
  const { data: productsData } = useQuery<{ data: Product[] }>({
    queryKey: ['pos-products', search],
    queryFn: () =>
      api.get<{ data: Product[] }>(
        `/products?limit=24${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    placeholderData: (prev) => prev,
  });
  const products = productsData?.data ?? [];

  // Cache products locally so barcode lookup/checkout still works while offline
  useEffect(() => {
    if (products.length > 0) cacheProducts(products);
  }, [products]);

  // Online/offline tracking + pending (unsynced) offline sales count
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const trySync = () => flushPendingSales().then((n) => {
      if (n > 0) qc.invalidateQueries({ queryKey: ['pending-sales-count'] });
    });
    setIsOnline(navigator.onLine);
    const goOnline = () => { setIsOnline(true); trySync(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    trySync();
    // Fallback poll in case the browser's online/offline events are unreliable
    const interval = setInterval(trySync, 20000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(interval);
    };
  }, [qc]);

  const { data: pendingCount } = useQuery({
    queryKey: ['pending-sales-count'],
    queryFn: () => getPendingSales().then((s) => s.length),
    refetchInterval: 10000,
  });

  // Customer search for debt payment
  const { data: customerSearchData } = useQuery({
    queryKey: ['customer-search-pos', customerPhone],
    queryFn: () => api.get<{ data: Customer[] }>(`/customers?search=${encodeURIComponent(customerPhone)}&limit=5`),
    enabled: payType === 'DEBT' && customerPhone.length >= 3 && !selectedCustomer,
  });
  const foundCustomers = customerSearchData?.data ?? [];

  // Barcode lookup — falls back to the local IndexedDB cache when offline
  const barcodeMut = useMutation({
    mutationFn: async (code: string) => {
      try {
        return await api.get<Product>(`/products/by-barcode/${encodeURIComponent(code)}`);
      } catch (e) {
        const cached = await getCachedProductByBarcode(code);
        if (cached) return cached as Product;
        throw e;
      }
    },
    onSuccess: (p) => {
      addToCart(p);
      setSearch('');
      setError('');
    },
    onError: () => {
      setError('Barcode topilmadi');
      setTimeout(() => setError(''), 3000);
    },
  });

  // Create sale — queued locally and synced later if the network is unreachable
  const saleMut = useMutation({
    mutationFn: async (body: any) => {
      const clientTxnId = crypto.randomUUID();
      const payload = { ...body, clientTxnId };
      try {
        return await api.post<any>('/sales', payload);
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 0) throw e;

        // Network unreachable — queue the sale and synthesize a local receipt
        await queuePendingSale({ clientTxnId, body: payload, createdAt: new Date().toISOString() });
        await decrementCachedStock(body.items);

        const subtotal = body.items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
        const total = subtotal - (body.discount ?? 0);
        const totalPaid = (body.payments ?? []).reduce((s: number, p: any) => s + p.amount, 0);
        return {
          id: `offline-${clientTxnId}`,
          receiptNo: `OFLN-${clientTxnId.slice(0, 8).toUpperCase()}`,
          offline: true,
          subtotal,
          discount: body.discount ?? 0,
          total,
          items: body.items,
          payments: body.payments ?? [],
          status: totalPaid < total ? 'PARTIAL' : 'PAID',
          createdAt: new Date().toISOString(),
        };
      }
    },
    onSuccess: (data) => {
      setReceipt(data);
      setCart([]);
      setDiscount('');
      setDiscountType('FIXED');
      setPayOpen(false);
      setCashGiven('');
      setCardGiven('');
      setMobileCartOpen(false);
      // Reset debt state
      setCustomerPhone('');
      setCustomerName('');
      setDebtPaidAmount('');
      setSelectedCustomer(null);
      qc.invalidateQueries({ queryKey: ['active-session'] });
      qc.invalidateQueries({ queryKey: ['pos-products'] });
      qc.invalidateQueries({ queryKey: ['pending-sales-count'] });
    },
    onError: (e: any) => setError(e.message),
  });

  const addToCart = useCallback((p: Product, selectedVariant?: Product['variants'][number]) => {
    setCart((prev) => {
      const lineId = selectedVariant?.id ?? p.id;
      const exists = prev.find((i) => i.lineId === lineId);
      const avail = selectedVariant?.quantity ?? p.stock?.quantity ?? 0;
      const price = selectedVariant?.price ?? p.price;
      if (avail < 1) return prev;
      if (exists) {
        if (exists.qty >= avail) return prev;
        return prev.map((i) =>
          i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i,
        );
      }
      const variantName = selectedVariant
        ? [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' / ')
        : '';
      return [...prev, { lineId, productId: p.id, variantId: selectedVariant?.id, name: variantName ? `${p.name} (${variantName})` : p.name, price, qty: 1, available: avail }];
    });
  }, []);

  const removeItem = (lineId: string) =>
    setCart((prev) => prev.filter((i) => i.lineId !== lineId));

  const changeQty = (lineId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.lineId !== lineId) return i;
          const nq = i.qty + delta;
          if (nq <= 0) return { ...i, qty: 0 };
          if (nq > i.available) return i;
          return { ...i, qty: nq };
        })
        .filter((i) => i.qty > 0),
    );

  const handleScan = useCallback(
    (code: string) => {
      setShowScanner(false);
      barcodeMut.mutate(code);
    },
    [barcodeMut],
  );

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      barcodeMut.mutate(search.trim());
    }
  };

  // Cart totals
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const discountVal = Math.max(0, Number(discount) || 0);
  const discountAmt = discountType === 'PERCENT'
    ? Math.min(Math.round((subtotal * discountVal) / 100), subtotal)
    : Math.min(discountVal, subtotal);
  const total = subtotal - discountAmt;
  const cashNum = Number(cashGiven) || 0;
  const cardNum = Number(cardGiven) || 0;
  const mixedSum = cashNum + cardNum;
  const change = cashNum - total;

  function openPayment() {
    if (cart.length === 0) return;
    if (!session?.id) {
      setError('Avval Kassa sahifasidan kassani oching!');
      setTimeout(() => setError(''), 4000);
      return;
    }
    setCashGiven(String(total));
    setCardGiven('');
    setPayType('CASH');
    setCustomerPhone('');
    setCustomerName('');
    setDebtPaidAmount('');
    setSelectedCustomer(null);
    setPayOpen(true);
    setError('');
  }

  async function confirmPayment() {
    // ── DEBT (qarz) payment ──
    if (payType === 'DEBT') {
      let customerId: string;
      if (selectedCustomer) {
        customerId = selectedCustomer.id;
      } else if (customerName.trim()) {
        try {
          const c = await api.post<Customer>('/customers', {
            name: customerName.trim(),
            phone: customerPhone.trim() || undefined,
          });
          customerId = c.id;
        } catch (e: any) {
          setError(e.message || "Mijoz yaratishda xatolik");
          return;
        }
      } else {
        setError("Mijoz ismini kiriting");
        return;
      }

      const paidAmt = Number(debtPaidAmount) || 0;
      if (paidAmt > 0 && paidAmt >= total) {
        setError("Qarz bo'lishi uchun to'lov jami summadan kam bo'lishi kerak");
        return;
      }

      const payments = paidAmt > 0
        ? [{ type: debtPayMethod, amount: paidAmt }]
        : [];

      saleMut.mutate({
        cashSessionId: session?.id ?? null,
        discount: discountAmt,
        discountType,
        discountValue: discountVal,
        customerId,
        items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty, price: i.price, name: i.name })),
        payments,
      });
      return;
    }

    // ── Regular payments (CASH, CARD, MIXED) ──
    if (payType === 'CASH' && cashNum < total) {
      setError("Naqd to'lov yetarli emas");
      return;
    }

    let payments: { type: string; amount: number }[];
    if (payType === 'CASH') {
      payments = [{ type: 'CASH', amount: total }];
    } else if (payType === 'CARD') {
      payments = [{ type: 'CARD', amount: total }];
    } else {
      // MIXED: ikkala qism ham musbat, yig'indisi total ga teng bo'lishi kerak
      if (cashNum <= 0 || cardNum <= 0) {
        setError("Aralash to'lovda har ikkala qism ham 0 dan katta bo'lishi kerak");
        return;
      }
      if (mixedSum !== total) {
        setError(`Naqd + Karta (${fmt(mixedSum)}) jami summaga (${fmt(total)}) teng bo'lishi kerak`);
        return;
      }
      payments = [
        { type: 'CASH', amount: cashNum },
        { type: 'CARD', amount: cardNum },
      ];
    }

    saleMut.mutate({
      cashSessionId: session?.id ?? null,
      discount: discountAmt,
      discountType,
      discountValue: discountVal,
      items: cart.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty, price: i.price, name: i.name })),
      payments,
    });
  }

  // Auto-focus search after receipt
  useEffect(() => {
    if (!receipt) {
      const t = setTimeout(() => searchRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [receipt]);

  // ── HOTKEYS ──────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in input fields (except F-keys)
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );

      // F2: Focus barcode input
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // F9: Open checkout
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !payOpen) openPayment();
        return;
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        e.preventDefault();
        if (payOpen) { setPayOpen(false); setError(''); }
        if (showScanner) setShowScanner(false);
        if (showReceiptPrint) setShowReceiptPrint(false);
        if (receipt) setReceipt(null);
        return;
      }

      // Don't handle +/-/Del when in an input
      if (isInput) return;

      // + or = : Increase last cart item qty
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        if (cart.length > 0) {
          const last = cart[cart.length - 1];
          changeQty(last.lineId, 1);
        }
        return;
      }

      // - : Decrease last cart item qty
      if (e.key === '-') {
        e.preventDefault();
        if (cart.length > 0) {
          const last = cart[cart.length - 1];
          changeQty(last.lineId, -1);
        }
        return;
      }

      // Delete: Remove last cart item
      if (e.key === 'Delete') {
        e.preventDefault();
        if (cart.length > 0) {
          removeItem(cart[cart.length - 1].lineId);
        }
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, payOpen, showScanner, showReceiptPrint, receipt]);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;
    const closeCurrentView = () => {
      if (payOpen) setPayOpen(false);
      else if (variantPicker) setVariantPicker(null);
      else if (receipt) setReceipt(null);
    };
    tg.BackButton.onClick(closeCurrentView);
    if (payOpen || variantPicker || receipt) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.MainButton.setParams({
      text: payOpen ? "TO'LOVNI TASDIQLASH" : `TO'LOV ${fmt(total)} SO'M`,
      is_visible: !payOpen && cart.length > 0,
      is_active: !saleMut.isPending,
    });
    const handleMainButton = () => payOpen ? confirmPayment() : openPayment();
    tg.MainButton.onClick(handleMainButton);
    return () => {
      tg.BackButton.offClick(closeCurrentView);
      tg.MainButton.offClick(handleMainButton);
      tg.MainButton.hide();
    };
  }, [cart.length, total, payOpen, variantPicker, receipt, saleMut.isPending]);

  // ── RECEIPT SCREEN ──────────────────────────────────────────────────
  if (receipt) {
    return (
      <div className="max-w-sm mx-auto mt-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className={`${receipt.offline ? 'bg-orange-500' : 'bg-green-500'} text-white text-center py-6 px-4`}>
            <CheckCircle2 className="w-16 h-16 mx-auto mb-2" />
            <h2 className="text-xl font-bold">{receipt.offline ? 'Saqlandi — offline navbatda' : 'Sotuv muvaffaqiyatli!'}</h2>
            <p className="text-sm opacity-80 mt-1 font-mono">#{receipt.receiptNo}</p>
          </div>

          <div className="p-5 space-y-1.5 text-sm">
            {receipt.items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-gray-700">
                <span className="truncate max-w-[60%]">
                  {item.qty} × {fmt(item.price)}
                </span>
                <span className="font-medium">{fmt(item.qty * item.price)} so&apos;m</span>
              </div>
            ))}

            <div className="border-t pt-2 mt-2 space-y-1">
              {receipt.discount > 0 && (
                <div className="flex justify-between text-red-500 text-xs">
                  <span>Chegirma</span>
                  <span>− {fmt(receipt.discount)} so&apos;m</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>JAMI</span>
                <span className="text-blue-600">{fmt(receipt.total)} so&apos;m</span>
              </div>
            </div>

            <div className="border-t pt-2 text-xs text-gray-500 space-y-1">
              {receipt.payments?.map((p: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="flex items-center gap-1">
                    {p.type === 'CASH' ? <Banknote className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                    {p.type === 'CASH' ? 'Naqd' : 'Karta'}
                  </span>
                  <span>{fmt(p.amount)} so&apos;m</span>
                </div>
              ))}
              {receipt.status === 'PARTIAL' && (
                <div className="flex justify-between text-orange-600 font-semibold text-sm pt-1 border-t border-dashed">
                  <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Qarz</span>
                  <span>
                    {fmt(receipt.total - (receipt.payments?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0))} so&apos;m
                  </span>
                </div>
              )}
            </div>

            <p className="text-center text-xs text-gray-400 pt-1">
              {new Date(receipt.createdAt).toLocaleString('uz-UZ')}
            </p>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={() => setShowReceiptPrint(true)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium transition text-sm mb-2 flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Chop etish
            </button>
            <button
              onClick={() => setReceipt(null)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition text-sm"
            >
              Yangi sotuv →
            </button>
          </div>
        </div>

        {showReceiptPrint && (
          <ReceiptPrint
            sale={receipt}
            onClose={() => setShowReceiptPrint(false)}
          />
        )}
      </div>
    );
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // ── MAIN POS SCREEN ─────────────────────────────────────────────────
  return (
    <div
      className="fixed left-0 right-0 md:left-56 md:top-0 md:bottom-0 flex flex-col md:flex-row overflow-hidden bg-gray-50 z-10"
      style={{ top: 'var(--app-top-offset)', bottom: 'var(--app-bottom-offset)' }}
    >

      {/* ── LEFT: Products (always visible) ────────────── */}
      <div className="flex-1 flex flex-col min-w-0 p-4 overflow-hidden">
        {/* Offline / pending sync banner */}
        {(!isOnline || !!pendingCount) && (
          <div className="bg-orange-50 border border-orange-200 text-orange-700 text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              {!isOnline
                ? "Offline rejim \u2014 sotuvlar mahalliy saqlanadi va internet qaytganda avtomatik yuboriladi"
                : `Sinxronlanmoqda \u2014 ${pendingCount} ta sotuv navbatda`}
            </span>
          </div>
        )}

        {/* Session banner */}
        {!session?.id && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Kassa yopiq — avval{' '}
              <a href="/cash-sessions" className="font-semibold underline">
                Kassa
              </a>{' '}
              sahifasidan oching
            </span>
          </div>
        )}

        {/* Search row */}
        <div className="flex gap-2 mb-3 shrink-0">
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Mahsulot nomi yoki barcode kiriting…"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowScanner(true)}
            title="Kamera bilan barcode skanerlash"
            className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition border border-gray-200 flex items-center justify-center"
          >
            <Camera className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {error && (
          <p className="text-sm bg-red-50 text-red-600 px-3 py-2 rounded-lg mb-3 border border-red-100 shrink-0">
            {error}
          </p>
        )}

        {/* Product grid — scrollable */}
        <div className="flex-1 overflow-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {products.map((p) => {
              const sellableVariants = p.variants?.filter((variant) => variant.quantity > 0) ?? [];
              const inStock = sellableVariants.length > 0 || (p.stock?.quantity ?? 0) > 0;
              const inCart = cart.find((i) => i.productId === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => sellableVariants.length > 1 ? setVariantPicker(p) : addToCart(p, sellableVariants[0])}
                  disabled={!inStock}
                  className={`relative text-left p-3 rounded-xl border-2 transition group ${
                    inCart
                      ? 'border-blue-400 bg-blue-50'
                      : inStock
                        ? 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                        : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {inCart && (
                    <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                      {inCart.qty}
                    </span>
                  )}
                  {p.images?.[0] && (
                    <img src={p.images[0].url} alt={p.name} className="w-10 h-10 rounded-lg object-cover mb-1" />
                  )}
                  <p className="font-medium text-sm leading-snug pr-6">{p.name}</p>
                  {p.sku && <p className="text-xs text-gray-400 mt-0.5">SKU: {p.sku}</p>}
                  <p className="text-blue-600 font-bold text-sm mt-1">{fmt(p.price)} so&apos;m</p>
                  <p className={`text-xs mt-0.5 ${inStock ? 'text-gray-400' : 'text-red-400'}`}>
                    {inStock ? `Ombor: ${sellableVariants.length ? sellableVariants.reduce((sum, variant) => sum + variant.quantity, 0) : p.stock!.quantity}` : 'Tugagan'}
                  </p>
                </button>
              );
            })}
            {products.length === 0 && (
              <div className="col-span-4 py-10 text-center text-gray-400 text-sm">
                Mahsulot topilmadi
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Desktop Cart ───────────────── */}
      <div className="hidden md:flex md:w-72 border-l border-gray-200 bg-white flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-base">Savat</h2>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-xs text-gray-400 hover:text-red-500 transition"
            >
              Tozalash
            </button>
          )}
        </div>

        {/* Cart items — scrollable */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-12 space-y-2">
              <ShoppingCart className="w-10 h-10 mx-auto text-gray-200" />
              <p>Mahsulot tanlang</p>
              <p className="text-xs">yoki barcode skanerlang</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.lineId} className="bg-gray-50 rounded-xl p-2.5">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-medium leading-snug flex-1 break-words">
                    {item.name}
                  </p>
                  <button
                    onClick={() => removeItem(item.lineId)}
                    className="text-gray-300 hover:text-red-500 text-sm ml-1 shrink-0 mt-0.5 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => changeQty(item.lineId, -1)}
                      className="w-6 h-6 rounded-md bg-white border border-gray-200 hover:bg-gray-100 text-sm font-bold leading-none transition"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.qty}</span>
                    <button
                      onClick={() => changeQty(item.lineId, 1)}
                      disabled={item.qty >= item.available}
                      className="w-6 h-6 rounded-md bg-white border border-gray-200 hover:bg-gray-100 text-sm font-bold leading-none transition disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">
                    {fmt(item.price * item.qty)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Totals + Pay button */}
        <div className="border-t border-gray-100 p-3 space-y-2.5">
          {cart.length > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Mahsulotlar ({cart.reduce((s, i) => s + i.qty, 0)} ta)</span>
                <span>{fmt(subtotal)} so&apos;m</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                  Chegirma:
                </label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                  min="0"
                  max={discountType === 'PERCENT' ? 100 : subtotal}
                />
                <button
                  onClick={() => setDiscountType(discountType === 'FIXED' ? 'PERCENT' : 'FIXED')}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition ${
                    discountType === 'PERCENT'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                  title={discountType === 'PERCENT' ? 'Foizda' : "So'mda"}
                >
                  {discountType === 'PERCENT' ? '%' : "so'm"}
                </button>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2">
                <span>TO&apos;LOV</span>
                <span className="text-blue-600">{fmt(total)} so&apos;m</span>
              </div>
            </>
          )}
          <button
            onClick={openPayment}
            disabled={cart.length === 0 || saleMut.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition text-sm"
          >
            {saleMut.isPending ? 'Saqlanmoqda…' : "To'lov →"}
          </button>
        </div>
      </div>

      {/* ── MOBILE: Floating Cart Bar ────────────── */}
      {cart.length > 0 && (
        <div className="md:hidden shrink-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          {/* Expandable cart details */}
          {mobileCartOpen && (
            <div className="max-h-[40vh] overflow-auto p-3 space-y-2 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-gray-700">Savatdagi mahsulotlar</span>
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-gray-400 hover:text-red-500 transition"
                >
                  Tozalash
                </button>
              </div>
              {cart.map((item) => (
                <div key={item.lineId} className="bg-gray-50 rounded-xl p-2.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium leading-snug flex-1 break-words">
                      {item.name}
                    </p>
                    <button
                      onClick={() => removeItem(item.lineId)}
                      className="text-gray-300 hover:text-red-500 text-sm ml-1 shrink-0 mt-0.5 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => changeQty(item.lineId, -1)}
                        className="w-7 h-7 rounded-md bg-white border border-gray-200 hover:bg-gray-100 text-sm font-bold leading-none transition"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-bold">{item.qty}</span>
                      <button
                        onClick={() => changeQty(item.lineId, 1)}
                        disabled={item.qty >= item.available}
                        className="w-7 h-7 rounded-md bg-white border border-gray-200 hover:bg-gray-100 text-sm font-bold leading-none transition disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      {fmt(item.price * item.qty)}
                    </span>
                  </div>
                </div>
              ))}
              {/* Mobile discount */}
              <div className="flex items-center gap-2 pt-1">
                <label className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                  Chegirma:
                </label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                  min="0"
                  max={discountType === 'PERCENT' ? 100 : subtotal}
                />
                <button
                  onClick={() => setDiscountType(discountType === 'FIXED' ? 'PERCENT' : 'FIXED')}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition ${
                    discountType === 'PERCENT'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {discountType === 'PERCENT' ? '%' : "so'm"}
                </button>
              </div>
            </div>
          )}

          {/* Summary bar + payment button */}
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => setMobileCartOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700"
            >
              <span className="relative">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2 -right-3 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              </span>
              <span className="ml-2">{mobileCartOpen ? '▾' : '▴'}</span>
            </button>
            <div className="flex-1 text-right">
              <span className="font-bold text-blue-600 text-base">{fmt(total)} so&apos;m</span>
            </div>
            <button
              onClick={openPayment}
              disabled={saleMut.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm disabled:opacity-60"
            >
              {saleMut.isPending ? '…' : "To'lov →"}
            </button>
          </div>
        </div>
      )}

      {/* ── CAMERA SCANNER MODAL ─── */}
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {variantPicker && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="font-bold">{variantPicker.name}</h2><p className="text-sm text-gray-500">Rang va o&apos;lchamni tanlang</p></div>
              <button onClick={() => setVariantPicker(null)} className="p-1 text-gray-400 hover:text-gray-700" title="Yopish"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {variantPicker.variants.filter((variant) => variant.quantity > 0).map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => { addToCart(variantPicker, variant); setVariantPicker(null); }}
                  className="border border-gray-200 hover:border-blue-500 hover:bg-blue-50 rounded-lg px-3 py-3 text-left transition"
                >
                  <span className="block font-medium text-sm">{[variant.color, variant.size].filter(Boolean).join(' / ') || 'Standart'}</span>
                  <span className="block text-xs text-gray-500 mt-1">{fmt(variant.price ?? variantPicker.price)} so&apos;m · {variant.quantity} dona</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── PAYMENT MODAL ─────────── */}
      {payOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col mb-16 sm:mb-0" style={{ maxHeight: 'calc(var(--vv-height, 100vh) - 5rem)' }}>
            <div className="px-5 py-3 border-b shrink-0">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Jami summa</p>
              <p className="text-2xl font-bold text-blue-600 mt-0.5">{fmt(total)} so&apos;m</p>
            </div>

            <div className="p-5 space-y-4 overflow-auto flex-1">
              {/* Payment type selector */}
              <div className="grid grid-cols-4 gap-1.5">
                {(['CASH', 'CARD', 'MIXED', 'DEBT'] as PayType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setPayType(t);
                      if (t === 'MIXED') { setCashGiven(''); setCardGiven(''); }
                      else if (t === 'CASH') { setCashGiven(String(total)); }
                      setError('');
                    }}
                    className={`py-2.5 px-1 rounded-xl text-xs font-medium border transition ${
                      payType === t
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {t === 'CASH' ? (
                      <span className="flex flex-col items-center gap-0.5"><Banknote className="w-4 h-4" /><span>Naqd</span></span>
                    ) : t === 'CARD' ? (
                      <span className="flex flex-col items-center gap-0.5"><CreditCard className="w-4 h-4" /><span>Karta</span></span>
                    ) : t === 'MIXED' ? (
                      <span className="flex flex-col items-center gap-0.5"><ArrowLeftRight className="w-4 h-4" /><span>Aralash</span></span>
                    ) : (
                      <span className="flex flex-col items-center gap-0.5"><ClipboardList className="w-4 h-4" /><span>Qarz</span></span>
                    )}
                  </button>
                ))}
              </div>

              {/* CASH input */}
              {payType === 'CASH' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 block">
                    Qabul qilindi (so&apos;m):
                  </label>
                  <input
                    type="number"
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-xl font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                    min="0"
                    autoFocus
                  />
                  {cashNum >= total && (
                    <p className="text-sm text-green-600 font-semibold text-right">
                      Qaytim: {fmt(Math.max(0, change))} so&apos;m
                    </p>
                  )}
                </div>
              )}

              {/* MIXED inputs — naqd va karta alohida */}
              {payType === 'MIXED' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">Naqd qism (so&apos;m):</label>
                    <input
                      type="number"
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                      min="0"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">Karta qism (so&apos;m):</label>
                    <input
                      type="number"
                      value={cardGiven}
                      onChange={(e) => setCardGiven(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                      min="0"
                    />
                  </div>
                  <div className={`text-xs font-semibold text-right flex items-center justify-end gap-1 ${mixedSum === total ? 'text-green-600' : 'text-orange-500'}`}>
                    {mixedSum === total ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}{' '}
                    {fmt(cashNum)} + {fmt(cardNum)} = {fmt(mixedSum)}{' '}
                    <span className="text-gray-400">/ {fmt(total)}</span>
                  </div>
                </div>
              )}

              {/* DEBT inputs — customer name + phone + optional partial payment */}
              {payType === 'DEBT' && (
                <div className="space-y-3">
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-medium text-gray-600 block"><span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Telefon raqam:</span></label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        setSelectedCustomer(null);
                      }}
                      placeholder="+998 90 123 45 67"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      autoFocus
                    />
                    {/* Customer search results dropdown */}
                    {foundCustomers.length > 0 && !selectedCustomer && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 z-10 overflow-hidden">
                        {foundCustomers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerName(c.name);
                              setCustomerPhone(c.phone ?? '');
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-50 last:border-0 transition"
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block"><span className="flex items-center gap-1"><User className="w-3 h-3" /> Mijoz ismi:</span></label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ism kiriting…"
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      disabled={!!selectedCustomer}
                    />
                    {selectedCustomer && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Mavjud mijoz tanlandi —{' '}
                        <button
                          onClick={() => { setSelectedCustomer(null); setCustomerName(''); }}
                          className="text-blue-600 underline"
                        >
                          boshqa
                        </button>
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-600 block">
                      <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Oldindan to&apos;lov (ixtiyoriy):</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={debtPaidAmount}
                        onChange={(e) => setDebtPaidAmount(e.target.value)}
                        placeholder="0"
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm text-right font-bold focus:outline-none focus:ring-2 focus:ring-blue-400"
                        min="0"
                        max={total - 1}
                      />
                      <button
                        onClick={() => setDebtPayMethod(debtPayMethod === 'CASH' ? 'CARD' : 'CASH')}
                        className={`px-3 py-3 rounded-xl text-xs font-bold border transition ${
                          debtPayMethod === 'CASH'
                            ? 'bg-green-50 text-green-700 border-green-300'
                            : 'bg-blue-50 text-blue-700 border-blue-300'
                        }`}
                      >
                        {debtPayMethod === 'CASH' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
                    <div className="flex justify-between text-orange-700">
                      <span>Qarz qoladi:</span>
                      <span className="font-bold">
                        {fmt(Math.max(0, total - (Number(debtPaidAmount) || 0)))} so&apos;m
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            <div className="px-5 pb-5 pt-2 flex gap-3 shrink-0 safe-bottom">
              <button
                onClick={() => {
                  setPayOpen(false);
                  setError('');
                }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
              >
                Bekor
              </button>
              <button
                onClick={confirmPayment}
                disabled={saleMut.isPending}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm transition disabled:opacity-60 shadow-sm flex items-center justify-center gap-1.5"
              >
                {saleMut.isPending ? '…' : <><CheckCircle2 className="w-4 h-4" /> Tasdiqlash</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
