import { OrderStatus, QuickRequestDetails } from './vendor';

export interface AssignedVendor {
  id: number;
  name: string | null;
  email: string | null;
  quick_request_tea_price?: number;
  quick_request_coffee_price?: number;
}

export interface DeliveryProfile {
  id: number;
  name: string | null;
  email: string | null;
  mobile: string;
  role: string;
  is_active: boolean;
  assigned_vendors: AssignedVendor[];
  active_order_count: number;
}

export interface DeliveryOrderItem {
  id: number;
  title: string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface DeliveryOrder {
  id: number;
  order_no: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string | null;
  notes: string | null;
  cancel_reason: string | null;
  order_channel: string | null;
  ordered_by_name: string | null;
  quick_request: QuickRequestDetails | null;
  placed_at: string | null;
  allowed_transitions: OrderStatus[];
  building_name: string | null;
  building_address: string | null;
  wing_name: string | null;
  floor_name: string | null;
  office_no: string | null;
  vendor_name: string | null;
  vendor_mobile: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  items: DeliveryOrderItem[];
}
