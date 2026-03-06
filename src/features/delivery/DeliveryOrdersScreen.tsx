import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ActionButton, ModePill, SegmentTabs, StatusBadge } from '../shared/ui';
import { OrderStatus } from '../../types/workflow';
import { tokens } from '../shared/tokens';

const tabs: Array<{ key: OrderStatus; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function DeliveryOrdersScreen() {
  const { orders, updateOrderStatus, logout } = useAppWorkflow();

  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const filteredOrders = useMemo(
    () => orders.filter((order) => order.status === activeTab),
    [orders, activeTab],
  );

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'pending').length,
      completed: orders.filter((order) => order.status === 'completed').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
    }),
    [orders],
  );

  const cancelTargetOrder = cancelTargetId ? orders.find((order) => order.id === cancelTargetId) ?? null : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Delivery Partner — Orders" />

        <View style={styles.heroCard}>
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.roleText}>Delivery Partner</Text>
              <Text style={styles.title}>My Deliveries</Text>
            </View>

            <Pressable onPress={logout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={16} color="#ffffff" />
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>

          <SegmentTabs
            tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label, count: counts[tab.key] }))}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as OrderStatus)}
            palette="delivery"
          />
        </View>

        {filteredOrders.length === 0 ? <Text style={styles.emptyText}>No deliveries in this tab.</Text> : null}

        {filteredOrders.map((order) => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.orderId}>{order.id}</Text>
              <StatusBadge
                label={order.status === 'pending' ? 'ASSIGNED' : order.status.toUpperCase()}
                tone={order.status === 'pending' ? 'orange' : order.status === 'completed' ? 'green' : 'red'}
              />
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={15} color="#8b8b95" />
              <Text style={styles.metaText}>{order.customerPhone}</Text>
              <View style={styles.dotSpacer} />
              <Text style={styles.timeText}>{order.createdAgo}</Text>
            </View>

            <View style={styles.locationTagGreen}>
              <Text style={styles.locationTagLabel}>PICKUP FROM</Text>
              <Text style={styles.locationTagText}>{order.pickupStore}</Text>
            </View>

            <View style={styles.locationTagBlue}>
              <Text style={styles.locationTagLabelBlue}>DELIVER TO</Text>
              <Text style={styles.locationTagText}>{order.deliveryAddress}</Text>
            </View>

            <View style={styles.itemsBox}>
              {order.items.map((item) => (
                <Text key={`${order.id}-${item.name}`} style={styles.itemText}>• {item.name} x{item.qty}</Text>
              ))}
            </View>

            {order.status === 'cancelled' && order.cancelReason ? (
              <View style={styles.cancelReasonWrap}>
                <Text style={styles.cancelReasonLabel}>Cancel reason</Text>
                <Text style={styles.cancelReasonText}>{order.cancelReason}</Text>
              </View>
            ) : null}

            <View style={styles.valueRow}>
              <Text style={styles.valueLabel}>Order Value</Text>
              <Text style={[styles.valueText, order.status === 'cancelled' ? styles.cancelledValue : null]}>₹{order.total}</Text>
            </View>

            {order.status === 'pending' ? (
              <View style={styles.actionsRow}>
                <ActionButton
                  label="Mark Delivered"
                  tone="success"
                  icon="checkmark"
                  style={styles.mainAction}
                  onPress={() => updateOrderStatus(order.id, 'completed')}
                />
                <Pressable style={styles.cancelIconBtn} onPress={() => setCancelTargetId(order.id)}>
                  <Ionicons name="close" size={20} color={tokens.colors.danger} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!cancelTargetOrder} animationType="slide" transparent onRequestClose={() => setCancelTargetId(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCancelTargetId(null)} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="alert-circle-outline" size={22} color={tokens.colors.danger} />
                <Text style={styles.modalTitle}>Cancel {cancelTargetOrder?.id}</Text>
              </View>

              <Pressable style={styles.closeModalBtn} onPress={() => setCancelTargetId(null)}>
                <Ionicons name="close" size={18} color="#7f7f89" />
              </Pressable>
            </View>

            <Text style={styles.modalPrompt}>Why are you cancelling this delivery?</Text>
            <TextInput
              placeholder="E.g. Customer not reachable, wrong address..."
              placeholderTextColor="#9a9aa3"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              style={styles.reasonInput}
            />

            <ActionButton
              label="Confirm Cancellation"
              tone="muted"
              disabled={cancelReason.trim().length < 4}
              onPress={() => {
                if (!cancelTargetOrder || cancelReason.trim().length < 4) {
                  return;
                }

                updateOrderStatus(cancelTargetOrder.id, 'cancelled', cancelReason.trim());
                setCancelTargetId(null);
                setCancelReason('');
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
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
  },
  orderId: {
    color: '#212127',
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
    alignItems: 'center',
  },
  mainAction: {
    flex: 1,
  },
  cancelIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#ffefee',
    borderWidth: 1,
    borderColor: '#ffd9d7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14,16,23,0.52)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#f8f8f9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#222329',
    fontSize: 20,
    fontWeight: '900',
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#ececef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrompt: {
    color: '#6d6d77',
    fontSize: 13,
    fontWeight: '600',
  },
  reasonInput: {
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#232328',
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top',
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
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
