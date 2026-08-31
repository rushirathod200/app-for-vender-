import { API_ENDPOINTS } from '../config/api';
import { DeliveryOrder, DeliveryOrderItem, DeliveryProfile } from '../types/delivery';
import { Building, ManualOfficeDirectoryItem, ManualOfficeFloorOption, ManualOfficeOrderReceipt, ManualOfficePaymentMethod, ManualOfficePickerBuilding, QuickRequestDetails, QuickRequestPaymentMethod } from '../types/vendor';
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
  if (!id) {
    return null;
  }

  const assignedVendors = asArray(envelope.assigned_vendors)
    .map((entry): DeliveryProfile['assigned_vendors'][number] | null => {
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
        quick_request_tea_price: toNumberValue(entry.quick_request_tea_price, 0),
        quick_request_coffee_price: toNumberValue(entry.quick_request_coffee_price, 0),
      };
    })
    .filter((entry): entry is DeliveryProfile['assigned_vendors'][number] => entry !== null);

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
    variant_name: toNullableString(entry.variant_name),
    qty: toNumberValue(entry.qty, 1),
    unit_price: toNumberValue(entry.unit_price, 0),
    line_total: toNumberValue(entry.line_total, 0),
  };
}

function normalizeQuickRequest(entry: unknown): QuickRequestDetails | null {
  if (!isRecord(entry)) {
    return null;
  }

  return {
    requested_type: toNullableString(entry.requested_type),
    requested_label: toNullableString(entry.requested_label),
    suggested_tea_qty: toNumberValue(entry.suggested_tea_qty, 0),
    suggested_coffee_qty: toNumberValue(entry.suggested_coffee_qty, 0),
    tea_qty: toNumberValue(entry.tea_qty, 0),
    coffee_qty: toNumberValue(entry.coffee_qty, 0),
    tea_price: toNumberValue(entry.tea_price, 0),
    coffee_price: toNumberValue(entry.coffee_price, 0),
    payment_method: toNullableString(entry.payment_method),
    completed_at: toNullableString(entry.completed_at),
    payment_pending: toBooleanValue(entry.payment_pending, false),
    office_wallet_available: toBooleanValue(entry.office_wallet_available, false),
    office_wallet_balance: toNumberValue(entry.office_wallet_balance, 0),
    office_wallet_credit_enabled: toBooleanValue(entry.office_wallet_credit_enabled, false),
    wallet_available: toBooleanValue(entry.wallet_available, false),
    wallet_balance: toNumberValue(entry.wallet_balance, 0),
  };
}

function normalizeManualOfficeDirectoryItem(entry: unknown): ManualOfficeDirectoryItem | null {
  if (!isRecord(entry)) {
    return null;
  }

  const officeId = toNumberValue(entry.office_id, 0);
  if (!officeId) {
    return null;
  }

  return {
    office_id: officeId,
    office_name: toStringValue(entry.office_name, `Office ${officeId}`),
    floor_id: toNumberValue(entry.floor_id, 0),
    floor_name: toStringValue(entry.floor_name, ''),
    wing_id: toNumberValue(entry.wing_id, 0) || null,
    wing_name: toNullableString(entry.wing_name),
    building_id: toNumberValue(entry.building_id, 0),
    building_name: toStringValue(entry.building_name, ''),
    tea_qty: toNumberValue(entry.tea_qty, 0),
    coffee_qty: toNumberValue(entry.coffee_qty, 0),
    total_amount: toNumberValue(entry.total_amount, 0),
    pending_amount: toNumberValue(entry.pending_amount, 0),
    office_wallet_available: toBooleanValue(entry.office_wallet_available, false),
    office_wallet_balance: toNumberValue(entry.office_wallet_balance, 0),
    office_wallet_credit_enabled: toBooleanValue(entry.office_wallet_credit_enabled, false),
    orders_count: toNumberValue(entry.orders_count, 0),
    last_ordered_at: toNullableString(entry.last_ordered_at),
    label: toStringValue(entry.label, `Office ${officeId}`),
  };
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
    default_delivery_charge: 0,
    delivery_charge_override: null,
    effective_delivery_charge: 0,
    uses_default_delivery_charge: true,
    default_below_minimum_order_mode: 'charge_delivery',
    below_minimum_order_mode_override: null,
    effective_below_minimum_order_mode: 'charge_delivery',
    default_minimum_order_value: 0,
    minimum_order_value_override: null,
    effective_minimum_order_value: 0,
    uses_default_order_policy: true,
  };
}

