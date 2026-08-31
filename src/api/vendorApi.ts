import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import {
  AssignedDeliveryPartner,
  BuildingOrderPolicyInput,
  Building,
  CatalogProduct,
  DeliveryPartnerFilter,
  ManualOfficeDirectoryItem,
  ManualOfficeFloorOption,
  ManualOfficePaymentMethod,
  ManualOfficeOrderReceipt,
  ManualOfficePickerBuilding,
  ManualOfficeReport,
  MenuItem,
  OrderTabCounts,
  OrderTabKey,
  OrderStatus,
  PrintOrderDetails,
  PrintOrderFile,
  QuickRequestDetails,
  QuickRequestPaymentMethod,
  StockFilter,
  BelowMinimumOrderMode,
  StoreHours,
  VendorDeliveryPartner,
  VendorOrder,
  VendorOrderItem,
  VendorOrderSummary,
  MenuItemVariant,
  ProductCategoryOption,
  ProductImageAsset,
  ProductSubcategoryOption,
  VendorOfficeWalletLookupItem,
  VendorProfile,
  VendorProductCreateInput,
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

function normalizeBelowMinimumOrderMode(value: unknown): BelowMinimumOrderMode {
  const mode = toStringValue(value, 'charge_delivery');

  if (mode === 'block_order' || mode === 'free_delivery') {
    return mode;
  }

  return 'charge_delivery';
}

function normalizeNullableBelowMinimumOrderMode(value: unknown): BelowMinimumOrderMode | null {
  if (value == null) return null;

  const mode = toStringValue(value, '');
  return mode === 'charge_delivery' || mode === 'block_order' || mode === 'free_delivery'
    ? mode
    : null;
}

const DEFAULT_STORE_HOURS: StoreHours = {
  mon: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  tue: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  wed: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  thu: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  fri: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  sat: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  sun: { is_open: false, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
};

function normalizeStoreHours(value: unknown): StoreHours {
  const source = isRecord(value) ? value : {};
  const normalized = Object.fromEntries(
    Object.entries(DEFAULT_STORE_HOURS).map(([day, entry]) => [day, {
      ...entry,
      slots: entry.slots.map((slot) => ({ ...slot })),
    }]),
  ) as StoreHours;

  (Object.keys(normalized) as Array<keyof StoreHours>).forEach((day) => {
    const entry = isRecord(source[day]) ? source[day] : {};
    const fallbackSlot = normalized[day].slots[0];
    const sourceSlots = asArray(entry.slots);
    const slots = sourceSlots.length > 0
      ? sourceSlots
        .filter(isRecord)
        .slice(0, 4)
        .map((slot) => ({
          opens_at: toStringValue(slot.opens_at, fallbackSlot.opens_at),
          closes_at: toStringValue(slot.closes_at, fallbackSlot.closes_at),
        }))
      : [{
          opens_at: toStringValue(entry.opens_at, fallbackSlot.opens_at),
          closes_at: toStringValue(entry.closes_at, fallbackSlot.closes_at),
        }];

    normalized[day] = {
      is_open: toBooleanValue(entry.is_open, normalized[day].is_open),
      slots,
    };
  });

  return normalized;
}

function toPublicAssetUrl(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const apiOrigin = new URL(API_BASE_URL).origin;

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const assetUrl = new URL(path);
      const localAssetHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

      // Laravel can generate localhost asset URLs while the API is exposed through
      // ngrok. A phone would resolve localhost to itself, so retain the asset path
      // but serve it from the same public origin as the configured API.
      if (localAssetHosts.has(assetUrl.hostname)) {
        return `${apiOrigin}${assetUrl.pathname}${assetUrl.search}${assetUrl.hash}`;
      }

      return assetUrl.toString();
    } catch {
      return null;
    }
  }

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

  const defaultDeliveryCharge = toNumberValue(entry.default_delivery_charge, 0);
  const deliveryChargeOverride = entry.delivery_charge_override == null
    ? null
    : toNumberValue(entry.delivery_charge_override, 0);

  return {
    id,
    name: toStringValue(entry.name, `Building ${id}`),
    address: toNullableString(entry.address),
    is_active: toBooleanValue(entry.is_active, true),
    wings_count: toNumberValue(entry.wings_count, 0),
    floors_count: toNumberValue(entry.floors_count, 0),
    menu_items_count: toNumberValue(entry.menu_items_count, 0),
    orders_count: toNumberValue(entry.orders_count, 0),
    is_quick_request_vendor: toBooleanValue(entry.is_quick_request_vendor, false),
    is_print_vendor: toBooleanValue(entry.is_print_vendor, false),
    default_delivery_charge: defaultDeliveryCharge,
    delivery_charge_override: deliveryChargeOverride,
    effective_delivery_charge: toNumberValue(
      entry.effective_delivery_charge,
      deliveryChargeOverride ?? defaultDeliveryCharge,
    ),
    uses_default_delivery_charge: toBooleanValue(
      entry.uses_default_delivery_charge,
      deliveryChargeOverride === null,
    ),
    default_below_minimum_order_mode: normalizeBelowMinimumOrderMode(entry.default_below_minimum_order_mode),
    below_minimum_order_mode_override: normalizeNullableBelowMinimumOrderMode(entry.below_minimum_order_mode_override),
    effective_below_minimum_order_mode: normalizeBelowMinimumOrderMode(entry.effective_below_minimum_order_mode),
    default_minimum_order_value: toNumberValue(entry.default_minimum_order_value, 0),
    minimum_order_value_override: entry.minimum_order_value_override == null
      ? null
      : toNumberValue(entry.minimum_order_value_override, 0),
    effective_minimum_order_value: toNumberValue(entry.effective_minimum_order_value, 0),
    uses_default_order_policy: toBooleanValue(entry.uses_default_order_policy, deliveryChargeOverride === null),
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
    mrp: entry.mrp === null || entry.mrp === undefined ? null : toNumberValue(entry.mrp, 0),
    price: toNumberValue(entry.price, 0),
    is_available: toBooleanValue(entry.is_available, true),
    photo_url: toPublicAssetUrl(
      toNullableString(entry.image_url) ??
        toNullableString(entry.photo_url) ??
        toNullableString(entry.photo_path) ??
        (predefined ? toNullableString(predefined.default_image_url) ?? toNullableString(predefined.default_image) : null),
    ),
    product_name: predefined ? toNullableString(predefined.name) : toNullableString(entry.product_name),
    category: predefined ? toNullableString(predefined.category) : null,
    subcategory:
      toNullableString(entry.subcategory) ??
      toNullableString(entry.subcategory_name) ??
      (predefined ? toNullableString(predefined.subcategory) ?? toNullableString(predefined.subcategory_name) : null),
    description: predefined ? toNullableString(predefined.description) : null,
    building_name: building ? toNullableString(building.name) : null,
    variants: asArray(entry.variants)
      .map(normalizeMenuItemVariant)
      .filter((variant): variant is MenuItemVariant => !!variant),
    is_vendor_owned: toBooleanValue(entry.is_vendor_owned, false),
  };
}

