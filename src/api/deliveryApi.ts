import { API_ENDPOINTS } from '../config/api';
import { DeliveryOrder, DeliveryOrderItem, DeliveryProfile } from '../types/delivery';
import { OrderStatus } from '../types/vendor';
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

function normalizeDeliveryProfile(payload: unknown): DeliveryProfile | null {
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

  const assignedVendors = asArray(envelope.assigned_vendors)
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const vendorId = toNumberValue(entry.id, 0);
      if (!vendorId) {
        return null;
      }

      return {
        id: vendorId,
        name: toNullableString(entry.name),
        email: toNullableString(entry.email),
      };
    })
    .filter((entry): entry is DeliveryProfile['assigned_vendors'][number] => !!entry);

  return {
    id,
    name: toNullableString(envelope.name),
    email: toNullableString(envelope.email),
    mobile,
    role: toStringValue(envelope.role, 'delivery'),
    is_active: toBooleanValue(envelope.is_active, true),
    assigned_vendors: assignedVendors,
    active_order_count: toNumberValue(envelope.active_order_count, 0),
  };
}

function normalizeDeliveryOrderItem(entry: unknown): DeliveryOrderItem | null {
  if (!isRecord(entry)) {
    return null;
  }

  return {
    id: toNumberValue(entry.id, 0),
    title: toStringValue(entry.title, 'Item'),
    qty: toNumberValue(entry.qty, 1),
    unit_price: toNumberValue(entry.unit_price, 0),
    line_total: toNumberValue(entry.line_total, 0),
  };
}

function normalizeDeliveryOrder(entry: unknown): DeliveryOrder | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  const building = isRecord(entry.building) ? entry.building : null;
  const wing = isRecord(entry.wing) ? entry.wing : null;
  const floor = isRecord(entry.floor) ? entry.floor : null;
  const office = isRecord(entry.office) ? entry.office : null;
  const vendor = isRecord(entry.vendor) ? entry.vendor : null;
  const customer = isRecord(entry.customer) ? entry.customer : null;
  const allowedTransitions = asArray(entry.allowed_transitions)
    .map((status) => toStringValue(status, '') as OrderStatus)
    .filter((status): status is OrderStatus => Boolean(status));

  return {
    id,
    order_no: toStringValue(entry.order_no, `#${id}`),
    status: toStringValue(entry.status, 'preparing') as OrderStatus,
    subtotal: toNumberValue(entry.subtotal, 0),
    delivery_fee: toNumberValue(entry.delivery_fee, 0),
    total: toNumberValue(entry.total, 0),
    payment_method: toNullableString(entry.payment_method),
    notes: toNullableString(entry.notes),
    cancel_reason: toNullableString(entry.cancel_reason),
    placed_at: toNullableString(entry.placed_at),
    allowed_transitions: allowedTransitions,
    building_name: building ? toNullableString(building.name) : null,
    building_address: building ? toNullableString(building.address) : null,
    wing_name: wing ? toNullableString(wing.name) : null,
    floor_name: floor ? toNullableString(floor.name) : null,
    office_no: office ? toNullableString(office.office_no) ?? toNullableString(office.name) : null,
    vendor_name: vendor ? toNullableString(vendor.name) : null,
    vendor_mobile: vendor ? toNullableString(vendor.mobile) : null,
    customer_name: customer ? toNullableString(customer.name) : null,
    customer_mobile: customer ? toNullableString(customer.mobile) : null,
    items: asArray(entry.items)
      .map(normalizeDeliveryOrderItem)
      .filter((item): item is DeliveryOrderItem => !!item),
  };
}

export async function fetchDeliveryProfile(): Promise<DeliveryProfile | null> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.deliveryMe);
  return normalizeDeliveryProfile(payload);
}

export async function updateDeliveryProfile(input: {
  name: string;
  email: string;
  mobile: string;
}): Promise<DeliveryProfile | null> {
  const payload = await apiClient.patch<unknown>(API_ENDPOINTS.deliveryProfile, input);
  return normalizeDeliveryProfile(payload);
}

export async function fetchDeliveryOrders(params?: {
  status?: OrderStatus | '';
}): Promise<DeliveryOrder[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.deliveryOrders, {
    status: params?.status ?? '',
  });

  return extractCollection(payload)
    .map(normalizeDeliveryOrder)
    .filter((entry): entry is DeliveryOrder => !!entry);
}

export async function updateDeliveryOrderStatus(
  orderId: number,
  status: OrderStatus,
  cancelReason?: string,
): Promise<DeliveryOrder | null> {
  const payload = await apiClient.patch<unknown>(`${API_ENDPOINTS.deliveryOrders}/${orderId}/status`, {
    status,
    ...(cancelReason ? { cancel_reason: cancelReason } : {}),
  });

  const data = extractDataEnvelope(payload);
  return normalizeDeliveryOrder(data);
}
