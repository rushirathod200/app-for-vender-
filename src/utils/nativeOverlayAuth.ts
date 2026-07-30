import { NativeModules, Platform } from 'react-native';

import { API_BASE_URL } from '../config/api';

type DeskDropNativeAuthModule = {
  save?: (token: string, apiBaseUrl: string) => Promise<void>;
  clear?: () => Promise<void>;
};

const nativeAuth = NativeModules.DeskDropNativeAuth as DeskDropNativeAuthModule | undefined;

export async function saveNativeOverlayAuth(token: string): Promise<void> {
  if (Platform.OS !== 'android' || !nativeAuth?.save) {
    return;
  }

  await nativeAuth.save(token, API_BASE_URL);
}

export async function clearNativeOverlayAuth(): Promise<void> {
  if (Platform.OS !== 'android' || !nativeAuth?.clear) {
    return;
  }

  await nativeAuth.clear();
}
