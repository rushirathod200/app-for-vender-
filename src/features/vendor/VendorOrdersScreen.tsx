import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ActionButton, ModePill, SectionTitle, SegmentTabs, StatusBadge } from '../shared/ui';
import { OrderStatus } from '../../types/workflow';
import { tokens } from '../shared/tokens';

const orderTabs: Array<{ key: OrderStatus; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function VendorOrdersScreen() {
  const { orders, updateOrderStatus } = useAppWorkflow();
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('pending');

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'pending').length,
      completed: orders.filter((order) => order.status === 'completed').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
    }),
    [orders],
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === activeStatus),
    [orders, activeStatus],
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Vendor — Orders" />

        <SectionTitle title="Orders" />

        <SegmentTabs
          tabs={orderTabs.map((tab) => ({ key: tab.key, label: tab.label, count: counts[tab.key] }))}
          activeKey={activeStatus}
          onChange={(key) => setActiveStatus(key as OrderStatus)}
          palette="vendor"
        />

        {filteredOrders.length === 0 ? <Text style={styles.emptyText}>No orders in this tab.</Text> : null}

        {filteredOrders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.orderId}>{order.id}</Text>
              <StatusBadge
                label={order.status.toUpperCase()}
                tone={order.status === 'pending' ? 'orange' : order.status === 'completed' ? 'green' : 'red'}
              />
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={15} color="#8b8b95" />
              <Text style={styles.metaText}>{order.customerPhone}</Text>
              <View style={styles.dotSpacer} />
              <Ionicons name="time-outline" size={15} color="#b3b3bc" />
              <Text style={styles.timeText}>{order.createdAgo}</Text>
            </View>

            <View style={styles.itemsWrap}>
              {order.items.map((item) => (
                <Text key={`${order.id}-${item.name}`} style={styles.itemText}>• {item.name} x{item.qty}</Text>
              ))}
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={15} color={tokens.colors.vendorPrimary} />
              <Text style={styles.locationText}>{order.deliveryAddress}</Text>
            </View>

            {order.status === 'cancelled' && order.cancelReason ? (
              <View style={styles.cancelReasonWrap}>
                <Text style={styles.cancelReasonLabel}>Cancel reason</Text>
                <Text style={styles.cancelReasonText}>{order.cancelReason}</Text>
              </View>
            ) : null}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={[styles.totalValue, order.status === 'cancelled' ? styles.totalCancelled : null]}>
                ₹{order.total}
              </Text>
            </View>

            {order.status === 'pending' ? (
              <View style={styles.actionsRow}>
                <ActionButton
                  label="Complete Order"
                  tone="success"
                  icon="checkmark"
                  style={styles.halfAction}
                  onPress={() => updateOrderStatus(order.id, 'completed')}
                />
                <ActionButton
                  label="Cancel Order"
                  tone="muted"
                  icon="close"
                  style={styles.halfActionDanger}
                  onPress={() => updateOrderStatus(order.id, 'cancelled', 'Vendor cancelled due to unavailable item.')}
                />
              </View>
            ) : null}
          </View>
        ))}
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
    paddingBottom: 20,
    gap: 12,
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
  },
  orderId: {
    color: '#232328',
    fontSize: 20,
    fontWeight: '900',
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
  },
  halfAction: {
    flex: 1,
  },
  halfActionDanger: {
    flex: 1,
    backgroundColor: '#ffefee',
  },
});
