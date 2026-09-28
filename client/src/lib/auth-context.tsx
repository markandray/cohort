'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch, setAccessToken, refreshAccessToken } from './api-client';

interface User {
  id: string;
  role: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signup: (email: string, password: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On app load: try to silently refresh using the httpOnly cookie.
  useEffect(() => {
    async function tryRestoreSession() {
      const token = await refreshAccessToken();
      if (token) {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser({ id: data.user.userId, role: data.user.role });
        }
      }
      setIsLoading(false);
    }
    tryRestoreSession();
  }, []);

  async function signup(email: string, password: string, name: string) {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Signup failed');
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function login(email: string, password: string) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}