function normalizeSubcategoryOption(entry: unknown): ProductSubcategoryOption | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  const name = toStringValue(entry.name, '');
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    slug: toStringValue(entry.slug, ''),
  };
}

function normalizeCategoryOption(entry: unknown): ProductCategoryOption | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  const name = toStringValue(entry.name, '');
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    slug: toStringValue(entry.slug, ''),
    service_group: toNullableString(entry.service_group),
    subcategories: asArray(entry.subcategories)
      .map(normalizeSubcategoryOption)
      .filter((item): item is ProductSubcategoryOption => !!item),
  };
}

function appendImage(formData: FormData, field: string, asset: ProductImageAsset): void {
  const name = asset.fileName?.trim() || `product-${Date.now()}.jpg`;
  const type = asset.mimeType?.trim() || 'image/jpeg';

  if (asset.file) {
    formData.append(field, asset.file, name);
    return;
  }

  formData.append(field, { uri: asset.uri, name, type } as unknown as Blob);
}

function normalizeMenuItemVariant(entry: unknown): MenuItemVariant | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  const name = toStringValue(entry.name, '');

  if (!id || !name) {
    return null;
  }

  return {
    id,
    product_variant_id: toNumberValue(entry.product_variant_id, 0) || null,
    name,
    mrp: entry.mrp === null || entry.mrp === undefined ? null : toNumberValue(entry.mrp, 0),
    price: toNumberValue(entry.price, 0),
    is_available: toBooleanValue(entry.is_available, true),
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

function normalizePrintOrderFile(entry: unknown): PrintOrderFile | null {
  if (!isRecord(entry)) {
    return null;
  }

  const id = toNumberValue(entry.id, 0);
  if (!id) {
    return null;
  }

  return {
    id,
    original_name: toStringValue(entry.original_name, `Print file ${id}`),
    mime_type: toNullableString(entry.mime_type),
    size_bytes: toNumberValue(entry.size_bytes, 0),
    page_count: toNumberValue(entry.page_count, 0),
    print_mode: toNullableString(entry.print_mode),
    print_mode_label: toNullableString(entry.print_mode_label),
    copies: toNumberValue(entry.copies, 1),
    paper_size: toNullableString(entry.paper_size),
    orientation: toNullableString(entry.orientation),
    double_sided: toBooleanValue(entry.double_sided, false),
    price_per_page: toNumberValue(entry.price_per_page, 0),
    line_total: toNumberValue(entry.line_total, 0),
    download_url: toNullableString(entry.download_url),
    share_url: toNullableString(entry.share_url),
  };
}

function normalizePrintOrder(entry: unknown): PrintOrderDetails | null {
  if (!isRecord(entry)) {
    return null;
  }

  const files = asArray(entry.files)
    .map(normalizePrintOrderFile)
    .filter((file): file is PrintOrderFile => !!file);

  return {
    print_mode: toNullableString(entry.print_mode),
    copies: toNumberValue(entry.copies, 1),
    copies_summary: toNullableString(entry.copies_summary),
    paper_size: toNullableString(entry.paper_size),
    double_sided: toBooleanValue(entry.double_sided, false),
    status_note: toNullableString(entry.status_note),
    file_count: toNumberValue(entry.file_count, files.length),
    bw_price: toNumberValue(entry.bw_price, 0),
    color_price: toNumberValue(entry.color_price, 0),
    legal_price: toNumberValue(entry.legal_price, 0),
    selected_price: toNumberValue(entry.selected_price, 0),
    estimated_total: toNumberValue(entry.estimated_total, 0),
    files,
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
  const wing = isRecord(entry.wing) ? entry.wing : null;
  const office = isRecord(entry.office) ? entry.office : null;
  const user = isRecord(entry.user) ? entry.user : null;
  const deliveryPartner = isRecord(entry.delivery_partner) ? entry.delivery_partner : null;
  const quickRequest = normalizeQuickRequest(entry.quick_request);
  const printOrder = normalizePrintOrder(entry.print_order);
  const allowedTransitions = asArray(entry.allowed_transitions)
    .map((status) => normalizeVendorOrderStatus(toStringValue(status, '')))
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
    status: normalizeVendorOrderStatus(toStringValue(entry.status, 'placed')) ?? 'placed',
    subtotal: toNumberValue(entry.subtotal, 0),
    delivery_fee: toNumberValue(entry.delivery_fee, 0),
    total: toNumberValue(entry.total, 0),
    payment_method: toNullableString(entry.payment_method),
    notes: toNullableString(entry.notes),
    cancel_reason: toNullableString(entry.cancel_reason) ?? toNullableString(entry.cancelReason),
    order_channel: toNullableString(entry.order_channel),
    ordered_by_name: toNullableString(entry.ordered_by_name),
    quick_request: quickRequest,
    print_order: printOrder,
    placed_at: toNullableString(entry.placed_at),
    building_name: building ? toNullableString(building.name) : null,
    wing_name: wing ? toNullableString(wing.name) : null,
    office_no: office ? toNullableString(office.office_no) : null,
    customer_name: user ? toNullableString(user.name) : null,
    customer_mobile: user ? toNullableString(user.mobile) : null,
    delivery_partner: normalizedDeliveryPartner,
    allowed_transitions: allowedTransitions,
    items,
  };
}

function normalizeVendorOrderStatus(status: string): OrderStatus | null {
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

function apiVendorOrderStatus(status: OrderStatus): 'accepted' | 'completed' | 'rejected' {
  if (status === 'cancelled') {
    return 'rejected';
  }

  if (status === 'delivered' || status === 'preparing' || status === 'out_for_delivery') {
    return 'completed';
  }

  return 'accepted';
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
    can_cancel_orders: toBooleanValue(entry.can_cancel_orders, true),
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
    store_hours_enabled: toBooleanValue(envelope.store_hours_enabled, false),
    store_hours: normalizeStoreHours(envelope.store_hours),
    store_available_now: toBooleanValue(envelope.store_available_now, toBooleanValue(envelope.store_open, true)),
    delivery_charge: toNumberValue(envelope.delivery_charge, 0),
    estimated_waiting_time_minutes: envelope.estimated_waiting_time_minutes == null
      ? null
      : toNumberValue(envelope.estimated_waiting_time_minutes, 0),
    below_minimum_order_mode: normalizeBelowMinimumOrderMode(envelope.below_minimum_order_mode),
    minimum_order_value: toNumberValue(envelope.minimum_order_value, 50),
    quick_request_tea_price: toNumberValue(envelope.quick_request_tea_price, 15),
    quick_request_coffee_price: toNumberValue(envelope.quick_request_coffee_price, 20),
    can_manage_quick_request_pricing: toBooleanValue(envelope.can_manage_quick_request_pricing, false),
    can_top_up_customer_wallet: toBooleanValue(envelope.can_top_up_customer_wallet, false),
    vendor_category: toNullableString(envelope.vendor_category),
    print_bw_price: toNumberValue(envelope.print_bw_price, 2),
    print_color_price: toNumberValue(envelope.print_color_price, 10),
    print_legal_price: toNumberValue(envelope.print_legal_price, 5),
    can_manage_print_pricing: toBooleanValue(envelope.can_manage_print_pricing, false),
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

  return {
    message: extractMessage(payload, 'Wallet topped up successfully.'),
    target_type: 'user',
    mobile: toStringValue(data.mobile, ''),
    target_name: toNullableString(data.target_name),
    balance: toNumberValue(data.balance, 0),
    wallet_label: toStringValue(data.wallet_label, 'Customer Wallet'),
  };
}

function normalizeOfficeWalletLookupItem(entry: unknown): VendorOfficeWalletLookupItem | null {
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
    building_id: entry.building_id == null ? null : toNumberValue(entry.building_id, 0) || null,
    building_name: toNullableString(entry.building_name),
    label: toStringValue(entry.label, toStringValue(entry.office_name, `Office ${officeId}`)),
    owner_name: toNullableString(entry.owner_name),
    owner_mobile: toNullableString(entry.owner_mobile),
    balance: toNumberValue(entry.balance, 0),
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
  store_hours_enabled?: boolean;
  store_hours?: StoreHours;
  delivery_charge: number;
  estimated_waiting_time_minutes: number | null;
  below_minimum_order_mode: BelowMinimumOrderMode;
  minimum_order_value: number;
  building_id?: number;
  quick_request_tea_price?: number;
  quick_request_coffee_price?: number;
  print_bw_price?: number;
  print_color_price?: number;
  print_legal_price?: number;
  office_wallet_credit_enabled: boolean;
}): Promise<VendorProfile | null> {
  const payload = await apiClient.patch<unknown>(API_ENDPOINTS.vendorProfile, input);
  return normalizeProfile(payload);
}

export async function fetchAssignedBuildings(): Promise<Building[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorBuildings);
  return normalizeCollection(payload, normalizeBuilding);
}

