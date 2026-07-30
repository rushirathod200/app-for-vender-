import { API_ENDPOINTS } from '../config/api';
import { apiClient } from './httpClient';

export async function registerVendorDeviceToken(input: {
  token: string;
  device_id?: string | null;
  app_id?: string | null;
  platform?: 'android' | 'ios';
  device_name?: string;
}): Promise<void> {
  await apiClient.post(API_ENDPOINTS.vendorDeviceToken, {
    token: input.token,
    device_id: input.device_id ?? null,
    app_id: input.app_id ?? null,
    platform: input.platform ?? 'android',
    device_name: input.device_name ?? null,
  });
}

export async function registerDeliveryDeviceToken(input: {
  token: string;
  device_id?: string | null;
  app_id?: string | null;
  platform?: 'android' | 'ios';
  device_name?: string;
}): Promise<void> {
  await apiClient.post(API_ENDPOINTS.deliveryDeviceToken, {
    token: input.token,
    device_id: input.device_id ?? null,
    app_id: input.app_id ?? null,
    platform: input.platform ?? 'android',
    device_name: input.device_name ?? null,
  });
}
