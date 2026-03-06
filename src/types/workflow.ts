export type AppRole = 'vendor' | 'delivery';

export type VendorTabKey = 'dashboard' | 'orders' | 'products' | 'delivery' | 'profile';

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

export interface OrderLineItem {
  name: string;
  qty: number;
}

export interface AppOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupStore: string;
  deliveryAddress: string;
  items: OrderLineItem[];
  total: number;
  status: OrderStatus;
  createdAgo: string;
  cancelReason?: string;
  assignedPartnerId?: string;
}

export interface VendorProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  isActive: boolean;
  emoji: string;
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  category: string;
  emoji: string;
}

export interface DeliveryPartner {
  id: string;
  name: string;
  email: string;
  totalDeliveries: number;
  isActive: boolean;
}

export interface StoreProfile {
  storeName: string;
  freeDeliveryMinOrder: number;
  deliveryCharge: number;
  phoneNumber: string;
  address: string;
}
