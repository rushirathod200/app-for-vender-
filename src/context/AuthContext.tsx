import React, { createContext, useContext, useMemo, useState } from 'react';

import { fetchCurrentAuthUser, loginWithEmailPassword, logoutCurrentSession } from '../api/authApi';
import { apiClient } from '../api/httpClient';
import { AuthUser } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = async (input: { email: string; password: string }): Promise<void> => {
    const result = await loginWithEmailPassword(input);
    let resolvedUser = result.user;

    if (!resolvedUser) {
      try {
        resolvedUser = await fetchCurrentAuthUser();
      } catch {
        // Login response may already contain everything the app needs.
      }
    }

    if (!result.token) {
      throw new Error('Login succeeded but no token was returned by API.');
    }

    if (!resolvedUser) {
      throw new Error('Login succeeded but no user was returned by API.');
    }

    if (resolvedUser.role !== 'vendor' && resolvedUser.role !== 'delivery') {
      throw new Error('This app only allows vendor or delivery accounts.');
    }

    setUser(resolvedUser);
    setToken(result.token);
    apiClient.setToken(result.token);
  };

  const logout = (): void => {
    if (token) {
      void logoutCurrentSession().catch(() => undefined);
    }

    setUser(null);
    setToken(null);
    apiClient.setToken(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      login,
      logout,
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
