import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVendorApp } from '../../context/VendorAppContext';
import { OrderStatus } from '../../types/vendor';
import { formatCurrency, prettifyStatus } from '../../utils/format';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import {
  buildVendorOrderLocation,
  formatRelativeTime,
  getVendorOrderTransitions,
  groupVendorOrderStatus,
} from '../../utils/vendor';
import { ActionButton, SectionTitle, SegmentTabs, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

type OrderTab = 'pending' | 'completed' | 'cancelled';
const ORDER_PAGE_SIZE = 10;

const orderTabs: Array<{ key: OrderTab; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

interface VendorOrdersScreenProps {
  highlightedOrderId?: number | null;
  notificationTapRequestId?: number;
}

export function VendorOrdersScreen({
  highlightedOrderId = null,
  notificationTapRequestId = 0,
}: VendorOrdersScreenProps) {
  const insets = useSafeAreaInsets();
  const { ordersByTab, orderCounts, ordersLoading, error, refreshOrders, updateOrderStatus } = useVendorApp();
  const [activeStatus, setActiveStatus] = useState<OrderTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<OrderTab, number>>({
    pending: ORDER_PAGE_SIZE,
    completed: ORDER_PAGE_SIZE,
    cancelled: ORDER_PAGE_SIZE,
  });
  const modalBottomPadding = Math.max(insets.bottom, 14) + 8;
  const appliedNotificationTapRef = useRef(0);

  useAutoClearValue(actionError, () => setActionError(null));

  useEffect(() => {
    void refreshOrders();
  }, []);

  useEffect(() => {
    if (!notificationTapRequestId) {
      return;
    }

    void refreshOrders({ force: true });
  }, [highlightedOrderId, notificationTapRequestId]);

  useEffect(() => {
    if (!highlightedOrderId || appliedNotificationTapRef.current === notificationTapRequestId) {
      return;
    }

    const matchedOrder = Object.values(ordersByTab)
      .flat()
      .find((order) => order.id === highlightedOrderId);

    if (!matchedOrder) {
      return;
    }

    const nextTab = groupVendorOrderStatus(matchedOrder.status);
    const matchIndex = ordersByTab[nextTab].findIndex((order) => order.id === highlightedOrderId);
    if (matchIndex >= 0) {
      const requiredVisibleCount = Math.max(
        ORDER_PAGE_SIZE,
        Math.ceil((matchIndex + 1) / ORDER_PAGE_SIZE) * ORDER_PAGE_SIZE,
      );
      setVisibleCounts((current) => (
        current[nextTab] >= requiredVisibleCount
          ? current
          : { ...current, [nextTab]: requiredVisibleCount }
      ));
    }

    setActiveStatus(nextTab);
    appliedNotificationTapRef.current = notificationTapRequestId;
  }, [highlightedOrderId, notificationTapRequestId, ordersByTab]);

  const filteredOrders = useMemo(() => ordersByTab[activeStatus], [activeStatus, ordersByTab]);
  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleCounts[activeStatus]),
    [activeStatus, filteredOrders, visibleCounts],
  );
  const hasMoreOrders = visibleOrders.length < filteredOrders.length;

  const cancelTargetOrder = useMemo(
    () =>
      cancelTargetOrderId
        ? (Object.values(ordersByTab).flat().find((order) => order.id === cancelTargetOrderId) ?? null)
        : null,
    [cancelTargetOrderId, ordersByTab],
  );
  const topMessages = useMemo(
    () => Array.from(new Set([error, actionError].filter((message): message is string => !!message))),
    [actionError, error],
  );

  const handleStatusUpdate = async (
    orderId: number,
    nextStatus: OrderStatus,
    reason?: string,
  ): Promise<void> => {
    const key = `${orderId}:${nextStatus}`;
    setUpdatingKey(key);
    setActionError(null);

    try {
      await updateOrderStatus(orderId, nextStatus, nextStatus === 'cancelled' ? reason : undefined);
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : 'Could not update order.');
      throw updateError;
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleMarkCompleted = async (orderId: number, status: OrderStatus): Promise<void> => {
    const key = `${orderId}:complete`;
    setUpdatingKey(key);
    setActionError(null);

    try {
      for (const nextStatus of getCompletionPath(status)) {
        await updateOrderStatus(orderId, nextStatus);
      }
    } catch (updateError) {
      setActionError(updateError instanceof Error ? updateError.message : 'Could not complete order.');
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

    setCancelReasonError(null);

    try {
      await handleStatusUpdate(cancelTargetOrder.id, 'cancelled', trimmedReason);
      setCancelTargetOrderId(null);
      setCancelReason('');
    } catch {
      // Error state is handled by handleStatusUpdate.
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
              void refreshOrders({ force: true });
            }}
          />
        }
      >
        <SectionTitle title="Orders" subtitle="Manage current customer orders" />

        <SegmentTabs
          tabs={orderTabs.map((tab) => ({ key: tab.key, label: tab.label, count: orderCounts[tab.key] }))}
          activeKey={activeStatus}
          onChange={(key) => setActiveStatus(key as OrderTab)}
          palette="vendor"
        />

        {topMessages.map((message) => (
          <Text key={message} style={styles.errorText}>{message}</Text>
        ))}

        {filteredOrders.length === 0 ? <Text style={styles.emptyText}>No orders in this tab.</Text> : null}

        {visibleOrders.map((order) => {
          const isQuickRequest = order.order_channel === 'office_quick_request';
          const nextStatuses = getVisibleTransitions(order.status, order.allowed_transitions).filter(
            (status) => !(isQuickRequest && status === 'delivered'),
          );
          const showCompleteAction = order.status === 'placed' && !isQuickRequest;

          return (
            <View
              key={order.id}
              style={[
                styles.orderCard,
                highlightedOrderId === order.id ? styles.highlightedOrderCard : null,
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.orderId}>{order.order_no}</Text>
                <StatusBadge label={statusLabelForOrder(order.status)} tone={toneForStatus(order.status)} />
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={15} color="#8b8b95" />
                <Text style={styles.metaText}>{order.customer_mobile ?? '--'}</Text>
                <View style={styles.dotSpacer} />
                <Ionicons name="time-outline" size={15} color="#b3b3bc" />
                <Text style={styles.timeText}>{formatRelativeTime(order.placed_at)}</Text>
              </View>

              <Text style={styles.customerText}>{order.customer_name ?? 'Customer'}</Text>

              {isQuickRequest ? (
                <View style={styles.quickRequestBadge}>
                  <Text style={styles.quickRequestBadgeText}>
                    Quick Request{order.quick_request?.requested_label ? ` • ${order.quick_request.requested_label}` : ''}
                  </Text>
                </View>
              ) : null}

              <View style={styles.itemsWrap}>
                {order.items.length > 0 ? (
                  order.items.map((item) => (
                    <Text key={`${order.id}-${item.id}-${item.title}`} style={styles.itemText}>
                      • {item.title} x{item.qty}
                    </Text>
                  ))
                ) : isQuickRequest ? (
                  <Text style={styles.itemText}>
                    • Requested: {order.quick_request?.requested_label ?? 'Tea / Coffee'}
                  </Text>
                ) : null}
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={15} color={tokens.colors.vendorPrimary} />
                <Text style={styles.locationText}>{buildVendorOrderLocation(order)}</Text>
              </View>

              {order.notes ? (
                <View style={styles.noteWrap}>
                  <Text style={styles.noteLabel}>Customer note</Text>
                  <Text style={styles.noteText}>{order.notes}</Text>
                </View>
              ) : null}

              {order.status === 'cancelled' && order.cancel_reason ? (
                <View style={styles.cancelReasonWrap}>
                  <Text style={styles.cancelReasonLabel}>Cancel reason</Text>
                  <Text style={styles.cancelReasonText}>{order.cancel_reason}</Text>
                </View>
              ) : null}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={[styles.totalValue, order.status === 'cancelled' ? styles.totalCancelled : null]}>
                  {isQuickRequest && order.quick_request?.payment_pending
                    ? 'Pending'
                    : formatCurrency(order.total)}
                </Text>
              </View>

              {isQuickRequest && order.quick_request?.payment_pending ? (
                <Text style={styles.quickRequestHint}>
                  Delivery partner will add tea or coffee counts and choose Office Wallet or COD at completion.
                </Text>
              ) : null}

              {nextStatuses.length > 0 ? (
                <View style={styles.actionsRow}>
                  {showCompleteAction ? (
                    <ActionButton
                      label={updatingKey === `${order.id}:complete` ? 'Completing...' : 'Mark Completed'}
                      tone="success"
                      style={styles.halfAction}
                      disabled={updatingKey !== null}
                      onPress={() => {
                        void handleMarkCompleted(order.id, order.status);
                      }}
                    />
                  ) : null}
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
                          if (status === 'cancelled') {
                            openCancelReasonModal(order.id);
                            return;
                          }

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

        {hasMoreOrders ? (
          <Pressable
            style={styles.loadMoreButton}
            onPress={() => {
              setVisibleCounts((current) => ({
                ...current,
                [activeStatus]: current[activeStatus] + ORDER_PAGE_SIZE,
              }));
            }}
          >
            <Text style={styles.loadMoreText}>Load 10 more</Text>
            <Text style={styles.loadMoreMeta}>
              Showing {visibleOrders.length} of {filteredOrders.length} orders
            </Text>
          </Pressable>
        ) : null}

      </ScrollView>

      <Modal
        visible={!!cancelTargetOrder}
        animationType="slide"
        transparent
        onRequestClose={closeCancelReasonModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCancelReasonModal} />

          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.modalSheet, { paddingBottom: modalBottomPadding }]}>
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
                  style={styles.halfAction}
                  disabled={!!updatingKey}
                  onPress={closeCancelReasonModal}
                />
                <ActionButton
                  label={updatingKey === `${cancelTargetOrder?.id}:cancelled` ? 'Cancelling...' : 'Cancel Order'}
                  tone="danger"
                  style={styles.halfAction}
                  disabled={!!updatingKey}
                  onPress={() => {
                    void submitCancelReason();
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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

function statusLabelForOrder(status: OrderStatus): string {
  if (status === 'placed') {
    return 'PENDING';
  }

  return prettifyStatus(status).toUpperCase();
}

function getVisibleTransitions(status: OrderStatus, allowedTransitions: OrderStatus[]): OrderStatus[] {
  const transitions = allowedTransitions.length ? allowedTransitions : getVendorOrderTransitions(status);

  if (status === 'placed') {
    return transitions.filter((entry) => entry === 'cancelled');
  }

  return transitions;
}

function getCompletionPath(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case 'placed':
      return ['accepted', 'preparing', 'out_for_delivery', 'delivered'];
    case 'accepted':
      return ['preparing', 'out_for_delivery', 'delivered'];
    case 'preparing':
      return ['out_for_delivery', 'delivered'];
    case 'out_for_delivery':
      return ['delivered'];
    default:
      return [];
  }
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
  loadMoreButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffd7bd',
    backgroundColor: '#fff7f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  loadMoreText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  loadMoreMeta: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 16,
    padding: 12,
    gap: 9,
  },
  highlightedOrderCard: {
    borderColor: '#ffd0ad',
    backgroundColor: '#fff7f0',
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
  quickRequestBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fff1e5',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickRequestBadgeText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '800',
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
  quickRequestHint: {
    color: '#7f7f89',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14,16,23,0.52)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 28,
  },
  modalSheet: {
    backgroundColor: '#f8f8f9',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 16,
    gap: 12,
    maxHeight: '88%',
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
