// Client: relative URL → proxied through Next.js → backend (works with ngrok/any host)
// Server (SSR): absolute URL → direct call to backend
const API_BASE =
  typeof window !== 'undefined'
    ? '/api'
    : `${process.env.BACKEND_URL || 'http://localhost:3001'}/api`;

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
      localStorage.setItem('access_token', data.accessToken);
      document.cookie = `access_token=${data.accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const role = JSON.parse(user).role;
          document.cookie = `user_role=${role}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
        } catch {}
      }
      return data.accessToken as string;
    })
    .catch(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'user_role=; path=/; max-age=0; SameSite=Lax';
      return null;
    })
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });

  return refreshPromise;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, 'Server bilan bog\'lanib bo\'lmadi. Internet yoki server holatini tekshiring.');
  }

  // On 401, try to refresh the token and retry once
  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/refresh')) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...(init?.headers ?? {}),
        },
      });
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({ message: retryRes.statusText }));
        throw new ApiError(retryRes.status, err.message ?? 'Xato');
      }
      return retryRes.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = res.status === 500
      ? 'Server xatosi yuz berdi. Qayta urinib ko\'ring.'
      : (err.message ?? 'Xato');
    throw new ApiError(res.status, message);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
