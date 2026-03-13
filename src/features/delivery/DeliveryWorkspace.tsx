import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeliveryAppProvider } from '../../context/DeliveryAppContext';
import { useNotificationTap } from '../../context/NotificationTapContext';
import { tokens } from '../shared/tokens';
import { DeliveryManualOrderScreen } from './DeliveryManualOrderScreen';
import { DeliveryOrdersScreen } from './DeliveryOrdersScreen';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';

export function DeliveryWorkspace() {
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const [notificationTapRequestId, setNotificationTapRequestId] = useState(0);
  const [screenHistory, setScreenHistory] = useState<Array<'orders' | 'manual'>>(['orders']);
  const { registerHandler } = useNotificationTap();
  const activeScreen = screenHistory[screenHistory.length - 1];

  function navigateToScreen(nextScreen: 'orders' | 'manual'): void {
    setScreenHistory((currentHistory) => {
      if (currentHistory[currentHistory.length - 1] === nextScreen) {
        return currentHistory;
      }

      return [...currentHistory, nextScreen];
    });
  }

  function goBack(): boolean {
    let handled = true;

    setScreenHistory((currentHistory) => {
      if (currentHistory.length <= 1) {
        return currentHistory;
      }

      return currentHistory.slice(0, -1);
    });

    return handled;
  }

  useAndroidBackHandler(() => goBack(), { priority: 0 });

  useEffect(() => {
    return registerHandler(({ orderId, requestId }) => {
      navigateToScreen('orders');
      setHighlightedOrderId(orderId);
      setNotificationTapRequestId(requestId);
    });
  }, [registerHandler]);

  return (
    <DeliveryAppProvider>
      <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
        {activeScreen === 'orders' ? (
          <DeliveryOrdersScreen
            highlightedOrderId={highlightedOrderId}
            notificationTapRequestId={notificationTapRequestId}
            onHighlightedOrderIdChange={setHighlightedOrderId}
            onOpenManualOrders={() => navigateToScreen('manual')}
          />
        ) : (
          <DeliveryManualOrderScreen onBack={() => { goBack(); }} />
        )}
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
