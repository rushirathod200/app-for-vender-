import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const RELOAD_DELAY_MS = 400;

function reloadIntoDownloadedUpdate(): void {
  // Let the native Alert finish dismissing before expo-updates replaces the
  // React Native bridge. Some Android builds otherwise ignore the reload.
  setTimeout(() => {
    void Updates.reloadAsync().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(
        'Restart Failed',
        `${message}\n\nPlease fully close DeskDrop Vendor and open it again to apply the downloaded update.`,
      );
    });
  }, RELOAD_DELAY_MS);
}

export function ExpoOtaUpdateChecker() {
  const { downloadedUpdate, isUpdatePending } = Updates.useUpdates();
  const lastCheckedAtRef = useRef(0);
  const checkingRef = useRef(false);
  const promptedUpdateIdRef = useRef<string | null>(null);

  const promptToRestart = useCallback((updateId?: string): void => {
    const promptKey = updateId ?? 'pending-update';
    if (promptedUpdateIdRef.current === promptKey) {
      return;
    }

    promptedUpdateIdRef.current = promptKey;
    Alert.alert(
      'App Update Ready',
      'A new DeskDrop Vendor update has been downloaded. Restart the app to apply it.',
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            promptedUpdateIdRef.current = null;
          },
        },
        {
          text: 'Restart Now',
          onPress: reloadIntoDownloadedUpdate,
        },
      ],
      { cancelable: false },
    );
  }, []);

  const checkForUpdate = useCallback(async (force = false): Promise<void> => {
    if (__DEV__ || !Updates.isEnabled || checkingRef.current) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastCheckedAtRef.current < CHECK_INTERVAL_MS) {
      return;
    }

    checkingRef.current = true;
    lastCheckedAtRef.current = now;

    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        return;
      }

      const downloaded = await Updates.fetchUpdateAsync();
      const downloadedUpdateId = 'manifest' in downloaded && downloaded.manifest
        ? downloaded.manifest.id
        : undefined;
      promptToRestart(typeof downloadedUpdateId === 'string' ? downloadedUpdateId : undefined);
    } catch {
      // OTA checks must never interrupt normal app usage when the device is offline.
    } finally {
      checkingRef.current = false;
    }
  }, [promptToRestart]);

  useEffect(() => {
    void checkForUpdate(true);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void checkForUpdate(false);
      }
    });

    return () => subscription.remove();
  }, [checkForUpdate]);

  useEffect(() => {
    if (!isUpdatePending) {
      return;
    }

    const updateId = downloadedUpdate && 'updateId' in downloadedUpdate
      ? downloadedUpdate.updateId
      : undefined;
    promptToRestart(updateId);
  }, [downloadedUpdate, isUpdatePending, promptToRestart]);

  return null;
}
