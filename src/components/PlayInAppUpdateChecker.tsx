import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { checkForPlayStoreUpdate } from '../utils/playInAppUpdates';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function PlayInAppUpdateChecker() {
  const lastCheckedAtRef = useRef(0);

  const checkForUpdate = useCallback(async (force = false): Promise<void> => {
    if (Platform.OS !== 'android') return;

    const now = Date.now();
    if (!force && now - lastCheckedAtRef.current < CHECK_INTERVAL_MS) return;

    lastCheckedAtRef.current = now;
    await checkForPlayStoreUpdate();
  }, []);

  useEffect(() => {
    void checkForUpdate(true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkForUpdate(false);
      }
    });

    return () => subscription.remove();
  }, [checkForUpdate]);

  return null;
}
