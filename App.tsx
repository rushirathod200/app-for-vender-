import * as Notifications from 'expo-notifications';
import * as Clarity from '@microsoft/react-native-clarity';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlayInAppUpdateChecker } from './src/components/PlayInAppUpdateChecker';
import { ExpoOtaUpdateChecker } from './src/components/ExpoOtaUpdateChecker';
import { theme } from './src/config/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import {
  NotificationOrderAction,
  NotificationTapProvider,
  useNotificationTap,
} from './src/context/NotificationTapContext';
import { StyledLoginScreen } from './src/features/auth/StyledLoginScreen';
import { DeliveryWorkspace } from './src/features/delivery/DeliveryWorkspace';
import { VendorWorkspace } from './src/features/vendor/VendorWorkspace';

function orderIdFromNotificationData(data: Record<string, unknown> | undefined): number | null {
  const rawOrderId = data?.order_id;
  const orderId = typeof rawOrderId === 'number'
    ? rawOrderId
    : typeof rawOrderId === 'string'
      ? parseInt(rawOrderId, 10)
      : null;

  return Number.isFinite(orderId) && orderId ? orderId : null;
}

function isOrderPopupNotification(data: Record<string, unknown> | undefined): boolean {
  const fullScreenOrder = data?.full_screen_order;
  const type = typeof data?.type === 'string' ? data.type : '';

  return fullScreenOrder === true
    || fullScreenOrder === 1
    || fullScreenOrder === '1'
    || fullScreenOrder === 'true'
    || type === 'order_placed';
}

function orderIdFromUrl(url: string): number | null {
  const match = url.match(/[?&]order_id=(\d+)/);

  if (!match?.[1]) {
    return null;
  }

  const orderId = parseInt(match[1], 10);
  return Number.isFinite(orderId) ? orderId : null;
}

function queryValueFromUrl(url: string, key: string): string | null {
  const match = url.match(new RegExp(`[?&]${key}=([^&#]*)`, 'i'));
  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {
    return match[1];
  }
}

function orderActionFromUrl(url: string): NotificationOrderAction {
  const action = queryValueFromUrl(url, 'action')?.toLowerCase();
  return action === 'accepted' || action === 'rejected' ? action : null;
}

function wasOrderHandledExternally(url: string): boolean {
  const handled = queryValueFromUrl(url, 'handled')?.toLowerCase();
  return handled === '1' || handled === 'true';
}

function NotificationListener() {
  const { handleNotificationTap } = useNotificationTap();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      handleNotificationTap(orderIdFromNotificationData(data));
    });

    const receiveSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      if (!isOrderPopupNotification(data)) {
        return;
      }

      handleNotificationTap(orderIdFromNotificationData(data));
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleNotificationTap(
        orderIdFromUrl(url),
        orderActionFromUrl(url),
        queryValueFromUrl(url, 'reason'),
        wasOrderHandledExternally(url),
      );
    });

    void Linking.getInitialURL().then((url) => {
      if (url) {
        handleNotificationTap(
          orderIdFromUrl(url),
          orderActionFromUrl(url),
          queryValueFromUrl(url, 'reason'),
          wasOrderHandledExternally(url),
        );
      }
    });

    return () => {
      responseSubscription.remove();
      receiveSubscription.remove();
      urlSubscription.remove();
    };
  }, [handleNotificationTap]);

  return null;
}

function AppBody() {
  const { isAuthenticated, user, isRestoringSession } = useAuth();

  if (isRestoringSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Restoring session...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !user) {
    return <StyledLoginScreen />;
  }

  if (user.role === 'delivery') {
    return <DeliveryWorkspace />;
  }

  return <VendorWorkspace />;
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    Clarity.initialize('xqb8a2d9ij', {
      logLevel: Clarity.LogLevel.None,
    });
  }, []);

  return (
    <SafeAreaProvider>
      <PlayInAppUpdateChecker />
      <ExpoOtaUpdateChecker />
      <AuthProvider>
        <NotificationTapProvider>
          <NotificationListener />
          <View style={styles.root}>
            <AppBody />
            <ExpoStatusBar style="dark" />
          </View>
        </NotificationTapProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: theme.colors.subtext,
    fontSize: 14,
    fontWeight: '600',
  },
});
