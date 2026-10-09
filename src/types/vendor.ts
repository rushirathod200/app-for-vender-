export type StockFilter = '' | 'in_stock' | 'out_of_stock';
export type BelowMinimumOrderMode = 'charge_delivery' | 'block_order' | 'free_delivery';
export type ManualOfficePaymentMethod = 'cash' | 'pending' | 'office_wallet';
export type ManualOfficeRecordedPaymentMethod = ManualOfficePaymentMethod;
export type QuickRequestPaymentMethod = 'cod' | 'office_wallet' | 'wallet';
export type StoreHoursDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface StoreHoursSlot {
  opens_at: string;
  closes_at: string;
}

export type StoreHours = Record<StoreHoursDayKey, {
  is_open: boolean;
  slots: StoreHoursSlot[];
}>;

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderTabKey = 'pending' | 'completed' | 'cancelled';

export interface OrderTabCounts {
  pending: number;
  completed: number;
  cancelled: number;
}

export interface Building {
  id: number;
  name: string;
  address: string | null;
  is_active?: boolean;
  wings_count?: number;
  floors_count?: number;
  menu_items_count?: number;
  orders_count?: number;
  is_quick_request_vendor?: boolean;
  is_print_vendor?: boolean;
  default_delivery_charge: number;
  delivery_charge_override: number | null;
  effective_delivery_charge: number;
  uses_default_delivery_charge: boolean;
  default_below_minimum_order_mode: BelowMinimumOrderMode;
  below_minimum_order_mode_override: BelowMinimumOrderMode | null;
  effective_below_minimum_order_mode: BelowMinimumOrderMode;
  default_minimum_order_value: number;
  minimum_order_value_override: number | null;
  effective_minimum_order_value: number;
  uses_default_order_policy: boolean;
}

export interface BuildingOrderPolicyInput {
  delivery_charge_override: number | null;
  below_minimum_order_mode_override: BelowMinimumOrderMode | null;
  minimum_order_value_override: number | null;
}

export interface CatalogProduct {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  default_image_url: string | null;
  is_active: boolean;
  is_added: boolean;
  menu_item_id: number | null;
}

export interface MenuItem {
  id: number;
  building_id: number;
  vendor_id?: number;
  predefined_product_id?: number | null;
  title: string;
  mrp?: number | null;
  price: number;
  is_available: boolean;
  photo_url: string | null;
  product_name: string | null;
  category?: string | null;
  subcategory?: string | null;
  description?: string | null;
  building_name?: string | null;
  variants: MenuItemVariant[];
  is_vendor_owned?: boolean;
}

export interface ProductSubcategoryOption {
  id: number;
  name: string;
  slug: string;
}

export interface ProductCategoryOption {
  id: number;
  name: string;
  slug: string;
  service_group: string | null;
  subcategories: ProductSubcategoryOption[];
}

export interface ProductImageAsset {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  file?: Blob | null;
}

export interface VendorProductVariantInput {
  name: string;
  mrp: number | null;
  price: number;
  gst_rate: number | null;
  is_available: boolean;
}

export interface VendorProductCreateInput {
  name: string;
  description: string | null;
  category_id: number;
  subcategory_id: number;
  mrp: number | null;
  price: number;
  gst_rate: number | null;
  photo: ProductImageAsset;
  is_available: boolean;
  variants: VendorProductVariantInput[];
}

export interface MenuItemVariant {
  id: number;
  product_variant_id: number | null;
  name: string;
  mrp: number | null;
  price: number;
  is_available: boolean;
}

