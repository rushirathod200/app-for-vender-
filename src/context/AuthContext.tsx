import * as Device from 'expo-device';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { fetchCurrentAuthUser, loginWithEmailPassword, logoutCurrentSession } from '../api/authApi';
import { registerDeliveryDeviceToken, registerVendorDeviceToken } from '../api/deviceTokenApi';
import { apiClient } from '../api/httpClient';
import { AuthUser } from '../types/auth';
import {
  clearStoredAuth,
  getStoredAuthToken,
  setStoredAuthToken,
  setStoredAuthUser,
} from '../utils/secureStorage';
import {
  addPushTokenRefreshListener,
  getCurrentPushTokenAsync,
  registerForPushNotificationsAsync,
} from '../utils/pushNotifications';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isRestoringSession: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

function logPushRegistrationError(error: unknown): void {
  if (__DEV__) {
    console.warn('Push token registration failed', error);
  }
}

async function registerPushTokenIfAvailable(
  role: 'vendor' | 'delivery',
  tokenOverride?: string,
): Promise<void> {
  const token = tokenOverride ?? (await registerForPushNotificationsAsync());
  if (!token) return;
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const deviceName = Device.modelName ?? undefined;

  if (role === 'vendor') {
    await registerVendorDeviceToken({ token, platform, device_name: deviceName });
  } else {
    await registerDeliveryDeviceToken({ token, platform, device_name: deviceName });
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const logout = useCallback((): void => {
    const currentToken = token;
    const currentUser = user;

    void (async () => {
      try {
        if (
          currentToken
          && currentUser
          && (currentUser.role === 'vendor' || currentUser.role === 'delivery')
        ) {
          apiClient.setToken(currentToken);

          const deviceToken = await getCurrentPushTokenAsync();
          await logoutCurrentSession({
            deviceToken,
          });
        } else if (currentToken) {
          apiClient.setToken(currentToken);
          await logoutCurrentSession();
        }
      } catch {
        // Local logout should still complete even if the API call fails.
      } finally {
        setUser(null);
        setToken(null);
        apiClient.setToken(null);
        await clearStoredAuth();
      }
    })();
  }, [token, user]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      const storedToken = await getStoredAuthToken();

      if (cancelled) return;

      if (!storedToken || !storedToken.trim()) {
        setIsRestoringSession(false);
        return;
      }

      apiClient.setToken(storedToken);

      try {
        const freshUser = await fetchCurrentAuthUser();
        if (cancelled) return;

        if (freshUser && (freshUser.role === 'vendor' || freshUser.role === 'delivery')) {
          setToken(storedToken);
          setUser(freshUser);
          await setStoredAuthUser(JSON.stringify(freshUser));
          if (Platform.OS === 'android') {
            registerPushTokenIfAvailable(freshUser.role).catch(logPushRegistrationError);
          }
        } else {
          void clearStoredAuth();
          apiClient.setToken(null);
        }
      } catch {
        if (cancelled) return;
        void clearStoredAuth();
        apiClient.setToken(null);
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

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

    await Promise.all([
      setStoredAuthToken(result.token),
      setStoredAuthUser(JSON.stringify(resolvedUser)),
    ]);

    if (Platform.OS === 'android') {
      registerPushTokenIfAvailable(resolvedUser.role).catch(logPushRegistrationError);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'android' || !user || !token) {
      return;
    }

    if (user.role !== 'vendor' && user.role !== 'delivery') {
      return;
    }

    const userRole = user.role;

    const subscription = addPushTokenRefreshListener((nextToken) => {
      registerPushTokenIfAvailable(userRole, nextToken).catch(logPushRegistrationError);
    });

    return () => subscription?.remove();
  }, [token, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isRestoringSession,
      login,
      logout,
    }),
    [token, user, isRestoringSession, logout],
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
