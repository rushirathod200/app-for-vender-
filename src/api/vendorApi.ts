import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import {
  AssignedDeliveryPartner,
  Building,
  CatalogProduct,
  DeliveryPartnerFilter,
  ManualOfficeDirectoryItem,
  ManualOfficeFloorOption,
  ManualOfficeOrderReceipt,
  ManualOfficePickerBuilding,
  ManualOfficeReport,
  MenuItem,
  OrderStatus,
  QuickRequestDetails,
  StockFilter,
  BelowMinimumOrderMode,
  VendorDeliveryPartner,
  VendorOrder,
  VendorOrderItem,
  VendorProfile,
  VendorWalletTargetType,
  VendorWalletTopUpReceipt,
} from '../types/vendor';
import {
  asArray,
  extractCollection,
  extractDataEnvelope,
  extractMessage,
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

function normalizeManualOfficeOrderEntry(entry: unknown): ManualOfficeReport['entries'][number] | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    id,
    tea_qty: toNumberValue(entry.tea_qty, 0),
    coffee_qty: toNumberValue(entry.coffee_qty, 0),
    tea_unit_price: toNumberValue(entry.tea_unit_price, 0),
    coffee_unit_price: toNumberValue(entry.coffee_unit_price, 0),
    total_amount: toNumberValue(entry.total_amount, 0),
    paid_amount: toNumberValue(entry.paid_amount, 0),
    pending_amount: toNumberValue(entry.pending_amount, 0),
    payment_method: toStringValue(entry.payment_method, 'pending') as ManualOfficeReport['entries'][number]['payment_method'],
    source: toStringValue(entry.source, 'vendor_app'),
    notes: toNullableString(entry.notes),
    created_at: toNullableString(entry.created_at),
    recorded_by: toStringValue(entry.recorded_by, 'Vendor App'),
  };
}

function normalizeManualOfficeReport(payload: unknown): ManualOfficeReport | null {
  if (!isRecord(payload)) {
    return null;
  }

  const data = extractDataEnvelope(payload);
  if (!isRecord(data)) {
    return null;
  }

  const office = isRecord(data.office) ? data.office : null;
  const summary = isRecord(data.summary) ? data.summary : null;
  if (!office || !summary) {
    return null;
  }

  const officeId = toNumberValue(office.id, 0);
  if (!officeId) {
    return null;
  }

  return {
    office: {
      id: officeId,
      name: toStringValue(office.name, `Office ${officeId}`),
      floor_id: toNumberValue(office.floor_id, 0),
      floor_name: toStringValue(office.floor_name, ''),
      wing_id: toNumberValue(office.wing_id, 0) || null,
      wing_name: toNullableString(office.wing_name),
      building_id: toNumberValue(office.building_id, 0),
      building_name: toStringValue(office.building_name, ''),
      label: toStringValue(office.label, `Office ${officeId}`),
      office_wallet_available: toBooleanValue(office.office_wallet_available, false),
      office_wallet_balance: toNumberValue(office.office_wallet_balance, 0),
    },
    summary: {
      tea_qty: toNumberValue(summary.tea_qty, 0),
      coffee_qty: toNumberValue(summary.coffee_qty, 0),
      total_amount: toNumberValue(summary.total_amount, 0),
      paid_amount: toNumberValue(summary.paid_amount, 0),
      pending_amount: toNumberValue(summary.pending_amount, 0),
      orders_count: toNumberValue(summary.orders_count, 0),
      last_ordered_at: toNullableString(summary.last_ordered_at),
      office_wallet_available: toBooleanValue(summary.office_wallet_available, false),
      office_wallet_balance: toNumberValue(summary.office_wallet_balance, 0),
    },
    entries: asArray(data.entries)
      .map(normalizeManualOfficeOrderEntry)
      .filter((entry): entry is ManualOfficeReport['entries'][number] => !!entry),
    download_url: toNullableString(data.download_url),
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
  const quickRequest = normalizeQuickRequest(entry.quick_request);
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
    order_channel: toNullableString(entry.order_channel),
    ordered_by_name: toNullableString(entry.ordered_by_name),
    quick_request: quickRequest,
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

  if (!id) {
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
    below_minimum_order_mode:
      toStringValue(envelope.below_minimum_order_mode, 'charge_delivery') === 'block_order'
        ? 'block_order'
        : 'charge_delivery',
    minimum_order_value: toNumberValue(envelope.minimum_order_value, 50),
    quick_request_tea_price: toNumberValue(envelope.quick_request_tea_price, 15),
    quick_request_coffee_price: toNumberValue(envelope.quick_request_coffee_price, 20),
    office_wallet_credit_enabled: toBooleanValue(envelope.office_wallet_credit_enabled, false),
    assigned_buildings: assignedBuildings,
    active_order_count: toNumberValue(envelope.active_order_count, 0),
  };
}

function normalizeWalletTopUpReceipt(payload: unknown): VendorWalletTopUpReceipt | null {
  if (!isRecord(payload)) {
    return null;
  }

  const data = extractDataEnvelope(payload);
  if (!isRecord(data)) {
    return null;
  }

  const targetType = toStringValue(data.target_type, 'user') as VendorWalletTargetType;

  return {
    message: extractMessage(payload, 'Wallet topped up successfully.'),
    target_type: targetType === 'office' ? 'office' : 'user',
    mobile: toStringValue(data.mobile, ''),
    target_name: toNullableString(data.target_name),
    balance: toNumberValue(data.balance, 0),
    wallet_label: toStringValue(data.wallet_label, targetType === 'office' ? 'Office Wallet' : 'Customer Wallet'),
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
  below_minimum_order_mode: BelowMinimumOrderMode;
  minimum_order_value: number;
  quick_request_tea_price: number;
  quick_request_coffee_price: number;
  office_wallet_credit_enabled: boolean;
}): Promise<VendorProfile | null> {
  const payload = await apiClient.patch<unknown>(API_ENDPOINTS.vendorProfile, input);
  return normalizeProfile(payload);
}

export async function fetchAssignedBuildings(): Promise<Building[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorBuildings);
  return normalizeCollection(payload, normalizeBuilding);
}

