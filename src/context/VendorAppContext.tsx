import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  createDeliveryPartner,
  fetchAssignedBuildings,
  fetchDeliveryPartners,
  fetchVendorMenu,
  fetchVendorOrders,
  fetchVendorProfile,
  updateDeliveryPartner,
  updateDeliveryPartnerStatus,
  updateMenuItemAvailability,
  updateVendorOrderStatus,
  updateVendorProfile,
} from '../api/vendorApi';
import {
  fetchVendorNotificationIndex,
  fetchVendorUnreadNotificationCount,
  markVendorNotificationRead,
} from '../api/notificationsApi';
import { useAutoClearValue } from '../utils/useAutoClearValue';
import { useAuth } from './AuthContext';
import { AuthUser } from '../types/auth';
import { AppNotification } from '../types/notification';
import {
  BelowMinimumOrderMode,
  Building,
  MenuItem,
  OrderStatus,
  OrderTabCounts,
  OrderTabKey,
  VendorDeliveryPartner,
  VendorOrder,
  VendorProfile,
  VendorOrderSummary,
} from '../types/vendor';
import { groupVendorOrderStatus, isSameCalendarDay, sortVendorOrders } from '../utils/vendor';

interface RefreshOptions {
  force?: boolean;
}

interface VendorAppContextValue {
  user: AuthUser | null;
  profile: VendorProfile | null;
  buildings: Building[];
  selectedBuildingId: number | null;
  setSelectedBuildingId: (buildingId: number) => void;
  products: MenuItem[];
  allProducts: MenuItem[];
  ordersByTab: Record<OrderTabKey, VendorOrder[]>;
  orderCounts: OrderTabCounts;
  dashboardOrderSummary: VendorOrderSummary | null;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  deliveryPartners: VendorDeliveryPartner[];
  isLoading: boolean;
  productsLoading: boolean;
  ordersLoading: boolean;
  notificationsLoading: boolean;
  deliveryPartnersLoading: boolean;
  error: string | null;
  refreshAll: (options?: RefreshOptions) => Promise<void>;
  refreshProducts: (options?: RefreshOptions) => Promise<void>;
  refreshOrders: (options?: RefreshOptions) => Promise<void>;
  refreshNotifications: (options?: RefreshOptions) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  refreshDeliveryPartners: (options?: RefreshOptions) => Promise<void>;
  saveProfile: (input: {
    name: string;
    email: string;
    mobile: string;
    store_open: boolean;
    delivery_charge: number;
    below_minimum_order_mode: BelowMinimumOrderMode;
    minimum_order_value: number;
    quick_request_tea_price: number;
    quick_request_coffee_price: number;
    office_wallet_credit_enabled: boolean;
  }) => Promise<void>;
  toggleStoreOpen: () => Promise<void>;
  toggleProductActive: (item: MenuItem) => Promise<void>;
  updateOrderStatus: (orderId: number, status: OrderStatus, cancelReason?: string) => Promise<void>;
  upsertDeliveryPartner: (input: {
    id?: number;
    name: string;
    email: string;
    mobile: string;
    password?: string;
    is_active?: boolean;
  }) => Promise<void>;
  toggleDeliveryPartnerStatus: (partnerId: number) => Promise<void>;
}

const VendorAppContext = createContext<VendorAppContextValue | undefined>(undefined);
const EMPTY_ORDER_COUNTS: OrderTabCounts = {
  pending: 0,
  completed: 0,
  cancelled: 0,
};

const CACHE_TTL_MS = {
  all: 30_000,
  orders: 15_000,
  notifications: 20_000,
  deliveryPartners: 60_000,
  products: 60_000,
} as const;

function buildMenuMap(buildings: Building[], menuLists: MenuItem[][]): Record<number, MenuItem[]> {
  return buildings.reduce<Record<number, MenuItem[]>>((result, building, index) => {
    result[building.id] = menuLists[index] ?? [];
    return result;
  }, {});
}

function createEmptyOrdersByTab(): Record<OrderTabKey, VendorOrder[]> {
  return {
    pending: [],
    completed: [],
    cancelled: [],
  };
}

