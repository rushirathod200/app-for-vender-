import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
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

import { useAuth } from '../../context/AuthContext';
import { useDeliveryApp } from '../../context/DeliveryAppContext';
import { DeliveryOrder } from '../../types/delivery';
import { OrderStatus, QuickRequestPaymentMethod } from '../../types/vendor';
import { formatCurrency, prettifyStatus } from '../../utils/format';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { formatRelativeTime } from '../../utils/vendor';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';
import { NotificationCenterSheet } from '../shared/NotificationCenterSheet';
import { ActionButton, QuantityStepper, SegmentTabs, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

type DeliveryTab = 'pending' | 'completed' | 'cancelled';
const ORDER_PAGE_SIZE = 10;

const tabs: Array<{ key: DeliveryTab; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

interface DeliveryOrdersScreenProps {
  highlightedOrderId?: number | null;
  notificationTapRequestId?: number;
  onHighlightedOrderIdChange?: (orderId: number | null) => void;
  onOpenManualOrders?: () => void;
}

export function DeliveryOrdersScreen({
  highlightedOrderId: controlledHighlightedOrderId,
  notificationTapRequestId = 0,
  onHighlightedOrderIdChange,
  onOpenManualOrders,
}: DeliveryOrdersScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const {
    profile,
    ordersByTab,
    orderCounts,
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
    markAllNotificationsRead,
    updateOrderStatus,
    completeQuickRequest,
  } = useDeliveryApp();

  const [activeTab, setActiveTab] = useState<DeliveryTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [internalHighlightedOrderId, setInternalHighlightedOrderId] = useState<number | null>(null);

  const highlightedOrderId =
    controlledHighlightedOrderId !== undefined ? controlledHighlightedOrderId : internalHighlightedOrderId;
  const setHighlightedOrderId =
    onHighlightedOrderIdChange ?? setInternalHighlightedOrderId;
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [quickRequestTargetOrderId, setQuickRequestTargetOrderId] = useState<number | null>(null);
  const [quickRequestTeaQty, setQuickRequestTeaQty] = useState(0);
  const [quickRequestCoffeeQty, setQuickRequestCoffeeQty] = useState(0);
  const [quickRequestPaymentMethod, setQuickRequestPaymentMethod] = useState<QuickRequestPaymentMethod>('cod');
  const [quickRequestError, setQuickRequestError] = useState<string | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<DeliveryTab, number>>({
    pending: ORDER_PAGE_SIZE,
    completed: ORDER_PAGE_SIZE,
    cancelled: ORDER_PAGE_SIZE,
  });
  const modalBottomPadding = Math.max(insets.bottom, 14) + 8;
  const appliedNotificationTapRef = useRef(0);

  useAutoClearValue(actionError, () => setActionError(null));

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (!notificationTapRequestId) {
      return;
    }

    void refreshOrders({ force: true });
  }, [highlightedOrderId, notificationTapRequestId]);

  useAndroidBackHandler(
    () => {
      setActiveTab('pending');
      return true;
    },
    { enabled: activeTab !== 'pending', priority: 10 },
  );

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

    const nextTab = groupDeliveryOrderStatus(matchedOrder.status);
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

    setActiveTab(nextTab);
    appliedNotificationTapRef.current = notificationTapRequestId;
  }, [highlightedOrderId, notificationTapRequestId, ordersByTab]);

  const filteredOrders = useMemo(() => ordersByTab[activeTab], [activeTab, ordersByTab]);
  const visibleOrders = useMemo(
    () => filteredOrders.slice(0, visibleCounts[activeTab]),
    [activeTab, filteredOrders, visibleCounts],
  );
  const hasMoreOrders = visibleOrders.length < filteredOrders.length;

  const cancelTargetOrder = useMemo(
    () =>
      cancelTargetOrderId
        ? (Object.values(ordersByTab).flat().find((order) => order.id === cancelTargetOrderId) ?? null)
        : null,
    [cancelTargetOrderId, ordersByTab],
  );

  const quickRequestTargetOrder = useMemo(
    () =>
      quickRequestTargetOrderId
        ? (Object.values(ordersByTab).flat().find((order) => order.id === quickRequestTargetOrderId) ?? null)
        : null,
    [ordersByTab, quickRequestTargetOrderId],
  );
  const topMessages = useMemo(
    () => Array.from(new Set([error, actionError].filter((message): message is string => !!message))),
    [actionError, error],
  );

  const quickRequestTotalPreview = useMemo(() => {
    if (!quickRequestTargetOrder?.quick_request) {
      return 0;
    }

    return roundCurrency(
      (quickRequestTeaQty * quickRequestTargetOrder.quick_request.tea_price)
        + (quickRequestCoffeeQty * quickRequestTargetOrder.quick_request.coffee_price),
    );
  }, [quickRequestCoffeeQty, quickRequestTargetOrder, quickRequestTeaQty]);

  const quickRequestPaymentOptions = useMemo<Array<{
    key: QuickRequestPaymentMethod;
    label: string;
    enabled: boolean;
    balance?: number;
    creditEnabled?: boolean;
  }>>(() => {
    const quickRequest = quickRequestTargetOrder?.quick_request;
    if (!quickRequest) {
      return [{ key: 'cod', label: 'Cash', enabled: true }];
    }

    const options: Array<{
      key: QuickRequestPaymentMethod;
      label: string;
      enabled: boolean;
      balance?: number;
      creditEnabled?: boolean;
    }> = [];

    if (quickRequest.office_wallet_available) {
      options.push({
        key: 'office_wallet',
        label: 'Office Wallet',
        enabled: quickRequest.office_wallet_credit_enabled || quickRequest.office_wallet_balance >= quickRequestTotalPreview,
        balance: quickRequest.office_wallet_balance,
        creditEnabled: quickRequest.office_wallet_credit_enabled,
      });
    }

    if (quickRequest.wallet_available && quickRequest.wallet_balance > 0) {
      options.push({
        key: 'wallet',
        label: 'Personal Wallet',
        enabled: quickRequest.wallet_balance >= quickRequestTotalPreview,
        balance: quickRequest.wallet_balance,
      });
    }

    options.push({ key: 'cod', label: 'Cash', enabled: true });

    return options;
  }, [quickRequestTargetOrder, quickRequestTotalPreview]);

  useEffect(() => {
    if (!quickRequestTargetOrder) {
      return;
    }

    const selectedOption = quickRequestPaymentOptions.find((option) => option.key === quickRequestPaymentMethod);
    if (selectedOption?.enabled) {
      return;
    }

    const fallbackOption = quickRequestPaymentOptions.find((option) => option.enabled);
    setQuickRequestPaymentMethod(fallbackOption?.key ?? 'cod');
  }, [quickRequestPaymentMethod, quickRequestPaymentOptions, quickRequestTargetOrder]);

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

  const openQuickRequestModal = (order: DeliveryOrder): void => {
    setQuickRequestTargetOrderId(order.id);
    setQuickRequestTeaQty(order.quick_request?.suggested_tea_qty ?? 0);
    setQuickRequestCoffeeQty(order.quick_request?.suggested_coffee_qty ?? 0);
    setQuickRequestPaymentMethod('cod');
    setQuickRequestError(null);
  };

  const closeQuickRequestModal = (): void => {
    if (updatingKey) {
      return;
    }

    setQuickRequestTargetOrderId(null);
    setQuickRequestTeaQty(0);
    setQuickRequestCoffeeQty(0);
    setQuickRequestPaymentMethod('cod');
    setQuickRequestError(null);
  };

  const submitQuickRequestCompletion = async (): Promise<void> => {
    if (!quickRequestTargetOrder) {
      return;
    }

    if (quickRequestTeaQty + quickRequestCoffeeQty <= 0) {
      setQuickRequestError('Add at least one tea or coffee.');
      return;
    }

    const key = `${quickRequestTargetOrder.id}:quick-request-complete`;
    setUpdatingKey(key);
    setActionError(null);
    setQuickRequestError(null);

    try {
      await completeQuickRequest(quickRequestTargetOrder.id, {
        tea_qty: quickRequestTeaQty,
        coffee_qty: quickRequestCoffeeQty,
        payment_method: quickRequestPaymentMethod,
      });
      setQuickRequestTargetOrderId(null);
      setQuickRequestTeaQty(0);
      setQuickRequestCoffeeQty(0);
      setQuickRequestPaymentMethod('cod');
      setQuickRequestError(null);
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : 'Could not complete quick request.';
      setActionError(message);
      setQuickRequestError(message);
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
      await refreshOrders({ force: true });
    } catch {
      return;
    }

    setHighlightedOrderId(orderId);
    setNotificationsVisible(false);
  };

  const openNotificationCenter = (): void => {
    setNotificationsVisible(true);
    void markAllNotificationsRead().catch(() => undefined);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, styles.contentGrow]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading || ordersLoading || notificationsLoading}
            onRefresh={() => {
              void refreshAll({ force: true });
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
                {profile?.active_order_count ?? orderCounts.pending} active delivery orders
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                onPress={openNotificationCenter}
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
            tabs={tabs.map((tab) => ({ key: tab.key, label: tab.label, count: orderCounts[tab.key] }))}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as DeliveryTab)}
            palette="delivery"
          />

          <ActionButton
            label="Manual Order"
            tone="muted"
            icon="create-outline"
            onPress={() => onOpenManualOrders?.()}
            style={styles.manualOrderButton}
          />
        </View>

        {topMessages.map((message) => (
          <Text key={message} style={styles.errorText}>{message}</Text>
        ))}
        {filteredOrders.length === 0 ? <Text style={styles.emptyText}>No deliveries in this tab.</Text> : null}

        {visibleOrders.map((order) => {
          const nextStatuses = order.allowed_transitions.length
            ? order.allowed_transitions
            : getDeliveryTransitions(order.status);
          const showCompleteAction = nextStatuses.includes('delivered');
          const canCancel = order.can_cancel_order && nextStatuses.includes('cancelled');
          const isQuickRequest = order.order_channel === 'office_quick_request';

          return (
            <View
              key={order.id}
              style={[styles.orderCard, highlightedOrderId === order.id ? styles.highlightedOrderCard : null]}
            >
              <View style={styles.rowBetween}>
                <View style={styles.orderPrimaryCopy}>
                  <Text style={styles.customerPrimaryText}>
                    {order.customer_name ?? order.ordered_by_name ?? 'Customer'}
                  </Text>
                  <Text style={styles.orderReference}>{order.order_no}</Text>
                </View>
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

              {isQuickRequest ? (
                <View style={styles.quickRequestBadge}>
                  <Text style={styles.quickRequestBadgeText}>
                    Quick Request{order.quick_request?.requested_label ? ` • ${order.quick_request.requested_label}` : ''}
                  </Text>
                </View>
              ) : null}

              <View style={styles.locationTagGreen}>
                <Text style={styles.locationTagLabel}>PICKUP FROM</Text>
                <Text style={styles.locationTagText}>{buildPickupLabel(order)}</Text>
              </View>

              <View style={styles.locationTagBlue}>
                <Text style={styles.locationTagLabelBlue}>DELIVER TO</Text>
                <Text style={styles.locationTagText}>{buildDeliveryLabel(order)}</Text>
              </View>

              <DeliveryItemsTable order={order} />

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

              <DeliveryPriceSummary order={order} />

              {showCompleteAction || canCancel ? (
                <View style={styles.actionsRow}>
                  {showCompleteAction ? (
                    <ActionButton
                      label={
                        isQuickRequest
                          ? updatingKey === `${order.id}:quick-request-complete`
                            ? 'Saving...'
                            : 'Complete Quick Request'
                          : updatingKey === `${order.id}:complete`
                            ? 'Completing...'
                            : 'Mark Completed'
                      }
                      tone="success"
                      style={styles.mainAction}
                      disabled={updatingKey !== null}
                      onPress={() => {
                        if (isQuickRequest) {
                          openQuickRequestModal(order);
                          return;
                        }

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

        {hasMoreOrders ? (
          <Pressable
            style={styles.loadMoreButton}
            onPress={() => {
              setVisibleCounts((current) => ({
                ...current,
                [activeTab]: current[activeTab] + ORDER_PAGE_SIZE,
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
          void refreshNotifications({ force: true });
        }}
        onSelectNotification={(notification) => {
          void handleNotificationOpen(notification.id, notification.order_id);
        }}
      />
      <Modal
        visible={!!quickRequestTargetOrder}
        animationType="slide"
        transparent
        onRequestClose={closeQuickRequestModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 12}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeQuickRequestModal} />

          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.modalSheet, { paddingBottom: modalBottomPadding }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <Ionicons name="cafe-outline" size={22} color={tokens.colors.deliveryPrimary} />
                  <Text style={styles.modalTitle}>Complete Quick Request</Text>
                </View>

                <Pressable style={styles.closeModalButton} onPress={closeQuickRequestModal} disabled={!!updatingKey}>
                  <Ionicons name="close" size={18} color="#7f7f89" />
                </Pressable>
              </View>

              <Text style={styles.modalPrompt}>
                {quickRequestTargetOrder?.quick_request?.requested_label
                  ? `Requested: ${quickRequestTargetOrder.quick_request.requested_label}`
                  : 'Enter the final tea and coffee count for this request.'}
              </Text>

              <View style={styles.quickRequestRow}>
                <View style={styles.quickRequestField}>
                  <QuantityStepper
                    label="Tea Qty"
                    value={quickRequestTeaQty}
                    onChange={(value) => {
                      setQuickRequestTeaQty(value);
                      if (quickRequestError) {
                        setQuickRequestError(null);
                      }
                    }}
                    tone="delivery"
                  />
                </View>

                <View style={styles.quickRequestField}>
                  <QuantityStepper
                    label="Coffee Qty"
                    value={quickRequestCoffeeQty}
                    onChange={(value) => {
                      setQuickRequestCoffeeQty(value);
                      if (quickRequestError) {
                        setQuickRequestError(null);
                      }
                    }}
                    tone="delivery"
                  />
                </View>
              </View>

              <View style={styles.quickRequestPreviewCard}>
                <Text style={styles.quickRequestPreviewLabel}>Total Preview</Text>
                <Text style={styles.quickRequestPreviewValue}>{formatCurrency(quickRequestTotalPreview)}</Text>
              </View>

              <View style={styles.paymentOptionsWrap}>
                <Text style={styles.quickRequestLabel}>Cut payment from</Text>

                <View style={styles.paymentOptionsRow}>
                  {quickRequestPaymentOptions.map((option) => (
                    <Pressable
                      key={option.key}
                      style={[
                        styles.paymentOption,
                        quickRequestPaymentMethod === option.key ? styles.paymentOptionActive : null,
                        !option.enabled ? styles.paymentOptionDisabled : null,
                      ]}
                      onPress={() => {
                        if (!option.enabled) {
                          return;
                        }

                        setQuickRequestPaymentMethod(option.key);
                      }}
                    >
                      <Text
                        style={[
                          styles.paymentOptionText,
                          quickRequestPaymentMethod === option.key ? styles.paymentOptionTextActive : null,
                          !option.enabled ? styles.paymentOptionTextDisabled : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {quickRequestPaymentOptions
                  .filter((option) => option.key !== 'cod' && typeof option.balance === 'number')
                  .map((option) => (
                    <Text key={`${option.key}-balance`} style={styles.paymentHintText}>
                      {option.label}: {formatCurrency(option.balance ?? 0)}
                      {option.key === 'office_wallet' && option.creditEnabled
                        ? ` available. Credit is ON, so the wallet can go to ${formatCurrency((option.balance ?? 0) - quickRequestTotalPreview)}.`
                        : !option.enabled && quickRequestTotalPreview > 0
                          ? ' available, not enough for this total.'
                          : ''}
                    </Text>
                  ))}
              </View>

              {quickRequestError ? <Text style={styles.errorText}>{quickRequestError}</Text> : null}

              <View style={styles.modalActionsRow}>
                <ActionButton
                  label="Back"
                  tone="muted"
                  style={styles.mainAction}
                  disabled={!!updatingKey}
                  onPress={closeQuickRequestModal}
                />
                <ActionButton
                  label={
                    updatingKey === `${quickRequestTargetOrder?.id}:quick-request-complete`
                      ? 'Saving...'
                      : 'Complete'
                  }
                  tone="success"
                  style={styles.mainAction}
                  disabled={!!updatingKey}
                  onPress={() => {
                    void submitQuickRequestCompletion();
                  }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
          </ScrollView>
        </KeyboardAvoidingView>
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

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
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

function DeliveryItemsTable({ order }: { order: DeliveryOrder }) {
  if (order.items.length === 0 && order.quick_request) {
    return (
      <View style={styles.itemsBox}>
        <Text style={styles.itemTitle}>Requested: {order.quick_request.requested_label ?? 'Tea / Coffee'}</Text>
        <Text style={styles.itemCalculation}>Final quantity and price will be added at completion</Text>
      </View>
    );
  }

  return (
    <View style={styles.itemsBox}>
      {order.items.map((item, index) => (
        <View key={`${order.id}-${item.id}-${item.title}`}>
          <View style={styles.itemRow}>
            <View style={styles.itemCopy}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {item.variant_name ? <Text style={styles.itemVariant}>{item.variant_name}</Text> : null}
              <Text style={styles.itemCalculation}>{item.qty} × {formatCurrency(item.unit_price)}</Text>
            </View>
            <Text style={styles.itemLineTotal}>{formatCurrency(item.line_total)}</Text>
          </View>
          {index < order.items.length - 1 ? <View style={styles.itemSeparator} /> : null}
        </View>
      ))}
    </View>
  );
}

function DeliveryPriceSummary({ order }: { order: DeliveryOrder }) {
  const paymentPending = order.order_channel === 'office_quick_request' && order.quick_request?.payment_pending;
  const paymentLabel = deliveryPaymentLabel(order.payment_method ?? order.quick_request?.payment_method ?? null);

  if (paymentPending) {
    return (
      <View style={styles.priceSummary}>
        <View style={styles.priceTotalRow}>
          <Text style={styles.priceTotalLabel}>Total</Text>
          <Text style={styles.pricePendingValue}>Pending</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.priceSummary}>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Items subtotal</Text>
        <Text style={styles.priceValue}>{formatCurrency(order.subtotal)}</Text>
      </View>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Delivery fee</Text>
        <Text style={styles.priceValue}>{order.delivery_fee > 0 ? formatCurrency(order.delivery_fee) : 'Free'}</Text>
      </View>
      <View style={styles.priceDivider} />
      <View style={styles.priceTotalRow}>
        <Text style={styles.priceTotalLabel}>Total</Text>
        <Text style={[styles.priceTotalValue, order.status === 'cancelled' ? styles.cancelledValue : null]}>
          {formatCurrency(order.total)}
        </Text>
      </View>
      {paymentLabel ? (
        <View style={styles.paymentRow}>
          <Ionicons name="wallet-outline" size={14} color="#6b7280" />
          <Text style={styles.paymentText}>Payment: {paymentLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

function deliveryPaymentLabel(paymentMethod: string | null): string | null {
  if (!paymentMethod) {
    return null;
  }

  const normalized = paymentMethod.trim().toLowerCase();
  const knownLabels: Record<string, string> = {
    cod: 'Cash on delivery',
    cash: 'Cash',
    cash_on_delivery: 'Cash on delivery',
    office_wallet: 'Office Wallet',
    wallet: 'Customer Wallet',
    online: 'Online',
  };

  return knownLabels[normalized]
    ?? normalized.split('_').filter(Boolean).map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
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
  contentGrow: {
    flexGrow: 1,
  },
  heroCard: {
    backgroundColor: tokens.colors.deliveryPrimary,
    borderRadius: 22,
    padding: 12,
    gap: 8,
  },
  manualOrderButton: {
    marginTop: 4,
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
  loadMoreButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cfd4ff',
    backgroundColor: '#f6f7ff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  loadMoreText: {
    color: tokens.colors.deliveryPrimary,
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
  orderPrimaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  customerPrimaryText: {
    color: '#212127',
    fontSize: 18,
    fontWeight: '900',
  },
  orderReference: {
    color: '#92929c',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickRequestBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickRequestBadgeText: {
    color: tokens.colors.deliveryPrimary,
    fontSize: 11,
    fontWeight: '800',
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
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e8ef',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: '#28282e',
    fontSize: 14,
    fontWeight: '800',
  },
  itemVariant: {
    color: tokens.colors.deliveryPrimary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  itemCalculation: {
    color: '#888892',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  itemLineTotal: {
    color: '#28282e',
    fontSize: 14,
    fontWeight: '900',
  },
  itemSeparator: {
    height: 1,
    backgroundColor: '#eeeef2',
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
  priceSummary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dfe2f4',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 7,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '700',
  },
  priceValue: {
    color: '#4f4f58',
    fontSize: 13,
    fontWeight: '800',
  },
  priceDivider: {
    height: 1,
    backgroundColor: '#ececf1',
    marginVertical: 2,
  },
  priceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceTotalLabel: {
    color: '#28282e',
    fontSize: 15,
    fontWeight: '900',
  },
  priceTotalValue: {
    color: '#1f2025',
    fontSize: 22,
    fontWeight: '900',
  },
  pricePendingValue: {
    color: tokens.colors.deliveryPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  paymentText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
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
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 28,
    paddingBottom: 12,
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
  quickRequestRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickRequestField: {
    flex: 1,
    gap: 6,
  },
  quickRequestLabel: {
    color: '#5f5f69',
    fontSize: 12,
    fontWeight: '800',
  },
  quickRequestPreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e9f6',
    backgroundColor: '#f7f9ff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  quickRequestPreviewLabel: {
    color: '#5f6b88',
    fontSize: 12,
    fontWeight: '800',
  },
  quickRequestPreviewValue: {
    color: '#1f2430',
    fontSize: 22,
    fontWeight: '900',
  },
  paymentOptionsWrap: {
    gap: 8,
  },
  paymentOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  paymentOption: {
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dfe1e9',
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    minWidth: 110,
    flexGrow: 1,
  },
  paymentOptionActive: {
    borderColor: tokens.colors.deliveryPrimary,
    backgroundColor: '#eef2ff',
  },
  paymentOptionDisabled: {
    opacity: 0.55,
  },
  paymentOptionText: {
    color: '#71717b',
    fontSize: 13,
    fontWeight: '800',
  },
  paymentOptionTextActive: {
    color: tokens.colors.deliveryPrimary,
  },
  paymentOptionTextDisabled: {
    color: '#9393a1',
  },
  paymentHintText: {
    color: '#6e7483',
    fontSize: 12,
    fontWeight: '600',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