export async function updateBuildingDeliveryCharge(
  buildingId: number,
  input: BuildingOrderPolicyInput,
): Promise<Building | null> {
  const payload = await apiClient.patch<unknown>(
    `${API_ENDPOINTS.vendorBuildings}/${buildingId}/delivery-charge`,
    input,
  );

  return normalizeBuilding(extractDataEnvelope(payload));
}

export async function topUpVendorWallet(input: {
  mobile: string;
  amount: number;
}): Promise<VendorWalletTopUpReceipt | null> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorWalletTopUp, {
    ...input,
    target_type: 'user',
  });
  return normalizeWalletTopUpReceipt(payload);
}

export async function fetchVendorOfficeWallets(params: {
  query: string;
  buildingId?: number;
}): Promise<VendorOfficeWalletLookupItem[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorOfficeWallets, {
    q: params.query,
    building_id: params.buildingId,
  });
  const data = extractDataEnvelope(payload);
  const record = isRecord(data) ? data : {};

  return asArray(record.offices)
    .map(normalizeOfficeWalletLookupItem)
    .filter((entry): entry is VendorOfficeWalletLookupItem => !!entry);
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
  payment_method: ManualOfficePaymentMethod;
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
  cacheBust?: number;
}

export async function fetchVendorMenu(params: FetchMenuParams): Promise<MenuItem[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorMenu, {
    building_id: params.buildingId,
    search: params.search ?? '',
    stock: params.stock ?? '',
    _t: params.cacheBust,
  });

  return normalizeCollection(payload, normalizeMenuItem);
}