function buildOrdersByTab(orders: VendorOrder[]): Record<OrderTabKey, VendorOrder[]> {
  return {
    pending: orders.filter((order) => groupVendorOrderStatus(order.status) === 'pending'),
    completed: orders.filter((order) => groupVendorOrderStatus(order.status) === 'completed'),
    cancelled: orders.filter((order) => groupVendorOrderStatus(order.status) === 'cancelled'),
  };
}

function buildOrderCounts(ordersByTab: Record<OrderTabKey, VendorOrder[]>): OrderTabCounts {
  return {
    pending: ordersByTab.pending.length,
    completed: ordersByTab.completed.length,
    cancelled: ordersByTab.cancelled.length,
  };
}

function buildVendorOrderSummary(orders: VendorOrder[]): VendorOrderSummary {
  const completedOrders = orders.filter((order) => order.status === 'delivered');

  return {
    today_orders: orders.filter((order) => isSameCalendarDay(order.placed_at)).length,
    total_sales: completedOrders.reduce((sum, order) => sum + order.total, 0),
    recent_orders: orders.slice(0, 2),
  };
}

export function VendorAppProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingIdState] = useState<number | null>(null);
  const [productsByBuilding, setProductsByBuilding] = useState<Record<number, MenuItem[]>>({});
  const [ordersByTab, setOrdersByTab] = useState<Record<OrderTabKey, VendorOrder[]>>(createEmptyOrdersByTab);
  const [orderCounts, setOrderCounts] = useState<OrderTabCounts>(EMPTY_ORDER_COUNTS);
  const [dashboardOrderSummary, setDashboardOrderSummary] = useState<VendorOrderSummary | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [deliveryPartners, setDeliveryPartners] = useState<VendorDeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deliveryPartnersLoading, setDeliveryPartnersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef({
    all: { loaded: false, timestamp: 0 },
    orders: { loaded: false, timestamp: 0 },
    notifications: { loaded: false, timestamp: 0 },
    deliveryPartners: { loaded: false, timestamp: 0 },
    productsByBuilding: {} as Record<number, { loaded: boolean; timestamp: number }>,
  });
  const inFlightRef = useRef({
    all: null as Promise<void> | null,
    orders: null as Promise<void> | null,
    notifications: null as Promise<void> | null,
    deliveryPartners: null as Promise<void> | null,
    productsByBuilding: {} as Record<number, Promise<void> | null>,
  });

  useAutoClearValue(error, () => setError(null));

  function isFresh(loaded: boolean, timestamp: number, ttlMs: number, force?: boolean): boolean {
    return !force && loaded && (Date.now() - timestamp) < ttlMs;
  }

  function touchCache(keys: Array<'all' | 'orders' | 'notifications' | 'deliveryPartners'>): void {
    const now = Date.now();
    keys.forEach((key) => {
      cacheRef.current[key] = {
        loaded: true,
        timestamp: now,
      };
    });
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      setBuildings([]);
      setSelectedBuildingIdState(null);
      setProductsByBuilding({});
      setOrdersByTab(createEmptyOrdersByTab());
      setOrderCounts(EMPTY_ORDER_COUNTS);
      setDashboardOrderSummary(null);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setDeliveryPartners([]);
      setError(null);
      setIsLoading(false);
      cacheRef.current = {
        all: { loaded: false, timestamp: 0 },
        orders: { loaded: false, timestamp: 0 },
        notifications: { loaded: false, timestamp: 0 },
        deliveryPartners: { loaded: false, timestamp: 0 },
        productsByBuilding: {},
      };
      inFlightRef.current = {
        all: null,
        orders: null,
        notifications: null,
        deliveryPartners: null,
        productsByBuilding: {},
      };
      return;
    }
  }, [isAuthenticated]);

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
        const [fetchedProfile, fetchedBuildings, fetchedOrders, fetchedPartners, notificationIndex] = await Promise.all([
          fetchVendorProfile(),
          fetchAssignedBuildings(),
          fetchVendorOrders({}),
          fetchDeliveryPartners(),
          fetchVendorNotificationIndex(),
        ]);
        const sortedOrders = sortVendorOrders(fetchedOrders);
        const nextOrdersByTab = buildOrdersByTab(sortedOrders);

        setProfile(fetchedProfile);
        setBuildings(fetchedBuildings);
        setDeliveryPartners(fetchedPartners);
        setOrdersByTab(nextOrdersByTab);
        setOrderCounts(buildOrderCounts(nextOrdersByTab));
        setDashboardOrderSummary(buildVendorOrderSummary(sortedOrders));
        setNotifications(notificationIndex.notifications);
        setUnreadNotificationCount(
          notificationIndex.unreadCount ?? (await fetchVendorUnreadNotificationCount()),
        );
        touchCache(['orders']);

        if (fetchedBuildings.length === 0) {
          setSelectedBuildingIdState(null);
          setProductsByBuilding({});
          touchCache(['all', 'orders', 'notifications', 'deliveryPartners']);
          return;
        }

        const menuLists = await Promise.all(
          fetchedBuildings.map((building) => fetchVendorMenu({ buildingId: building.id })),
        );

        setProductsByBuilding(buildMenuMap(fetchedBuildings, menuLists));
        const now = Date.now();
        cacheRef.current.productsByBuilding = fetchedBuildings.reduce<Record<number, { loaded: boolean; timestamp: number }>>(
          (result, building) => {
            result[building.id] = { loaded: true, timestamp: now };
            return result;
          },
          {},
        );
        setSelectedBuildingIdState((current) => {
          if (current && fetchedBuildings.some((building) => building.id === current)) {
            return current;
          }

          return fetchedBuildings[0]?.id ?? null;
        });
        touchCache(['all', 'orders', 'notifications', 'deliveryPartners']);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load vendor data.';
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

  const refreshProducts = async (options?: RefreshOptions): Promise<void> => {
    if (!selectedBuildingId) {
      return;
    }

    const currentCache = cacheRef.current.productsByBuilding[selectedBuildingId];
    if (
      isFresh(currentCache?.loaded ?? false, currentCache?.timestamp ?? 0, CACHE_TTL_MS.products, options?.force)
    ) {
      return;
    }

    if (inFlightRef.current.productsByBuilding[selectedBuildingId]) {
      return inFlightRef.current.productsByBuilding[selectedBuildingId] as Promise<void>;
    }

    const request = (async () => {
      setProductsLoading(true);
      setError(null);

      try {
        const items = await fetchVendorMenu({ buildingId: selectedBuildingId });
        setProductsByBuilding((current) => ({
          ...current,
          [selectedBuildingId]: items,
        }));
        cacheRef.current.productsByBuilding[selectedBuildingId] = {
          loaded: true,
          timestamp: Date.now(),
        };
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load menu items.';
        setError(message);
      } finally {
        setProductsLoading(false);
      }
    })();

    inFlightRef.current.productsByBuilding[selectedBuildingId] = request;

    return request.finally(() => {
      if (inFlightRef.current.productsByBuilding[selectedBuildingId] === request) {
        delete inFlightRef.current.productsByBuilding[selectedBuildingId];
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
        const items = sortVendorOrders(await fetchVendorOrders({}));
        const nextOrdersByTab = buildOrdersByTab(items);
        setOrdersByTab(nextOrdersByTab);
        setOrderCounts(buildOrderCounts(nextOrdersByTab));
        setDashboardOrderSummary(buildVendorOrderSummary(items));
        touchCache(['orders']);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load orders.';
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
        const notificationIndex = await fetchVendorNotificationIndex();
        setNotifications(notificationIndex.notifications);
        setUnreadNotificationCount(
          notificationIndex.unreadCount ?? (await fetchVendorUnreadNotificationCount()),
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
      const updated = await markVendorNotificationRead(notificationId);
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

  const refreshDeliveryPartners = async (options?: RefreshOptions): Promise<void> => {
    if (
      isFresh(
        cacheRef.current.deliveryPartners.loaded,
        cacheRef.current.deliveryPartners.timestamp,
        CACHE_TTL_MS.deliveryPartners,
        options?.force,
      )
    ) {
      return;
    }

    if (inFlightRef.current.deliveryPartners) {
      return inFlightRef.current.deliveryPartners;
    }

    const request = (async () => {
      setDeliveryPartnersLoading(true);
      setError(null);

      try {
        const items = await fetchDeliveryPartners();
        setDeliveryPartners(items);
        touchCache(['deliveryPartners']);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load delivery partners.';
        setError(message);
      } finally {
        setDeliveryPartnersLoading(false);
      }
    })();

    inFlightRef.current.deliveryPartners = request;

    return request.finally(() => {
      if (inFlightRef.current.deliveryPartners === request) {
        inFlightRef.current.deliveryPartners = null;
      }
    });
  };

  const saveProfile = async (input: {
    name: string;
    email: string;
    mobile: string;
    store_open: boolean;
    delivery_charge: number;
    below_minimum_order_mode: BelowMinimumOrderMode;
    minimum_order_value: number;
    quick_request_tea_price: number;
    quick_request_coffee_price: number;
    office_wallet_credit_enabled: boolean;
  }): Promise<void> => {
    const updated = await updateVendorProfile(input);
    if (updated) {
      setProfile(updated);
      touchCache(['all']);
    }
  };

  const toggleStoreOpen = async (): Promise<void> => {
    if (!profile) {
      return;
    }

    const next = !profile.store_open;
    const optimistic = { ...profile, store_open: next };
    setProfile(optimistic);

    try {
      await saveProfile({
        name: profile.name ?? '',
        email: profile.email ?? '',
        mobile: profile.mobile,
        store_open: next,
        delivery_charge: profile.delivery_charge,
        below_minimum_order_mode: profile.below_minimum_order_mode,
        minimum_order_value: profile.minimum_order_value,
        quick_request_tea_price: profile.quick_request_tea_price,
        quick_request_coffee_price: profile.quick_request_coffee_price,
        office_wallet_credit_enabled: profile.office_wallet_credit_enabled,
      });
    } catch (toggleError) {
      setProfile(profile);
      const message = toggleError instanceof Error ? toggleError.message : 'Could not update store status.';
      setError(message);
      throw toggleError;
    }
  };

  const toggleProductActive = async (item: MenuItem): Promise<void> => {
    const nextAvailability = !item.is_available;

    setProductsByBuilding((current) => ({
      ...current,
      [item.building_id]: (current[item.building_id] ?? []).map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              is_available: nextAvailability,
            }
          : entry,
      ),
    }));

    try {
      await updateMenuItemAvailability(item.id, nextAvailability);
      cacheRef.current.productsByBuilding[item.building_id] = {
        loaded: true,
        timestamp: Date.now(),
      };
      touchCache(['all']);
    } catch (toggleError) {
      setProductsByBuilding((current) => ({
        ...current,
        [item.building_id]: (current[item.building_id] ?? []).map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                is_available: item.is_available,
              }
            : entry,
        ),
      }));

      const message = toggleError instanceof Error ? toggleError.message : 'Could not update menu item availability.';
      setError(message);
      throw toggleError;
    }
  };

  const updateOrderStatus = async (
    orderId: number,
    status: OrderStatus,
    cancelReason?: string,
  ): Promise<void> => {
    const previousOrdersByTab = ordersByTab;
    const previousOrderCounts = orderCounts;
    const previousDashboardOrderSummary = dashboardOrderSummary;
    const optimisticOrders = sortVendorOrders(
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
    setDashboardOrderSummary(buildVendorOrderSummary(optimisticOrders));

    try {
      const updated = await updateVendorOrderStatus(orderId, status, cancelReason);
      if (updated) {
        const syncedOrders = sortVendorOrders(
          optimisticOrders.map((order) => (order.id === orderId ? updated : order)),
        );
        const syncedOrdersByTab = buildOrdersByTab(syncedOrders);

        setOrdersByTab(syncedOrdersByTab);
        setOrderCounts(buildOrderCounts(syncedOrdersByTab));
        setDashboardOrderSummary(buildVendorOrderSummary(syncedOrders));
        touchCache(['all', 'orders']);
      }
    } catch (updateError) {
      setOrdersByTab(previousOrdersByTab);
      setOrderCounts(previousOrderCounts);
      setDashboardOrderSummary(previousDashboardOrderSummary);
      const message = updateError instanceof Error ? updateError.message : 'Could not update order status.';
      setError(message);
      throw updateError;
    }
  };

  const upsertDeliveryPartner = async (input: {
    id?: number;
    name: string;
    email: string;
    mobile: string;
    password?: string;
    is_active?: boolean;
  }): Promise<void> => {
    const result = input.id
      ? await updateDeliveryPartner(input.id, {
          name: input.name,
          email: input.email,
          mobile: input.mobile,
          ...(input.password ? { password: input.password } : {}),
        })
      : await createDeliveryPartner({
          name: input.name,
          email: input.email,
          mobile: input.mobile,
          password: input.password ?? '',
          is_active: input.is_active ?? true,
        });

    if (!result) {
      return;
    }

    setDeliveryPartners((current) => {
      const exists = current.some((partner) => partner.id === result.id);

      if (exists) {
        return current.map((partner) => (partner.id === result.id ? result : partner));
      }

      return [result, ...current];
    });
    touchCache(['all', 'deliveryPartners']);
  };

  const toggleDeliveryPartnerStatus = async (partnerId: number): Promise<void> => {
    const selectedPartner = deliveryPartners.find((partner) => partner.id === partnerId);
    if (!selectedPartner) {
      return;
    }

    const nextIsActive = !selectedPartner.partner_active;

    setDeliveryPartners((current) =>
      current.map((partner) =>
        partner.id === partnerId
          ? {
              ...partner,
              partner_active: nextIsActive,
              is_active: nextIsActive,
            }
          : partner,
      ),
    );

    try {
      const updated = await updateDeliveryPartnerStatus(partnerId, nextIsActive);
      if (updated) {
        setDeliveryPartners((current) =>
          current.map((partner) => (partner.id === partnerId ? updated : partner)),
        );
        touchCache(['all', 'deliveryPartners']);
      }
    } catch (updateError) {
      setDeliveryPartners((current) =>
        current.map((partner) =>
          partner.id === partnerId
            ? {
                ...partner,
                partner_active: selectedPartner.partner_active,
                is_active: selectedPartner.is_active,
              }
            : partner,
        ),
      );

      const message = updateError instanceof Error ? updateError.message : 'Could not update delivery partner.';
      setError(message);
      throw updateError;
    }
  };

  const products = selectedBuildingId ? productsByBuilding[selectedBuildingId] ?? [] : [];
  const allProducts = Object.values(productsByBuilding).flat();

  const value = useMemo<VendorAppContextValue>(
    () => ({
      user,
      profile,
      buildings,
      selectedBuildingId,
      setSelectedBuildingId: setSelectedBuildingIdState,
      products,
      allProducts,
      ordersByTab,
      orderCounts,
      dashboardOrderSummary,
      notifications,
      unreadNotificationCount,
      deliveryPartners,
      isLoading,
      productsLoading,
      ordersLoading,
      notificationsLoading,
      deliveryPartnersLoading,
      error,
      refreshAll,
      refreshProducts,
      refreshOrders,
      refreshNotifications,
      markNotificationRead,
      refreshDeliveryPartners,
      saveProfile,
      toggleStoreOpen,
      toggleProductActive,
      updateOrderStatus,
      upsertDeliveryPartner,
      toggleDeliveryPartnerStatus,
    }),
    [
      allProducts,
      buildings,
      dashboardOrderSummary,
      deliveryPartners,
      deliveryPartnersLoading,
      error,
      isLoading,
      notifications,
      notificationsLoading,
      orderCounts,
      ordersByTab,
      ordersLoading,
      products,
      productsLoading,
      profile,
      selectedBuildingId,
      unreadNotificationCount,
      user,
    ],
  );

  return <VendorAppContext.Provider value={value}>{children}</VendorAppContext.Provider>;
}

export function useVendorApp(): VendorAppContextValue {
  const context = useContext(VendorAppContext);

  if (!context) {
    throw new Error('useVendorApp must be used within VendorAppProvider');
  }

  return context;
}
