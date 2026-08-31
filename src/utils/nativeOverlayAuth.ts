import { NativeModules, Platform } from 'react-native';

import { API_BASE_URL } from '../config/api';

type DeskDropNativeAuthModule = {
  save?: (token: string, apiBaseUrl: string, role: 'vendor' | 'delivery') => Promise<void>;
  clear?: () => Promise<void>;
};

const nativeAuth = NativeModules.DeskDropNativeAuth as DeskDropNativeAuthModule | undefined;

export async function saveNativeOverlayAuth(
  token: string,
  role: 'vendor' | 'delivery',
): Promise<void> {
  if (Platform.OS !== 'android' || !nativeAuth?.save) {
    return;
  }

  await nativeAuth.save(token, API_BASE_URL, role);
}

export async function clearNativeOverlayAuth(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeAuth?.clear) {
    return;
  }

  await nativeAuth.clear();
}
