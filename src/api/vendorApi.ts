import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import {
  AssignedDeliveryPartner,
  Building,
  CatalogProduct,
  DeliveryPartnerFilter,
  MenuItem,
  OrderStatus,
  StockFilter,
  VendorDeliveryPartner,
  VendorOrder,
  VendorOrderItem,
  VendorProfile,
} from '../types/vendor';
import {
  asArray,
  extractCollection,
  extractDataEnvelope,
  isRecord,
  toBooleanValue,
  toNumberValue,
  toNullableString,
  toStringValue,
} from '../utils/parsers';
import { apiClient } from './httpClient';

function toPublicAssetUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const apiOrigin = new URL(API_BASE_URL).origin;

  if (path.startsWith('/')) {
    return `${apiOrigin}${path}`;
  }

  return `${apiOrigin}/storage/${path}`;
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
    is_active: toBooleanValue(entry.is_active, true),
    wings_count: toNumberValue(entry.wings_count, 0),
    floors_count: toNumberValue(entry.floors_count, 0),
    menu_items_count: toNumberValue(entry.menu_items_count, 0),
    orders_count: toNumberValue(entry.orders_count, 0),
  };
}

function normalizeCatalogProduct(entry: unknown): CatalogProduct | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    id,
    name: toStringValue(entry.name, `Product ${id}`),
    description: toNullableString(entry.description),
    category: toNullableString(entry.category),
    default_image_url: toPublicAssetUrl(
      toNullableString(entry.default_image_url) ?? toNullableString(entry.default_image),
    ),
    is_active: toBooleanValue(entry.is_active, true),
    is_added: toBooleanValue(entry.is_added, false),
    menu_item_id: toNumberValue(entry.menu_item_id, 0) || null,
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
  const building = isRecord(entry.building) ? entry.building : null;

  return {
    id,
    building_id: toNumberValue(entry.building_id, 0),
    vendor_id: toNumberValue(entry.vendor_id, 0) || undefined,
    predefined_product_id: toNumberValue(entry.predefined_product_id, 0) || null,
    title: toStringValue(entry.title, `Item ${id}`),
    price: toNumberValue(entry.price, 0),
    is_available: toBooleanValue(entry.is_available, true),
    photo_url: toPublicAssetUrl(
      toNullableString(entry.photo_url) ??
        toNullableString(entry.photo_path) ??
        (predefined ? toNullableString(predefined.default_image_url) ?? toNullableString(predefined.default_image) : null),
    ),
    product_name: predefined ? toNullableString(predefined.name) : toNullableString(entry.product_name),
    category: predefined ? toNullableString(predefined.category) : null,
    description: predefined ? toNullableString(predefined.description) : null,
    building_name: building ? toNullableString(building.name) : null,
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

  const items = asArray(entry.items)
    .map(normalizeOrderItem)
    .filter((item): item is VendorOrderItem => !!item);
  const building = isRecord(entry.building) ? entry.building : null;
  const office = isRecord(entry.office) ? entry.office : null;
  const user = isRecord(entry.user) ? entry.user : null;
  const deliveryPartner = isRecord(entry.delivery_partner) ? entry.delivery_partner : null;
  const allowedTransitions = asArray(entry.allowed_transitions)
    .map((status) => toStringValue(status, '') as OrderStatus)
    .filter((status): status is OrderStatus => Boolean(status));
  const normalizedDeliveryPartner: AssignedDeliveryPartner | null =
    deliveryPartner && toNumberValue(deliveryPartner.id, 0)
      ? {
          id: toNumberValue(deliveryPartner.id, 0),
          name: toNullableString(deliveryPartner.name),
          email: toNullableString(deliveryPartner.email),
          mobile: toNullableString(deliveryPartner.mobile),
        }
      : null;

  return {
    id,
    order_no: toStringValue(entry.order_no, `#${id}`),
    status: toStringValue(entry.status, 'placed') as OrderStatus,
    subtotal: toNumberValue(entry.subtotal, 0),
    delivery_fee: toNumberValue(entry.delivery_fee, 0),
    total: toNumberValue(entry.total, 0),
    payment_method: toNullableString(entry.payment_method),
    notes: toNullableString(entry.notes),
    cancel_reason: toNullableString(entry.cancel_reason) ?? toNullableString(entry.cancelReason),
    placed_at: toNullableString(entry.placed_at),
    building_name: building ? toNullableString(building.name) : null,
    office_no: office ? toNullableString(office.office_no) : null,
    customer_name: user ? toNullableString(user.name) : null,
    customer_mobile: user ? toNullableString(user.mobile) : null,
    delivery_partner: normalizedDeliveryPartner,
    allowed_transitions: allowedTransitions,
    items,
  };
}

function normalizeDeliveryPartner(entry: unknown): VendorDeliveryPartner | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    id,
    name: toStringValue(entry.name, `Partner ${id}`),
    email: toNullableString(entry.email),
    mobile: toNullableString(entry.mobile),
    is_active: toBooleanValue(entry.is_active, true),
    partner_active: toBooleanValue(entry.partner_active, true),
    app_access_active: toBooleanValue(entry.app_access_active, true),
    active_order_count: toNumberValue(entry.active_order_count, 0),
  };
}

function normalizeProfile(payload: unknown): VendorProfile | null {
  if (!isRecord(payload)) {
    return null;
  }

  const envelope = extractDataEnvelope(payload);
  if (!isRecord(envelope)) {
    return null;
  }

  const id = toNumberValue(envelope.id, 0);
  const mobile = toStringValue(envelope.mobile, '');

  if (!id || !mobile) {
    return null;
  }

  const assignedBuildings = asArray(envelope.assigned_buildings)
    .map(normalizeBuilding)
    .filter((building): building is Building => !!building);

  return {
    id,
    name: toNullableString(envelope.name),
    email: toNullableString(envelope.email),
    mobile,
    role: toStringValue(envelope.role, 'vendor'),
    is_active: toBooleanValue(envelope.is_active, true),
    store_open: toBooleanValue(envelope.store_open, true),
    delivery_charge: toNumberValue(envelope.delivery_charge, 0),
    assigned_buildings: assignedBuildings,
    active_order_count: toNumberValue(envelope.active_order_count, 0),
  };
}

