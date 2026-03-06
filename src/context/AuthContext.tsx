import React, { createContext, useContext, useMemo, useState } from 'react';

import { fetchCurrentAuthUser, sendOtp, verifyOtp } from '../api/authApi';
import { apiClient } from '../api/httpClient';
import { AuthUser, SendOtpResult } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  sendOtpCode: (mobile: string) => Promise<SendOtpResult>;
  verifyOtpCode: (mobile: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const sendOtpCode = async (mobile: string): Promise<SendOtpResult> => {
    return sendOtp(mobile);
  };

  const verifyOtpCode = async (mobile: string, code: string): Promise<void> => {
    const result = await verifyOtp(mobile, code);
    let resolvedUser = result.user;

    if (!resolvedUser) {
      try {
        resolvedUser = await fetchCurrentAuthUser();
      } catch {
        // Some backends return only token and no user profile endpoint.
      }
    }

    if (resolvedUser && resolvedUser.role !== 'vendor') {
      throw new Error('This app only allows vendor accounts.');
    }

    if (!resolvedUser && !result.token) {
      throw new Error('Login succeeded but no user/token was returned by API.');
    }

    setUser(resolvedUser);
    setToken(result.token);
    apiClient.setToken(result.token);
  };

  const logout = (): void => {
    setUser(null);
    setToken(null);
    apiClient.setToken(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user || token),
      sendOtpCode,
      verifyOtpCode,
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
