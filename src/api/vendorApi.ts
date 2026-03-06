import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { Building, MenuItem, OrderStatus, StockFilter, VendorOrder, VendorOrderItem } from '../types/vendor';
import {
  asArray,
  extractCollection,
  isRecord,
  toBooleanValue,
  toNumberValue,
  toNullableString,
  toStringValue,
} from '../utils/parsers';
import { requestWithFallback } from './requestWithFallback';
import { apiClient } from './httpClient';

function toPublicStorageUrl(photoPath: string | null): string | null {
  if (!photoPath) {
    return null;
  }

  if (photoPath.startsWith('http://') || photoPath.startsWith('https://')) {
    return photoPath;
  }

  const apiOrigin = new URL(API_BASE_URL).origin;
  const normalizedPath = photoPath.startsWith('/') ? photoPath.slice(1) : photoPath;
  return `${apiOrigin}/storage/${normalizedPath}`;
}

function normalizeBuilding(entry: unknown): Building | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    id,
    name: toStringValue(entry.name, `Building ${id}`),
    address: toNullableString(entry.address),
  };
}

function normalizeMenuItem(entry: unknown): MenuItem | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  const predefined = isRecord(entry.predefined_product)
    ? entry.predefined_product
    : isRecord(entry.predefinedProduct)
      ? entry.predefinedProduct
      : null;

  const productName = predefined ? toNullableString(predefined.name) : null;

  return {
    id,
    building_id: toNumberValue(entry.building_id, 0),
    title: toStringValue(entry.title, productName ?? `Item ${id}`),
    price: toNumberValue(entry.price, 0),
    is_available: toBooleanValue(entry.is_available, true),
    photo_url: toPublicStorageUrl(
      toNullableString(entry.photo_url) ?? toNullableString(entry.photo_path),
    ),
    product_name: productName,
  };
}

function normalizeOrderItem(entry: unknown): VendorOrderItem | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);

  return {
    id,
    title: toStringValue(entry.title, `Item ${id || ''}`.trim()),
    qty: toNumberValue(entry.qty, 1),
    unit_price: toNumberValue(entry.unit_price, 0),
    line_total: toNumberValue(entry.line_total, 0),
  };
}

function normalizeOrder(entry: unknown): VendorOrder | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  const items = asArray(entry.items).map(normalizeOrderItem).filter((item): item is VendorOrderItem => !!item);

  const building = isRecord(entry.building) ? entry.building : null;
  const office = isRecord(entry.office) ? entry.office : null;
  const user = isRecord(entry.user) ? entry.user : null;

  return {
    id,
    order_no: toStringValue(entry.order_no, `#${id}`),
    status: toStringValue(entry.status, 'placed') as OrderStatus,
    subtotal: toNumberValue(entry.subtotal, 0),
    delivery_fee: toNumberValue(entry.delivery_fee, 0),
    total: toNumberValue(entry.total, 0),
    placed_at: toNullableString(entry.placed_at),
    building_name: building ? toNullableString(building.name) : null,
    office_no: office ? toNullableString(office.office_no) : null,
    customer_name: user ? toNullableString(user.name) : null,
    customer_mobile: user ? toNullableString(user.mobile) : null,
    items,
  };
}

function normalizeCollection<T>(payload: unknown, normalizer: (entry: unknown) => T | null): T[] {
  return extractCollection(payload)
    .map(normalizer)
    .filter((entry): entry is T => !!entry);
}

export async function fetchAssignedBuildings(): Promise<Building[]> {
  const payload = await requestWithFallback<unknown>([
    () => apiClient.get(API_ENDPOINTS.vendorBuildings),
    () => apiClient.get('/buildings'),
  ]);

  return normalizeCollection(payload, normalizeBuilding);
}

interface FetchMenuParams {
  buildingId: number;
  search?: string;
  stock?: StockFilter;
}

export async function fetchVendorMenu(params: FetchMenuParams): Promise<MenuItem[]> {
  const payload = await requestWithFallback<unknown>([
    () =>
      apiClient.get(API_ENDPOINTS.vendorMenu, {
        building_id: params.buildingId,
        search: params.search ?? '',
        stock: params.stock ?? '',
      }),
    () =>
      apiClient.get('/menu', {
        building_id: params.buildingId,
        search: params.search ?? '',
        stock: params.stock ?? '',
      }),
  ]);

  return normalizeCollection(payload, normalizeMenuItem);
}

export async function updateMenuItemAvailability(menuItemId: number, isAvailable: boolean): Promise<void> {
  const availabilityPath = `${API_ENDPOINTS.vendorMenu}/${menuItemId}/availability`;

  await requestWithFallback<unknown>([
    () => apiClient.patch(availabilityPath, { is_available: isAvailable }),
    () => apiClient.patch(availabilityPath, {}),
    () => apiClient.put(availabilityPath, { is_available: isAvailable }),
  ], [404, 405, 422]);
}

interface FetchOrdersParams {
  status?: OrderStatus | '';
  buildingId?: number;
}

export async function fetchVendorOrders(params: FetchOrdersParams): Promise<VendorOrder[]> {
  const payload = await requestWithFallback<unknown>([
    () =>
      apiClient.get(API_ENDPOINTS.vendorOrders, {
        status: params.status ?? '',
        building_id: params.buildingId,
      }),
    () =>
      apiClient.get('/orders', {
        status: params.status ?? '',
        building_id: params.buildingId,
      }),
  ]);

  return normalizeCollection(payload, normalizeOrder);
}

export async function updateVendorOrderStatus(orderId: number, status: OrderStatus): Promise<void> {
  const statusPath = `${API_ENDPOINTS.vendorOrders}/${orderId}/status`;

  await requestWithFallback<unknown>([
    () => apiClient.patch(statusPath, { status }),
    () => apiClient.post(statusPath, { status }),
    () => apiClient.put(statusPath, { status }),
  ], [404, 405]);
}
