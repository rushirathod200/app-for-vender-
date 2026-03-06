import React, { createContext, useContext, useMemo, useState } from 'react';

import {
  defaultDeliveryPartners,
  defaultOrders,
  defaultProducts,
  defaultStoreProfile,
  productCatalog,
} from './mockData';
import { AppOrder, AppRole, DeliveryPartner, StoreProfile, VendorProduct } from '../types/workflow';

interface LoginInput {
  email: string;
  password: string;
}

interface DeliveryPartnerInput {
  id?: string;
  name: string;
  email: string;
  password?: string;
}

interface AppWorkflowContextValue {
  role: AppRole | null;
  isAuthenticated: boolean;
  currentEmail: string | null;
  isStoreOpen: boolean;
  storeProfile: StoreProfile;
  orders: AppOrder[];
  products: VendorProduct[];
  deliveryPartners: DeliveryPartner[];
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
  setStoreOpen: (next: boolean) => void;
  updateOrderStatus: (orderId: string, status: AppOrder['status'], reason?: string) => void;
  toggleProductActive: (productId: string) => void;
  deleteProduct: (productId: string) => void;
  updateProductPrice: (productId: string, nextPrice: number) => void;
  addProductFromCatalog: (catalogId: string, price: number) => void;
  availableCatalogItems: () => typeof productCatalog;
  upsertDeliveryPartner: (input: DeliveryPartnerInput) => void;
  toggleDeliveryPartnerStatus: (partnerId: string) => void;
  saveStoreProfile: (payload: StoreProfile) => void;
}

const AppWorkflowContext = createContext<AppWorkflowContextValue | undefined>(undefined);

function inferRoleFromEmail(email: string): AppRole {
  return email.trim().toLowerCase().startsWith('vendor@') ? 'vendor' : 'delivery';
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function AppWorkflowProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [storeProfile, setStoreProfile] = useState<StoreProfile>(defaultStoreProfile);
  const [orders, setOrders] = useState<AppOrder[]>(defaultOrders);
  const [products, setProducts] = useState<VendorProduct[]>(defaultProducts);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>(defaultDeliveryPartners);

  const login = async (input: LoginInput): Promise<void> => {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();

    if (!email.includes('@')) {
      throw new Error('Enter a valid email address.');
    }

    if (password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    await pause(380);

    setRole(inferRoleFromEmail(email));
    setCurrentEmail(email);
  };

  const logout = (): void => {
    setRole(null);
    setCurrentEmail(null);
  };

  const updateOrderStatus = (orderId: string, status: AppOrder['status'], reason?: string): void => {
    setOrders((current) =>
      current.map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        return {
          ...order,
          status,
          cancelReason: status === 'cancelled' ? reason || order.cancelReason || 'Cancelled by partner.' : undefined,
        };
      }),
    );
  };

  const toggleProductActive = (productId: string): void => {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              isActive: !product.isActive,
            }
          : product,
      ),
    );
  };

  const deleteProduct = (productId: string): void => {
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

  const updateProductPrice = (productId: string, nextPrice: number): void => {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId
          ? {
              ...product,
              price: nextPrice,
            }
          : product,
      ),
    );
  };

  const addProductFromCatalog = (catalogId: string, price: number): void => {
    const selected = productCatalog.find((item) => item.id === catalogId);
    if (!selected) {
      return;
    }

    const nextId = `p${Date.now()}`;

    setProducts((current) => [
      {
        id: nextId,
        name: selected.name,
        category: selected.category,
        emoji: selected.emoji,
        price,
        isActive: true,
      },
      ...current,
    ]);
  };

  const availableCatalogItems = (): typeof productCatalog => {
    const existingNames = new Set(products.map((item) => item.name.toLowerCase()));
    return productCatalog.filter((item) => !existingNames.has(item.name.toLowerCase()));
  };

  const upsertDeliveryPartner = (input: DeliveryPartnerInput): void => {
    if (input.id) {
      setDeliveryPartners((current) =>
        current.map((partner) =>
          partner.id === input.id
            ? {
                ...partner,
                name: input.name,
                email: input.email,
              }
            : partner,
        ),
      );
      return;
    }

    const next: DeliveryPartner = {
      id: `d${Date.now()}`,
      name: input.name,
      email: input.email,
      totalDeliveries: 0,
      isActive: true,
    };

    setDeliveryPartners((current) => [next, ...current]);
  };

  const toggleDeliveryPartnerStatus = (partnerId: string): void => {
    setDeliveryPartners((current) =>
      current.map((partner) =>
        partner.id === partnerId
          ? {
              ...partner,
              isActive: !partner.isActive,
            }
          : partner,
      ),
    );
  };

  const saveStoreProfile = (payload: StoreProfile): void => {
    setStoreProfile(payload);
  };

  const value = useMemo<AppWorkflowContextValue>(
    () => ({
      role,
      isAuthenticated: Boolean(role),
      currentEmail,
      isStoreOpen,
      storeProfile,
      orders,
      products,
      deliveryPartners,
      login,
      logout,
      setStoreOpen: setIsStoreOpen,
      updateOrderStatus,
      toggleProductActive,
      deleteProduct,
      updateProductPrice,
      addProductFromCatalog,
      availableCatalogItems,
      upsertDeliveryPartner,
      toggleDeliveryPartnerStatus,
      saveStoreProfile,
    }),
    [
      role,
      currentEmail,
      isStoreOpen,
      storeProfile,
      orders,
      products,
      deliveryPartners,
      login,
      logout,
      updateOrderStatus,
      toggleProductActive,
      deleteProduct,
      updateProductPrice,
      addProductFromCatalog,
      availableCatalogItems,
      upsertDeliveryPartner,
      toggleDeliveryPartnerStatus,
      saveStoreProfile,
    ],
  );

  return <AppWorkflowContext.Provider value={value}>{children}</AppWorkflowContext.Provider>;
}

export function useAppWorkflow(): AppWorkflowContextValue {
  const context = useContext(AppWorkflowContext);

  if (!context) {
    throw new Error('useAppWorkflow must be used inside AppWorkflowProvider');
  }

  return context;
}
