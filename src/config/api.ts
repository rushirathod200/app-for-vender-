const PLACEHOLDER_API_BASE_URL = 'https://YOUR-NGROK-URL.ngrok-free.app/api';

function normalizeApiBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL = normalizeApiBaseUrl(
  envApiBaseUrl && envApiBaseUrl.length > 0 ? envApiBaseUrl : PLACEHOLDER_API_BASE_URL,
);

export const API_BASE_URL_IS_PLACEHOLDER = API_BASE_URL === PLACEHOLDER_API_BASE_URL;

export const API_ENDPOINTS = {
  authLogin: '/auth/login',
  authMe: '/auth/me',
  authLogout: '/auth/logout',
  vendorMe: '/vendor/me',
  vendorProfile: '/vendor/profile',
  vendorBuildings: '/vendor/buildings',
  vendorWalletTopUp: '/vendor/wallet/top-up',
  vendorManualOffices: '/vendor/manual-offices',
  vendorManualOrders: '/vendor/manual-orders',
  vendorManualReports: '/vendor/manual-reports/offices',
  vendorCatalogProducts: '/vendor/catalog-products',
  vendorMenu: '/vendor/menu',
  vendorOrders: '/vendor/orders',
  vendorNotifications: '/vendor/notifications',
  vendorNotificationsUnreadCount: '/vendor/notifications/unread-count',
  vendorDeviceToken: '/vendor/device-token',
  vendorDeliveryPartners: '/vendor/delivery-partners',
  deliveryMe: '/delivery/me',
  deliveryProfile: '/delivery/profile',
  deliveryManualOffices: '/delivery/manual-offices',
  deliveryManualOrders: '/delivery/manual-orders',
  deliveryOrders: '/delivery/orders',
  deliveryQuickRequestCompletion: '/delivery/orders',
  deliveryNotifications: '/delivery/notifications',
  deliveryNotificationsUnreadCount: '/delivery/notifications/unread-count',
  deliveryDeviceToken: '/delivery/device-token',
} as const;
