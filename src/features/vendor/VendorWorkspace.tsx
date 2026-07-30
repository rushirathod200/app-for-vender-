import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationOrderAction, useNotificationTap } from '../../context/NotificationTapContext';
import { useVendorApp, VendorAppProvider } from '../../context/VendorAppContext';
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
import { ConnectionUnavailableModal } from '../shared/ConnectionUnavailableModal';
import { tokens } from '../shared/tokens';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';

export function VendorWorkspace() {
  return (
    <VendorAppProvider>
      <VendorWorkspaceContent />
    </VendorAppProvider>
  );
}

function VendorWorkspaceContent() {
  const [tabHistory, setTabHistory] = useState<VendorTabKey[]>(['dashboard']);
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const [notificationTapRequestId, setNotificationTapRequestId] = useState(0);
  const [notificationAction, setNotificationAction] = useState<NotificationOrderAction>(null);
  const [notificationReason, setNotificationReason] = useState<string | null>(null);
  const [notificationHandledExternally, setNotificationHandledExternally] = useState(false);
  const { registerHandler } = useNotificationTap();
  const {
    connectionUnavailable,
    isLoading,
    refreshAll,
  } = useVendorApp();
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
    return registerHandler(({ orderId, action, reason, handledExternally, requestId }) => {
      navigateToTab('orders');
      setHighlightedOrderId(orderId);
      setNotificationAction(action);
      setNotificationReason(reason);
      setNotificationHandledExternally(handledExternally);
      setNotificationTapRequestId(requestId);
    });
  }, [registerHandler]);

  useEffect(() => {
    if (!connectionUnavailable) {
      return;
    }

    const retry = (): void => {
      if (!isLoading) {
        void refreshAll({ force: true });
      }
    };

    // Android can launch before mobile data/Wi-Fi is fully ready. Retry the
    // actual API (not just the network flag) and dismiss the modal only after
    // the API succeeds.
    const retryTimer = setInterval(retry, 5_000);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        retry();
      }
    });

    return () => {
      clearInterval(retryTimer);
      appStateSubscription.remove();
    };
  }, [connectionUnavailable, isLoading, refreshAll]);

  return (
    <>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
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
              notificationAction={notificationAction}
              notificationReason={notificationReason}
              notificationHandledExternally={notificationHandledExternally}
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

      <ConnectionUnavailableModal
        visible={connectionUnavailable}
        isRetrying={isLoading}
        onRetry={() => {
          void refreshAll({ force: true });
        }}
      />
    </>
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
