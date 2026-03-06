import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ModePill, SectionTitle, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';
import { VendorTabKey } from '../../types/workflow';

interface VendorDashboardScreenProps {
  onGoToTab: (tab: VendorTabKey) => void;
}

export function VendorDashboardScreen({ onGoToTab }: VendorDashboardScreenProps) {
  const { orders, products, deliveryPartners, isStoreOpen, setStoreOpen } = useAppWorkflow();

  const pendingCount = useMemo(() => orders.filter((order) => order.status === 'pending').length, [orders]);
  const completedCount = useMemo(() => orders.filter((order) => order.status === 'completed').length, [orders]);

  const stats = [
    {
      icon: 'document-text-outline' as const,
      value: orders.length,
      label: "Today's Orders",
      color: tokens.colors.vendorPrimary,
    },
    {
      icon: 'time-outline' as const,
      value: pendingCount,
      label: 'Pending',
      color: '#f59f0b',
    },
    {
      icon: 'checkmark-circle-outline' as const,
      value: completedCount,
      label: 'Completed',
      color: '#28c66f',
    },
  ];

  const activityRows = [
    `New order #${orders.find((item) => item.status === 'pending')?.id ?? 'ORD-1024'} received`,
    `Order #${orders.find((item) => item.status === 'completed')?.id ?? 'ORD-1022'} delivered`,
  ];

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Vendor — Dashboard" />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.greeting}>Good Morning 👋</Text>
              <Text style={styles.storeName}>Brewed Bliss Café</Text>
            </View>
            <Pressable style={styles.notificationButton}>
              <Ionicons name="notifications-outline" size={20} color="#ffffff" />
            </Pressable>
          </View>

          <View style={styles.statusCard}>
            <View>
              <Text style={styles.statusCardTitle}>Store Status</Text>
              <Text style={styles.statusCardSubtitle}>
                {isStoreOpen ? 'Accepting new orders' : 'Temporarily paused'}
              </Text>
            </View>
            <Pressable
              onPress={() => setStoreOpen(!isStoreOpen)}
              style={[styles.statusTogglePill, isStoreOpen ? styles.statusTogglePillOn : styles.statusTogglePillOff]}
            >
              <View style={[styles.statusDot, isStoreOpen ? styles.statusDotOn : styles.statusDotOff]} />
              <Text style={[styles.statusToggleText, isStoreOpen ? styles.statusToggleTextOn : styles.statusToggleTextOff]}>
                {isStoreOpen ? 'Online' : 'Offline'}
              </Text>
              <Ionicons
                name={isStoreOpen ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={isStoreOpen ? '#0ea95b' : '#c05b57'}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: `${stat.color}1A` }]}>
                <Ionicons name={stat.icon} size={18} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <SectionTitle title="Quick Actions" />

        <Pressable style={styles.quickActionCard} onPress={() => onGoToTab('orders')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#fff1e6' }]}>
            <Ionicons name="clipboard-outline" size={20} color={tokens.colors.vendorPrimary} />
          </View>
          <View style={styles.quickActionBody}>
            <Text style={styles.quickActionTitle}>View Orders</Text>
            <Text style={styles.quickActionSub}>{pendingCount} orders pending</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={() => onGoToTab('delivery')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#ecedff' }]}>
            <MaterialCommunityIcons name="bike-fast" size={20} color="#6a74f8" />
          </View>
          <View style={styles.quickActionBody}>
            <Text style={styles.quickActionTitle}>Delivery Boys</Text>
            <Text style={styles.quickActionSub}>{deliveryPartners.filter((item) => item.isActive).length} partners active</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={() => onGoToTab('products')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#e6f8ec' }]}>
            <Ionicons name="cube-outline" size={20} color="#28b162" />
          </View>
          <View style={styles.quickActionBody}>
            <Text style={styles.quickActionTitle}>Manage Products</Text>
            <Text style={styles.quickActionSub}>{products.length} products listed</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <SectionTitle title="Recent Activity" />

        <View style={styles.activityCard}>
          <View style={styles.activityRow}>
            <View style={[styles.activityDot, { backgroundColor: tokens.colors.vendorPrimary }]} />
            <Text style={styles.activityText}>{activityRows[0]}</Text>
            <Text style={styles.activityTime}>2 min ago</Text>
          </View>

          <View style={styles.activityRow}>
            <View style={[styles.activityDot, { backgroundColor: '#28c66f' }]} />
            <Text style={styles.activityText}>{activityRows[1]}</Text>
            <Text style={styles.activityTime}>15 min ago</Text>
          </View>

          <View style={styles.badgeWrap}>
            <StatusBadge label={isStoreOpen ? 'Store Live' : 'Store Paused'} tone={isStoreOpen ? 'green' : 'gray'} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  heroCard: {
    backgroundColor: tokens.colors.vendorPrimary,
    borderRadius: 24,
    padding: 14,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTitleWrap: {
    flex: 1,
    paddingRight: 8,
  },
  greeting: {
    color: '#ffe5d3',
    fontSize: 12,
    fontWeight: '600',
  },
  storeName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  notificationButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  statusCardSubtitle: {
    color: '#ffe2cd',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusTogglePill: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusTogglePillOn: {
    backgroundColor: '#e8fff3',
  },
  statusTogglePillOff: {
    backgroundColor: '#ffeceb',
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusDotOn: {
    backgroundColor: '#12b86a',
  },
  statusDotOff: {
    backgroundColor: '#e2645f',
  },
  statusToggleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusToggleTextOn: {
    color: '#0ea95b',
  },
  statusToggleTextOff: {
    color: '#c05b57',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f7f7f8',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ededf2',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#232328',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b8b95',
  },
  quickActionCard: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBody: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#222329',
  },
  quickActionSub: {
    marginTop: 2,
    fontSize: 12,
    color: '#898993',
    fontWeight: '600',
  },
  activityCard: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityText: {
    flex: 1,
    fontSize: 13,
    color: '#3a3a43',
    fontWeight: '600',
  },
  activityTime: {
    color: '#a2a2ab',
    fontSize: 11,
    fontWeight: '600',
  },
  badgeWrap: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
});
