import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  completeVendorQuickRequest,
  createDeliveryPartner,
  fetchAssignedBuildings,
  fetchDeliveryPartners,
  fetchVendorOrderDashboardData,
  fetchVendorOrdersPage,
  fetchVendorMenu,
  fetchVendorProfile,
  updateDeliveryPartner,
  updateDeliveryPartnerStatus,
  updateBuildingDeliveryCharge,
  updateMenuItemAvailability,
  updateVendorOrderStatus,
  updateVendorProfile,
} from '../api/vendorApi';
import {
  fetchVendorNotificationIndex,
  fetchVendorUnreadNotificationCount,
  markAllVendorNotificationsRead,
  markVendorNotificationRead,
} from '../api/notificationsApi';
import { ApiError } from '../api/httpClient';
import { useAutoClearValue } from '../utils/useAutoClearValue';
import { useAuth } from './AuthContext';
import { AuthUser } from '../types/auth';
import { AppNotification } from '../types/notification';
import {
  BelowMinimumOrderMode,
  Building,
  BuildingOrderPolicyInput,
  MenuItem,
  OrderStatus,
  OrderTabCounts,
  OrderTabKey,
  QuickRequestPaymentMethod,
  StoreHours,
  VendorDeliveryPartner,
  VendorOrder,
  VendorProfile,
  VendorOrderSummary,
} from '../types/vendor';
import { groupVendorOrderStatus, sortVendorOrders } from '../utils/vendor';

interface RefreshOptions {
  force?: boolean;
}

interface OrderPageState {
  currentPage: number;
  lastPage: number;
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
  ordersHasMore: Record<OrderTabKey, boolean>;
  ordersLoadingMoreTab: OrderTabKey | null;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  deliveryPartners: VendorDeliveryPartner[];
  isLoading: boolean;
  productsLoading: boolean;
  ordersLoading: boolean;
  notificationsLoading: boolean;
  deliveryPartnersLoading: boolean;
  storeStatusUpdating: boolean;
  updatingProductIds: number[];
  connectionUnavailable: boolean;
  connectionUnavailableReason: string | null;
  error: string | null;
  refreshAll: (options?: RefreshOptions) => Promise<void>;
  refreshProducts: (options?: RefreshOptions) => Promise<boolean>;
  refreshOrders: (options?: RefreshOptions) => Promise<boolean>;
  loadMoreOrders: (tab: OrderTabKey) => Promise<void>;
  refreshNotifications: (options?: RefreshOptions) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refreshDeliveryPartners: (options?: RefreshOptions) => Promise<void>;
  saveBuildingDeliveryCharge: (buildingId: number, input: BuildingOrderPolicyInput) => Promise<void>;
  saveProfile: (input: {
    name: string;
    email: string;
    mobile: string;
    store_open: boolean;
    store_hours_enabled?: boolean;
    store_hours?: StoreHours;
    delivery_charge: number;
    estimated_waiting_time_minutes: number | null;
    below_minimum_order_mode: BelowMinimumOrderMode;
    minimum_order_value: number;
    building_id?: number;
    quick_request_tea_price?: number;
    quick_request_coffee_price?: number;
    print_bw_price?: number;
    print_color_price?: number;
    print_legal_price?: number;
    office_wallet_credit_enabled: boolean;
  }) => Promise<void>;
  toggleStoreOpen: () => Promise<void>;
  toggleProductActive: (item: MenuItem) => Promise<void>;
  updateOrderStatus: (orderId: number, status: OrderStatus, cancelReason?: string) => Promise<void>;
  completeQuickRequest: (
    orderId: number,
    input: { tea_qty: number; coffee_qty: number; payment_method: QuickRequestPaymentMethod },
  ) => Promise<void>;
  upsertDeliveryPartner: (input: {
    id?: number;
    name: string;
    email: string;
    mobile: string;
    password?: string;
    is_active?: boolean;
    can_cancel_orders: boolean;
  }) => Promise<void>;
  toggleDeliveryPartnerStatus: (partnerId: number) => Promise<void>;
}

