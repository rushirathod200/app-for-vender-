export type StockFilter = '' | 'in_stock' | 'out_of_stock';
export type BelowMinimumOrderMode = 'charge_delivery' | 'block_order';
export type ManualOfficePaymentMethod = 'cash' | 'office_wallet';
export type ManualOfficeRecordedPaymentMethod = ManualOfficePaymentMethod | 'pending';
export type QuickRequestPaymentMethod = 'cod' | 'office_wallet' | 'wallet';

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
  price: number;
  is_available: boolean;
  photo_url: string | null;
  product_name: string | null;
  category?: string | null;
  description?: string | null;
  building_name?: string | null;
}

export interface VendorOrderItem {
  id: number;
  title: string;
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
  placed_at: string | null;
  building_name: string | null;
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
  delivery_charge: number;
  below_minimum_order_mode: BelowMinimumOrderMode;
  minimum_order_value: number;
  quick_request_tea_price: number;
  quick_request_coffee_price: number;
  office_wallet_credit_enabled: boolean;
  assigned_buildings: Building[];
  active_order_count: number;
}

export type VendorWalletTargetType = 'user' | 'office';

export interface VendorWalletTopUpReceipt {
  message: string;
  target_type: VendorWalletTargetType;
  mobile: string;
  target_name: string | null;
  balance: number;
  wallet_label: string;
}
