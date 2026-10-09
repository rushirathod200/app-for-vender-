import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorTabKey } from '../../types/workflow';
import { tokens } from '../shared/tokens';

interface VendorSidebarSheetProps {
  visible: boolean;
  activeTab: VendorTabKey;
  title: string;
  subtitle: string;
  canTopUpCustomerWallet: boolean;
  onClose: () => void;
  onSelectTab: (tab: VendorTabKey) => void;
}

const menuItems: Array<{
  key: VendorTabKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
}> = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', subtitle: 'Overview and live stats' },
  { key: 'analytics', label: 'Business Analytics', icon: 'trending-up-outline', subtitle: 'Demand, visitors, searches & insights' },
  { key: 'orders', label: 'Orders', icon: 'receipt-outline', subtitle: 'Check active and completed orders' },
  { key: 'products', label: 'Products', icon: 'cube-outline', subtitle: 'Manage live menu items' },
  { key: 'delivery', label: 'Delivery Boys', icon: 'bicycle-outline', subtitle: 'Manage delivery partners' },
  { key: 'wallet', label: 'Customer Top-up', icon: 'wallet-outline', subtitle: 'Add funds usable only at your store' },
  { key: 'manual', label: 'Manual Orders', icon: 'create-outline', subtitle: 'Add tea and coffee entry for offices' },
  { key: 'reports', label: 'Reports', icon: 'bar-chart-outline', subtitle: 'Pending office tea and coffee report' },
  { key: 'profile', label: 'Vendor Profile', icon: 'person-outline', subtitle: 'Store details and settings' },
];

export function VendorSidebarSheet({
  visible,
  activeTab,
  title,
  subtitle,
  canTopUpCustomerWallet,
  onClose,
  onSelectTab,
}: VendorSidebarSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={[styles.panel, { paddingTop: Math.max(insets.top, 14) + 14 }]}>
          <View style={styles.header}>
            <Text style={styles.headerEyebrow}>Vendor Menu</Text>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {title}
            </Text>
            <Text numberOfLines={2} style={styles.headerSubtitle}>
              {subtitle}
            </Text>
          </View>

          {/* The list is taller than the panel once every shortcut is shown,
              so it scrolls while the header stays put. */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={[styles.menuList, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
            showsVerticalScrollIndicator={false}
          >
            {menuItems.filter((item) => item.key !== 'wallet' || canTopUpCustomerWallet).map((item) => {
              const isActive = item.key === activeTab;

              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    onSelectTab(item.key);
                    onClose();
                  }}
                  style={[styles.menuItem, isActive ? styles.menuItemActive : null]}
                >
                  <View style={[styles.menuIconWrap, isActive ? styles.menuIconWrapActive : null]}>
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isActive ? '#ffffff' : tokens.colors.vendorPrimary}
                    />
                  </View>
                  <View style={styles.menuBody}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#b0b0ba" />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
    justifyContent: 'flex-start',
  },
  panel: {
    width: '84%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
  header: {
    borderRadius: 18,
    backgroundColor: tokens.colors.vendorPrimary,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerEyebrow: {
    color: '#ffe3cf',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 4,
    color: '#fff3eb',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  menuScroll: {
    flex: 1,
    marginTop: 16,
  },
  menuList: {
    gap: 10,
  },
  menuItem: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececf0',
    backgroundColor: '#f8f8fa',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuItemActive: {
    borderColor: '#ffc28d',
    backgroundColor: '#fff3e8',
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff0e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrapActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  menuBody: {
    flex: 1,
  },
  menuLabel: {
    color: '#202026',
    fontSize: 14,
    fontWeight: '800',
  },
  menuSubtitle: {
    marginTop: 2,
    color: '#8a8a94',
    fontSize: 12,
    fontWeight: '600',
  },
});
