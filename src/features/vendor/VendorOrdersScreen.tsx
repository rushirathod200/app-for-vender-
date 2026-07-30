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
import { OrderStatus, PrintOrderFile, VendorOrder } from '../../types/vendor';
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
  const { ordersByTab, orderCounts, ordersLoading, error, refreshOrders, updateOrderStatus } = useVendorApp();
  const [activeStatus, setActiveStatus] = useState<OrderTab>('pending');
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [fileActionKey, setFileActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelTargetOrderId, setCancelTargetOrderId] = useState<number | null>(null);
  const [popupOrderId, setPopupOrderId] = useState<number | null>(null);
  const [popupSeconds, setPopupSeconds] = useState(20);
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
      setPopupSeconds(20);
    } else {
      setPopupOrderId(null);
      setActionError(null);
    }
  }, [highlightedOrderId, notificationAction, notificationHandledExternally, notificationReason, notificationTapRequestId, ordersByTab, updateOrderStatus]);

  useEffect(() => {
    if (!popupOrderId) {
      return;
    }

    const timer = setInterval(() => {
      setPopupSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [popupOrderId]);

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
  const popupOrder = useMemo(
    () =>
      popupOrderId
        ? (Object.values(ordersByTab).flat().find((order) => order.id === popupOrderId) ?? null)
        : null,
    [ordersByTab, popupOrderId],
  );

  useEffect(() => {
    if (popupOrder && popupOrder.status !== 'placed') {
      setPopupOrderId(null);
    }
  }, [popupOrder]);

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

  const handlePrintFileAction = async (
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
          const isPrintOrder = order.order_channel === 'print' || !!order.print_order;
          const nextStatuses = getVisibleTransitions(order.status, order.allowed_transitions).filter(
            (status) => !(isQuickRequest && status === 'delivered'),
          );

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
                <Pressable
                  accessibilityLabel={order.customer_mobile ? `Call customer at ${order.customer_mobile}` : undefined}
                  accessibilityRole="link"
                  disabled={!order.customer_mobile}
                  hitSlop={8}
                  onPress={() => {
                    void handleCallCustomer(order.customer_mobile);
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

              <Text style={styles.customerText}>{order.customer_name ?? 'Customer'}</Text>

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
                  activeActionKey={fileActionKey}
                  onFileAction={(file, action) => {
                    void handlePrintFileAction(order.id, file, action);
                  }}
                />
              ) : (
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
              )}

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
        visible={!!popupOrder}
        animationType="slide"
        transparent
        onRequestClose={closeOrderPopup}
      >
        <View style={styles.popupOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOrderPopup} />

          {popupOrder ? (
            <View style={[styles.newOrderSheet, { paddingBottom: modalBottomPadding }]}>
              <View style={styles.popupHeader}>
                <View style={styles.popupHeaderCopy}>
                  <Text style={styles.popupTitle}>New Order</Text>
                  <Text style={styles.popupSubtitle}>Respond quickly so the customer gets confirmation</Text>
                </View>
                <Pressable style={styles.popupCloseButton} onPress={closeOrderPopup} disabled={!!updatingKey}>
                  <Ionicons name="close" size={20} color="#5f6470" />
                </Pressable>
              </View>

              <View style={styles.timerRow}>
                <View style={styles.timerCircle}>
                  <Text style={styles.timerText}>{popupSeconds}</Text>
                </View>
                <View style={styles.timerCopy}>
                  <Text style={styles.timerLabel}>Time remaining</Text>
                  <View style={styles.timerTrack}>
                    <View
                      style={[
                        styles.timerFill,
                        { width: `${Math.max(0, Math.min(100, (popupSeconds / 20) * 100))}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.popupDivider} />

              <Text style={styles.popupSectionTitle}>Order Details</Text>
              <PopupOrderItems order={popupOrder} />

              <View style={styles.popupTotalBox}>
                <Text style={styles.popupTotalLabel}>Total Amount</Text>
                <Text style={styles.popupTotalValue}>{formatCurrency(popupOrder.total)}</Text>
              </View>

              <Text style={styles.popupLocation}>{buildVendorOrderLocation(popupOrder)}</Text>
              <Text style={styles.popupMeta}>{popupOrder.order_no} - {formatRelativeTime(popupOrder.placed_at)}</Text>

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
    return (
      <View style={styles.popupItemRow}>
        <Text style={styles.popupItemText}>{order.quick_request.requested_label ?? 'Tea / Coffee'}</Text>
        <Text style={styles.popupQty}>x1</Text>
      </View>
    );
  }

  return (
    <View style={styles.popupItemsList}>
      {order.items.map((item) => (
        <View key={`${order.id}-popup-${item.id}-${item.title}`} style={styles.popupItemRow}>
          <Text style={styles.popupItemText}>{item.title}</Text>
          <Text style={styles.popupQty}>x{item.qty}</Text>
        </View>
      ))}
    </View>
  );
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
    fontSize: 28,
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
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f1f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  timerCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    borderColor: '#f6ad1b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: '#f6a800',
    fontSize: 32,
    fontWeight: '900',
  },
  timerCopy: {
    flex: 1,
    gap: 12,
  },
  timerLabel: {
    color: '#7b8190',
    fontSize: 15,
    fontWeight: '900',
  },
  timerTrack: {
    height: 9,
    borderRadius: 999,
    backgroundColor: '#ffe5a3',
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#f6ad1b',
  },
  popupDivider: {
    height: 1,
    backgroundColor: '#e7e9ef',
  },
  popupSectionTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
  },
  popupItemsList: {
    gap: 8,
  },
  popupItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  popupItemText: {
    flex: 1,
    color: '#111827',
    fontSize: 18,
    fontWeight: '900',
  },
  popupQty: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#f1f2f7',
    color: '#7b8190',
    fontSize: 16,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  popupTotalBox: {
    borderRadius: 16,
    backgroundColor: '#fff1a8',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  popupTotalLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  popupTotalValue: {
    color: '#111827',
    fontSize: 32,
    fontWeight: '900',
  },
  popupLocation: {
    color: '#7b8190',
    fontSize: 14,
    fontWeight: '900',
  },
  popupMeta: {
    color: '#7b8190',
    fontSize: 13,
    fontWeight: '900',
  },
  popupActionsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  popupActionButton: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
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
    fontSize: 20,
    fontWeight: '900',
  },
  popupAcceptText: {
    color: '#ffffff',
    fontSize: 20,
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