export async function fetchVendorProductFormOptions(): Promise<ProductCategoryOption[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorProductFormOptions);
  return normalizeCollection(payload, normalizeCategoryOption);
}

export async function createVendorProductSubcategory(input: {
  category_id: number;
  name: string;
}): Promise<ProductSubcategoryOption> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorProductSubcategories, input);
  const subcategory = normalizeSubcategoryOption(extractDataEnvelope(payload));

  if (!subcategory) {
    throw new Error('The server returned an invalid subcategory.');
  }

  return subcategory;
}

export async function createVendorProduct(input: VendorProductCreateInput): Promise<MenuItem> {
  const formData = new FormData();
  formData.append('name', input.name);
  if (input.description) formData.append('description', input.description);
  formData.append('category_id', String(input.category_id));
  formData.append('subcategory_id', String(input.subcategory_id));
  if (input.mrp !== null) formData.append('mrp', String(input.mrp));
  formData.append('price', String(input.price));
  if (input.gst_rate !== null) formData.append('gst_rate', String(input.gst_rate));
  formData.append('is_available', input.is_available ? '1' : '0');
  appendImage(formData, 'photo', input.photo);

  input.variants.forEach((variant, index) => {
    formData.append(`variants[${index}][name]`, variant.name);
    if (variant.mrp !== null) formData.append(`variants[${index}][mrp]`, String(variant.mrp));
    formData.append(`variants[${index}][price]`, String(variant.price));
    if (variant.gst_rate !== null) formData.append(`variants[${index}][gst_rate]`, String(variant.gst_rate));
    formData.append(`variants[${index}][is_available]`, variant.is_available ? '1' : '0');
  });

  const payload = await apiClient.post<unknown>(API_ENDPOINTS.vendorProducts, formData);
  const product = normalizeMenuItem(extractDataEnvelope(payload));
  if (!product) {
    throw new Error('The server returned an invalid product.');
  }

  return product;
}

