import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AppWorkflowProvider, useAppWorkflow } from './src/context/AppWorkflowContext';
import { StyledLoginScreen } from './src/features/auth/StyledLoginScreen';
import { DeliveryOrdersScreen } from './src/features/delivery/DeliveryOrdersScreen';
import { tokens } from './src/features/shared/tokens';
import { VendorWorkspace } from './src/features/vendor/VendorWorkspace';

function AppBody() {
  const { isAuthenticated, role } = useAppWorkflow();

  if (!isAuthenticated || !role) {
    return <StyledLoginScreen />;
  }

  if (role === 'vendor') {
    return <VendorWorkspace />;
  }

  return <DeliveryOrdersScreen />;
}

export default function App() {
  return (
    <AppWorkflowProvider>
      <View style={styles.root}>
        <AppBody />
        <StatusBar style="dark" />
      </View>
    </AppWorkflowProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
});
