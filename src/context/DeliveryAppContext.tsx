import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchDeliveryNotificationIndex,
  fetchDeliveryUnreadNotificationCount,
  markAllDeliveryNotificationsRead,
  markDeliveryNotificationRead,
} from '../api/notificationsApi';
import {
  completeDeliveryQuickRequest,
  fetchDeliveryOrders,
  fetchDeliveryProfile,
  updateDeliveryOrderStatus,
} from '../api/deliveryApi';
import { useAutoClearValue } from '../utils/useAutoClearValue';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types/notification';
import { DeliveryOrder, DeliveryProfile } from '../types/delivery';
import { OrderStatus, OrderTabCounts, OrderTabKey, QuickRequestPaymentMethod } from '../types/vendor';

interface RefreshOptions {
  force?: boolean;
}

interface DeliveryAppContextValue {
  profile: DeliveryProfile | null;
  ordersByTab: Record<OrderTabKey, DeliveryOrder[]>;
  orderCounts: OrderTabCounts;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  isLoading: boolean;
  ordersLoading: boolean;
  notificationsLoading: boolean;
  error: string | null;
  refreshAll: (options?: RefreshOptions) => Promise<void>;
  refreshOrders: (options?: RefreshOptions) => Promise<void>;
  refreshNotifications: (options?: RefreshOptions) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  updateOrderStatus: (orderId: number, status: OrderStatus, cancelReason?: string) => Promise<void>;
  completeQuickRequest: (
    orderId: number,
    input: { tea_qty: number; coffee_qty: number; payment_method: QuickRequestPaymentMethod },
  ) => Promise<void>;
}

const DeliveryAppContext = createContext<DeliveryAppContextValue | undefined>(undefined);
const EMPTY_ORDER_COUNTS: OrderTabCounts = {
  pending: 0,
  completed: 0,
  cancelled: 0,
};

const CACHE_TTL_MS = {
  all: 30_000,
  orders: 15_000,
  notifications: 20_000,
} as const;

function sortDeliveryOrders(orders: DeliveryOrder[]): DeliveryOrder[] {
  return [...orders].sort((left, right) => {
    const leftTimestamp = left.placed_at ? new Date(left.placed_at).getTime() : 0;
    const rightTimestamp = right.placed_at ? new Date(right.placed_at).getTime() : 0;

    return rightTimestamp - leftTimestamp;
  });
}

function createEmptyOrdersByTab(): Record<OrderTabKey, DeliveryOrder[]> {
  return {
    pending: [],
    completed: [],
    cancelled: [],
  };
}

