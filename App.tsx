import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from './src/config/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { StyledLoginScreen } from './src/features/auth/StyledLoginScreen';
import { DeliveryWorkspace } from './src/features/delivery/DeliveryWorkspace';
import { VendorWorkspace } from './src/features/vendor/VendorWorkspace';

function AppBody() {
  const { isAuthenticated, user } = useAuth();

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
    <AuthProvider>
      <View style={styles.root}>
        <AppBody />
        <StatusBar style="dark" />
      </View>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