export async function topUpVendorWallet(input: {
  mobile: string;
  amount: number;
  target_type: VendorWalletTargetType;
}): Promise<VendorWalletTopUpReceipt | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorWalletTopUp, input);
  return normalizeWalletTopUpReceipt(payload);
}

export async function fetchVendorManualOffices(params?: {
  buildingId?: number;
  query?: string;
}): Promise<{
  recent: ManualOfficeDirectoryItem[];
  results: ManualOfficeDirectoryItem[];
  buildings: Building[];
  floors: ManualOfficeFloorOption[];
  location_picker: ManualOfficePickerBuilding[];
}> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorManualOffices, {
    building_id: params?.buildingId,
    q: params?.query ?? '',
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

export async function createVendorOfficeLocation(input: {
  floor_id: number;
  office_name: string;
}): Promise<ManualOfficeDirectoryItem | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorManualOffices, input);
  const data = extractDataEnvelope(payload);
  return normalizeManualOfficeDirectoryItem(data);
}

export async function createVendorManualOfficeOrder(input: {
  office_id: number;
  tea_qty: number;
  coffee_qty: number;
  payment_method: 'cash' | 'office_wallet';
  notes?: string;
}): Promise<ManualOfficeOrderReceipt | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorManualOrders, input);
  return normalizeManualOfficeOrderReceipt(payload);
}

export async function fetchVendorManualReportOffices(params?: {
  buildingId?: number;
  query?: string;
}): Promise<{ offices: ManualOfficeDirectoryItem[]; buildings: Building[] }> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorManualReports, {
    building_id: params?.buildingId,
    q: params?.query ?? '',
  });

  const data = extractDataEnvelope(payload);
  const record = isRecord(data) ? data : {};

  return {
    offices: asArray(record.offices)
      .map(normalizeManualOfficeDirectoryItem)
      .filter((item): item is ManualOfficeDirectoryItem => !!item),
    buildings: asArray(record.buildings)
      .map(normalizeBuilding)
      .filter((item): item is Building => !!item),
  };
}

export async function fetchVendorManualOfficeReport(officeId: number): Promise<ManualOfficeReport | null> {
  const payload = await apiClient.get<unknown>(`${API_ENDPOINTS.vendorManualReports}/${officeId}`);
  return normalizeManualOfficeReport(payload);
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