const VendorAppContext = createContext<VendorAppContextValue | undefined>(undefined);
const EMPTY_ORDER_COUNTS: OrderTabCounts = {
  pending: 0,
  completed: 0,
  cancelled: 0,
};
const ORDER_PAGE_SIZE = 10;

const CACHE_TTL_MS = {
  all: 30_000,
  orders: 15_000,
  notifications: 20_000,
  deliveryPartners: 60_000,
  products: 60_000,
} as const;

function buildSharedMenuMap(buildings: Building[], menuItems: MenuItem[]): Record<number, MenuItem[]> {
  return buildings.reduce<Record<number, MenuItem[]>>((result, building) => {
    result[building.id] = menuItems;
    return result;
  }, {});
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isFresh(loaded: boolean, timestamp: number, ttlMs: number, force?: boolean): boolean {
  return !force && loaded && (Date.now() - timestamp) < ttlMs;
}

function createEmptyOrdersByTab(): Record<OrderTabKey, VendorOrder[]> {
  return {
    pending: [],
    completed: [],
    cancelled: [],
  };
}

function createInitialOrderPages(): Record<OrderTabKey, OrderPageState> {
  return {
    pending: { currentPage: 0, lastPage: 0 },
    completed: { currentPage: 0, lastPage: 0 },
    cancelled: { currentPage: 0, lastPage: 0 },
  };
}

async function fetchInitialOrderWorkspace() {
  const [dashboard, pending, completed, cancelled] = await Promise.all([
    fetchVendorOrderDashboardData(),
    fetchVendorOrdersPage({ bucket: 'pending', page: 1, perPage: ORDER_PAGE_SIZE }),
    fetchVendorOrdersPage({ bucket: 'completed', page: 1, perPage: ORDER_PAGE_SIZE }),
    fetchVendorOrdersPage({ bucket: 'cancelled', page: 1, perPage: ORDER_PAGE_SIZE }),
  ]);

  return {
    dashboard,
    pages: { pending, completed, cancelled },
  };
}

function buildOrdersByTab(orders: VendorOrder[]): Record<OrderTabKey, VendorOrder[]> {
  return {
    pending: orders.filter((order) => groupVendorOrderStatus(order.status) === 'pending'),
    completed: orders.filter((order) => groupVendorOrderStatus(order.status) === 'completed'),
    cancelled: orders.filter((order) => groupVendorOrderStatus(order.status) === 'cancelled'),
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
  const [orderPages, setOrderPages] = useState<Record<OrderTabKey, OrderPageState>>(createInitialOrderPages);
  const [ordersLoadingMoreTab, setOrdersLoadingMoreTab] = useState<OrderTabKey | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [deliveryPartners, setDeliveryPartners] = useState<VendorDeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [deliveryPartnersLoading, setDeliveryPartnersLoading] = useState(false);
  const [storeStatusUpdating, setStoreStatusUpdating] = useState(false);
  const [updatingProductIds, setUpdatingProductIds] = useState<number[]>([]);
  const [connectionUnavailable, setConnectionUnavailable] = useState(false);
  const [connectionUnavailableReason, setConnectionUnavailableReason] = useState<string | null>(null);
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
    orders: null as Promise<boolean> | null,
    notifications: null as Promise<void> | null,
    deliveryPartners: null as Promise<void> | null,
    productsByBuilding: {} as Record<number, Promise<boolean> | null>,
  });
  const storeToggleInFlightRef = useRef<Promise<void> | null>(null);
  const productToggleInFlightRef = useRef<Record<number, Promise<void>>>({});
  const orderPageInFlightRef = useRef<Record<OrderTabKey, Promise<void> | null>>({
    pending: null,
    completed: null,
    cancelled: null,
  });

  useAutoClearValue(error, () => setError(null));

  const touchCache = useCallback((keys: Array<'all' | 'orders' | 'notifications' | 'deliveryPartners'>): void => {
    const now = Date.now();
    keys.forEach((key) => {
      cacheRef.current[key] = {
        loaded: true,
        timestamp: now,
      };
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      setBuildings([]);
      setSelectedBuildingIdState(null);
      setProductsByBuilding({});
      setOrdersByTab(createEmptyOrdersByTab());
      setOrderCounts(EMPTY_ORDER_COUNTS);
      setDashboardOrderSummary(null);
      setOrderPages(createInitialOrderPages());
      setOrdersLoadingMoreTab(null);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setDeliveryPartners([]);
      setStoreStatusUpdating(false);
      setUpdatingProductIds([]);
      setConnectionUnavailable(false);
      setConnectionUnavailableReason(null);
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
      storeToggleInFlightRef.current = null;
      productToggleInFlightRef.current = {};
      orderPageInFlightRef.current = { pending: null, completed: null, cancelled: null };
      return;
    }
  }, [isAuthenticated]);

  const refreshAll = useCallback(async (options?: RefreshOptions): Promise<void> => {
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
        // Profile and building access are required to establish the vendor workspace.
        // The remaining sections are independent so one temporary endpoint failure
        // must not make the entire app unusable.
        const [fetchedProfile, fetchedBuildings] = await Promise.all([
          fetchVendorProfile(),
          fetchAssignedBuildings(),
        ]);

        setProfile(fetchedProfile);
        setBuildings(fetchedBuildings);
        setConnectionUnavailable(false);
        setConnectionUnavailableReason(null);
        setSelectedBuildingIdState((current) => {
          if (current && fetchedBuildings.some((building) => building.id === current)) {
            return current;
          }

          return fetchedBuildings[0]?.id ?? null;
        });

        const [ordersResult, partnersResult, notificationsResult, menuResult] = await Promise.allSettled([
          fetchInitialOrderWorkspace(),
          fetchDeliveryPartners(),
          (async () => {
            const notificationIndex = await fetchVendorNotificationIndex();
            const unreadCount = notificationIndex.unreadCount ?? (await fetchVendorUnreadNotificationCount());
            return { notificationIndex, unreadCount };
          })(),
          fetchedBuildings.length > 0
            ? fetchVendorMenu({ buildingId: fetchedBuildings[0].id })
            : Promise.resolve([] as MenuItem[]),
        ]);

        const partialErrors: unknown[] = [];

        if (ordersResult.status === 'fulfilled') {
          const { dashboard, pages } = ordersResult.value;
          setOrdersByTab({
            pending: sortVendorOrders(pages.pending.orders),
            completed: sortVendorOrders(pages.completed.orders),
            cancelled: sortVendorOrders(pages.cancelled.orders),
          });
          setOrderCounts(dashboard.counts);
          setDashboardOrderSummary(dashboard.summary);
          setOrderPages({
            pending: { currentPage: pages.pending.currentPage, lastPage: pages.pending.lastPage },
            completed: { currentPage: pages.completed.currentPage, lastPage: pages.completed.lastPage },
            cancelled: { currentPage: pages.cancelled.currentPage, lastPage: pages.cancelled.lastPage },
          });
          touchCache(['orders']);
        } else {
          partialErrors.push(ordersResult.reason);
        }

        if (partnersResult.status === 'fulfilled') {
          setDeliveryPartners(partnersResult.value);
          touchCache(['deliveryPartners']);
        } else {
          partialErrors.push(partnersResult.reason);
        }

        if (notificationsResult.status === 'fulfilled') {
          setNotifications(notificationsResult.value.notificationIndex.notifications);
          setUnreadNotificationCount(notificationsResult.value.unreadCount);
          touchCache(['notifications']);
        } else {
          partialErrors.push(notificationsResult.reason);
        }

        if (menuResult.status === 'fulfilled') {
          setProductsByBuilding(buildSharedMenuMap(fetchedBuildings, menuResult.value));
          const now = Date.now();
          cacheRef.current.productsByBuilding = fetchedBuildings.reduce<Record<number, { loaded: boolean; timestamp: number }>>(
            (result, building) => {
              result[building.id] = { loaded: true, timestamp: now };
              return result;
            },
            {},
          );
        } else {
          partialErrors.push(menuResult.reason);
        }

        if (partialErrors.length === 0) {
          touchCache(['all']);
        } else {
          setError(errorMessage(partialErrors[0], 'Some vendor data could not be refreshed. Please try again.'));
        }
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 0) {
          setConnectionUnavailable(true);
          setConnectionUnavailableReason(loadError.message);
          setError(null);
        } else {
          setError(errorMessage(loadError, 'Could not load vendor data.'));
        }
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
  }, [touchCache]);

  const refreshProducts = useCallback(async (options?: RefreshOptions): Promise<boolean> => {
    if (!selectedBuildingId) {
      return true;
    }

    const buildingId = selectedBuildingId;
    const activeRequest = inFlightRef.current.productsByBuilding[buildingId];

    if (activeRequest) {
      const activeResult = await activeRequest;

      if (!options?.force) {
        return activeResult;
      }
    }

    const currentCache = cacheRef.current.productsByBuilding[buildingId];
    if (
      isFresh(currentCache?.loaded ?? false, currentCache?.timestamp ?? 0, CACHE_TTL_MS.products, options?.force)
    ) {
      return true;
    }

    const request = (async () => {
      setProductsLoading(true);
      setError(null);

      try {
        const items = await fetchVendorMenu({
          buildingId,
          cacheBust: options?.force ? Date.now() : undefined,
        });
        setProductsByBuilding(buildSharedMenuMap(buildings, items));
        const now = Date.now();
        cacheRef.current.productsByBuilding = buildings.reduce<Record<number, { loaded: boolean; timestamp: number }>>(
          (result, building) => {
            result[building.id] = { loaded: true, timestamp: now };
            return result;
          },
          {},
        );
        return true;
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load menu items.';
        setError(message);
        return false;
      } finally {
        setProductsLoading(false);
      }
    })();

    inFlightRef.current.productsByBuilding[buildingId] = request;

    return request.finally(() => {
      if (inFlightRef.current.productsByBuilding[buildingId] === request) {
        delete inFlightRef.current.productsByBuilding[buildingId];
      }
    });
  }, [buildings, selectedBuildingId]);

  const refreshOrders = useCallback(async (options?: RefreshOptions): Promise<boolean> => {
    if (isFresh(cacheRef.current.orders.loaded, cacheRef.current.orders.timestamp, CACHE_TTL_MS.orders, options?.force)) {
      return true;
    }

    if (inFlightRef.current.orders) {
      return inFlightRef.current.orders;
    }

    const request = (async () => {
      setOrdersLoading(true);
      setError(null);

      try {
        const { dashboard, pages } = await fetchInitialOrderWorkspace();
        setOrdersByTab({
          pending: sortVendorOrders(pages.pending.orders),
          completed: sortVendorOrders(pages.completed.orders),
          cancelled: sortVendorOrders(pages.cancelled.orders),
        });
        setOrderCounts(dashboard.counts);
        setDashboardOrderSummary(dashboard.summary);
        setOrderPages({
          pending: { currentPage: pages.pending.currentPage, lastPage: pages.pending.lastPage },
          completed: { currentPage: pages.completed.currentPage, lastPage: pages.completed.lastPage },
          cancelled: { currentPage: pages.cancelled.currentPage, lastPage: pages.cancelled.lastPage },
        });
        touchCache(['orders']);
        return true;
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Could not load orders.';
        setError(message);
        return false;
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
  }, [touchCache]);

  const loadMoreOrders = useCallback(async (tab: OrderTabKey): Promise<void> => {
    const activeRequest = orderPageInFlightRef.current[tab];
    if (activeRequest) {
      return activeRequest;
    }

    const currentPage = orderPages[tab];
    if (currentPage.currentPage >= currentPage.lastPage) {
      return;
    }

    const request = (async () => {
      setOrdersLoadingMoreTab(tab);
      setError(null);

      try {
        const nextPage = await fetchVendorOrdersPage({
          bucket: tab,
          page: currentPage.currentPage + 1,
          perPage: ORDER_PAGE_SIZE,
        });

        setOrdersByTab((current) => {
          const existingIds = new Set(current[tab].map((order) => order.id));
          const appended = nextPage.orders.filter((order) => !existingIds.has(order.id));
          return {
            ...current,
            [tab]: sortVendorOrders([...current[tab], ...appended]),
          };
        });
        setOrderPages((current) => ({
          ...current,
          [tab]: { currentPage: nextPage.currentPage, lastPage: nextPage.lastPage },
        }));
        setOrderCounts((current) => ({ ...current, [tab]: nextPage.total }));
      } catch (loadError) {
        setError(errorMessage(loadError, 'Could not load more orders.'));
      } finally {
        setOrdersLoadingMoreTab((current) => (current === tab ? null : current));
      }
    })();

    orderPageInFlightRef.current[tab] = request;

    return request.finally(() => {
      if (orderPageInFlightRef.current[tab] === request) {
        orderPageInFlightRef.current[tab] = null;
      }
    });
  }, [orderPages]);

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

  const markAllNotificationsRead = async (): Promise<void> => {
    if (unreadNotificationCount <= 0) {
      return;
    }

    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    setUnreadNotificationCount(0);

    try {
      await markAllVendorNotificationsRead();
      touchCache(['all', 'notifications']);
    } catch (updateError) {
      await refreshNotifications({ force: true });
      const message = updateError instanceof Error ? updateError.message : 'Could not update notifications.';
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
    store_hours_enabled?: boolean;
    store_hours?: StoreHours;
    delivery_charge: number;
    estimated_waiting_time_minutes: number | null;
    below_minimum_order_mode: BelowMinimumOrderMode;
    minimum_order_value: number;
    building_id?: number;
    quick_request_tea_price?: number;
    quick_request_coffee_price?: number;
    print_bw_price?: number;
    print_color_price?: number;
    print_legal_price?: number;
    office_wallet_credit_enabled: boolean;
  }): Promise<void> => {
    const updated = await updateVendorProfile(input);
    if (updated) {
      const synchronizeDefaultCharge = (building: Building): Building => {
        const usesDefaultPolicy = building.uses_default_order_policy;
        const effectiveMode = usesDefaultPolicy
          ? updated.below_minimum_order_mode
          : building.effective_below_minimum_order_mode;

        return {
          ...building,
          default_delivery_charge: updated.delivery_charge,
          default_below_minimum_order_mode: updated.below_minimum_order_mode,
          default_minimum_order_value: updated.minimum_order_value,
          effective_below_minimum_order_mode: effectiveMode,
          effective_minimum_order_value: usesDefaultPolicy
            ? effectiveMode === 'free_delivery' ? 0 : updated.minimum_order_value
            : building.effective_minimum_order_value,
          effective_delivery_charge: usesDefaultPolicy
            ? effectiveMode === 'charge_delivery' ? updated.delivery_charge : 0
            : building.effective_delivery_charge,
          uses_default_delivery_charge: building.delivery_charge_override === null,
        };
      };

      setBuildings((current) => current.map(synchronizeDefaultCharge));
      setProfile({
        ...updated,
        assigned_buildings: buildings.length
          ? buildings.map(synchronizeDefaultCharge)
          : updated.assigned_buildings.map(synchronizeDefaultCharge),
      });
      touchCache(['all']);
    }
  };

  const saveBuildingDeliveryCharge = async (
    buildingId: number,
    input: BuildingOrderPolicyInput,
  ): Promise<void> => {
    setError(null);
    const updated = await updateBuildingDeliveryCharge(buildingId, input);

    if (!updated) {
      throw new Error('Could not update the building delivery charge.');
    }

    setBuildings((current) => current.map((building) => (
      building.id === buildingId ? updated : building
    )));
    setProfile((current) => current ? {
      ...current,
      assigned_buildings: current.assigned_buildings.map((building) => (
        building.id === buildingId ? updated : building
      )),
    } : current);
    touchCache(['all']);
  };

  const toggleStoreOpen = async (): Promise<void> => {
    if (storeToggleInFlightRef.current) {
      return storeToggleInFlightRef.current;
    }

    if (!profile) {
      return;
    }

    const previousProfile = profile;
    const next = !previousProfile.store_open;
    setProfile({ ...previousProfile, store_open: next });
    setStoreStatusUpdating(true);

    const request = (async () => {
      try {
        const quickRequestBuilding = previousProfile.assigned_buildings.find(
          (building) => building.is_quick_request_vendor,
        );

        await saveProfile({
          name: previousProfile.name ?? '',
          email: previousProfile.email ?? '',
          mobile: previousProfile.mobile,
          store_open: next,
          store_hours_enabled: previousProfile.store_hours_enabled,
          store_hours: previousProfile.store_hours,
          delivery_charge: previousProfile.delivery_charge,
          estimated_waiting_time_minutes: previousProfile.estimated_waiting_time_minutes,
          below_minimum_order_mode: previousProfile.below_minimum_order_mode,
          minimum_order_value: previousProfile.minimum_order_value,
          building_id: quickRequestBuilding?.id,
          quick_request_tea_price: quickRequestBuilding ? previousProfile.quick_request_tea_price : undefined,
          quick_request_coffee_price: quickRequestBuilding ? previousProfile.quick_request_coffee_price : undefined,
          print_bw_price: previousProfile.can_manage_print_pricing ? previousProfile.print_bw_price : undefined,
          print_color_price: previousProfile.can_manage_print_pricing ? previousProfile.print_color_price : undefined,
          print_legal_price: previousProfile.can_manage_print_pricing ? previousProfile.print_legal_price : undefined,
          office_wallet_credit_enabled: previousProfile.office_wallet_credit_enabled,
        });
      } catch (toggleError) {
        setProfile(previousProfile);
        setError(errorMessage(toggleError, 'Could not update store status.'));
        throw toggleError;
      }
    })();

    storeToggleInFlightRef.current = request;

    return request.finally(() => {
      if (storeToggleInFlightRef.current === request) {
        storeToggleInFlightRef.current = null;
        setStoreStatusUpdating(false);
      }
    });
  };

  const toggleProductActive = async (item: MenuItem): Promise<void> => {
    const productKey = item.predefined_product_id ?? item.id;
    const existingRequest = productToggleInFlightRef.current[productKey];
    if (existingRequest) {
      return existingRequest;
    }

    const nextAvailability = !item.is_available;
    const updateCachedItem = (entry: MenuItem, isAvailable: boolean): MenuItem =>
      entry.id === item.id ||
      (item.predefined_product_id !== null &&
        item.predefined_product_id !== undefined &&
        entry.predefined_product_id === item.predefined_product_id)
        ? {
            ...entry,
            is_available: isAvailable,
          }
        : entry;

    setProductsByBuilding((current) =>
      Object.fromEntries(
        Object.entries(current).map(([buildingId, entries]) => [
          buildingId,
          entries.map((entry) => updateCachedItem(entry, nextAvailability)),
        ]),
      ),
    );
    setUpdatingProductIds((current) => (current.includes(productKey) ? current : [...current, productKey]));

    const request = (async () => {
      try {
        await updateMenuItemAvailability(item.id, nextAvailability);
        const now = Date.now();
        Object.keys(cacheRef.current.productsByBuilding).forEach((buildingId) => {
          cacheRef.current.productsByBuilding[Number(buildingId)] = {
            loaded: true,
            timestamp: now,
          };
        });
        touchCache(['all']);
      } catch (toggleError) {
        setProductsByBuilding((current) =>
          Object.fromEntries(
            Object.entries(current).map(([buildingId, entries]) => [
              buildingId,
              entries.map((entry) => updateCachedItem(entry, item.is_available)),
            ]),
          ),
        );

        setError(errorMessage(toggleError, 'Could not update menu item availability.'));
        throw toggleError;
      }
    })();

    productToggleInFlightRef.current[productKey] = request;

    return request.finally(() => {
      if (productToggleInFlightRef.current[productKey] === request) {
        delete productToggleInFlightRef.current[productKey];
        setUpdatingProductIds((current) => current.filter((id) => id !== productKey));
      }
    });
  };

  const updateOrderStatus = useCallback(async (
    orderId: number,
    status: OrderStatus,
    cancelReason?: string,
  ): Promise<void> => {
    const previousOrdersByTab = ordersByTab;
    const previousOrderCounts = orderCounts;
    const previousDashboardOrderSummary = dashboardOrderSummary;
    const previousOrder = Object.values(ordersByTab).flat().find((order) => order.id === orderId) ?? null;
    const previousBucket = previousOrder ? groupVendorOrderStatus(previousOrder.status) : null;
    const nextBucket = groupVendorOrderStatus(status);
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
    const optimisticOrderCounts = { ...previousOrderCounts };
    if (previousBucket && previousBucket !== nextBucket) {
      optimisticOrderCounts[previousBucket] = Math.max(0, optimisticOrderCounts[previousBucket] - 1);
      optimisticOrderCounts[nextBucket] += 1;
    }
    const optimisticDashboardSummary = previousDashboardOrderSummary
      ? {
          ...previousDashboardOrderSummary,
          total_sales:
            previousDashboardOrderSummary.total_sales +
            (previousBucket !== 'completed' && nextBucket === 'completed' ? (previousOrder?.total ?? 0) : 0),
          recent_orders: previousDashboardOrderSummary.recent_orders.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  status,
                  cancel_reason: status === 'cancelled' ? (cancelReason ?? order.cancel_reason ?? null) : null,
                  allowed_transitions: [],
                }
              : order,
          ),
        }
      : null;

    setOrdersByTab(optimisticOrdersByTab);
    setOrderCounts(optimisticOrderCounts);
    setDashboardOrderSummary(optimisticDashboardSummary);

    try {
      const updated = await updateVendorOrderStatus(orderId, status, cancelReason);
      if (updated) {
        const syncedOrders = sortVendorOrders(
          optimisticOrders.map((order) => (order.id === orderId ? updated : order)),
        );
        const syncedOrdersByTab = buildOrdersByTab(syncedOrders);
        const syncedDashboardSummary = previousDashboardOrderSummary
          ? {
              ...previousDashboardOrderSummary,
              total_sales:
                previousDashboardOrderSummary.total_sales +
                (previousBucket !== 'completed' && nextBucket === 'completed' ? updated.total : 0),
              recent_orders: previousDashboardOrderSummary.recent_orders.map((order) =>
                order.id === orderId ? updated : order,
              ),
            }
          : null;

        setOrdersByTab(syncedOrdersByTab);
        setOrderCounts(optimisticOrderCounts);
        setDashboardOrderSummary(syncedDashboardSummary);
        touchCache(['all', 'orders']);
        void refreshOrders({ force: true });
      }
    } catch (updateError) {
      setOrdersByTab(previousOrdersByTab);
      setOrderCounts(previousOrderCounts);
      setDashboardOrderSummary(previousDashboardOrderSummary);
      const message = updateError instanceof Error ? updateError.message : 'Could not update order status.';
      setError(message);
      throw updateError;
    }
  }, [dashboardOrderSummary, orderCounts, ordersByTab, refreshOrders, touchCache]);

  const completeQuickRequest = useCallback(async (
    orderId: number,
    input: { tea_qty: number; coffee_qty: number; payment_method: QuickRequestPaymentMethod },
  ): Promise<void> => {
    const previousOrdersByTab = ordersByTab;
    const previousOrderCounts = orderCounts;
    const previousDashboardOrderSummary = dashboardOrderSummary;
    const previousOrder = Object.values(previousOrdersByTab)
      .flat()
      .find((order) => order.id === orderId) ?? null;

    try {
      const updated = await completeVendorQuickRequest(orderId, input);
      if (!updated) {
        throw new Error('Server did not return the completed quick request.');
      }

      const syncedOrders = sortVendorOrders(
        Object.values(previousOrdersByTab)
          .flat()
          .map((order) => (order.id === orderId ? updated : order)),
      );
      const previousBucket = previousOrder ? groupVendorOrderStatus(previousOrder.status) : null;
      const nextBucket = groupVendorOrderStatus(updated.status);
      const syncedCounts = { ...previousOrderCounts };

      if (previousBucket && previousBucket !== nextBucket) {
        syncedCounts[previousBucket] = Math.max(0, syncedCounts[previousBucket] - 1);
        syncedCounts[nextBucket] += 1;
      }

      setOrdersByTab(buildOrdersByTab(syncedOrders));
      setOrderCounts(syncedCounts);
      setDashboardOrderSummary((current) => current ? {
        ...current,
        total_sales: current.total_sales + (previousBucket !== 'completed' ? updated.total : 0),
        recent_orders: current.recent_orders.map((order) => order.id === orderId ? updated : order),
      } : current);
      touchCache(['all', 'orders']);
      void refreshOrders({ force: true });
    } catch (completionError) {
      setOrdersByTab(previousOrdersByTab);
      setOrderCounts(previousOrderCounts);
      setDashboardOrderSummary(previousDashboardOrderSummary);
      setError(errorMessage(completionError, 'Could not complete quick request.'));
      throw completionError;
    }
  }, [dashboardOrderSummary, orderCounts, ordersByTab, refreshOrders, touchCache]);

  const upsertDeliveryPartner = async (input: {
    id?: number;
    name: string;
    email: string;
    mobile: string;
    password?: string;
    is_active?: boolean;
    can_cancel_orders: boolean;
  }): Promise<void> => {
    const result = input.id
      ? await updateDeliveryPartner(input.id, {
          name: input.name,
          email: input.email,
          mobile: input.mobile,
          can_cancel_orders: input.can_cancel_orders,
          ...(input.password ? { password: input.password } : {}),
        })
      : await createDeliveryPartner({
          name: input.name,
          email: input.email,
          mobile: input.mobile,
          password: input.password ?? '',
          is_active: input.is_active ?? true,
          can_cancel_orders: input.can_cancel_orders,
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

  const products = useMemo(
    () => (selectedBuildingId ? productsByBuilding[selectedBuildingId] ?? [] : []),
    [productsByBuilding, selectedBuildingId],
  );
  // The backend exposes one canonical vendor menu for every assigned building.
  // Reuse the selected canonical list so dashboard counts cannot multiply by building count.
  const allProducts = products;
  const ordersHasMore = useMemo<Record<OrderTabKey, boolean>>(
    () => ({
      pending: orderPages.pending.currentPage < orderPages.pending.lastPage,
      completed: orderPages.completed.currentPage < orderPages.completed.lastPage,
      cancelled: orderPages.cancelled.currentPage < orderPages.cancelled.lastPage,
    }),
    [orderPages],
  );

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
      ordersHasMore,
      ordersLoadingMoreTab,
      notifications,
      unreadNotificationCount,
      deliveryPartners,
      isLoading,
      productsLoading,
      ordersLoading,
      notificationsLoading,
      deliveryPartnersLoading,
      storeStatusUpdating,
      updatingProductIds,
      connectionUnavailable,
      connectionUnavailableReason,
      error,
      refreshAll,
      refreshProducts,
      refreshOrders,
      loadMoreOrders,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      refreshDeliveryPartners,
      saveBuildingDeliveryCharge,
      saveProfile,
      toggleStoreOpen,
      toggleProductActive,
      updateOrderStatus,
      completeQuickRequest,
      upsertDeliveryPartner,
      toggleDeliveryPartnerStatus,
    }),
    [
      allProducts,
      buildings,
      connectionUnavailable,
      connectionUnavailableReason,
      dashboardOrderSummary,
      deliveryPartners,
      deliveryPartnersLoading,
      error,
      isLoading,
      notifications,
      notificationsLoading,
      orderCounts,
      orderPages,
      ordersByTab,
      ordersLoadingMoreTab,
      ordersLoading,
      products,
      productsLoading,
      profile,
      selectedBuildingId,
      storeStatusUpdating,
      unreadNotificationCount,
      updatingProductIds,
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