export interface VendorOrderItem {
  id: number;
  title: string;
  variant_name: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface QuickRequestDetails {
  requested_type: string | null;
  requested_label: string | null;
  suggested_tea_qty: number;
  suggested_coffee_qty: number;
  tea_qty: number;
  coffee_qty: number;
  tea_price: number;
  coffee_price: number;
  payment_method: string | null;
  completed_at: string | null;
  payment_pending: boolean;
  office_wallet_available: boolean;
  office_wallet_balance: number;
  office_wallet_credit_enabled: boolean;
  wallet_available: boolean;
  wallet_balance: number;
}

export interface ManualOfficeDirectoryItem {
  office_id: number;
  office_name: string;
  floor_id: number;
  floor_name: string;
  wing_id: number | null;
  wing_name: string | null;
  building_id: number;
  building_name: string;
  tea_qty: number;
  coffee_qty: number;
  total_amount: number;
  pending_amount: number;
  office_wallet_available: boolean;
  office_wallet_balance: number;
  office_wallet_credit_enabled: boolean;
  orders_count: number;
  last_ordered_at: string | null;
  label: string;
}

export interface ManualOfficeFloorOption {
  id: number;
  name: string;
  building_id: number;
  building_name: string;
  wing_id: number | null;
  wing_name: string | null;
  label: string;
}

export interface ManualOfficePickerOffice {
  id: number;
  name: string;
}

export interface ManualOfficePickerFloor {
  id: number;
  name: string;
  display_name: string;
  offices: ManualOfficePickerOffice[];
}

export interface ManualOfficePickerWing {
  id: number;
  name: string;
  floors: ManualOfficePickerFloor[];
}

export interface ManualOfficePickerBuilding {
  id: number;
  name: string;
  wings: ManualOfficePickerWing[];
}

export interface ManualOfficeOrderEntry {
  id: number;
  tea_qty: number;
  coffee_qty: number;
  tea_unit_price: number;
  coffee_unit_price: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  payment_method: ManualOfficeRecordedPaymentMethod;
  source: string;
  notes: string | null;
  created_at: string | null;
  recorded_by: string;
}

export interface ManualOfficeReport {
  office: {
    id: number;
    name: string;
    floor_id: number;
    floor_name: string;
    wing_id: number | null;
    wing_name: string | null;
    building_id: number;
    building_name: string;
    label: string;
    office_wallet_available: boolean;
    office_wallet_balance: number;
  };
  summary: {
    tea_qty: number;
    coffee_qty: number;
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    orders_count: number;
    last_ordered_at: string | null;
    office_wallet_available: boolean;
    office_wallet_balance: number;
  };
  entries: ManualOfficeOrderEntry[];
  download_url: string | null;
}

export interface ManualOfficeOrderReceipt {
  entry: {
    id: number;
    tea_qty: number;
    coffee_qty: number;
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    payment_method: ManualOfficePaymentMethod;
    created_at: string | null;
  };
  office: {
    office_id: number;
    office_name: string;
    floor_id: number;
    floor_name: string;
    wing_id: number | null;
    wing_name: string | null;
    building_id: number;
  };
}

export interface AssignedDeliveryPartner {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
}

export interface PrintOrderFile {
  id: number;
  original_name: string;
  mime_type: string | null;
  size_bytes: number;
  page_count: number;
  print_mode: string | null;
  print_mode_label: string | null;
  copies: number;
  paper_size: string | null;
  orientation: string | null;
  double_sided: boolean;
  price_per_page: number;
  line_total: number;
  download_url: string | null;
  share_url: string | null;
}

export interface PrintOrderDetails {
  print_mode: string | null;
  copies: number;
  copies_summary: string | null;
  paper_size: string | null;
  double_sided: boolean;
  status_note: string | null;
  file_count: number;
  bw_price: number;
  color_price: number;
  legal_price: number;
  selected_price: number;
  estimated_total: number;
  files: PrintOrderFile[];
}

export interface VendorOrder {
  id: number;
  order_no: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method?: string | null;
  notes?: string | null;
  cancel_reason?: string | null;
  order_channel?: string | null;
  ordered_by_name?: string | null;
  quick_request?: QuickRequestDetails | null;
  print_order?: PrintOrderDetails | null;
  placed_at: string | null;
  building_name: string | null;
  wing_name: string | null;
  office_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  delivery_partner: AssignedDeliveryPartner | null;
  allowed_transitions: OrderStatus[];
  items: VendorOrderItem[];
}

export interface VendorOrderSummary {
  today_orders: number;
  total_sales: number;
  recent_orders: VendorOrder[];
}

export type DeliveryPartnerFilter = '' | 'active' | 'inactive';

export interface VendorDeliveryPartner {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  is_active: boolean;
  partner_active: boolean;
  app_access_active: boolean;
  can_cancel_orders: boolean;
  active_order_count: number;
}

export interface VendorProfile {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string;
  role: string;
  is_active: boolean;
  store_open: boolean;
  store_hours_enabled: boolean;
  store_hours: StoreHours;
  store_available_now: boolean;
  delivery_charge: number;
  estimated_waiting_time_minutes: number | null;
  below_minimum_order_mode: BelowMinimumOrderMode;
  minimum_order_value: number;
  quick_request_tea_price: number;
  quick_request_coffee_price: number;
  can_manage_quick_request_pricing: boolean;
  can_top_up_customer_wallet: boolean;
  vendor_category: string | null;
  print_bw_price: number;
  print_color_price: number;
  print_legal_price: number;
  can_manage_print_pricing: boolean;
  office_wallet_credit_enabled: boolean;
  assigned_buildings: Building[];
  active_order_count: number;
}

export type VendorWalletTargetType = 'user';

export interface VendorOfficeWalletLookupItem {
  office_id: number;
  office_name: string;
  building_id: number | null;
  building_name: string | null;
  label: string;
  owner_name: string | null;
  owner_mobile: string | null;
  balance: number;
}

export interface VendorWalletTopUpReceipt {
  message: string;
  target_type: VendorWalletTargetType;
  mobile: string;
  target_name: string | null;
  balance: number;
  wallet_label: string;
}

export interface BuildingInvitation {
  id: number;
  building_id: number;
  name: string;
  address: string;
  city: string;
  offices_count: number;
  floors_count: number;
  invited_at: string | null;
}

