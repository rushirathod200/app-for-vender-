import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useDeliveryApp } from '../../context/DeliveryAppContext';
import { DeliveryOrder } from '../../types/delivery';
import { OrderStatus } from '../../types/vendor';
import { prettifyStatus } from '../../utils/format';
import { formatRelativeTime } from '../../utils/vendor';
import { NotificationCenterSheet } from '../shared/NotificationCenterSheet';
import { ActionButton, SegmentTabs, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

type DeliveryTab = 'pending' | 'completed' | 'cancelled';

const tabs: Array<{ key: DeliveryTab; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function DeliveryOrdersScreen() {
  const { logout } = useAuth();
  const {
    profile,
    orders,
    notifications,
    unreadNotificationCount,
    isLoading,
    ordersLoading,
    notificationsLoading,
    error,
    refreshAll,
    refreshOrders,
    refreshNotifications,
    markNotificationRead,
    updateOrderStatus,
  } = useDeliveryApp();

  const [activeTab, setActiveTab] = useState<DeliveryTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<number | null>(null);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

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

  const cancelTargetOrder = useMemo(
    () => (cancelTargetOrderId ? orders.find((order) => order.id === cancelTargetOrderId) ?? null : null),
    [cancelTargetOrderId, orders],
  );

  const handleMarkCompleted = async (orderId: number): Promise<void> => {
    const key = `${orderId}:complete`;
    setUpdatingKey(key);
    setActionError(null);

    try {
      await updateOrderStatus(orderId, 'delivered');
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : 'Could not complete delivery.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const openCancelReasonModal = (orderId: number): void => {
    setCancelTargetOrderId(orderId);
    setCancelReason('');
    setCancelReasonError(null);
  };

  const closeCancelReasonModal = (): void => {
    if (updatingKey) {
      return;
    }

    setCancelTargetOrderId(null);
    setCancelReason('');
    setCancelReasonError(null);
  };

  const submitCancelReason = async (): Promise<void> => {
    if (!cancelTargetOrder) {
      return;
    }

    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) {
      setCancelReasonError('Enter a cancel reason.');
      return;
    }

    const key = `${cancelTargetOrder.id}:cancelled`;
    setUpdatingKey(key);
    setActionError(null);
    setCancelReasonError(null);

    try {
      await updateOrderStatus(cancelTargetOrder.id, 'cancelled', trimmedReason);
      setCancelTargetOrderId(null);
      setCancelReason('');
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Could not cancel delivery.';
      setActionError(message);
      setCancelReasonError(message);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleCallCustomer = async (phoneNumber: string | null): Promise<void> => {
    const normalizedNumber = phoneNumber?.replace(/[^\d+]/g, '') ?? '';
    if (!normalizedNumber) {
      setActionError('Customer phone number is not available.');
      return;
    }

    try {
      await Linking.openURL(`tel:${normalizedNumber}`);
    } catch (callError) {
      setActionError(callError instanceof Error ? callError.message : 'Could not open the dialer.');
    }
  };

  const handleNotificationOpen = async (notificationId: string, orderId: number | null): Promise<void> => {
    try {
      await markNotificationRead(notificationId);
    } catch {
      return;
    }

    await refreshOrders();
    setHighlightedOrderId(orderId);
    setNotificationsVisible(false);
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
        <View style={styles.heroCard}>
          <View style={styles.topRow}>
            <View style={styles.titleWrap}>
              <Text style={styles.roleText}>{profile?.name ?? 'Delivery Partner'}</Text>
              <Text style={styles.title}>My Deliveries</Text>
              <Text style={styles.heroSubText}>
                {profile?.active_order_count ?? counts.pending} active delivery orders
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={() => {
                  setNotificationsVisible(true);
                }}
                style={styles.notificationButton}
              >
                <Ionicons name="notifications-outline" size={18} color="#ffffff" />
                {unreadNotificationCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{Math.min(unreadNotificationCount, 9)}</Text>
                  </View>
                ) : null}
              </Pressable>

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
            ? order.allowed_transitions
            : getDeliveryTransitions(order.status);
          const showCompleteAction = nextStatuses.includes('delivered');
          const canCancel = nextStatuses.includes('cancelled');

          return (
            <View
              key={order.id}
              style={[styles.orderCard, highlightedOrderId === order.id ? styles.highlightedOrderCard : null]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.orderId}>{order.order_no}</Text>
                <StatusBadge
                  label={deliveryStatusLabel(order.status)}
                  tone={deliveryStatusTone(order.status)}
                />
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={15} color="#8b8b95" />
                <Pressable
                  disabled={!order.customer_mobile}
                  onPress={() => {
                    void handleCallCustomer(order.customer_mobile);
                  }}
                >
                  <Text style={[styles.metaText, order.customer_mobile ? styles.callText : null]}>
                    {order.customer_mobile ?? '--'}
                  </Text>
                </Pressable>
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

              {order.notes ? (
                <View style={styles.noteWrap}>
                  <Text style={styles.noteLabel}>Customer note</Text>
                  <Text style={styles.noteText}>{order.notes}</Text>
                </View>
              ) : null}

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

              {showCompleteAction || canCancel ? (
                <View style={styles.actionsRow}>
                  {showCompleteAction ? (
                    <ActionButton
                      label={updatingKey === `${order.id}:complete` ? 'Completing...' : 'Mark Completed'}
                      tone="success"
                      style={styles.mainAction}
                      disabled={updatingKey !== null}
                      onPress={() => {
                        void handleMarkCompleted(order.id);
                      }}
                    />
                  ) : null}
                  {canCancel ? (
                    <ActionButton
                      label={updatingKey === `${order.id}:cancelled` ? 'Cancelling...' : 'Cancel Order'}
                      tone="danger"
                      style={styles.mainAction}
                      disabled={updatingKey !== null}
                      onPress={() => {
                        openCancelReasonModal(order.id);
                      }}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <NotificationCenterSheet
        accentColor={tokens.colors.deliveryPrimary}
        visible={notificationsVisible}
        title="Notifications"
        subtitle="Assigned deliveries and status updates"
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
      <Modal
        visible={!!cancelTargetOrder}
        animationType="slide"
        transparent
        onRequestClose={closeCancelReasonModal}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCancelReasonModal} />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="alert-circle-outline" size={22} color={tokens.colors.danger} />
                <Text style={styles.modalTitle}>Cancel Order</Text>
              </View>

              <Pressable style={styles.closeModalButton} onPress={closeCancelReasonModal} disabled={!!updatingKey}>
                <Ionicons name="close" size={18} color="#7f7f89" />
              </Pressable>
            </View>

            <Text style={styles.modalPrompt}>
              {cancelTargetOrder ? `Why are you cancelling ${cancelTargetOrder.order_no}?` : 'Why are you cancelling this order?'}
            </Text>

            <TextInput
              value={cancelReason}
              onChangeText={(value) => {
                setCancelReason(value);
                if (cancelReasonError) {
                  setCancelReasonError(null);
                }
              }}
              placeholder="Enter cancel reason"
              placeholderTextColor="#9a9aa3"
              multiline
              style={styles.reasonInput}
              textAlignVertical="top"
            />

            {cancelReasonError ? <Text style={styles.errorText}>{cancelReasonError}</Text> : null}

            <View style={styles.modalActionsRow}>
              <ActionButton
                label="Back"
                tone="muted"
                style={styles.mainAction}
                disabled={!!updatingKey}
                onPress={closeCancelReasonModal}
              />
              <ActionButton
                label={updatingKey === `${cancelTargetOrder?.id}:cancelled` ? 'Cancelling...' : 'Cancel Order'}
                tone="danger"
                style={styles.mainAction}
                disabled={!!updatingKey}
                onPress={() => {
                  void submitCancelReason();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  if (status === 'delivered' || status === 'cancelled') {
    return [];
  }

  return ['delivered', 'cancelled'];
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
    paddingRight: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginLeft: 8,
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
  notificationButton: {
    width: 36,
    height: 36,
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
    color: tokens.colors.deliveryPrimary,
    fontSize: 10,
    fontWeight: '900',
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
  highlightedOrderCard: {
    borderColor: '#bac2ff',
    backgroundColor: '#f4f6ff',
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
  callText: {
    color: tokens.colors.deliveryPrimary,
    textDecorationLine: 'underline',
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
  noteWrap: {
    backgroundColor: '#fff7e8',
    borderWidth: 1,
    borderColor: '#ffe1b1',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  noteLabel: {
    color: '#c57a13',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noteText: {
    color: '#7a5a2e',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
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
    gap: 12,
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
  closeModalButton: {
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
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#232328',
    fontSize: 15,
    fontWeight: '600',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