function normalizeManualOfficeFloorOption(entry: unknown): ManualOfficeFloorOption | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    id,
    name: toStringValue(entry.name, `Floor ${id}`),
    building_id: toNumberValue(entry.building_id, 0),
    building_name: toStringValue(entry.building_name, ''),
    wing_id: toNumberValue(entry.wing_id, 0) || null,
    wing_name: toNullableString(entry.wing_name),
    label: toStringValue(entry.label, `Floor ${id}`),
  };
}

function normalizeManualOfficePickerBuilding(entry: unknown): ManualOfficePickerBuilding | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  const wings = asArray(entry.wings)
    .map((wingEntry) => {
      if (!isRecord(wingEntry)) {
        return null;
      }

      const wingId = toNumberValue(wingEntry.id, 0);
      if (!wingId) {
        return null;
      }

      return {
        id: wingId,
        name: toStringValue(wingEntry.name, `Wing ${wingId}`),
        floors: asArray(wingEntry.floors)
          .map((floorEntry) => {
            if (!isRecord(floorEntry)) {
              return null;
            }

            const floorId = toNumberValue(floorEntry.id, 0);
            if (!floorId) {
              return null;
            }

            return {
              id: floorId,
              name: toStringValue(floorEntry.name, `Floor ${floorId}`),
              display_name: toStringValue(floorEntry.display_name, toStringValue(floorEntry.name, `Floor ${floorId}`)),
              offices: asArray(floorEntry.offices)
                .map((officeEntry) => {
                  if (!isRecord(officeEntry)) {
                    return null;
                  }

                  const officeId = toNumberValue(officeEntry.id, 0);
                  if (!officeId) {
                    return null;
                  }

                  return {
                    id: officeId,
                    name: toStringValue(officeEntry.name, `Office ${officeId}`),
                  };
                })
                .filter((office): office is ManualOfficePickerBuilding['wings'][number]['floors'][number]['offices'][number] => office !== null),
            };
          })
          .filter((floor): floor is ManualOfficePickerBuilding['wings'][number]['floors'][number] => floor !== null),
      };
    })
    .filter((wing): wing is ManualOfficePickerBuilding['wings'][number] => wing !== null);

  return {
    id,
    name: toStringValue(entry.name, `Building ${id}`),
    wings,
  };
}

