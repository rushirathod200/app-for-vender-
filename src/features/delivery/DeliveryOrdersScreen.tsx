import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useDeliveryApp } from '../../context/DeliveryAppContext';
import { DeliveryOrder } from '../../types/delivery';
import { OrderStatus } from '../../types/vendor';
import { prettifyStatus } from '../../utils/format';
import { formatRelativeTime } from '../../utils/vendor';
import { ActionButton, ModePill, SegmentTabs, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

type DeliveryTab = 'pending' | 'completed' | 'cancelled';

const tabs: Array<{ key: DeliveryTab; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function DeliveryOrdersScreen() {
  const { logout } = useAuth();
  const { profile, orders, isLoading, ordersLoading, error, refreshAll, refreshOrders, updateOrderStatus } =
    useDeliveryApp();

  const [activeTab, setActiveTab] = useState<DeliveryTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void refreshAll();
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => groupDeliveryOrderStatus(order.status) === activeTab),
    [orders, activeTab],
  );

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => groupDeliveryOrderStatus(order.status) === 'pending').length,
      completed: orders.filter((order) => groupDeliveryOrderStatus(order.status) === 'completed').length,
      cancelled: orders.filter((order) => groupDeliveryOrderStatus(order.status) === 'cancelled').length,
    }),
    [orders],
  );

  const handleStatusUpdate = async (orderId: number, nextStatus: OrderStatus): Promise<void> => {
    const key = `${orderId}:${nextStatus}`;
    setUpdatingKey(key);
    setActionError(null);

    try {
      await updateOrderStatus(orderId, nextStatus);
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : 'Could not update delivery.');
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={ordersLoading || isLoading}
            onRefresh={() => {
              void refreshOrders();
            }}
          />
        }
      >
        <ModePill text="🛵 Delivery Partner — Orders" />

        <View style={styles.heroCard}>
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.roleText}>{profile?.name ?? 'Delivery Partner'}</Text>
              <Text style={styles.title}>My Deliveries</Text>
              <Text style={styles.heroSubText}>
                {profile?.active_order_count ?? counts.pending} active delivery orders
              </Text>
            </View>

            <Pressable
              onPress={() => {
                logout();
              }}
              style={styles.logoutButton}
            >
              <Ionicons name="log-out-outline" size={16} color="#ffffff" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <SegmentTabs
            tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label, count: counts[tab.key] }))}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DeliveryTab)}
            palette="delivery"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
        {filteredOrders.length === 0 ? <Text style={styles.emptyText}>No deliveries in this tab.</Text> : null}

        {filteredOrders.map((order) => {
          const nextStatuses = order.allowed_transitions.length
            ? order.allowed_transitions.filter((status) => status === 'out_for_delivery' || status === 'delivered')
            : getDeliveryTransitions(order.status);

          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.orderId}>{order.order_no}</Text>
                <StatusBadge
                  label={deliveryStatusLabel(order.status)}
                  tone={deliveryStatusTone(order.status)}
                />
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={15} color="#8b8b95" />
                <Text style={styles.metaText}>{order.customer_mobile ?? '--'}</Text>
                <View style={styles.dotSpacer} />
                <Text style={styles.timeText}>{formatRelativeTime(order.placed_at)}</Text>
              </View>

              <View style={styles.locationTagGreen}>
                <Text style={styles.locationTagLabel}>PICKUP FROM</Text>
                <Text style={styles.locationTagText}>{buildPickupLabel(order)}</Text>
              </View>

              <View style={styles.locationTagBlue}>
                <Text style={styles.locationTagLabelBlue}>DELIVER TO</Text>
                <Text style={styles.locationTagText}>{buildDeliveryLabel(order)}</Text>
              </View>

              <View style={styles.itemsBox}>
                {order.items.map((item) => (
                  <Text key={`${order.id}-${item.id}-${item.title}`} style={styles.itemText}>
                    • {item.title} x{item.qty}
                  </Text>
                ))}
              </View>

              {order.cancel_reason ? (
                <View style={styles.cancelReasonWrap}>
                  <Text style={styles.cancelReasonLabel}>Cancel reason</Text>
                  <Text style={styles.cancelReasonText}>{order.cancel_reason}</Text>
                </View>
              ) : null}

              <View style={styles.valueRow}>
                <Text style={styles.valueLabel}>Order Value</Text>
                <Text style={[styles.valueText, order.status === 'cancelled' ? styles.cancelledValue : null]}>
                  ₹{order.total}
                </Text>
              </View>

              {nextStatuses.length > 0 ? (
                <View style={styles.actionsRow}>
                  {nextStatuses.map((status) => {
                    const key = `${order.id}:${status}`;

                    return (
                      <ActionButton
                        key={key}
                        label={deliveryActionLabel(status)}
                        tone={status === 'delivered' ? 'success' : 'delivery'}
                        style={styles.mainAction}
                        disabled={updatingKey !== null}
                        onPress={() => {
                          void handleStatusUpdate(order.id, status);
                        }}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function groupDeliveryOrderStatus(status: OrderStatus): DeliveryTab {
  if (status === 'delivered') {
    return 'completed';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'pending';
}

function getDeliveryTransitions(status: OrderStatus): OrderStatus[] {
  if (status === 'preparing') {
    return ['out_for_delivery'];
  }

  if (status === 'out_for_delivery') {
    return ['delivered'];
  }

  return [];
}

function deliveryActionLabel(status: OrderStatus): string {
  if (status === 'out_for_delivery') {
    return 'Start Delivery';
  }

  if (status === 'delivered') {
    return 'Mark Delivered';
  }

  return prettifyStatus(status);
}

function deliveryStatusLabel(status: OrderStatus): string {
  if (status === 'preparing') {
    return 'READY';
  }

  return prettifyStatus(status).toUpperCase();
}

function deliveryStatusTone(status: OrderStatus): 'orange' | 'green' | 'red' | 'gray' {
  if (status === 'cancelled') {
    return 'red';
  }

  if (status === 'delivered') {
    return 'green';
  }

  if (status === 'out_for_delivery') {
    return 'gray';
  }

  return 'orange';
}

function buildPickupLabel(order: DeliveryOrder): string {
  if (order.vendor_name && order.building_name) {
    return `${order.vendor_name} • ${order.building_name}`;
  }

  return order.vendor_name ?? order.building_name ?? 'Pickup details unavailable';
}

function buildDeliveryLabel(order: DeliveryOrder): string {
  const segments = [order.building_name, order.wing_name, order.floor_name, order.office_no].filter(Boolean);
  return segments.length ? segments.join(' • ') : 'Delivery address unavailable';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  heroCard: {
    backgroundColor: tokens.colors.deliveryPrimary,
    borderRadius: 22,
    padding: 12,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  roleText: {
    color: '#d8ddff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroSubText: {
    color: '#eef0ff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: '#8b8b95',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  orderCard: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    padding: 11,
    gap: 9,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    color: '#212127',
    fontSize: 20,
    fontWeight: '900',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#4b4b54',
    fontSize: 12,
    fontWeight: '600',
  },
  dotSpacer: {
    flex: 1,
  },
  timeText: {
    color: '#a4a4ad',
    fontSize: 11,
    fontWeight: '600',
  },
  locationTagGreen: {
    borderRadius: 12,
    backgroundColor: '#e9f5ee',
    padding: 10,
    gap: 2,
  },
  locationTagBlue: {
    borderRadius: 12,
    backgroundColor: '#eef0fa',
    padding: 10,
    gap: 2,
  },
  locationTagLabel: {
    color: '#26b562',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  locationTagLabelBlue: {
    color: '#5a67ef',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  locationTagText: {
    color: '#404048',
    fontSize: 13,
    fontWeight: '700',
  },
  itemsBox: {
    borderRadius: 12,
    backgroundColor: '#f1f1f4',
    borderWidth: 1,
    borderColor: '#ececf2',
    padding: 10,
    gap: 3,
  },
  itemText: {
    color: '#4a4a53',
    fontSize: 12,
    fontWeight: '600',
  },
  cancelReasonWrap: {
    backgroundColor: '#ffeef0',
    borderWidth: 1,
    borderColor: '#ffd3d9',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  cancelReasonLabel: {
    color: '#d34853',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cancelReasonText: {
    color: '#8a4e56',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueLabel: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '600',
  },
  valueText: {
    color: '#212127',
    fontSize: 18,
    fontWeight: '900',
  },
  cancelledValue: {
    color: '#b6b6be',
    textDecorationLine: 'line-through',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mainAction: {
    flex: 1,
    minWidth: 160,
  },
});
