import React, { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { DeliveryAppProvider } from '../../context/DeliveryAppContext';
import { useNotificationTap } from '../../context/NotificationTapContext';
import { tokens } from '../shared/tokens';
import { DeliveryOrdersScreen } from './DeliveryOrdersScreen';

export function DeliveryWorkspace() {
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const { registerHandler } = useNotificationTap();

  useEffect(() => {
    return registerHandler((orderId) => {
      setHighlightedOrderId(orderId);
    });
  }, [registerHandler]);

  return (
    <DeliveryAppProvider>
      <SafeAreaView style={styles.root}>
        <DeliveryOrdersScreen
          highlightedOrderId={highlightedOrderId}
          onHighlightedOrderIdChange={setHighlightedOrderId}
        />
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
