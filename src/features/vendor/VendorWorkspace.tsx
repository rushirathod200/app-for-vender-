import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { VendorAppProvider } from '../../context/VendorAppContext';
import { VendorTabKey } from '../../types/workflow';
import { VendorDashboardScreen } from './VendorDashboardScreen';
import { VendorDeliveryPartnersScreen } from './VendorDeliveryPartnersScreen';
import { VendorOrdersScreen } from './VendorOrdersScreen';
import { VendorProductsScreen } from './VendorProductsScreen';
import { VendorProfileScreen } from './VendorProfileScreen';
import { VendorBottomTabs } from '../shared/ui';
import { tokens } from '../shared/tokens';

export function VendorWorkspace() {
  const [activeTab, setActiveTab] = useState<VendorTabKey>('dashboard');

  return (
    <VendorAppProvider>
      <SafeAreaView style={styles.root}>
        <View style={styles.mainArea}>
          {activeTab === 'dashboard' ? <VendorDashboardScreen onGoToTab={setActiveTab} /> : null}
          {activeTab === 'orders' ? <VendorOrdersScreen /> : null}
          {activeTab === 'products' ? <VendorProductsScreen /> : null}
          {activeTab === 'delivery' ? <VendorDeliveryPartnersScreen /> : null}
          {activeTab === 'profile' ? <VendorProfileScreen /> : null}
        </View>

        <VendorBottomTabs activeTab={activeTab} onPressTab={setActiveTab} />
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
