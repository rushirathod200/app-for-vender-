import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useVendorApp } from '../../context/VendorAppContext';
import { VendorTabKey } from '../../types/workflow';
import { formatCurrency, prettifyStatus } from '../../utils/format';
import {
  formatRelativeTime,
  groupVendorOrderStatus,
  isSameCalendarDay,
  resolveVendorDisplayName,
} from '../../utils/vendor';
import { NotificationCenterSheet } from '../shared/NotificationCenterSheet';
import { SectionTitle, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

interface VendorDashboardScreenProps {
  onGoToTab: (tab: VendorTabKey) => void;
  onOpenOrderFromNotification: (orderId: number | null) => void;
}

export function VendorDashboardScreen({ onGoToTab, onOpenOrderFromNotification }: VendorDashboardScreenProps) {
  const {
    profile,
    buildings,
    allProducts,
    orders,
    notifications,
    unreadNotificationCount,
    notificationsLoading,
    deliveryPartners,
    isLoading,
    error,
    refreshAll,
    refreshNotifications,
    refreshOrders,
    markNotificationRead,
    toggleStoreOpen,
  } = useVendorApp();
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  useEffect(() => {
    void refreshAll();
  }, []);

  const storeName = useMemo(() => resolveVendorDisplayName(profile?.name ?? null, buildings), [buildings, profile?.name]);
  const isStoreOpen = profile?.store_open ?? false;

  const openOrders = useMemo(
    () => orders.filter((order) => groupVendorOrderStatus(order.status) === 'pending'),
    [orders],
  );
  const completedOrders = useMemo(
    () => orders.filter((order) => groupVendorOrderStatus(order.status) === 'completed'),
    [orders],
  );
  const todaysOrders = useMemo(
    () => orders.filter((order) => isSameCalendarDay(order.placed_at)).length,
    [orders],
  );
  const activeProducts = useMemo(
    () => allProducts.filter((product) => product.is_available),
    [allProducts],
  );
  const totalSales = useMemo(
    () => completedOrders.reduce((sum, order) => sum + order.total, 0),
    [completedOrders],
  );
  const recentOrders = useMemo(() => orders.slice(0, 2), [orders]);
  const activePartners = useMemo(
    () => deliveryPartners.filter((partner) => partner.partner_active && partner.app_access_active),
    [deliveryPartners],
  );

  const handleNotificationOpen = async (notificationId: string, orderId: number | null): Promise<void> => {
    try {
      await markNotificationRead(notificationId);
    } catch {
      return;
    }

    await refreshOrders();
    onOpenOrderFromNotification(orderId);
    setNotificationsVisible(false);
    onGoToTab('orders');
  };

  const stats = [
    {
      icon: 'document-text-outline' as const,
      value: todaysOrders,
      label: "Today's Orders",
      color: tokens.colors.vendorPrimary,
    },
    {
      icon: 'time-outline' as const,
      value: openOrders.length,
      label: 'Pending',
      color: '#f59f0b',
    },
    {
      icon: 'checkmark-circle-outline' as const,
      value: completedOrders.length,
      label: 'Completed',
      color: '#28c66f',
    },
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              void refreshAll();
            }}
          />
        }
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.greeting}>Welcome back</Text>
              <Text style={styles.storeName}>{storeName}</Text>
            </View>
            <Pressable style={styles.notificationButton} onPress={() => setNotificationsVisible(true)}>
              <Ionicons name="notifications-outline" size={20} color="#ffffff" />
              {unreadNotificationCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{Math.min(unreadNotificationCount, 9)}</Text>
                </View>
              ) : null}
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
              onPress={() => {
                void toggleStoreOpen();
              }}
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

          <View style={styles.salesRow}>
            <Text style={styles.salesLabel}>Delivered Sales</Text>
            <Text style={styles.salesValue}>{formatCurrency(totalSales)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
            <Text style={styles.quickActionSub}>{openOrders.length} orders in progress</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={() => onGoToTab('products')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#e6f8ec' }]}>
            <Ionicons name="cube-outline" size={20} color="#28b162" />
          </View>
          <View style={styles.quickActionBody}>
            <Text style={styles.quickActionTitle}>Manage Products</Text>
            <Text style={styles.quickActionSub}>{allProducts.length} menu items available</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={() => onGoToTab('delivery')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#ecedff' }]}>
            <Ionicons name="bicycle-outline" size={20} color="#6a74f8" />
          </View>
          <View style={styles.quickActionBody}>
            <Text style={styles.quickActionTitle}>Delivery Boys</Text>
            <Text style={styles.quickActionSub}>{activePartners.length} partners active</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <Pressable style={styles.quickActionCard} onPress={() => onGoToTab('profile')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#ecedff' }]}>
            <Ionicons name="person-outline" size={20} color="#6a74f8" />
          </View>
          <View style={styles.quickActionBody}>
            <Text style={styles.quickActionTitle}>Vendor Profile</Text>
            <Text style={styles.quickActionSub}>{profile?.email ?? profile?.mobile ?? 'Open account details'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#c2c2cb" />
        </Pressable>

        <SectionTitle title="Recent Activity" />

        <View style={styles.activityCard}>
          {recentOrders.length ? (
            recentOrders.map((order) => (
              <View key={order.id} style={styles.activityRow}>
                <View
                  style={[
                    styles.activityDot,
                    {
                      backgroundColor:
                        order.status === 'cancelled'
                          ? tokens.colors.danger
                          : order.status === 'delivered'
                            ? tokens.colors.success
                            : tokens.colors.vendorPrimary,
                    },
                  ]}
                />
                <Text style={styles.activityText}>
                  {order.order_no} is {prettifyStatus(order.status).toLowerCase()}
                </Text>
                <Text style={styles.activityTime}>{formatRelativeTime(order.placed_at)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyActivityText}>No live order activity yet.</Text>
          )}

          <View style={styles.badgeWrap}>
            <StatusBadge label={isLoading ? 'SYNCING' : 'LIVE'} tone={isLoading ? 'orange' : 'green'} />
          </View>
        </View>
      </ScrollView>

      <NotificationCenterSheet
        accentColor={tokens.colors.vendorPrimary}
        visible={notificationsVisible}
        title="Notifications"
        subtitle="New orders and order updates"
        notifications={notifications}
        unreadCount={unreadNotificationCount}
        isLoading={notificationsLoading}
        onClose={() => setNotificationsVisible(false)}
        onRefresh={() => {
          void refreshNotifications();
        }}
        onSelectNotification={(notification) => {
          void handleNotificationOpen(notification.id, notification.order_id);
        }}
      />
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
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 10,
    fontWeight: '900',
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
    flexShrink: 1,
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
  salesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salesLabel: {
    color: '#ffe5d3',
    fontSize: 13,
    fontWeight: '700',
  },
  salesValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
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
    padding: 12,
    gap: 10,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  activityText: {
    flex: 1,
    color: '#4b4b54',
    fontSize: 13,
    fontWeight: '700',
  },
  activityTime: {
    color: '#9e9ea7',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyActivityText: {
    color: '#8b8b95',
    fontSize: 13,
    fontWeight: '600',
  },
  badgeWrap: {
    alignItems: 'flex-start',
  },
});
