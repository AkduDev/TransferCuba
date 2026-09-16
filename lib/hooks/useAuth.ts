'use client';

import { useCallback, useEffect, useState } from 'react';

export type AuthRole = 'USER' | 'BUSINESS' | 'MESSENGER' | 'ADMIN';

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  role: AuthRole;
  status: 'active' | 'blocked';
}

interface ApiResponse {
  success?: boolean;
  authenticated?: boolean;
  user?: AuthUser | null;
  error?: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (phone: string, pin: string) => Promise<boolean>;
  register: (name: string, phone: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// La autoridad es la cookie HttpOnly; este hook solo refleja el estado que
// expone /api/account/me (misma inspiración que AdminDashboardModal con
// /api/auth/me, pero por usuario real).
export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/account/me', { cache: 'no-store' });
      const data = (await res.json()) as ApiResponse;
      setUser(data.authenticated && data.user ? data.user : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (phone: string, pin: string) => {
    setError(null);
    try {
      const res = await fetch('/api/account/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin })
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.success) {
        setError(data.error ?? 'No se pudo iniciar sesión');
        return false;
      }
      setUser(data.user ?? null);
      return true;
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
      return false;
    }
  }, []);

  const register = useCallback(async (name: string, phone: string, pin: string) => {
    setError(null);
    try {
      const res = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, pin })
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.success) {
        setError(data.error ?? 'No se pudo completar el registro');
        return false;
      }
      setUser(data.user ?? null);
      return true;
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    try {
      await fetch('/api/account/logout', { method: 'POST' });
    } catch {
      // best-effort: el estado local se limpia igual
    }
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    error,
    login,
    register,
    logout,
    refresh
  };
}
