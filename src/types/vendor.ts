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
}

export interface MenuItem {
  id: number;
  building_id: number;
  title: string;
  price: number;
  is_available: boolean;
  photo_url: string | null;
  product_name: string | null;
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
  placed_at: string | null;
  building_name: string | null;
  office_no: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  items: VendorOrderItem[];
}
