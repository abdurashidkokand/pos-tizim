import { api } from './api';

export type UserRole = 'SUPERADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'CASHIER';

export interface AuthUser {
  id: string;
  username: string;
  fullName?: string;
  role: UserRole;
  tenantId?: string;
  branchId?: string;
}

export async function login(username: string, password: string) {
  const data = await api.post<{
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }>('/auth/login', { username, password });

  localStorage.setItem('access_token', data.accessToken);
  localStorage.setItem('refresh_token', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));

  // Middleware cookie'dan tekshiradi — shuning uchun cookie'ga ham yozamiz (7 kun)
  const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
  document.cookie = `access_token=${data.accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = `user_role=${data.user.role}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;

  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    // ignore
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  // Cookie'ni ham o'chirish
  document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
  document.cookie = 'user_role=; path=/; max-age=0; SameSite=Lax';
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('access_token');
}

export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  const data = await api.post<{ accessToken: string }>('/auth/refresh', {
    refreshToken,
  });
  const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
  localStorage.setItem('access_token', data.accessToken);
  document.cookie = `access_token=${data.accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  // Renew role cookie too
  const user = getUser();
  if (user) {
    document.cookie = `user_role=${user.role}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }
  return data.accessToken;
}
