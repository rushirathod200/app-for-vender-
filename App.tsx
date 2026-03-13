import * as Notifications from 'expo-notifications';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, StatusBar as NativeStatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from './src/config/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationTapProvider, useNotificationTap } from './src/context/NotificationTapContext';
import { StyledLoginScreen } from './src/features/auth/StyledLoginScreen';
import { DeliveryWorkspace } from './src/features/delivery/DeliveryWorkspace';
import { VendorWorkspace } from './src/features/vendor/VendorWorkspace';

function NotificationListener() {
  const { handleNotificationTap } = useNotificationTap();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      const orderId = data?.order_id;
      handleNotificationTap(
        typeof orderId === 'number' ? orderId : typeof orderId === 'string' ? parseInt(orderId, 10) : null
      );
    });

    return () => subscription.remove();
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
  return (
    <SafeAreaProvider>
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

const androidTopInset = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 0 : 0;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: androidTopInset,
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