export async function updateVendorMenuItemPhoto(
  menuItemId: number,
  photo: ProductImageAsset,
): Promise<MenuItem> {
  const formData = new FormData();
  appendImage(formData, 'photo', photo);
  const payload = await apiClient.post<unknown>(
    `${API_ENDPOINTS.vendorMenu}/${menuItemId}/photo`,
    formData,
  );
  const product = normalizeMenuItem(extractDataEnvelope(payload));
  if (!product) {
    throw new Error('The server returned an invalid product image.');
  }

  return product;
}

export async function removeVendorMenuItemPhoto(menuItemId: number): Promise<MenuItem> {
  const payload = await apiClient.delete<unknown>(`${API_ENDPOINTS.vendorMenu}/${menuItemId}/photo`);
  const product = normalizeMenuItem(extractDataEnvelope(payload));
  if (!product) {
    throw new Error('The server returned an invalid product image.');
  }

  return product;
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
  input: {
    title: string;
    price: number;
    mrp?: number | null;
    is_available?: boolean;
    variants?: Array<{
      id?: number;
      product_variant_id?: number | null;
      name: string;
      mrp?: number | null;
      price: number;
      is_available?: boolean;
    }>;
  },
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

export interface VendorOrdersPage {
  orders: VendorOrder[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  hasMore: boolean;
}

export interface VendorOrderDashboardData {
  counts: OrderTabCounts;
  summary: VendorOrderSummary;
}

export async function fetchVendorOrders(params: FetchOrdersParams): Promise<VendorOrder[]> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorOrders, {
    status: params.status ?? '',
    building_id: params.buildingId,
  });

  return normalizeCollection(payload, normalizeOrder);
}

