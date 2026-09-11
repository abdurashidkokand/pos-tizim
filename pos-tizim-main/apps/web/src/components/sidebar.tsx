'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout, getUser } from '@/lib/auth';
import type { UserRole } from '@/lib/auth';
import { LogOut } from 'lucide-react';
import {
  allNavItems,
  bottomNavItems,
  filterByRole,
  isRouteActive,
  getRoleLabel,
} from '@/lib/navigation';
import MobileDrawer from '@/components/mobile-drawer';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = mounted ? getUser() : null;
  const userRole = (user?.role ?? 'CASHIER') as UserRole;

  const navItems = useMemo(() => filterByRole(allNavItems, userRole), [userRole]);
  const mobileNavItems = useMemo(() => filterByRole(bottomNavItems, userRole), [userRole]);

  useEffect(() => { setMounted(true); }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push('/login');
  }, [router]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      {/* ── DESKTOP SIDEBAR (md+) ─────────────────────────────── */}
      <aside className="hidden md:flex w-56 min-h-screen bg-gray-900 text-white flex-col shrink-0">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold">Marva POS</h2>
          {user && (
            <p className="text-xs text-gray-400 mt-1">
              {user.fullName || user.username} · {getRoleLabel(userRole)}
            </p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = isRouteActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Chiqish
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR (< md) — hidden inside Telegram WebApp ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-30 bg-gray-900 text-white flex items-center justify-between px-4 mobile-header-hide-tg"
        style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: '8px' }}
      >
        <button
          onClick={openDrawer}
          className="flex items-center gap-2 tap-highlight-none active:opacity-70 transition"
          aria-label="Menyuni ochish"
        >
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm font-bold">Marva POS</span>
        </button>
        {user && (
          <span className="text-xs text-gray-400 truncate mx-2">
            {user.fullName || user.username}
          </span>
        )}
      </header>

      {/* ── MOBILE TOP BAR for Telegram — positioned below TG chrome ── */}
      <header
        className="md:hidden fixed left-0 right-0 z-30 bg-gray-900/90 backdrop-blur-sm text-white items-center justify-between px-4 py-1.5 hidden mobile-header-tg-only"
        style={{ top: 'var(--tg-chrome-h, 0px)' }}
      >
        <button
          onClick={openDrawer}
          className="flex items-center gap-2 tap-highlight-none active:opacity-70 transition"
          aria-label="Menyuni ochish"
        >
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm font-bold">Marva POS</span>
        </button>
        {user && (
          <span className="text-xs text-gray-300 truncate mx-2">
            {user.fullName || user.username}
          </span>
        )}
      </header>

      {/* ── MOBILE DRAWER ─────────────────────────────────────── */}
      <MobileDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        user={user}
        onLogout={handleLogout}
      />

      {/* ── MOBILE BOTTOM NAV (< md) ─────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-lg border-t border-gray-200/60 flex"
        style={{ paddingBottom: 'var(--safe-bottom)' }}
      >
        {mobileNavItems.map((item) => {
          const active = isRouteActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition tap-highlight-none ${
                active
                  ? 'text-blue-600'
                  : 'text-gray-500 active:text-blue-500'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-blue-600' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

