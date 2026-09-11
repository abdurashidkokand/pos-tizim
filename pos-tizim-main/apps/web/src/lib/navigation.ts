import type { UserRole } from '@/lib/auth';
import {
  ShoppingCart,
  BarChart3,
  Package,
  Warehouse,
  ClipboardList,
  Wallet,
  Users,
  Gift,
  TrendingUp,
  LineChart,
  UserCog,
  CreditCard,
  Settings,
  Building2,
  Bot,
  type LucideIcon,
} from 'lucide-react';

export type { LucideIcon };

export interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string; // shorter label for bottom nav
  icon: LucideIcon;
  minRole?: UserRole;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ROLE_LEVEL: Record<UserRole, number> = {
  CASHIER: 1,
  MANAGER: 2,
  ADMIN: 3,
  OWNER: 4,
  SUPERADMIN: 5,
};

// ── All navigation items ──────────────────────────────────
export const allNavItems: NavItem[] = [
  { href: '/pos',            label: 'POS Kassa',     mobileLabel: 'Kassa',    icon: ShoppingCart },
  { href: '/dashboard',      label: 'Dashboard',     icon: BarChart3,   minRole: 'MANAGER' },
  { href: '/products',       label: 'Mahsulotlar',   mobileLabel: 'Mahsulot', icon: Package,     minRole: 'MANAGER' },
  { href: '/inventory',      label: 'Ombor',         icon: Warehouse,   minRole: 'MANAGER' },
  { href: '/sales',          label: 'Sotuvlar',      icon: ClipboardList, minRole: 'MANAGER' },
  { href: '/cash-sessions',  label: 'Kassa Sessiya', mobileLabel: 'Sessiya',  icon: Wallet },
  { href: '/customers',      label: 'Mijozlar',      icon: Users,       minRole: 'MANAGER' },
  { href: '/cashback',       label: 'Cashback',      icon: Gift,        minRole: 'MANAGER' },
  { href: '/reports/daily',  label: 'Hisobot',       icon: TrendingUp,  minRole: 'MANAGER' },
  { href: '/reports/profit', label: 'Foyda',         icon: LineChart,   minRole: 'ADMIN' },
  { href: '/settings/users', label: 'Hodimlar',      icon: UserCog,     minRole: 'ADMIN' },
  { href: '/billing',               label: 'Tarif',               icon: CreditCard,  minRole: 'OWNER' },
  { href: '/settings',              label: 'Sozlamalar',          icon: Settings,    minRole: 'ADMIN' },
  { href: '/settings/telegram',     label: 'Telegram Sozlamalari', icon: Bot,         minRole: 'OWNER' },
  { href: '/platform',              label: 'Platform',            icon: Building2,   minRole: 'SUPERADMIN' },
  { href: '/platform/bot-settings', label: 'Bot Sozlamalari',     icon: Bot,         minRole: 'SUPERADMIN' },
];

// ── Mobile bottom nav items (max 5, primary actions) ──────
export const bottomNavItems: NavItem[] = [
  { href: '/pos',           label: 'Kassa',    icon: ShoppingCart },
  { href: '/products',      label: 'Mahsulot', icon: Package,      minRole: 'MANAGER' },
  { href: '/sales',         label: 'Sotuvlar', icon: ClipboardList, minRole: 'MANAGER' },
  { href: '/customers',     label: 'Mijozlar', icon: Users,        minRole: 'MANAGER' },
  { href: '/cash-sessions', label: 'Sessiya',  icon: Wallet },
];

// ── Drawer groups (logically organized for mobile) ────────
export const drawerGroups: NavGroup[] = [
  {
    title: 'Asosiy',
    items: [
      { href: '/pos',           label: 'POS Kassa',     icon: ShoppingCart },
      { href: '/dashboard',     label: 'Dashboard',     icon: BarChart3,    minRole: 'MANAGER' },
      { href: '/cash-sessions', label: 'Kassa Sessiya', icon: Wallet },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { href: '/products',  label: 'Mahsulotlar', icon: Package,       minRole: 'MANAGER' },
      { href: '/inventory', label: 'Ombor',       icon: Warehouse,     minRole: 'MANAGER' },
      { href: '/sales',     label: 'Sotuvlar',    icon: ClipboardList, minRole: 'MANAGER' },
    ],
  },
  {
    title: 'Mijozlar',
    items: [
      { href: '/customers', label: 'Mijozlar', icon: Users, minRole: 'MANAGER' },
      { href: '/cashback',  label: 'Cashback', icon: Gift,  minRole: 'MANAGER' },
    ],
  },
  {
    title: 'Hisobotlar',
    items: [
      { href: '/reports/daily',  label: 'Kunlik hisobot', icon: TrendingUp, minRole: 'MANAGER' },
      { href: '/reports/profit', label: 'Foyda hisobot',  icon: LineChart,  minRole: 'ADMIN' },
    ],
  },
  {
    title: 'Tizim',
    items: [
      { href: '/settings/users',    label: 'Hodimlar',               icon: UserCog,    minRole: 'ADMIN' },
      { href: '/billing',            label: 'Tarif',                  icon: CreditCard, minRole: 'OWNER' },
      { href: '/settings',           label: 'Sozlamalar',             icon: Settings,   minRole: 'ADMIN' },
      { href: '/settings/telegram',  label: 'Telegram Sozlamalari',   icon: Bot,        minRole: 'OWNER' },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/platform', label: 'Platform', icon: Building2, minRole: 'SUPERADMIN' },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────
export function filterByRole(items: NavItem[], role: UserRole): NavItem[] {
  if (role === 'SUPERADMIN') {
    return items.filter((item) => item.href === '/platform' || item.href === '/settings');
  }
  const userLevel = ROLE_LEVEL[role] ?? 1;
  return items.filter((item) => {
    if (!item.minRole) return true;
    return userLevel >= ROLE_LEVEL[item.minRole];
  });
}

export function filterGroupsByRole(groups: NavGroup[], role: UserRole): NavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: filterByRole(group.items, role),
    }))
    .filter((group) => group.items.length > 0);
}

export function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/settings') return pathname === '/settings';
  return pathname === href || pathname.startsWith(href + '/');
}

export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    SUPERADMIN: 'Super Admin',
    OWNER: 'Egasi',
    ADMIN: 'Admin',
    MANAGER: 'Menejer',
    CASHIER: 'Kassir',
  };
  return labels[role] || role;
}
