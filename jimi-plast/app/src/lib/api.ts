const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const TOKEN_KEY = 'jimiplast_access_token';
export const REFRESH_KEY = 'jimiplast_refresh_token';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type TokensUpdatedHandler = (accessToken: string | null) => void;
let onTokensUpdated: TokensUpdatedHandler | null = null;

export function setTokensUpdatedHandler(handler: TokensUpdatedHandler | null) {
  onTokensUpdated = handler;
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * L'access token expire au bout de 15 min (voir ACCESS_TOKEN_TTL côté API).
 * Sans ce rafraîchissement silencieux, toute session ouverte plus de 15 min
 * perd l'authentification au prochain appel — d'où les "erreurs réseau" et
 * déconnexions signalées après une pause.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('refresh failed');
        return res.json() as Promise<{ accessToken: string; refreshToken: string }>;
      })
      .then((data) => {
        localStorage.setItem(TOKEN_KEY, data.accessToken);
        localStorage.setItem(REFRESH_KEY, data.refreshToken);
        onTokensUpdated?.(data.accessToken);
        return data.accessToken;
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        onTokensUpdated?.(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
  retried = false,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && token && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(path, options, newToken, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? 'Erreur réseau');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET' }, token),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }, token),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }, token),
  delete: <T>(path: string, token?: string | null) => request<T>(path, { method: 'DELETE' }, token),
};
