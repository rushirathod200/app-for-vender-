import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const NEW_ORDER_CATEGORY_ID = 'new_order';
export const NEW_ORDER_ACCEPT_ACTION = 'accept';
export const NEW_ORDER_REJECT_ACTION = 'reject';

let newOrderCategoryRegistered = false;

async function ensureNewOrderCategoryRegistered(): Promise<void> {
  if (newOrderCategoryRegistered || Platform.OS !== 'ios') {
    return;
  }

  try {
    await Notifications.setNotificationCategoryAsync(NEW_ORDER_CATEGORY_ID, [
      {
        identifier: NEW_ORDER_ACCEPT_ACTION,
        buttonTitle: 'Accept',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: NEW_ORDER_REJECT_ACTION,
        buttonTitle: 'Reject',
        options: {
          isDestructive: true,
          opensAppToForeground: true,
        },
      },
    ]);
    newOrderCategoryRegistered = true;
  } catch {
    // Category registration is best-effort; the notification still delivers
    // without the Accept/Reject actions if this fails.
  }
}

interface PushTokenSubscription {
  remove: () => void;
}

function platformName(): 'android' | 'ios' | null {
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return Platform.OS;
  }

  return null;
}

async function resolveAndroidPushToken(): Promise<string | null> {
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.type === 'android' && typeof tokenData.data === 'string' ? tokenData.data : null;
  } catch {
    return null;
  }
}

function resolveEasProjectId(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  if (fromEnv) return fromEnv;

  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
    ?? (Constants.easConfig as { projectId?: string } | undefined)?.projectId;

  return typeof fromConfig === 'string' && fromConfig.trim() ? fromConfig.trim() : undefined;
}

async function resolveIosPushToken(): Promise<string | null> {
  try {
    const projectId = resolveEasProjectId();
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    return typeof tokenData.data === 'string' && tokenData.data.length > 0 ? tokenData.data : null;
  } catch {
    return null;
  }
}

export async function getCurrentPushTokenAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    return resolveAndroidPushToken();
  }

  if (Platform.OS === 'ios') {
    return resolveIosPushToken();
  }

  return null;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const platform = platformName();

  if (!platform) {
    return null;
  }

  if (platform === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Orders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  if (platform === 'ios') {
    await ensureNewOrderCategoryRegistered();
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus !== 'granted') {
    try {
      await Notifications.requestPermissionsAsync();
    } catch {
      // Token registration can still succeed on Android even if notification permission is denied.
    }
  }

  return platform === 'android' ? resolveAndroidPushToken() : resolveIosPushToken();
}

export function addPushTokenRefreshListener(
  listener: (token: string) => void,
): PushTokenSubscription | null {
  if (Platform.OS !== 'android') {
    return null;
  }

  return Notifications.addPushTokenListener((tokenData) => {
    if (tokenData.type === 'android' && typeof tokenData.data === 'string') {
      listener(tokenData.data);
    }
  });
}
