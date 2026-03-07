import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { DeliveryAppProvider } from '../../context/DeliveryAppContext';
import { tokens } from '../shared/tokens';
import { DeliveryOrdersScreen } from './DeliveryOrdersScreen';

export function DeliveryWorkspace() {
  return (
    <DeliveryAppProvider>
      <SafeAreaView style={styles.root}>
        <DeliveryOrdersScreen />
      </SafeAreaView>
    </DeliveryAppProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
});
