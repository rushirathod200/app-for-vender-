export type StockFilter = '' | 'in_stock' | 'out_of_stock';

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

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
  placed_at: string | null;
  building_name: string | null;
  office_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  allowed_transitions: OrderStatus[];
  items: VendorOrderItem[];
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
  assigned_buildings: Building[];
  active_order_count: number;
}
