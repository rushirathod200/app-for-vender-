const PRODUCTION_API_BASE_URL = 'https://deskdrop.in/api';

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = normalizeApiBaseUrl(
  envApiBaseUrl && envApiBaseUrl.length > 0 ? envApiBaseUrl : PRODUCTION_API_BASE_URL,
);

export const API_BASE_URL_IS_PLACEHOLDER = false;

export const APP_ID = 'com.deskdrop.vendor';

export const API_ENDPOINTS = {
  authLogin: '/auth/login',
  authMe: '/auth/me',
  authLogout: '/auth/logout',
  vendorMe: '/vendor/me',
  vendorProfile: '/vendor/profile',
  vendorBuildings: '/vendor/buildings',
  vendorOfficeWallets: '/vendor/wallet/office-wallets',
  vendorWalletTopUp: '/vendor/wallet/top-up',
  vendorManualOffices: '/vendor/manual-offices',
  vendorManualOrders: '/vendor/manual-orders',
  vendorManualReports: '/vendor/manual-reports/offices',
  vendorCatalogProducts: '/vendor/catalog-products',
  vendorProductFormOptions: '/vendor/product-form-options',
  vendorProductSubcategories: '/vendor/product-subcategories',
  vendorProducts: '/vendor/products',
  vendorMenu: '/vendor/menu',
  vendorOrders: '/vendor/orders',
  vendorNotifications: '/vendor/notifications',
  vendorNotificationsUnreadCount: '/vendor/notifications/unread-count',
  vendorNotificationsReadAll: '/vendor/notifications/read-all',
  vendorDeviceToken: '/vendor/device-token',
  vendorDeliveryPartners: '/vendor/delivery-partners',
  referrals: '/referrals',
  coins: '/coins',
  payouts: '/payouts',
  deliveryMe: '/delivery/me',
  deliveryProfile: '/delivery/profile',
  deliveryManualOffices: '/delivery/manual-offices',
  deliveryManualOrders: '/delivery/manual-orders',
  deliveryOrders: '/delivery/orders',
  deliveryQuickRequestCompletion: '/delivery/orders',
  deliveryNotifications: '/delivery/notifications',
  deliveryNotificationsUnreadCount: '/delivery/notifications/unread-count',
  deliveryNotificationsReadAll: '/delivery/notifications/read-all',
  deliveryDeviceToken: '/delivery/device-token',
} as const;
