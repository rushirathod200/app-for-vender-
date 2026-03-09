import { Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'cafe_auth_token';
const AUTH_USER_KEY = 'cafe_auth_user';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function getStoredAuthToken(): Promise<string | null> {
  return getItem(AUTH_TOKEN_KEY);
}

export async function setStoredAuthToken(token: string): Promise<void> {
  await setItem(AUTH_TOKEN_KEY, token);
}

export async function getStoredAuthUser(): Promise<string | null> {
  return getItem(AUTH_USER_KEY);
}

export async function setStoredAuthUser(userJson: string): Promise<void> {
  await setItem(AUTH_USER_KEY, userJson);
}

export async function clearStoredAuth(): Promise<void> {
  await Promise.all([removeItem(AUTH_TOKEN_KEY), removeItem(AUTH_USER_KEY)]);
}