function groupDeliveryOrderStatus(status: OrderStatus): OrderTabKey {
  if (status === 'delivered') {
    return 'completed';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'pending';
}

function buildOrdersByTab(orders: DeliveryOrder[]): Record<OrderTabKey, DeliveryOrder[]> {
  return {
    pending: orders.filter((order) => groupDeliveryOrderStatus(order.status) === 'pending'),
    completed: orders.filter((order) => groupDeliveryOrderStatus(order.status) === 'completed'),
    cancelled: orders.filter((order) => groupDeliveryOrderStatus(order.status) === 'cancelled'),
  };
}

function buildOrderCounts(ordersByTab: Record<OrderTabKey, DeliveryOrder[]>): OrderTabCounts {
  return {
    pending: ordersByTab.pending.length,
    completed: ordersByTab.completed.length,
    cancelled: ordersByTab.cancelled.length,
  };
}

export function DeliveryAppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [ordersByTab, setOrdersByTab] = useState<Record<OrderTabKey, DeliveryOrder[]>>(createEmptyOrdersByTab);
  const [orderCounts, setOrderCounts] = useState<OrderTabCounts>(EMPTY_ORDER_COUNTS);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef({
    all: { loaded: false, timestamp: 0 },
    orders: { loaded: false, timestamp: 0 },
    notifications: { loaded: false, timestamp: 0 },
  });
  const inFlightRef = useRef({
    all: null as Promise<void> | null,
    orders: null as Promise<void> | null,
    notifications: null as Promise<void> | null,
  });

  useAutoClearValue(error, () => setError(null));

  function isFresh(loaded: boolean, timestamp: number, ttlMs: number, force?: boolean): boolean {
    return !force && loaded && (Date.now() - timestamp) < ttlMs;
  }

  function touchCache(keys: Array<'all' | 'orders' | 'notifications'>): void {
    const now = Date.now();
    keys.forEach((key) => {
      cacheRef.current[key] = {
        loaded: true,
        timestamp: now,
      };
    });
  }

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'delivery') {
      setProfile(null);
      setOrdersByTab(createEmptyOrdersByTab());
      setOrderCounts(EMPTY_ORDER_COUNTS);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setError(null);
      setIsLoading(false);
      cacheRef.current = {
        all: { loaded: false, timestamp: 0 },
        orders: { loaded: false, timestamp: 0 },
        notifications: { loaded: false, timestamp: 0 },
      };
      inFlightRef.current = {
        all: null,
        orders: null,
        notifications: null,
      };
      return;
    }
  }, [isAuthenticated, user?.role]);

  const refreshAll = async (options?: RefreshOptions): Promise<void> => {
    if (isFresh(cacheRef.current.all.loaded, cacheRef.current.all.timestamp, CACHE_TTL_MS.all, options?.force)) {
      return;
    }

    if (inFlightRef.current.all) {
      return inFlightRef.current.all;
    }

    const request = (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [fetchedProfile, fetchedOrders, notificationIndex] = await Promise.all([
          fetchDeliveryProfile(),
          fetchDeliveryOrders(),
          fetchDeliveryNotificationIndex(),
        ]);
        const sortedOrders = sortDeliveryOrders(fetchedOrders);
        const nextOrdersByTab = buildOrdersByTab(sortedOrders);

        setProfile(fetchedProfile);
        setOrdersByTab(nextOrdersByTab);
        setOrderCounts(buildOrderCounts(nextOrdersByTab));
        setNotifications(notificationIndex.notifications);
        setUnreadNotificationCount(
          notificationIndex.unreadCount ?? (await fetchDeliveryUnreadNotificationCount()),
        );
        touchCache(['all', 'orders', 'notifications']);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load delivery data.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    })();

    inFlightRef.current.all = request;

    return request.finally(() => {
      if (inFlightRef.current.all === request) {
        inFlightRef.current.all = null;
      }
    });
  };

  const refreshOrders = async (options?: RefreshOptions): Promise<void> => {
    if (isFresh(cacheRef.current.orders.loaded, cacheRef.current.orders.timestamp, CACHE_TTL_MS.orders, options?.force)) {
      return;
    }

    if (inFlightRef.current.orders) {
      return inFlightRef.current.orders;
    }

    const request = (async () => {
      setOrdersLoading(true);
      setError(null);

      try {
        const items = sortDeliveryOrders(await fetchDeliveryOrders());
        const nextOrdersByTab = buildOrdersByTab(items);
        setOrdersByTab(nextOrdersByTab);
        setOrderCounts(buildOrderCounts(nextOrdersByTab));
        touchCache(['orders']);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load delivery orders.';
        setError(message);
      } finally {
        setOrdersLoading(false);
      }
    })();

    inFlightRef.current.orders = request;

    return request.finally(() => {
      if (inFlightRef.current.orders === request) {
        inFlightRef.current.orders = null;
      }
    });
  };

  const refreshNotifications = async (options?: RefreshOptions): Promise<void> => {
    if (
      isFresh(
        cacheRef.current.notifications.loaded,
        cacheRef.current.notifications.timestamp,
        CACHE_TTL_MS.notifications,
        options?.force,
      )
    ) {
      return;
    }

    if (inFlightRef.current.notifications) {
      return inFlightRef.current.notifications;
    }

    const request = (async () => {
      setNotificationsLoading(true);
      setError(null);

      try {
        const notificationIndex = await fetchDeliveryNotificationIndex();
        setNotifications(notificationIndex.notifications);
        setUnreadNotificationCount(
          notificationIndex.unreadCount ?? (await fetchDeliveryUnreadNotificationCount()),
        );
        touchCache(['notifications']);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load notifications.';
        setError(message);
      } finally {
        setNotificationsLoading(false);
      }
    })();

    inFlightRef.current.notifications = request;

    return request.finally(() => {
      if (inFlightRef.current.notifications === request) {
        inFlightRef.current.notifications = null;
      }
    });
  };

  const markNotificationRead = async (notificationId: string): Promise<void> => {
    const wasUnread = notifications.some(
      (notification) => notification.id === notificationId && !notification.is_read,
    );

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, is_read: true } : notification,
      ),
    );
    setUnreadNotificationCount((current) => (wasUnread ? Math.max(0, current - 1) : current));

    try {
      const updated = await markDeliveryNotificationRead(notificationId);
      if (!updated) {
        return;
      }

      setNotifications((current) =>
        current.map((notification) => (notification.id === notificationId ? updated : notification)),
      );
      touchCache(['all', 'notifications']);
    } catch (updateError) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: false } : notification,
        ),
      );
      setUnreadNotificationCount((current) => (wasUnread ? current + 1 : current));
      const message = updateError instanceof Error ? updateError.message : 'Could not update notification.';
      setError(message);
      throw updateError;
    }
  };

  const markAllNotificationsRead = async (): Promise<void> => {
    if (unreadNotificationCount <= 0) {
      return;
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    setUnreadNotificationCount(0);

    try {
      await markAllDeliveryNotificationsRead();
      touchCache(['all', 'notifications']);
    } catch (updateError) {
      await refreshNotifications({ force: true });
      const message = updateError instanceof Error ? updateError.message : 'Could not update notifications.';
      setError(message);
      throw updateError;
    }
  };

  const updateOrderStatus = async (
    orderId: number,
    status: OrderStatus,
    cancelReason?: string,
  ): Promise<void> => {
    const previousOrdersByTab = ordersByTab;
    const previousOrderCounts = orderCounts;
    const optimisticOrders = sortDeliveryOrders(
      Object.values(ordersByTab)
        .flat()
        .map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                cancel_reason: status === 'cancelled' ? (cancelReason ?? order.cancel_reason ?? null) : null,
                allowed_transitions: [],
              }
            : order,
        ),
    );
    const optimisticOrdersByTab = buildOrdersByTab(optimisticOrders);

    setOrdersByTab(optimisticOrdersByTab);
    setOrderCounts(buildOrderCounts(optimisticOrdersByTab));

    try {
      const updated = await updateDeliveryOrderStatus(orderId, status, cancelReason);
      if (updated) {
        const syncedOrders = sortDeliveryOrders(
          optimisticOrders.map((order) => (order.id === orderId ? updated : order)),
        );
        const syncedOrdersByTab = buildOrdersByTab(syncedOrders);

        setOrdersByTab(syncedOrdersByTab);
        setOrderCounts(buildOrderCounts(syncedOrdersByTab));
        touchCache(['all', 'orders']);
      }
    } catch (updateError) {
      setOrdersByTab(previousOrdersByTab);
      setOrderCounts(previousOrderCounts);
      const message = updateError instanceof Error ? updateError.message : 'Could not update delivery status.';
      setError(message);
      throw updateError;
    }
  };

  const completeQuickRequest = async (
    orderId: number,
    input: { tea_qty: number; coffee_qty: number; payment_method: QuickRequestPaymentMethod },
  ): Promise<void> => {
    const previousOrdersByTab = ordersByTab;
    const previousOrderCounts = orderCounts;

    try {
      const updated = await completeDeliveryQuickRequest(orderId, input);
      if (updated) {
        const syncedOrders = sortDeliveryOrders(
          Object.values(ordersByTab)
            .flat()
            .map((order) => (order.id === orderId ? updated : order)),
        );
        const syncedOrdersByTab = buildOrdersByTab(syncedOrders);

        setOrdersByTab(syncedOrdersByTab);
        setOrderCounts(buildOrderCounts(syncedOrdersByTab));
        touchCache(['all', 'orders']);
      }
    } catch (updateError) {
      setOrdersByTab(previousOrdersByTab);
      setOrderCounts(previousOrderCounts);
      const message =
        updateError instanceof Error ? updateError.message : 'Could not complete quick request.';
      setError(message);
      throw updateError;
    }
  };

  const value = useMemo<DeliveryAppContextValue>(
    () => ({
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
    }),
    [
      error,
      isLoading,
      notifications,
      notificationsLoading,
      orderCounts,
      ordersByTab,
      ordersLoading,
      profile,
      unreadNotificationCount,
    ],
  );

  return <DeliveryAppContext.Provider value={value}>{children}</DeliveryAppContext.Provider>;
}

export function useDeliveryApp(): DeliveryAppContextValue {
  const context = useContext(DeliveryAppContext);

  if (!context) {
    throw new Error('useDeliveryApp must be used within DeliveryAppProvider');
  }

  return context;
}
