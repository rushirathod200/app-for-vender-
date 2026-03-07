import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import {
  fetchDeliveryNotifications,
  fetchDeliveryUnreadNotificationCount,
  markDeliveryNotificationRead,
} from '../api/notificationsApi';
import { fetchDeliveryOrders, fetchDeliveryProfile, updateDeliveryOrderStatus } from '../api/deliveryApi';
import { useAuth } from './AuthContext';
import { AppNotification } from '../types/notification';
import { DeliveryOrder, DeliveryProfile } from '../types/delivery';
import { OrderStatus } from '../types/vendor';

interface DeliveryAppContextValue {
  profile: DeliveryProfile | null;
  orders: DeliveryOrder[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  isLoading: boolean;
  ordersLoading: boolean;
  notificationsLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  updateOrderStatus: (orderId: number, status: OrderStatus) => Promise<void>;
}

const DeliveryAppContext = createContext<DeliveryAppContextValue | undefined>(undefined);

function sortDeliveryOrders(orders: DeliveryOrder[]): DeliveryOrder[] {
  return [...orders].sort((left, right) => {
    const leftTimestamp = left.placed_at ? new Date(left.placed_at).getTime() : 0;
    const rightTimestamp = right.placed_at ? new Date(right.placed_at).getTime() : 0;

    return rightTimestamp - leftTimestamp;
  });
}

export function DeliveryAppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();

  const [profile, setProfile] = useState<DeliveryProfile | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'delivery') {
      setProfile(null);
      setOrders([]);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setError(null);
      setIsLoading(false);
      return;
    }
  }, [isAuthenticated, user?.role]);

  const refreshAll = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedProfile, fetchedOrders, fetchedNotifications, unreadCount] = await Promise.all([
        fetchDeliveryProfile(),
        fetchDeliveryOrders(),
        fetchDeliveryNotifications(),
        fetchDeliveryUnreadNotificationCount(),
      ]);

      setProfile(fetchedProfile);
      setOrders(sortDeliveryOrders(fetchedOrders));
      setNotifications(fetchedNotifications);
      setUnreadNotificationCount(unreadCount);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load delivery data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshOrders = async (): Promise<void> => {
    setOrdersLoading(true);
    setError(null);

    try {
      const fetchedOrders = await fetchDeliveryOrders();
      setOrders(sortDeliveryOrders(fetchedOrders));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load delivery orders.';
      setError(message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const refreshNotifications = async (): Promise<void> => {
    setNotificationsLoading(true);
    setError(null);

    try {
      const [fetchedNotifications, unreadCount] = await Promise.all([
        fetchDeliveryNotifications(),
        fetchDeliveryUnreadNotificationCount(),
      ]);
      setNotifications(fetchedNotifications);
      setUnreadNotificationCount(unreadCount);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load notifications.';
      setError(message);
    } finally {
      setNotificationsLoading(false);
    }
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

  const updateOrderStatus = async (orderId: number, status: OrderStatus): Promise<void> => {
    const previousOrders = orders;

    setOrders((current) =>
      sortDeliveryOrders(
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                allowed_transitions: [],
              }
            : order,
        ),
      ),
    );

    try {
      const updated = await updateDeliveryOrderStatus(orderId, status);
      if (updated) {
        setOrders((current) =>
          sortDeliveryOrders(current.map((order) => (order.id === orderId ? updated : order))),
        );
      }
    } catch (updateError) {
      setOrders(previousOrders);
      const message = updateError instanceof Error ? updateError.message : 'Could not update delivery status.';
      setError(message);
      throw updateError;
    }
  };

  const value = useMemo<DeliveryAppContextValue>(
    () => ({
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
    }),
    [
      error,
      isLoading,
      notifications,
      notificationsLoading,
      orders,
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
