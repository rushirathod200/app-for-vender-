import { API_ENDPOINTS } from '../config/api';
import { AppNotification } from '../types/notification';
import {
  extractCollection,
  extractDataEnvelope,
  isRecord,
  toNullableString,
  toNumberValue,
  toStringValue,
} from '../utils/parsers';
import { apiClient } from './httpClient';

function toRecordMap(value: unknown): Record<string, string | number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string | number>>((result, [key, entry]) => {
    if (typeof entry === 'string' || typeof entry === 'number') {
      result[key] = entry;
    }

    return result;
  }, {});
}

function normalizeNotification(entry: unknown): AppNotification | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toStringValue(entry.id, '').trim();
  if (!id) {
    return null;
  }

  const actor = isRecord(entry.actor) ? entry.actor : null;
  const target = isRecord(entry.target) ? entry.target : null;
  const web = target && isRecord(target.web) ? target.web : null;
  const mobile = target && isRecord(target.mobile) ? target.mobile : null;

  return {
    id,
    title: toStringValue(entry.title, 'Notification'),
    description: toNullableString(entry.description),
    type: toStringValue(entry.type, 'general'),
    is_read: Boolean(entry.is_read),
    read_at: toNullableString(entry.read_at),
    created_at: toNullableString(entry.created_at),
    order_id: toNumberValue(entry.order_id, 0) || null,
    actor: {
      id: actor ? toNumberValue(actor.id, 0) || null : null,
      name: actor ? toNullableString(actor.name) : null,
      role: actor ? toNullableString(actor.role) : null,
    },
    target: {
      web: web
        ? {
            route: toNullableString(web.route),
            params: toRecordMap(web.params),
            url: toNullableString(web.url),
          }
        : null,
      mobile: mobile
        ? {
            screen: toNullableString(mobile.screen),
            params: toRecordMap(mobile.params),
          }
        : null,
    },
  };
}

export async function fetchNotifications(endpoint: string): Promise<AppNotification[]> {
  const payload = await apiClient.get<unknown>(endpoint);

  return extractCollection(payload)
    .map(normalizeNotification)
    .filter((entry): entry is AppNotification => !!entry);
}

export async function fetchUnreadNotificationCount(endpoint: string): Promise<number> {
  const payload = await apiClient.get<unknown>(endpoint);
  const data = extractDataEnvelope(payload);

  if (!isRecord(data)) {
    return 0;
  }

  return toNumberValue(data.unread_count, 0);
}

export async function markNotificationRead(endpointBase: string, notificationId: string): Promise<AppNotification | null> {
  const payload = await apiClient.patch<unknown>(`${endpointBase}/${notificationId}/read`);
  const data = extractDataEnvelope(payload);

  return normalizeNotification(data);
}

export async function fetchVendorNotifications(): Promise<AppNotification[]> {
  return fetchNotifications(API_ENDPOINTS.vendorNotifications);
}

export async function fetchVendorUnreadNotificationCount(): Promise<number> {
  return fetchUnreadNotificationCount(API_ENDPOINTS.vendorNotificationsUnreadCount);
}

export async function markVendorNotificationRead(notificationId: string): Promise<AppNotification | null> {
  return markNotificationRead(API_ENDPOINTS.vendorNotifications, notificationId);
}

export async function fetchDeliveryNotifications(): Promise<AppNotification[]> {
  return fetchNotifications(API_ENDPOINTS.deliveryNotifications);
}

export async function fetchDeliveryUnreadNotificationCount(): Promise<number> {
  return fetchUnreadNotificationCount(API_ENDPOINTS.deliveryNotificationsUnreadCount);
}

export async function markDeliveryNotificationRead(notificationId: string): Promise<AppNotification | null> {
  return markNotificationRead(API_ENDPOINTS.deliveryNotifications, notificationId);
}
