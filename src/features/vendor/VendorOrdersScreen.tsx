import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useVendorApp } from '../../context/VendorAppContext';
import { OrderStatus } from '../../types/vendor';
import { formatCurrency, prettifyStatus } from '../../utils/format';
import {
  buildVendorOrderLocation,
  formatRelativeTime,
  getVendorOrderTransitions,
  groupVendorOrderStatus,
} from '../../utils/vendor';
import { ActionButton, ModePill, SectionTitle, SegmentTabs, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

type OrderTab = 'pending' | 'completed' | 'cancelled';

const orderTabs: Array<{ key: OrderTab; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function VendorOrdersScreen() {
  const { orders, ordersLoading, error, refreshOrders, updateOrderStatus } = useVendorApp();
  const [activeStatus, setActiveStatus] = useState<OrderTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void refreshOrders();
  }, []);

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => groupVendorOrderStatus(order.status) === 'pending').length,
      completed: orders.filter((order) => groupVendorOrderStatus(order.status) === 'completed').length,
      cancelled: orders.filter((order) => groupVendorOrderStatus(order.status) === 'cancelled').length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => groupVendorOrderStatus(order.status) === activeStatus),
    [orders, activeStatus],
  );

  const handleStatusUpdate = async (orderId: number, nextStatus: OrderStatus): Promise<void> => {
    const key = `${orderId}:${nextStatus}`;
    setUpdatingKey(key);
    setActionError(null);

    try {
      await updateOrderStatus(
        orderId,
        nextStatus,
        nextStatus === 'cancelled' ? 'Cancelled by vendor from app.' : undefined,
      );
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : 'Could not update order.');
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
            refreshing={ordersLoading}
            onRefresh={() => {
              void refreshOrders();
            }}
          />
        }
      >
        <ModePill text="🛵 Vendor — Orders" />

        <SectionTitle title="Orders" subtitle="Manage current customer orders" />

        <SegmentTabs
          tabs={orderTabs.map((tab) => ({ key: tab.key, label: tab.label, count: counts[tab.key] }))}
          activeKey={activeStatus}
          onChange={(key) => setActiveStatus(key as OrderTab)}
          palette="vendor"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        {filteredOrders.length === 0 ? <Text style={styles.emptyText}>No orders in this tab.</Text> : null}

        {filteredOrders.map((order) => {
          const nextStatuses = order.allowed_transitions.length
            ? order.allowed_transitions
            : getVendorOrderTransitions(order.status);

          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.orderId}>{order.order_no}</Text>
                <StatusBadge label={prettifyStatus(order.status).toUpperCase()} tone={toneForStatus(order.status)} />
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={15} color="#8b8b95" />
                <Text style={styles.metaText}>{order.customer_mobile ?? '--'}</Text>
                <View style={styles.dotSpacer} />
                <Ionicons name="time-outline" size={15} color="#b3b3bc" />
                <Text style={styles.timeText}>{formatRelativeTime(order.placed_at)}</Text>
              </View>

              <Text style={styles.customerText}>{order.customer_name ?? 'Customer'}</Text>

              <View style={styles.itemsWrap}>
                {order.items.map((item) => (
                  <Text key={`${order.id}-${item.id}-${item.title}`} style={styles.itemText}>
                    • {item.title} x{item.qty}
                  </Text>
                ))}
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={15} color={tokens.colors.vendorPrimary} />
                <Text style={styles.locationText}>{buildVendorOrderLocation(order)}</Text>
              </View>

              {order.status === 'cancelled' && order.cancel_reason ? (
                <View style={styles.cancelReasonWrap}>
                  <Text style={styles.cancelReasonLabel}>Cancel reason</Text>
                  <Text style={styles.cancelReasonText}>{order.cancel_reason}</Text>
                </View>
              ) : null}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={[styles.totalValue, order.status === 'cancelled' ? styles.totalCancelled : null]}>
                  {formatCurrency(order.total)}
                </Text>
              </View>

              {nextStatuses.length > 0 ? (
                <View style={styles.actionsRow}>
                  {nextStatuses.map((status) => {
                    const key = `${order.id}:${status}`;
                    return (
                      <ActionButton
                        key={key}
                        label={labelForTransition(status)}
                        tone={status === 'cancelled' ? 'danger' : status === 'delivered' ? 'success' : 'vendor'}
                        style={styles.halfAction}
                        disabled={updatingKey !== null}
                        onPress={() => {
                          void handleStatusUpdate(
                            order.id,
                            status,
                          );
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

function toneForStatus(status: OrderStatus): 'orange' | 'green' | 'red' | 'gray' {
  if (status === 'cancelled') {
    return 'red';
  }

  if (status === 'delivered') {
    return 'green';
  }

  if (status === 'accepted' || status === 'preparing' || status === 'out_for_delivery') {
    return 'gray';
  }

  return 'orange';
}

function labelForTransition(status: OrderStatus): string {
  switch (status) {
    case 'accepted':
      return 'Accept Order';
    case 'preparing':
      return 'Mark Preparing';
    case 'out_for_delivery':
      return 'Send for Delivery';
    case 'delivered':
      return 'Mark Delivered';
    case 'cancelled':
      return 'Cancel Order';
    default:
      return prettifyStatus(status);
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
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
    marginTop: 8,
  },
  orderCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 16,
    padding: 12,
    gap: 9,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    color: '#232328',
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
    fontSize: 13,
    fontWeight: '600',
  },
  dotSpacer: {
    flex: 1,
  },
  timeText: {
    color: '#a4a4ad',
    fontSize: 12,
    fontWeight: '600',
  },
  customerText: {
    color: '#4a4a53',
    fontSize: 13,
    fontWeight: '700',
  },
  itemsWrap: {
    borderRadius: 12,
    backgroundColor: '#f1f1f4',
    borderWidth: 1,
    borderColor: '#ececf2',
    padding: 10,
    gap: 3,
  },
  itemText: {
    color: '#4a4a53',
    fontSize: 13,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    color: '#66666f',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    color: '#8b8b95',
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    color: '#212127',
    fontSize: 20,
    fontWeight: '900',
  },
  totalCancelled: {
    color: '#b6b6be',
    textDecorationLine: 'line-through',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  halfAction: {
    flex: 1,
    minWidth: 140,
  },
});