function normalizeManualOfficeOrderReceipt(payload: unknown): ManualOfficeOrderReceipt | null {
  if (!isRecord(payload)) {
    return null;
  }

  const data = extractDataEnvelope(payload);
  if (!isRecord(data)) {
    return null;
  }

  const entry = isRecord(data.entry) ? data.entry : null;
  const office = isRecord(data.office) ? data.office : null;
  if (!entry || !office) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    entry: {
      id,
      tea_qty: toNumberValue(entry.tea_qty, 0),
      coffee_qty: toNumberValue(entry.coffee_qty, 0),
      total_amount: toNumberValue(entry.total_amount, 0),
      paid_amount: toNumberValue(entry.paid_amount, 0),
      pending_amount: toNumberValue(entry.pending_amount, 0),
      payment_method: toStringValue(entry.payment_method, 'cash') as ManualOfficeOrderReceipt['entry']['payment_method'],
      created_at: toNullableString(entry.created_at),
    },
    office: {
      office_id: toNumberValue(office.office_id, 0),
      office_name: toStringValue(office.office_name, ''),
      floor_id: toNumberValue(office.floor_id, 0),
      floor_name: toStringValue(office.floor_name, ''),
      wing_id: toNumberValue(office.wing_id, 0) || null,
      wing_name: toNullableString(office.wing_name),
      building_id: toNumberValue(office.building_id, 0),
    },
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
  const quickRequest = normalizeQuickRequest(entry.quick_request);
  const allowedTransitions = asArray(entry.allowed_transitions)
    .map((status) => normalizeDeliveryOrderStatus(toStringValue(status, '')))
    .filter((status): status is OrderStatus => status !== null);

  return {
    id,
    order_no: toStringValue(entry.order_no, `#${id}`),
    status: normalizeDeliveryOrderStatus(toStringValue(entry.status, 'pending')) ?? 'placed',
    subtotal: toNumberValue(entry.subtotal, 0),
    delivery_fee: toNumberValue(entry.delivery_fee, 0),
    total: toNumberValue(entry.total, 0),
    payment_method: toNullableString(entry.payment_method),
    notes: toNullableString(entry.notes),
    cancel_reason: toNullableString(entry.cancel_reason),
    order_channel: toNullableString(entry.order_channel),
    ordered_by_name: toNullableString(entry.ordered_by_name),
    quick_request: quickRequest,
    placed_at: toNullableString(entry.placed_at),
    allowed_transitions: allowedTransitions,
    can_cancel_order: toBooleanValue(
      entry.can_cancel_order,
      allowedTransitions.includes('cancelled'),
    ),
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

function normalizeDeliveryOrderStatus(status: string): OrderStatus | null {
  switch (status) {
    case 'pending':
    case 'placed':
      return 'placed';
    case 'accepted':
      return 'accepted';
    case 'completed':
    case 'delivered':
      return 'delivered';
    case 'rejected':
    case 'cancelled':
      return 'cancelled';
    case 'preparing':
      return 'preparing';
    case 'out_for_delivery':
      return 'out_for_delivery';
    default:
      return null;
  }
}

function apiDeliveryOrderStatus(status: OrderStatus): 'accepted' | 'completed' | 'rejected' {
  if (status === 'cancelled') {
    return 'rejected';
  }

  if (status === 'delivered' || status === 'preparing' || status === 'out_for_delivery') {
    return 'completed';
  }

  return 'accepted';
}

function apiDeliveryOrderFilterStatus(status: OrderStatus | ''): 'pending' | 'accepted' | 'completed' | 'rejected' | '' {
  if (!status) {
    return '';
  }

  if (status === 'placed') {
    return 'pending';
  }

  return apiDeliveryOrderStatus(status);
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

export async function fetchDeliveryManualOffices(params: {
  vendorId: number;
  buildingId?: number;
  query?: string;
}): Promise<{
  recent: ManualOfficeDirectoryItem[];
  results: ManualOfficeDirectoryItem[];
  buildings: Building[];
  floors: ManualOfficeFloorOption[];
  location_picker: ManualOfficePickerBuilding[];
}> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.deliveryManualOffices, {
    vendor_id: params.vendorId,
    building_id: params.buildingId,
    q: params.query ?? '',
  });

  const data = extractDataEnvelope(payload);
  const record = isRecord(data) ? data : {};

  return {
    recent: asArray(record.recent)
      .map(normalizeManualOfficeDirectoryItem)
      .filter((item): item is ManualOfficeDirectoryItem => !!item),
    results: asArray(record.results)
      .map(normalizeManualOfficeDirectoryItem)
      .filter((item): item is ManualOfficeDirectoryItem => !!item),
    buildings: asArray(record.buildings)
      .map(normalizeBuilding)
      .filter((item): item is Building => !!item),
    floors: asArray(record.floors)
      .map(normalizeManualOfficeFloorOption)
      .filter((item): item is ManualOfficeFloorOption => !!item),
    location_picker: asArray(record.location_picker)
      .map(normalizeManualOfficePickerBuilding)
      .filter((item): item is ManualOfficePickerBuilding => !!item),
  };
}

export async function createDeliveryOfficeLocation(input: {
  vendor_id: number;
  floor_id: number;
  office_name: string;
}): Promise<ManualOfficeDirectoryItem | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.deliveryManualOffices, input);
  const data = extractDataEnvelope(payload);
  return normalizeManualOfficeDirectoryItem(data);
}

export async function createDeliveryManualOfficeOrder(input: {
  vendor_id: number;
  office_id: number;
  tea_qty: number;
  coffee_qty: number;
  payment_method: ManualOfficePaymentMethod;
  notes?: string;
}): Promise<ManualOfficeOrderReceipt | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.deliveryManualOrders, input);
  return normalizeManualOfficeOrderReceipt(payload);
}

export async function fetchDeliveryOrders(params?: {
  status?: OrderStatus | '';
}): Promise<DeliveryOrder[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.deliveryOrders, {
    status: apiDeliveryOrderFilterStatus(params?.status ?? ''),
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
    status: apiDeliveryOrderStatus(status),
    ...(cancelReason ? { cancel_reason: cancelReason } : {}),
  });

  const data = extractDataEnvelope(payload);
  return normalizeDeliveryOrder(data);
}

export async function completeDeliveryQuickRequest(
  orderId: number,
  input: {
    tea_qty: number;
    coffee_qty: number;
    payment_method: QuickRequestPaymentMethod;
  },
): Promise<DeliveryOrder | null> {
  const payload = await apiClient.patch<unknown>(
    `${API_ENDPOINTS.deliveryQuickRequestCompletion}/${orderId}/quick-request-completion`,
    input,
  );

  const data = extractDataEnvelope(payload);
  return normalizeDeliveryOrder(data);
}
