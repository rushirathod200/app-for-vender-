import { Platform } from 'react-native';

const DEFAULT_WEB_API_BASE_URL = 'http://127.0.0.1:8000/api';
const DEFAULT_NATIVE_API_BASE_URL = 'http://192.168.31.160:8000/api';

const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

export const API_BASE_URL =
  envApiBaseUrl && envApiBaseUrl.length > 0
    ? envApiBaseUrl
    : Platform.OS === 'web'
      ? DEFAULT_WEB_API_BASE_URL
      : DEFAULT_NATIVE_API_BASE_URL;

export const API_ENDPOINTS = {
  authLogin: '/auth/login',
  authMe: '/auth/me',
  authLogout: '/auth/logout',
  vendorMe: '/vendor/me',
  vendorProfile: '/vendor/profile',
  vendorBuildings: '/vendor/buildings',
  vendorCatalogProducts: '/vendor/catalog-products',
  vendorMenu: '/vendor/menu',
  vendorOrders: '/vendor/orders',
  vendorDeliveryPartners: '/vendor/delivery-partners',
  deliveryMe: '/delivery/me',
  deliveryProfile: '/delivery/profile',
  deliveryOrders: '/delivery/orders',
} as const;
