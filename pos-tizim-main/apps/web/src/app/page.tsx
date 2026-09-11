'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShoppingCart, BarChart3, Package, Users, Store, Shield, type LucideIcon } from 'lucide-react';

const features: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: ShoppingCart, title: 'Tez sotish', desc: 'Bir necha bosishda sotuv amalga oshiring. Barcha mahsulotlar bir joyda.' },
  { icon: BarChart3, title: 'Hisobotlar', desc: "Kunlik, oylik, yillik hisobotlar. Foyda va xarajatlar tahlili." },
  { icon: Package, title: 'Ombor nazorati', desc: "Mahsulotlarni real vaqtda kuzating. Kam qolgan tovarlar haqida ogohlantirish." },
  { icon: Users, title: "Xodimlar boshqaruvi", desc: "Kassir, menejer, admin — har biriga alohida ruxsatlar." },
  { icon: Store, title: "Ko'p filiallar", desc: "Bir nechta do'konni bitta paneldan boshqaring." },
  { icon: Shield, title: 'Xavfsizlik', desc: "Barcha ma'lumotlar shifrlangan va himoyalangan." },
];

const stats = [
  { value: '99.9%', label: 'Uptime' },
  { value: '500+', label: "Do'konlar" },
  { value: '1M+', label: 'Sotuvlar' },
  { value: '24/7', label: "Qo'llab-quvvatlash" },
];

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute top-2/3 left-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-blob animation-delay-3000" />
        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
        {/* Floating particles */}
        {mounted && Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
            style={{
              left: `${(i * 5.3 + 2) % 100}%`,
              top: `${(i * 7.1 + 5) % 100}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${6 + (i % 4) * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Nav */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrollY > 50 ? 'bg-slate-900/80 backdrop-blur-xl shadow-lg shadow-black/20' : ''}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center text-lg font-bold shadow-lg shadow-blue-500/30">
              M
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Marva POS</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm text-blue-200 hover:text-white transition-colors">
              Kirish
            </Link>
            <Link href="/signup" className="px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 rounded-xl font-medium shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:scale-105 whitespace-nowrap">
              Ro&apos;yxatdan o&apos;tish
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center px-6" style={{ paddingTop: 'calc(5rem + env(safe-area-inset-top))' }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={`transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Yangi avlod Marva POS tizimi
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold leading-tight mb-6">
              <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                Do&apos;koningizni
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                raqamlashtiring
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-blue-200/70 max-w-2xl mx-auto leading-relaxed mb-10 px-2">
              Sotuv, ombor, xodimlar va hisobotlarni bitta tizimdan boshqaring.
              Tez, qulay va ishonchli POS yechimi.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="group px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl font-semibold text-base sm:text-lg shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all hover:scale-105 flex items-center justify-center gap-2 w-full sm:w-auto">
                Bepul boshlash
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link href="/login" className="px-6 sm:px-8 py-3 sm:py-4 border border-white/10 hover:border-white/30 rounded-2xl font-medium text-blue-200 hover:text-white backdrop-blur-sm transition-all hover:bg-white/5 text-center w-full sm:w-auto">
                Tizimga kirish
              </Link>
            </div>
          </div>

          {/* Mockup */}
          <div className={`mt-16 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-20'}`}>
            <div className="relative mx-auto max-w-3xl">
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 rounded-3xl blur-2xl" />
              <div className="relative bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <div className="w-3 h-3 rounded-full bg-green-400/80" />
                  <span className="ml-3 text-xs text-white/30 font-mono">marvapos.uz — Dashboard</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                  {[
                    { label: 'Bugungi sotuv', val: "12,450,000 so'm", color: 'from-blue-500 to-blue-600' },
                    { label: 'Sotilgan tovar', val: '147 ta', color: 'from-green-500 to-emerald-600' },
                    { label: 'Mijozlar', val: '38 ta', color: 'from-purple-500 to-violet-600' },
                    { label: 'Foyda', val: "3,200,000 so'm", color: 'from-cyan-500 to-teal-600' },
                  ].map((item, i) => (
                    <div key={i} className={`bg-gradient-to-br ${item.color} rounded-xl p-2 sm:p-3 text-left`}>
                      <p className="text-[9px] sm:text-[10px] text-white/70">{item.label}</p>
                      <p className="text-xs sm:text-sm font-bold mt-1">{item.val}</p>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:grid grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="w-full h-2 bg-white/10 rounded mb-2" />
                      <div className="w-2/3 h-2 bg-white/5 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={i} className="text-center group">
                <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent group-hover:scale-110 transition-transform">
                  {s.value}
                </div>
                <p className="text-sm text-blue-200/50 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              Barcha kerakli imkoniyatlar
            </h2>
            <p className="text-blue-200/50 max-w-xl mx-auto">
              Do&apos;koningizni samarali boshqarish uchun zarur bo&apos;lgan barcha vositalar
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-6 h-6 text-blue-300" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-blue-200/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="relative py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-purple-500/10 rounded-3xl blur-xl" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-10 md:p-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                Hoziroq boshlang — <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">bepul!</span>
              </h2>
              <p className="text-blue-200/50 mb-8 max-w-lg mx-auto">
                14 kunlik sinov muddati. Bank kartasi talab qilinmaydi.
                Istalgan vaqtda tarifni oshiring yoki bekor qiling.
              </p>
              <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl font-semibold text-lg shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/50 transition-all hover:scale-105">
                Bepul ro&apos;yxatdan o&apos;tish
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-sm font-bold">M</div>
            <span className="text-sm text-white/50">© 2026 Marva POS. Barcha huquqlar himoyalangan.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <Link href="/login" className="hover:text-white transition-colors">Kirish</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Ro&apos;yxatdan o&apos;tish</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
