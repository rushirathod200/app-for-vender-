import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNotificationTap } from '../../context/NotificationTapContext';
import { VendorAppProvider } from '../../context/VendorAppContext';
import { VendorTabKey } from '../../types/workflow';
import { VendorDashboardScreen } from './VendorDashboardScreen';
import { VendorDeliveryPartnersScreen } from './VendorDeliveryPartnersScreen';
import { VendorManualOrderScreen } from './VendorManualOrderScreen';
import { VendorOrdersScreen } from './VendorOrdersScreen';
import { VendorProductsScreen } from './VendorProductsScreen';
import { VendorProfileScreen } from './VendorProfileScreen';
import { VendorReportsScreen } from './VendorReportsScreen';
import { VendorWalletTopUpScreen } from './VendorWalletTopUpScreen';
import { VendorBottomTabs } from '../shared/ui';
import { tokens } from '../shared/tokens';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';

export function VendorWorkspace() {
  const [tabHistory, setTabHistory] = useState<VendorTabKey[]>(['dashboard']);
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const [notificationTapRequestId, setNotificationTapRequestId] = useState(0);
  const { registerHandler } = useNotificationTap();
  const activeTab = tabHistory[tabHistory.length - 1];

  function navigateToTab(nextTab: VendorTabKey): void {
    setTabHistory((currentHistory) => {
      if (currentHistory[currentHistory.length - 1] === nextTab) {
        return currentHistory;
      }

      return [...currentHistory, nextTab];
    });
  }

  function goBack(): boolean {
    let handled = true;

    setTabHistory((currentHistory) => {
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
      navigateToTab('orders');
      setHighlightedOrderId(orderId);
      setNotificationTapRequestId(requestId);
    });
  }, [registerHandler]);

  return (
    <VendorAppProvider>
      <SafeAreaView style={styles.root} edges={['left', 'right']}>
        <View style={styles.mainArea}>
          {activeTab === 'dashboard' ? (
            <VendorDashboardScreen
              onGoToTab={navigateToTab}
              onOpenOrderFromNotification={setHighlightedOrderId}
            />
          ) : null}
          {activeTab === 'orders' ? (
            <VendorOrdersScreen
              highlightedOrderId={highlightedOrderId}
              notificationTapRequestId={notificationTapRequestId}
            />
          ) : null}
          {activeTab === 'products' ? <VendorProductsScreen /> : null}
          {activeTab === 'delivery' ? <VendorDeliveryPartnersScreen /> : null}
          {activeTab === 'wallet' ? <VendorWalletTopUpScreen onBack={() => { goBack(); }} /> : null}
          {activeTab === 'manual' ? <VendorManualOrderScreen /> : null}
          {activeTab === 'reports' ? <VendorReportsScreen onBack={() => { goBack(); }} /> : null}
          {activeTab === 'profile' ? <VendorProfileScreen /> : null}
        </View>

        <VendorBottomTabs activeTab={activeTab} onPressTab={navigateToTab} />
      </SafeAreaView>
    </VendorAppProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
  mainArea: {
    flex: 1,
  },
});