function normalizeCollection<T>(payload: unknown, normalizer: (entry: unknown) => T | null): T[] {
  return extractCollection(payload)
    .map(normalizer)
    .filter((entry): entry is T => !!entry);
}

export async function fetchVendorProfile(): Promise<VendorProfile | null> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorMe);
  return normalizeProfile(payload);
}

export async function updateVendorProfile(input: {
  name: string;
  email: string;
  mobile: string;
  store_open: boolean;
  delivery_charge: number;
}): Promise<VendorProfile | null> {
  const payload = await apiClient.patch<unknown>(API_ENDPOINTS.vendorProfile, input);
  return normalizeProfile(payload);
}

export async function fetchAssignedBuildings(): Promise<Building[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorBuildings);
  return normalizeCollection(payload, normalizeBuilding);
}

export async function fetchCatalogProducts(params?: { buildingId?: number }): Promise<CatalogProduct[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorCatalogProducts, {
    building_id: params?.buildingId,
  });
  return normalizeCollection(payload, normalizeCatalogProduct);
}

interface FetchMenuParams {
  buildingId?: number;
  search?: string;
  stock?: StockFilter;
}

export async function fetchVendorMenu(params: FetchMenuParams): Promise<MenuItem[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorMenu, {
    building_id: params.buildingId,
    search: params.search ?? '',
    stock: params.stock ?? '',
  });

  return normalizeCollection(payload, normalizeMenuItem);
}

export async function createVendorMenuItem(input: {
  building_id: number;
  predefined_product_id: number;
  title: string;
  price: number;
  is_available?: boolean;
}): Promise<MenuItem | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorMenu, input);
  const data = extractDataEnvelope(payload);
  return normalizeMenuItem(data);
}

export async function updateVendorMenuItem(
  menuItemId: number,
  input: { title: string; price: number; is_available?: boolean },
): Promise<MenuItem | null> {
  const payload = await apiClient.patch<unknown>(`${API_ENDPOINTS.vendorMenu}/${menuItemId}`, input);
  const data = extractDataEnvelope(payload);
  return normalizeMenuItem(data);
}

export async function deleteVendorMenuItem(menuItemId: number): Promise<void> {
  await apiClient.delete<unknown>(`${API_ENDPOINTS.vendorMenu}/${menuItemId}`);
}

export async function updateMenuItemAvailability(menuItemId: number, isAvailable: boolean): Promise<void> {
  await apiClient.patch<unknown>(`${API_ENDPOINTS.vendorMenu}/${menuItemId}/availability`, {
    is_available: isAvailable,
  });
}

interface FetchOrdersParams {
  status?: OrderStatus | '';
  buildingId?: number;
}

export async function fetchVendorOrders(params: FetchOrdersParams): Promise<VendorOrder[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorOrders, {
    status: params.status ?? '',
    building_id: params.buildingId,
  });

  return normalizeCollection(payload, normalizeOrder);
}

export async function updateVendorOrderStatus(
  orderId: number,
  status: OrderStatus,
  cancelReason?: string,
): Promise<VendorOrder | null> {
  const payload = await apiClient.patch<unknown>(`${API_ENDPOINTS.vendorOrders}/${orderId}/status`, {
    status,
    ...(cancelReason ? { cancel_reason: cancelReason } : {}),
  });

  const data = extractDataEnvelope(payload);
  return normalizeOrder(data);
}

export async function assignVendorOrderDeliveryPartner(
  orderId: number,
  deliveryUserId: number | null,
): Promise<VendorOrder | null> {
  const payload = await apiClient.patch<unknown>(`${API_ENDPOINTS.vendorOrders}/${orderId}/delivery-partner`, {
    delivery_user_id: deliveryUserId,
  });

  const data = extractDataEnvelope(payload);
  return normalizeOrder(data);
}

export async function fetchDeliveryPartners(
  status: DeliveryPartnerFilter = '',
): Promise<VendorDeliveryPartner[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorDeliveryPartners, {
    status,
  });

  return normalizeCollection(payload, normalizeDeliveryPartner);
}

export async function createDeliveryPartner(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
  is_active?: boolean;
}): Promise<VendorDeliveryPartner | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorDeliveryPartners, input);
  const data = extractDataEnvelope(payload);
  return normalizeDeliveryPartner(data);
}

export async function updateDeliveryPartner(
  deliveryUserId: number,
  input: {
    name: string;
    email: string;
    mobile: string;
    password?: string;
  },
): Promise<VendorDeliveryPartner | null> {
  const payload = await apiClient.patch<unknown>(
    `${API_ENDPOINTS.vendorDeliveryPartners}/${deliveryUserId}`,
    input,
  );
  const data = extractDataEnvelope(payload);
  return normalizeDeliveryPartner(data);
}

export async function updateDeliveryPartnerStatus(
  deliveryUserId: number,
  isActive?: boolean,
): Promise<VendorDeliveryPartner | null> {
  const payload = await apiClient.patch<unknown>(
    `${API_ENDPOINTS.vendorDeliveryPartners}/${deliveryUserId}/status`,
    typeof isActive === 'boolean' ? { is_active: isActive } : {},
  );
  const data = extractDataEnvelope(payload);
  return normalizeDeliveryPartner(data);
}
