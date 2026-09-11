'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, X } from 'lucide-react';
import type { UserRole } from '@/lib/auth';
import {
  drawerGroups,
  filterGroupsByRole,
  isRouteActive,
  getRoleLabel,
} from '@/lib/navigation';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  user: { fullName?: string; username: string; role: UserRole } | null;
  onLogout: () => void;
}

export default function MobileDrawer({ open, onClose, user, onLogout }: MobileDrawerProps) {
  const pathname = usePathname();
  const role = (user?.role ?? 'CASHIER') as UserRole;
  const groups = filterGroupsByRole(drawerGroups, role);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, handleKeyDown]);

  // Close on route change
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-gray-900 text-white flex flex-col transition-transform duration-300 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigatsiya menyusi"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold">Marva POS</h2>
            {user && (
              <p className="text-xs text-gray-400 mt-0.5">
                {user.fullName || user.username} · {getRoleLabel(role)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition"
            aria-label="Menyuni yopish"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-3 mb-1">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition tap-highlight-none ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800 active:bg-gray-700'
                      }`}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer - Logout */}
        <div className="px-3 py-3 border-t border-gray-700">
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition tap-highlight-none"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Chiqish</span>
          </button>
        </div>
      </aside>
    </>
  );
}
