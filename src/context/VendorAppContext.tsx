import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
import { useAuth } from './AuthContext';
import { AuthUser } from '../types/auth';
import {
  Building,
  MenuItem,
  OrderStatus,
  VendorDeliveryPartner,
  VendorOrder,
  VendorProfile,
} from '../types/vendor';
import { sortVendorOrders } from '../utils/vendor';

interface VendorAppContextValue {
  user: AuthUser | null;
  profile: VendorProfile | null;
  buildings: Building[];
  selectedBuildingId: number | null;
  setSelectedBuildingId: (buildingId: number) => void;
  products: MenuItem[];
  allProducts: MenuItem[];
  orders: VendorOrder[];
  deliveryPartners: VendorDeliveryPartner[];
  isLoading: boolean;
  productsLoading: boolean;
  ordersLoading: boolean;
  deliveryPartnersLoading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshOrders: () => Promise<void>;
  refreshDeliveryPartners: () => Promise<void>;
  saveProfile: (input: {
    name: string;
    email: string;
    mobile: string;
    store_open: boolean;
    delivery_charge: number;
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

function buildMenuMap(buildings: Building[], menuLists: MenuItem[][]): Record<number, MenuItem[]> {
  return buildings.reduce<Record<number, MenuItem[]>>((result, building, index) => {
    result[building.id] = menuLists[index] ?? [];
    return result;
  }, {});
}

export function VendorAppProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingIdState] = useState<number | null>(null);
  const [productsByBuilding, setProductsByBuilding] = useState<Record<number, MenuItem[]>>({});
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<VendorDeliveryPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [deliveryPartnersLoading, setDeliveryPartnersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      setBuildings([]);
      setSelectedBuildingIdState(null);
      setProductsByBuilding({});
      setOrders([]);
      setDeliveryPartners([]);
      setError(null);
      setIsLoading(false);
      return;
    }
  }, [isAuthenticated]);

  const refreshAll = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const [fetchedProfile, fetchedBuildings, fetchedOrders, fetchedPartners] = await Promise.all([
        fetchVendorProfile(),
        fetchAssignedBuildings(),
        fetchVendorOrders({}),
        fetchDeliveryPartners(),
      ]);

      setProfile(fetchedProfile);
      setBuildings(fetchedBuildings);
      setOrders(sortVendorOrders(fetchedOrders));
      setDeliveryPartners(fetchedPartners);

      if (fetchedBuildings.length === 0) {
        setSelectedBuildingIdState(null);
        setProductsByBuilding({});
        return;
      }

      const menuLists = await Promise.all(
        fetchedBuildings.map((building) => fetchVendorMenu({ buildingId: building.id })),
      );

      setProductsByBuilding(buildMenuMap(fetchedBuildings, menuLists));
      setSelectedBuildingIdState((current) => {
        if (current && fetchedBuildings.some((building) => building.id === current)) {
          return current;
        }

        return fetchedBuildings[0]?.id ?? null;
      });
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load vendor data.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProducts = async (): Promise<void> => {
    if (!selectedBuildingId) {
      return;
    }

    setProductsLoading(true);
    setError(null);

    try {
      const items = await fetchVendorMenu({ buildingId: selectedBuildingId });
      setProductsByBuilding((current) => ({
        ...current,
        [selectedBuildingId]: items,
      }));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load menu items.';
      setError(message);
    } finally {
      setProductsLoading(false);
    }
  };

  const refreshOrders = async (): Promise<void> => {
    setOrdersLoading(true);
    setError(null);

    try {
      const items = await fetchVendorOrders({});
      setOrders(sortVendorOrders(items));
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load orders.';
      setError(message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const refreshDeliveryPartners = async (): Promise<void> => {
    setDeliveryPartnersLoading(true);
    setError(null);

    try {
      const items = await fetchDeliveryPartners();
      setDeliveryPartners(items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load delivery partners.';
      setError(message);
    } finally {
      setDeliveryPartnersLoading(false);
    }
  };

  const saveProfile = async (input: {
    name: string;
    email: string;
    mobile: string;
    store_open: boolean;
    delivery_charge: number;
  }): Promise<void> => {
    const updated = await updateVendorProfile(input);
    if (updated) {
      setProfile(updated);
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
    const previousOrders = orders;

    setOrders((current) =>
      sortVendorOrders(
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status,
                cancel_reason: cancelReason ?? order.cancel_reason ?? null,
                allowed_transitions: [],
              }
            : order,
        ),
      ),
    );

    try {
      const updated = await updateVendorOrderStatus(orderId, status, cancelReason);
      if (updated) {
        setOrders((current) =>
          sortVendorOrders(
            current.map((order) => (order.id === orderId ? updated : order)),
          ),
        );
      }
    } catch (updateError) {
      setOrders(previousOrders);
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
      orders,
      deliveryPartners,
      isLoading,
      productsLoading,
      ordersLoading,
      deliveryPartnersLoading,
      error,
      refreshAll,
      refreshProducts,
      refreshOrders,
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
      deliveryPartners,
      deliveryPartnersLoading,
      error,
      isLoading,
      orders,
      ordersLoading,
      products,
      productsLoading,
      profile,
      selectedBuildingId,
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