export async function fetchVendorOrdersPage(params: {
  bucket: OrderTabKey;
  page: number;
  perPage: number;
  buildingId?: number;
}): Promise<VendorOrdersPage> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.vendorOrders, {
    bucket: params.bucket,
    page: params.page,
    per_page: params.perPage,
    building_id: params.buildingId,
  });
  const root = isRecord(payload) ? payload : {};
  const meta = isRecord(root.meta) ? root.meta : {};
  const pagination = isRecord(meta.pagination) ? meta.pagination : {};
  const currentPage = Math.max(1, toNumberValue(pagination.current_page, params.page));
  const lastPage = Math.max(currentPage, toNumberValue(pagination.last_page, currentPage));

  return {
    orders: normalizeCollection(payload, normalizeOrder),
    currentPage,
    lastPage,
    perPage: Math.max(1, toNumberValue(pagination.per_page, params.perPage)),
    total: Math.max(0, toNumberValue(pagination.total, 0)),
    hasMore: toBooleanValue(pagination.has_more, currentPage < lastPage),
  };
}

export async function fetchVendorOrderDashboardData(buildingId?: number): Promise<VendorOrderDashboardData> {
  const payload = await apiClient.get<unknown>(`${API_ENDPOINTS.vendorOrders}/summary`, {
    building_id: buildingId,
  });
  const data = extractDataEnvelope(payload);
  const record = isRecord(data) ? data : {};
  const counts = isRecord(record.counts) ? record.counts : {};
  const summary = isRecord(record.summary) ? record.summary : {};

  return {
    counts: {
      pending: Math.max(0, toNumberValue(counts.pending, 0)),
      completed: Math.max(0, toNumberValue(counts.completed, 0)),
      cancelled: Math.max(0, toNumberValue(counts.cancelled, 0)),
    },
    summary: {
      today_orders: Math.max(0, toNumberValue(summary.today_orders, 0)),
      total_sales: Math.max(0, toNumberValue(summary.total_sales, 0)),
      recent_orders: asArray(summary.recent_orders)
        .map(normalizeOrder)
        .filter((order): order is VendorOrder => !!order),
    },
  };
}

export async function fetchVendorOrder(orderId: number): Promise<VendorOrder | null> {
  const payload = await apiClient.get<unknown>(`${API_ENDPOINTS.vendorOrders}/${orderId}`);
  return normalizeOrder(extractDataEnvelope(payload));
}

export async function updateVendorOrderStatus(
  orderId: number,
  status: OrderStatus,
  cancelReason?: string,
): Promise<VendorOrder | null> {
  const apiStatus = apiVendorOrderStatus(status);
  const payload = await apiClient.patch<unknown>(`${API_ENDPOINTS.vendorOrders}/${orderId}/status`, {
    status: apiStatus,
    ...(cancelReason ? { cancel_reason: cancelReason } : {}),
  });

  const data = extractDataEnvelope(payload);
  const updatedOrder = normalizeOrder(data);

  if (!updatedOrder) {
    throw new Error('Server did not confirm the order status update.');
  }

  const expectedStatus = normalizeVendorOrderStatus(apiStatus);
  if (expectedStatus && updatedOrder.status !== expectedStatus) {
    throw new Error(`Server kept this order as ${updatedOrder.status}. Please refresh and try again.`);
  }

  return updatedOrder;
}

export async function completeVendorQuickRequest(
  orderId: number,
  input: {
    tea_qty: number;
    coffee_qty: number;
    payment_method: QuickRequestPaymentMethod;
  },
): Promise<VendorOrder | null> {
  const payload = await apiClient.patch<unknown>(
    `${API_ENDPOINTS.vendorOrders}/${orderId}/quick-request-completion`,
    input,
  );

  const updatedOrder = normalizeOrder(extractDataEnvelope(payload));
  if (!updatedOrder || updatedOrder.status !== 'delivered') {
    throw new Error('Server did not confirm the quick request completion.');
  }

  return updatedOrder;
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
  can_cancel_orders?: boolean;
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
    can_cancel_orders?: boolean;
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
