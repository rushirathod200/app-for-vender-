import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useVendorApp } from '../../context/VendorAppContext';
import { NotificationOrderAction } from '../../context/NotificationTapContext';
import { fetchVendorOrder } from '../../api/vendorApi';
import { OrderStatus, PrintOrderFile, QuickRequestPaymentMethod, VendorOrder } from '../../types/vendor';
import { formatCurrency, prettifyStatus } from '../../utils/format';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import {
  buildVendorOrderLocation,
  formatRelativeTime,
  getVendorOrderTransitions,
  groupVendorOrderStatus,
} from '../../utils/vendor';
import { ActionButton, QuantityStepper, SectionTitle, SegmentTabs, StatusBadge } from '../shared/ui';
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
  notificationAction?: NotificationOrderAction;
  notificationReason?: string | null;
  notificationHandledExternally?: boolean;
}

export function VendorOrdersScreen({
  highlightedOrderId = null,
  notificationTapRequestId = 0,
  notificationAction = null,
  notificationReason = null,
  notificationHandledExternally = false,
}: VendorOrdersScreenProps) {
  const insets = useSafeAreaInsets();
  const {
    ordersByTab,
    orderCounts,
    ordersHasMore,
    ordersLoading,
    ordersLoadingMoreTab,
    error,
    refreshOrders,
    loadMoreOrders,
    updateOrderStatus,
    completeQuickRequest,
  } = useVendorApp();
  const [activeStatus, setActiveStatus] = useState<OrderTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [fileActionKey, setFileActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<number | null>(null);
  const [popupOrderId, setPopupOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [quickRequestTargetOrderId, setQuickRequestTargetOrderId] = useState<number | null>(null);
  const [quickRequestTeaQty, setQuickRequestTeaQty] = useState(0);
  const [quickRequestCoffeeQty, setQuickRequestCoffeeQty] = useState(0);
  const [quickRequestPaymentMethod, setQuickRequestPaymentMethod] = useState<QuickRequestPaymentMethod>('cod');
  const [quickRequestError, setQuickRequestError] = useState<string | null>(null);
  const modalBottomPadding = Math.max(insets.bottom, 14) + 8;
  const appliedNotificationTapRef = useRef(0);
  const refreshOrdersRef = useRef(refreshOrders);

  useAutoClearValue(actionError, () => setActionError(null));

  useEffect(() => {
    refreshOrdersRef.current = refreshOrders;
  }, [refreshOrders]);

  useEffect(() => {
    void refreshOrders();
  }, []);

  useEffect(() => {
    if (!notificationTapRequestId || (notificationAction && !notificationHandledExternally)) {
      return;
    }

    void refreshOrders({ force: true });
  }, [highlightedOrderId, notificationAction, notificationHandledExternally, notificationTapRequestId]);

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

    if (notificationHandledExternally && matchedOrder.status === 'placed') {
      return;
    }

    const nextTab = groupVendorOrderStatus(matchedOrder.status);
    setActiveStatus(nextTab);
    appliedNotificationTapRef.current = notificationTapRequestId;

    if (notificationHandledExternally) {
      setPopupOrderId(null);
      setActionError(null);
      return;
    }

    if (notificationAction) {
      setPopupOrderId(null);
      setActionError(null);

      if (matchedOrder.status === 'placed') {
        const nextStatus: OrderStatus = notificationAction === 'accepted' ? 'accepted' : 'cancelled';
        const key = `${matchedOrder.id}:${nextStatus}`;
        setUpdatingKey(key);

        void updateOrderStatus(
          matchedOrder.id,
          nextStatus,
          nextStatus === 'cancelled' ? (notificationReason?.trim() || 'Rejected by vendor') : undefined,
        )
          .catch((updateError) => {
            setActionError(updateError instanceof Error ? updateError.message : 'Could not update order.');
          })
          .finally(() => {
            setUpdatingKey(null);
          });
      }

      return;
    }

    if (matchedOrder.status === 'placed') {
      setPopupOrderId(matchedOrder.id);
    } else {
      setPopupOrderId(null);
      setActionError(null);
    }
  }, [highlightedOrderId, notificationAction, notificationHandledExternally, notificationReason, notificationTapRequestId, ordersByTab, updateOrderStatus]);

  useEffect(() => {
    if (!popupOrderId) {
      return;
    }

    const refreshTimer = setInterval(() => {
      void refreshOrdersRef.current({ force: true });
    }, 3_000);

    return () => clearInterval(refreshTimer);
  }, [popupOrderId]);

  const filteredOrders = useMemo(() => ordersByTab[activeStatus], [activeStatus, ordersByTab]);
  const visibleOrders = filteredOrders;
  const hasMoreOrders = ordersHasMore[activeStatus];

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
  const popupOrder = useMemo(
    () =>
      popupOrderId
        ? (Object.values(ordersByTab).flat().find((order) => order.id === popupOrderId) ?? null)
        : null,
    [ordersByTab, popupOrderId],
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

  useEffect(() => {
    if (popupOrderId && (!popupOrder || popupOrder.status !== 'placed')) {
      setPopupOrderId(null);
    }
  }, [popupOrder, popupOrderId]);

  const topMessages = useMemo(
    () => Array.from(new Set([error, actionError].filter((message): message is string => !!message))),
    [actionError, error],
  );

  const handleStatusUpdate = useCallback(async (
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
  }, [updateOrderStatus]);

  const handlePrintFileAction = useCallback(async (
    orderId: number,
    file: PrintOrderFile,
    action: 'download' | 'share',
  ): Promise<void> => {
    const key = `${orderId}:${file.id}:${action}`;
    setFileActionKey(key);
    setActionError(null);

    try {
      // Signed print URLs expire after 30 minutes, so always refresh the order before opening one.
      const freshOrder = await fetchVendorOrder(orderId);
      const freshFile = freshOrder?.print_order?.files.find((candidate) => candidate.id === file.id);
      const url = action === 'share'
        ? (freshFile?.share_url ?? freshFile?.download_url)
        : freshFile?.download_url;

      if (!url) {
        throw new Error('This print file is not available right now. Pull to refresh and try again.');
      }

      if (action === 'share') {
        await Share.share({
          title: freshFile?.original_name ?? file.original_name,
          message: url,
          url,
        });
      } else {
        await Linking.openURL(url);
      }
    } catch (fileError) {
      setActionError(fileError instanceof Error ? fileError.message : 'Could not open this print file.');
    } finally {
      setFileActionKey(null);
    }
  }, []);

  const handleCallCustomer = useCallback(async (phoneNumber: string | null): Promise<void> => {
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
  }, []);

  const openCancelReasonModal = useCallback((orderId: number): void => {
    setCancelTargetOrderId(orderId);
    setCancelReason('');
    setCancelReasonError(null);
  }, []);

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

  const openQuickRequestModal = useCallback((order: VendorOrder): void => {
    setQuickRequestTargetOrderId(order.id);
    setQuickRequestTeaQty(order.quick_request?.suggested_tea_qty ?? 0);
    setQuickRequestCoffeeQty(order.quick_request?.suggested_coffee_qty ?? 0);
    setQuickRequestPaymentMethod('cod');
    setQuickRequestError(null);
  }, []);

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
    } catch (completionError) {
      const message = completionError instanceof Error
        ? completionError.message
        : 'Could not complete quick request.';
      setActionError(message);
      setQuickRequestError(message);
    } finally {
      setUpdatingKey(null);
    }
  };

  const closeOrderPopup = (): void => {
    if (updatingKey) {
      return;
    }

    setPopupOrderId(null);
  };

  const acceptPopupOrder = async (): Promise<void> => {
    if (!popupOrder) {
      return;
    }

    try {
      await handleStatusUpdate(popupOrder.id, 'accepted');
      setPopupOrderId(null);
    } catch {
      // Error state is handled by handleStatusUpdate.
    }
  };

  const rejectPopupOrder = async (): Promise<void> => {
    if (!popupOrder) {
      return;
    }

    try {
      await handleStatusUpdate(popupOrder.id, 'cancelled', 'Rejected by vendor');
      setPopupOrderId(null);
    } catch {
      // Error state is handled by handleStatusUpdate.
    }
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={visibleOrders}
        keyExtractor={(order) => String(order.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={ordersLoading}
            onRefresh={() => {
              void refreshOrders({ force: true });
            }}
          />
        }
        ListHeaderComponent={(
          <View style={styles.listHeader}>
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
            {filteredOrders.length === 0 && !ordersLoading ? (
              <OrdersEmptyState status={activeStatus} />
            ) : null}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.orderSeparator} />}
        renderItem={({ item: order }) => (
          <OrderCard
            order={order}
            highlighted={highlightedOrderId === order.id}
            updating={updatingKey !== null}
            activeFileActionKey={fileActionKey}
            onCallCustomer={handleCallCustomer}
            onFileAction={handlePrintFileAction}
            onCancel={openCancelReasonModal}
            onCompleteQuickRequest={openQuickRequestModal}
            onStatusUpdate={handleStatusUpdate}
          />
        )}
        ListFooterComponent={hasMoreOrders ? (
          <Pressable
            style={styles.loadMoreButton}
            disabled={ordersLoadingMoreTab !== null}
            onPress={() => {
              void loadMoreOrders(activeStatus);
            }}
          >
            <Text style={styles.loadMoreText}>
              {ordersLoadingMoreTab === activeStatus ? 'Loading...' : `Load ${ORDER_PAGE_SIZE} more`}
            </Text>
            <Text style={styles.loadMoreMeta}>
              Showing {visibleOrders.length} of {orderCounts[activeStatus]} orders
            </Text>
          </Pressable>
        ) : null}
      />

      <Modal
        visible={!!popupOrder}
        animationType="slide"
        transparent
        onRequestClose={closeOrderPopup}
      >
        <View style={styles.popupOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOrderPopup} />

          {popupOrder ? (
            <View style={[
              styles.newOrderSheet,
              popupOrder.order_channel === 'office_quick_request' ? styles.quickRequestPopupSheet : null,
              { paddingBottom: modalBottomPadding },
            ]}>
              <View style={styles.popupHeader}>
                <View style={styles.popupHeaderCopy}>
                  <Text style={styles.popupTitle}>
                    {popupOrder.order_channel === 'office_quick_request' ? 'New Quick Request' : 'New Order'}
                  </Text>
                  <Text style={styles.popupSubtitle}>
                    {popupOrder.order_channel === 'office_quick_request' && popupOrder.quick_request?.requested_label
                      ? `${popupOrder.quick_request.requested_label} • Confirm and respond`
                      : `${popupOrder.order_no} • Respond quickly`}
                  </Text>
                </View>
                <Pressable style={styles.popupCloseButton} onPress={closeOrderPopup} disabled={!!updatingKey}>
                  <Ionicons name="close" size={20} color="#5f6470" />
                </Pressable>
              </View>

              <ScrollView
                style={styles.popupBody}
                contentContainerStyle={styles.popupBodyContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.popupInfoCard}>
                  <View style={styles.popupInfoRow}>
                    <View style={styles.popupInfoIcon}>
                      <Ionicons name="location" size={18} color={tokens.colors.vendorPrimary} />
                    </View>
                    <View style={styles.popupInfoCopy}>
                      <Text style={styles.popupInfoLabel}>Deliver to</Text>
                      <Text style={styles.popupAddressValue}>{buildVendorOrderLocation(popupOrder)}</Text>
                    </View>
                  </View>
                  <View style={styles.popupInfoSeparator} />
                  <View style={styles.popupInfoRow}>
                    <View style={styles.popupInfoIcon}>
                      <Ionicons name="person-outline" size={17} color={tokens.colors.vendorPrimary} />
                    </View>
                    <View style={styles.popupInfoCopy}>
                      <Text style={styles.popupInfoLabel}>Customer</Text>
                      <Text style={styles.popupInfoValue}>{popupOrder.customer_name ?? 'Customer'}</Text>
                    </View>
                    {popupOrder.customer_mobile ? (
                      <Pressable
                        style={styles.popupCallButton}
                        onPress={() => {
                          void handleCallCustomer(popupOrder.customer_mobile);
                        }}
                      >
                        <Ionicons name="call" size={17} color="#ffffff" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <Text style={styles.popupSectionTitle}>
                  {popupOrder.order_channel === 'office_quick_request' ? 'Request details' : 'Order items'}
                </Text>
                <PopupOrderItems order={popupOrder} />

                <OrderPriceSummary order={popupOrder} mode="popup" />

                {popupOrder.notes ? (
                  <View style={styles.popupNoteWrap}>
                    <Ionicons name="chatbox-ellipses-outline" size={17} color="#b45309" />
                    <View style={styles.popupInfoCopy}>
                      <Text style={styles.popupNoteLabel}>Customer note</Text>
                      <Text style={styles.popupNoteText}>{popupOrder.notes}</Text>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.popupMeta}>
                  {popupOrder.order_no} • {formatRelativeTime(popupOrder.placed_at)}
                </Text>
              </ScrollView>

              <View style={styles.popupActionsRow}>
                <Pressable
                  style={[styles.popupActionButton, styles.popupRejectButton]}
                  disabled={!!updatingKey}
                  onPress={() => {
                    void rejectPopupOrder();
                  }}
                >
                  <Text style={styles.popupRejectText}>
                    {updatingKey === `${popupOrder.id}:cancelled` ? 'Rejecting...' : 'Reject'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.popupActionButton, styles.popupAcceptButton]}
                  disabled={!!updatingKey}
                  onPress={() => {
                    void acceptPopupOrder();
                  }}
                >
                  <Text style={styles.popupAcceptText}>
                    {updatingKey === `${popupOrder.id}:accepted` ? 'Accepting...' : 'Accept'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={!!quickRequestTargetOrder}
        animationType="slide"
        transparent
        onRequestClose={closeQuickRequestModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeQuickRequestModal} />

          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.modalSheet, styles.quickRequestModalSheet, { paddingBottom: modalBottomPadding }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleWrap}>
                  <View style={styles.quickRequestModalIcon}>
                    <Ionicons name="cafe-outline" size={20} color={tokens.colors.vendorPrimary} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>Complete Quick Request</Text>
                    <Text style={styles.quickRequestModalSubtitle}>
                      {quickRequestTargetOrder?.quick_request?.requested_label
                        ? `Requested: ${quickRequestTargetOrder.quick_request.requested_label}`
                        : 'Confirm the final served quantities'}
                    </Text>
                  </View>
                </View>

                <Pressable style={styles.closeModalButton} onPress={closeQuickRequestModal} disabled={!!updatingKey}>
                  <Ionicons name="close" size={18} color="#7f7f89" />
                </Pressable>
              </View>

              <View style={styles.quickRequestInfoCard}>
                <Ionicons name="location-outline" size={18} color="#a45a20" />
                <View style={styles.quickRequestInfoCopy}>
                  <Text style={styles.quickRequestInfoLabel}>Deliver to</Text>
                  <Text style={styles.quickRequestInfoValue}>
                    {quickRequestTargetOrder ? buildVendorOrderLocation(quickRequestTargetOrder) : '--'}
                  </Text>
                </View>
              </View>

              <View style={styles.quickRequestRow}>
                <View style={styles.quickRequestField}>
                  <QuantityStepper
                    label={`Tea • ${formatCurrency(quickRequestTargetOrder?.quick_request?.tea_price ?? 0)}`}
                    value={quickRequestTeaQty}
                    onChange={(value) => {
                      setQuickRequestTeaQty(value);
                      setQuickRequestError(null);
                    }}
                    tone="vendor"
                  />
                </View>

                <View style={styles.quickRequestField}>
                  <QuantityStepper
                    label={`Coffee • ${formatCurrency(quickRequestTargetOrder?.quick_request?.coffee_price ?? 0)}`}
                    value={quickRequestCoffeeQty}
                    onChange={(value) => {
                      setQuickRequestCoffeeQty(value);
                      setQuickRequestError(null);
                    }}
                    tone="vendor"
                  />
                </View>
              </View>

              <View style={styles.quickRequestPreviewCard}>
                <View>
                  <Text style={styles.quickRequestPreviewLabel}>Final amount</Text>
                  <Text style={styles.quickRequestPreviewHint}>Based on quantities served</Text>
                </View>
                <Text style={styles.quickRequestPreviewValue}>{formatCurrency(quickRequestTotalPreview)}</Text>
              </View>

              <View style={styles.paymentOptionsWrap}>
                <Text style={styles.quickRequestLabel}>Payment method</Text>
                <View style={styles.paymentOptionsRow}>
                  {quickRequestPaymentOptions.map((option) => (
                    <Pressable
                      key={option.key}
                      disabled={!option.enabled}
                      style={[
                        styles.paymentOption,
                        quickRequestPaymentMethod === option.key ? styles.paymentOptionActive : null,
                        !option.enabled ? styles.paymentOptionDisabled : null,
                      ]}
                      onPress={() => setQuickRequestPaymentMethod(option.key)}
                    >
                      <Ionicons
                        name={option.key === 'cod' ? 'cash-outline' : 'wallet-outline'}
                        size={16}
                        color={quickRequestPaymentMethod === option.key ? tokens.colors.vendorPrimary : '#777782'}
                      />
                      <Text style={[
                        styles.paymentOptionText,
                        quickRequestPaymentMethod === option.key ? styles.paymentOptionTextActive : null,
                      ]}>
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
                        ? ' • Credit enabled'
                        : !option.enabled && quickRequestTotalPreview > 0
                          ? ' • Insufficient balance'
                          : ''}
                    </Text>
                  ))}
              </View>

              {quickRequestError ? <Text style={styles.errorText}>{quickRequestError}</Text> : null}

              <View style={styles.modalActionsRow}>
                <ActionButton
                  label="Back"
                  tone="muted"
                  style={styles.halfAction}
                  disabled={!!updatingKey}
                  onPress={closeQuickRequestModal}
                />
                <ActionButton
                  label={
                    updatingKey === `${quickRequestTargetOrder?.id}:quick-request-complete`
                      ? 'Completing...'
                      : 'Complete & Save'
                  }
                  tone="success"
                  style={styles.halfAction}
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

const OrderCard = React.memo(function OrderCard({
  order,
  highlighted,
  updating,
  activeFileActionKey,
  onCallCustomer,
  onFileAction,
  onCancel,
  onCompleteQuickRequest,
  onStatusUpdate,
}: {
  order: VendorOrder;
  highlighted: boolean;
  updating: boolean;
  activeFileActionKey: string | null;
  onCallCustomer: (phoneNumber: string | null) => Promise<void>;
  onFileAction: (orderId: number, file: PrintOrderFile, action: 'download' | 'share') => Promise<void>;
  onCancel: (orderId: number) => void;
  onCompleteQuickRequest: (order: VendorOrder) => void;
  onStatusUpdate: (orderId: number, status: OrderStatus) => Promise<void>;
}) {
  const isQuickRequest = order.order_channel === 'office_quick_request';
  const isPrintOrder = order.order_channel === 'print' || !!order.print_order;
  const nextStatuses = getVisibleTransitions(order.status, order.allowed_transitions);

  return (
    <View style={[
      styles.orderCard,
      isQuickRequest ? styles.quickRequestOrderCard : null,
      highlighted ? styles.highlightedOrderCard : null,
    ]}>
      <View style={styles.rowBetween}>
        <View style={styles.orderPrimaryCopy}>
          <Text style={styles.customerPrimaryText}>{order.customer_name ?? 'Customer'}</Text>
          <Text style={styles.orderReference}>{order.order_no}</Text>
        </View>
        <StatusBadge label={statusLabelForOrder(order.status)} tone={toneForStatus(order.status)} />
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="call-outline" size={15} color="#8b8b95" />
        <Pressable
          accessibilityLabel={order.customer_mobile ? `Call customer at ${order.customer_mobile}` : undefined}
          accessibilityRole="link"
          disabled={!order.customer_mobile}
          hitSlop={8}
          onPress={() => {
            void onCallCustomer(order.customer_mobile);
          }}
        >
          <Text style={[styles.metaText, order.customer_mobile ? styles.callText : null]}>
            {order.customer_mobile ?? '--'}
          </Text>
        </Pressable>
        <View style={styles.dotSpacer} />
        <Ionicons name="time-outline" size={15} color="#b3b3bc" />
        <Text style={styles.timeText}>{formatRelativeTime(order.placed_at)}</Text>
      </View>

      <View style={styles.deliveryAddressCard}>
        <View style={styles.deliveryAddressIcon}>
          <Ionicons name="location" size={17} color={tokens.colors.vendorPrimary} />
        </View>
        <View style={styles.deliveryAddressCopy}>
          <Text style={styles.deliveryAddressLabel}>Deliver to</Text>
          <Text style={styles.deliveryAddressText}>{buildVendorOrderLocation(order)}</Text>
        </View>
      </View>

      {isQuickRequest ? (
        <View style={styles.quickRequestBadge}>
          <Text style={styles.quickRequestBadgeText}>
            Quick Request{order.quick_request?.requested_label ? ` • ${order.quick_request.requested_label}` : ''}
          </Text>
        </View>
      ) : null}

      {isPrintOrder ? (
        <PrintOrderFiles
          order={order}
          activeActionKey={activeFileActionKey}
          onFileAction={(file, action) => {
            void onFileAction(order.id, file, action);
          }}
        />
      ) : (
        <OrderItemsTable order={order} />
      )}

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

      <OrderPriceSummary order={order} mode="card" />

      {isQuickRequest && order.quick_request?.payment_pending ? (
        <Text style={styles.quickRequestHint}>
          Vendor or delivery partner can confirm Tea/Coffee quantities and payment at completion.
        </Text>
      ) : null}

      {nextStatuses.length > 0 ? (
        <View style={styles.actionsRow}>
          {nextStatuses.map((status) => (
            <ActionButton
              key={`${order.id}:${status}`}
              label={isQuickRequest && status === 'delivered' ? 'Complete Quick Request' : labelForTransition(status)}
              tone={status === 'cancelled' ? 'danger' : status === 'delivered' ? 'success' : 'vendor'}
              style={[styles.halfAction, isQuickRequest ? styles.quickRequestActionButton : null]}
              labelStyle={isQuickRequest && status === 'delivered' ? styles.quickRequestCompleteButtonLabel : null}
              labelNumberOfLines={isQuickRequest && status === 'delivered' ? 2 : 1}
              disabled={updating}
              onPress={() => {
                if (isQuickRequest && status === 'delivered') {
                  onCompleteQuickRequest(order);
                  return;
                }

                if (status === 'cancelled') {
                  onCancel(order.id);
                  return;
                }

                void onStatusUpdate(order.id, status);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

function PopupOrderItems({ order }: { order: VendorOrder }) {
  if (order.print_order) {
    return (
      <View style={styles.popupItemsList}>
        {order.print_order.files.map((file) => (
          <View key={`${order.id}-popup-print-${file.id}`} style={styles.popupPrintItem}>
            <View style={styles.popupPrintIcon}>
              <Ionicons name="document-text-outline" size={18} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.popupPrintCopy}>
              <Text style={styles.popupItemText} numberOfLines={1}>{file.original_name}</Text>
              <Text style={styles.popupPrintMeta}>
                {file.page_count} {file.page_count === 1 ? 'page' : 'pages'} • {file.copies} {file.copies === 1 ? 'copy' : 'copies'} • {file.print_mode_label ?? file.print_mode ?? 'Print'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (order.items.length === 0 && order.quick_request) {
    const requestedType = order.quick_request.requested_type?.trim().toLowerCase();
    const priceRows = [
      requestedType !== 'coffee'
        ? { key: 'tea', label: 'Tea', price: order.quick_request.tea_price }
        : null,
      requestedType !== 'tea'
        ? { key: 'coffee', label: 'Coffee', price: order.quick_request.coffee_price }
        : null,
    ].filter((entry): entry is { key: string; label: string; price: number } => entry !== null);

    return (
      <View style={[styles.popupItemsCard, styles.quickRequestPopupItemsCard]}>
        <View style={styles.quickRequestPopupLabelRow}>
          <Ionicons name="flash" size={14} color={tokens.colors.vendorPrimary} />
          <Text style={styles.quickRequestPopupLabel}>
            {order.quick_request.requested_label ?? 'Tea / Coffee'}
          </Text>
        </View>
        {priceRows.map((entry, index) => (
          <View key={entry.key}>
            <View style={styles.popupItemRow}>
              <View style={styles.popupItemCopy}>
                <Text style={styles.popupItemText}>{entry.label}</Text>
                <Text style={styles.popupItemMeta}>Quantity confirmed after acceptance</Text>
              </View>
              <Text style={styles.popupItemPrice}>{formatCurrency(entry.price)} each</Text>
            </View>
            {index < priceRows.length - 1 ? <View style={styles.popupItemSeparator} /> : null}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.popupItemsCard}>
      {order.items.map((item, index) => (
        <View key={`${order.id}-popup-${item.id}-${item.title}`}>
          <View style={styles.popupItemRow}>
            <View style={styles.popupItemCopy}>
              <Text style={styles.popupItemText}>{item.title}</Text>
              {item.variant_name ? <Text style={styles.popupVariantText}>{item.variant_name}</Text> : null}
              <Text style={styles.popupItemMeta}>
                {item.qty} × {formatCurrency(item.unit_price)}
              </Text>
            </View>
            <Text style={styles.popupItemPrice}>{formatCurrency(item.line_total)}</Text>
          </View>
          {index < order.items.length - 1 ? <View style={styles.popupItemSeparator} /> : null}
        </View>
      ))}
    </View>
  );
}

function OrderItemsTable({ order }: { order: VendorOrder }) {
  if (order.items.length === 0 && order.quick_request) {
    return (
      <View style={styles.itemsWrap}>
        <Text style={styles.itemTitle}>Requested: {order.quick_request.requested_label ?? 'Tea / Coffee'}</Text>
        <Text style={styles.itemCalculation}>Price and quantity will be added at completion</Text>
      </View>
    );
  }

  return (
    <View style={styles.itemsWrap}>
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

function OrderPriceSummary({ order, mode }: { order: VendorOrder; mode: 'card' | 'popup' }) {
  const paymentPending = order.order_channel === 'office_quick_request' && order.quick_request?.payment_pending;
  const paymentLabel = formatPaymentMethod(order.payment_method ?? order.quick_request?.payment_method ?? null);
  const popup = mode === 'popup';

  if (paymentPending) {
    return (
      <View style={popup ? styles.popupPriceSummary : styles.cardPriceSummary}>
        <View style={styles.priceTotalRow}>
          <Text style={styles.priceTotalLabel}>Total</Text>
          <Text style={styles.pricePendingValue}>Pending</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={popup ? styles.popupPriceSummary : styles.cardPriceSummary}>
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
        <Text style={[
          styles.priceTotalValue,
          order.status === 'cancelled' ? styles.totalCancelled : null,
        ]}>
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

function formatPaymentMethod(paymentMethod: string | null): string | null {
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

function PrintOrderFiles({
  order,
  activeActionKey,
  onFileAction,
}: {
  order: VendorOrder;
  activeActionKey: string | null;
  onFileAction: (file: PrintOrderFile, action: 'download' | 'share') => void;
}) {
  const printOrder = order.print_order;

  return (
    <View style={styles.printOrderWrap}>
      <View style={styles.printOrderHeader}>
        <View style={styles.printOrderBadge}>
          <Ionicons name="print-outline" size={15} color={tokens.colors.vendorPrimary} />
          <Text style={styles.printOrderBadgeText}>PRINT ORDER</Text>
        </View>
        {printOrder ? (
          <Text style={styles.printOrderCount}>
            {printOrder.file_count} {printOrder.file_count === 1 ? 'file' : 'files'}
          </Text>
        ) : null}
      </View>

      {printOrder?.files.length ? (
        printOrder.files.map((file) => {
          const downloadKey = `${order.id}:${file.id}:download`;
          const shareKey = `${order.id}:${file.id}:share`;
          const busy = activeActionKey === downloadKey || activeActionKey === shareKey;

          return (
            <View key={`${order.id}-print-${file.id}`} style={styles.printFileCard}>
              <View style={styles.printFileTopRow}>
                <View style={styles.printFileIcon}>
                  <Ionicons name="document-text-outline" size={21} color={tokens.colors.vendorPrimary} />
                </View>
                <View style={styles.printFileCopy}>
                  <Text style={styles.printFileName} numberOfLines={2}>{file.original_name}</Text>
                  <Text style={styles.printFileMeta}>
                    {file.page_count} {file.page_count === 1 ? 'page' : 'pages'} • {file.copies} {file.copies === 1 ? 'copy' : 'copies'}
                  </Text>
                </View>
                <Text style={styles.printFileTotal}>{formatCurrency(file.line_total)}</Text>
              </View>

              <View style={styles.printSpecsRow}>
                <Text style={styles.printSpecPill}>{file.print_mode_label ?? file.print_mode ?? 'Print'}</Text>
                <Text style={styles.printSpecPill}>{file.paper_size ?? 'Standard'}</Text>
                <Text style={styles.printSpecPill}>{file.orientation ?? 'Default'}</Text>
                <Text style={styles.printSpecPill}>{file.double_sided ? 'Double-sided' : 'Single-sided'}</Text>
              </View>

              <Text style={styles.printRateText}>
                {formatCurrency(file.price_per_page)} per page
              </Text>

              <View style={styles.printFileActions}>
                <Pressable
                  style={[styles.printFileButton, styles.printDownloadButton]}
                  disabled={busy}
                  onPress={() => onFileAction(file, 'download')}
                >
                  <Ionicons name="download-outline" size={16} color="#ffffff" />
                  <Text style={styles.printDownloadText}>
                    {activeActionKey === downloadKey ? 'Opening...' : 'Download'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.printFileButton, styles.printShareButton]}
                  disabled={busy}
                  onPress={() => onFileAction(file, 'share')}
                >
                  <Ionicons name="share-social-outline" size={16} color={tokens.colors.vendorPrimary} />
                  <Text style={styles.printShareText}>
                    {activeActionKey === shareKey ? 'Sharing...' : 'Share'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.printUnavailableText}>Print file details are not available for this order.</Text>
      )}

      {printOrder?.status_note ? (
        <Text style={styles.printStatusNote}>{printOrder.status_note}</Text>
      ) : null}
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

  if (status === 'delivered') {
    return 'COMPLETED';
  }

  if (status === 'cancelled') {
    return 'REJECTED';
  }

  return prettifyStatus(status).toUpperCase();
}

function getVisibleTransitions(status: OrderStatus, allowedTransitions: OrderStatus[]): OrderStatus[] {
  return allowedTransitions.length ? allowedTransitions : getVendorOrderTransitions(status);
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

const emptyStateContent: Record<OrderTab, {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  backgroundColor: string;
  borderColor: string;
  shadowColor: string;
  badge: string;
  badgeBackground: string;
  title: string;
  subtitle: string;
}> = {
  pending: {
    icon: 'restaurant-outline',
    iconColor: tokens.colors.vendorPrimary,
    backgroundColor: '#fff1e6',
    borderColor: '#ffd8bc',
    shadowColor: '#d96b1b',
    badge: 'Zzz',
    badgeBackground: tokens.colors.vendorPrimary,
    title: 'Kitchen’s catching its breath.',
    subtitle: 'No pending orders right now. Enjoy the calm before the next ding!',
  },
  completed: {
    icon: 'checkmark-done-outline',
    iconColor: '#16844b',
    backgroundColor: '#ebf8f0',
    borderColor: '#c8ead6',
    shadowColor: '#16844b',
    badge: '★',
    badgeBackground: '#16844b',
    title: 'No victory plates yet.',
    subtitle: 'Completed orders will appear here once the kitchen gets moving.',
  },
  cancelled: {
    icon: 'shield-checkmark-outline',
    iconColor: '#4d6f8f',
    backgroundColor: '#eef5fa',
    borderColor: '#d1e1ec',
    shadowColor: '#4d6f8f',
    badge: 'All good',
    badgeBackground: '#4d6f8f',
    title: 'No order heartbreaks here.',
    subtitle: 'No cancellations right now. Let’s keep the good streak going!',
  },
};

function OrdersEmptyState({ status }: { status: OrderTab }) {
  const floatAnimation = useRef(new Animated.Value(0)).current;
  const content = emptyStateContent[status];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnimation, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnimation, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(450),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [floatAnimation]);

  return (
    <View style={styles.pendingEmptyState} accessibilityRole="text">
      <Animated.View
        style={[
          styles.pendingEmptyIconWrap,
          {
            backgroundColor: content.backgroundColor,
            borderColor: content.borderColor,
            shadowColor: content.shadowColor,
          },
          {
            transform: [{
              translateY: floatAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            }],
          },
        ]}
      >
        <Ionicons name={content.icon} size={38} color={content.iconColor} />
        <View style={[styles.pendingEmptySleepBadge, { backgroundColor: content.badgeBackground }]}>
          <Text style={styles.pendingEmptySleepText}>{content.badge}</Text>
        </View>
      </Animated.View>
      <Text style={styles.pendingEmptyTitle}>{content.title}</Text>
      <Text style={styles.pendingEmptySubtitle}>{content.subtitle}</Text>
    </View>
  );
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  listHeader: {
    gap: 12,
    marginBottom: 12,
  },
  orderSeparator: {
    height: 12,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  pendingEmptyState: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 38,
    paddingBottom: 26,
  },
  pendingEmptyIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: '#fff1e6',
    borderWidth: 1,
    borderColor: '#ffd8bc',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#d96b1b',
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  pendingEmptySleepBadge: {
    position: 'absolute',
    right: -8,
    top: -8,
    minWidth: 42,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingEmptySleepText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  pendingEmptyTitle: {
    color: '#252631',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 20,
  },
  pendingEmptySubtitle: {
    maxWidth: 300,
    color: '#7f808a',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
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
    marginTop: 12,
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
  quickRequestOrderCard: {
    backgroundColor: '#fffaf0',
    borderColor: '#f2c98b',
    borderWidth: 1.5,
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
  orderPrimaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  customerPrimaryText: {
    color: '#232328',
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
  metaText: {
    color: '#4b4b54',
    fontSize: 13,
    fontWeight: '600',
  },
  callText: {
    color: tokens.colors.vendorPrimary,
    textDecorationLine: 'underline',
  },
  dotSpacer: {
    flex: 1,
  },
  timeText: {
    color: '#a4a4ad',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryAddressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffd9bc',
    backgroundColor: '#fff7f0',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  deliveryAddressIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#ffe8d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryAddressCopy: {
    flex: 1,
    minWidth: 0,
  },
  deliveryAddressLabel: {
    color: '#a75b20',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  deliveryAddressText: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
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
  printOrderWrap: {
    borderRadius: 14,
    backgroundColor: '#fffaf5',
    borderWidth: 1,
    borderColor: '#ffd8bb',
    padding: 10,
    gap: 9,
  },
  printOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  printOrderBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#ffead9',
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  printOrderBadgeText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  printOrderCount: {
    color: '#8b6a52',
    fontSize: 12,
    fontWeight: '800',
  },
  printFileCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1dfd0',
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 8,
  },
  printFileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  printFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  printFileCopy: {
    flex: 1,
    minWidth: 0,
  },
  printFileName: {
    color: '#25252b',
    fontSize: 14,
    fontWeight: '800',
  },
  printFileMeta: {
    color: '#85858f',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  printFileTotal: {
    color: '#25252b',
    fontSize: 14,
    fontWeight: '900',
  },
  printSpecsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  printSpecPill: {
    color: '#765740',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    backgroundColor: '#fff4eb',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  printRateText: {
    color: '#898993',
    fontSize: 11,
    fontWeight: '700',
  },
  printFileActions: {
    flexDirection: 'row',
    gap: 7,
  },
  printFileButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  printDownloadButton: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  printShareButton: {
    backgroundColor: '#fff7f0',
    borderWidth: 1,
    borderColor: '#f1c8a9',
  },
  printDownloadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  printShareText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  printUnavailableText: {
    color: '#8b6a52',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  printStatusNote: {
    color: '#8b6a52',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
  },
  itemsWrap: {
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e8ee',
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
    color: tokens.colors.vendorPrimary,
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
    backgroundColor: '#eeeeF2',
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
  cardPriceSummary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8ee',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 7,
  },
  popupPriceSummary: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ffd8b8',
    backgroundColor: '#fff8f2',
    padding: 14,
    gap: 8,
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
    color: '#c66a1d',
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
  popupPrintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    backgroundColor: '#fff8f2',
    borderWidth: 1,
    borderColor: '#ffe0c8',
    padding: 9,
  },
  popupPrintIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#ffead9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupPrintCopy: {
    flex: 1,
    minWidth: 0,
  },
  popupPrintMeta: {
    color: '#7d7d87',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
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
  quickRequestActionButton: {
    height: 54,
    paddingHorizontal: 12,
  },
  quickRequestCompleteButtonLabel: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7,12,24,0.38)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  newOrderSheet: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    gap: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    maxHeight: '92%',
  },
  quickRequestPopupSheet: {
    backgroundColor: '#fffdf9',
    borderWidth: 2,
    borderColor: '#ffc995',
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  popupHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  popupTitle: {
    color: '#111827',
    fontSize: 25,
    fontWeight: '900',
  },
  popupSubtitle: {
    color: '#7b8190',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 2,
  },
  popupCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    borderRadius: 14,
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#ffe3a3',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timerCopy: {
    gap: 8,
  },
  timerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerLabel: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '800',
  },
  timerTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#ffe5a3',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f6ad1b',
  },
  popupBody: {
    flexShrink: 1,
  },
  popupBodyContent: {
    gap: 12,
    paddingBottom: 2,
  },
  popupSectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  popupItemsList: {
    gap: 8,
  },
  popupItemsCard: {
    borderRadius: 16,
    backgroundColor: '#f8f8fa',
    borderWidth: 1,
    borderColor: '#e9e9ef',
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  quickRequestPopupItemsCard: {
    backgroundColor: '#fff8ef',
    borderColor: '#ffd6af',
    paddingTop: 10,
  },
  quickRequestPopupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  quickRequestPopupLabel: {
    color: tokens.colors.vendorPrimary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  popupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  popupItemCopy: {
    flex: 1,
    minWidth: 0,
  },
  popupItemText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  popupVariantText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  popupItemMeta: {
    color: '#7b8190',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  popupItemPrice: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
  },
  popupItemSeparator: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  popupInfoCard: {
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e7ed',
    padding: 12,
    gap: 10,
  },
  popupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  popupInfoIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#fff1e7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  popupInfoLabel: {
    color: '#8b8b95',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  popupInfoValue: {
    color: '#303038',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  popupAddressValue: {
    color: '#27272d',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 2,
  },
  popupCallButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupInfoSeparator: {
    height: 1,
    backgroundColor: '#ededf1',
  },
  popupNoteWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 14,
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#ffe1aa',
    padding: 11,
  },
  popupNoteLabel: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '900',
  },
  popupNoteText: {
    color: '#795628',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 2,
  },
  popupMeta: {
    color: '#7b8190',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  popupActionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  popupActionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupRejectButton: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e3424e',
  },
  popupAcceptButton: {
    backgroundColor: '#48c266',
  },
  popupRejectText: {
    color: '#d93743',
    fontSize: 17,
    fontWeight: '900',
  },
  popupAcceptText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
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
  quickRequestModalSheet: {
    backgroundColor: '#fffdf9',
    borderColor: '#f2d4ad',
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
  quickRequestModalIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff0e4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickRequestModalSubtitle: {
    color: '#8a6a50',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
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
  quickRequestInfoCard: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#f2d4ad',
    backgroundColor: '#fff7ed',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quickRequestInfoCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickRequestInfoLabel: {
    color: '#a45a20',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  quickRequestInfoValue: {
    color: '#34343b',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  quickRequestRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickRequestField: {
    flex: 1,
  },
  quickRequestLabel: {
    color: '#5f5f69',
    fontSize: 12,
    fontWeight: '800',
  },
  quickRequestPreviewCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f2d4ad',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickRequestPreviewLabel: {
    color: '#8a562f',
    fontSize: 12,
    fontWeight: '900',
  },
  quickRequestPreviewHint: {
    color: '#9a7a61',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  quickRequestPreviewValue: {
    color: '#25252b',
    fontSize: 22,
    fontWeight: '900',
  },
  paymentOptionsWrap: {
    gap: 8,
  },
  paymentOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentOption: {
    minHeight: 42,
    minWidth: 110,
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e6',
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  paymentOptionActive: {
    borderColor: tokens.colors.vendorPrimary,
    backgroundColor: '#fff0e4',
  },
  paymentOptionDisabled: {
    opacity: 0.5,
  },
  paymentOptionText: {
    color: '#71717b',
    fontSize: 12,
    fontWeight: '800',
  },
  paymentOptionTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  paymentHintText: {
    color: '#7a7068',
    fontSize: 11,
    fontWeight: '600',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
