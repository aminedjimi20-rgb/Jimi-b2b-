'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, TOKEN_KEY, REFRESH_KEY, setTokensUpdatedHandler } from './api';

interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  role: { id: string; key: string; name: string };
  permissions: string[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (...keys: string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reçoit les tokens rafraîchis silencieusement par api.ts (access token
    // expiré en cours de session) pour garder le contexte React synchronisé.
    setTokensUpdatedHandler((newAccessToken) => {
      setToken(newAccessToken);
      if (!newAccessToken) setUser(null);
    });
    return () => setTokensUpdatedHandler(null);
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!stored) {
      setLoading(false);
      return;
    }
    api
      .get<CurrentUser>('/auth/me', stored)
      .then((me) => {
        // Ce call peut avoir déclenché un rafraîchissement silencieux
        // (access token expiré) : relire le token courant dans le storage
        // plutôt que d'utiliser `stored`, qui serait alors périmé.
        setUser(me);
        setToken(localStorage.getItem(TOKEN_KEY));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
      email,
      password,
    });
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    localStorage.setItem(REFRESH_KEY, result.refreshToken);
    const me = await api.get<CurrentUser>('/auth/me', result.accessToken);
    setToken(result.accessToken);
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }, token).catch(() => undefined);
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setUser(null);
    setToken(null);
  }, [token]);

  const hasPermission = useCallback(
    (...keys: string[]) => !!user && keys.every((k) => user.permissions.includes(k)),
    [user],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const me = await api.get<CurrentUser>('/auth/me', token);
    setUser(me);
  }, [token]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, hasPermission, refreshUser }),
    [user, token, loading, login, logout, hasPermission, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
