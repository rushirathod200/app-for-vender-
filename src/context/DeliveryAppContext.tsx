import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { fetchDeliveryOrders, fetchDeliveryProfile, updateDeliveryOrderStatus } from '../api/deliveryApi';
import { useAuth } from './AuthContext';
import { DeliveryOrder, DeliveryProfile } from '../types/delivery';
import { OrderStatus } from '../types/vendor';

interface DeliveryAppContextValue {
  profile: DeliveryProfile | null;
  orders: DeliveryOrder[];
  isLoading: boolean;
  ordersLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshOrders: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'delivery') {
      setProfile(null);
      setOrders([]);
      setError(null);
      setIsLoading(false);
      return;
    }
  }, [isAuthenticated, user?.role]);

  const refreshAll = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedProfile, fetchedOrders] = await Promise.all([
        fetchDeliveryProfile(),
        fetchDeliveryOrders(),
      ]);

      setProfile(fetchedProfile);
      setOrders(sortDeliveryOrders(fetchedOrders));
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
      isLoading,
      ordersLoading,
      error,
      refreshAll,
      refreshOrders,
      updateOrderStatus,
    }),
    [error, isLoading, orders, ordersLoading, profile],
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
