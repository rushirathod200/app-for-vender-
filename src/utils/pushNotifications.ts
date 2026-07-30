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

async function resolveIosPushToken(): Promise<string | null> {
  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
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
