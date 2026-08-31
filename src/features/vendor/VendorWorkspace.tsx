import React, { useEffect, useState } from 'react';
import { AppState, Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationOrderAction, useNotificationTap } from '../../context/NotificationTapContext';
import { useVendorApp, VendorAppProvider } from '../../context/VendorAppContext';
import { VendorTabKey } from '../../types/workflow';
import { VendorDashboardScreen } from './VendorDashboardScreen';
import { VendorDeliveryPartnersScreen } from './VendorDeliveryPartnersScreen';
import { VendorManualOrderScreen } from './VendorManualOrderScreen';
import { VendorOrdersScreen } from './VendorOrdersScreen';
import { VendorProductsScreen } from './VendorProductsScreen';
import { VendorReferralScreen } from './VendorReferralScreen';
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
  const [activeTab, setActiveTab] = useState<VendorTabKey>('dashboard');
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const [notificationTapRequestId, setNotificationTapRequestId] = useState(0);
  const [notificationAction, setNotificationAction] = useState<NotificationOrderAction>(null);
  const [notificationReason, setNotificationReason] = useState<string | null>(null);
  const [notificationHandledExternally, setNotificationHandledExternally] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { registerHandler } = useNotificationTap();
  const {
    connectionUnavailable,
    isLoading,
    profile,
    refreshAll,
    user,
  } = useVendorApp();
  const canTopUpCustomerWallet = profile
    ? profile.can_top_up_customer_wallet
    : user?.can_top_up_customer_wallet === true;

  function navigateToTab(nextTab: VendorTabKey): void {
    if (nextTab === 'wallet' && !canTopUpCustomerWallet) {
      setActiveTab('dashboard');
      return;
    }

    setActiveTab(nextTab);
  }

  function goBack(): boolean {
    if (activeTab === 'dashboard') {
      return false;
    }

    setActiveTab('dashboard');
    return true;
  }

  useAndroidBackHandler(() => goBack(), { priority: 0 });

  useEffect(() => {
    if (activeTab === 'wallet' && !canTopUpCustomerWallet) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canTopUpCustomerWallet]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

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
          {activeTab === 'wallet' && canTopUpCustomerWallet ? (
            <VendorWalletTopUpScreen onBack={() => { goBack(); }} />
          ) : null}
          {activeTab === 'manual' ? <VendorManualOrderScreen /> : null}
          {activeTab === 'reports' ? <VendorReportsScreen onBack={() => { goBack(); }} /> : null}
          {activeTab === 'referral' ? <VendorReferralScreen /> : null}
          {activeTab === 'profile' ? <VendorProfileScreen onOpenReferral={() => { navigateToTab('referral'); }} /> : null}
        </View>

        {!keyboardVisible ? <VendorBottomTabs activeTab={activeTab} onPressTab={navigateToTab} /> : null}
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
