import { AppOrder, DeliveryPartner, ProductCatalogItem, StoreProfile, VendorProduct } from '../types/workflow';

export const defaultStoreProfile: StoreProfile = {
  storeName: 'Brewed Bliss Cafe',
  freeDeliveryMinOrder: 500,
  deliveryCharge: 30,
  phoneNumber: '+91 98765 43210',
  address: 'Ground Floor, Tech Park, Whitefield, Bangalore - 560066',
};

export const defaultProducts: VendorProduct[] = [
  { id: 'p1', name: 'Cappuccino', category: 'Coffee', price: 120, isActive: true, emoji: '☕' },
  { id: 'p2', name: 'Cold Brew', category: 'Coffee', price: 150, isActive: true, emoji: '🥤' },
  { id: 'p3', name: 'Croissant', category: 'Bakery', price: 80, isActive: true, emoji: '🥐' },
  { id: 'p4', name: 'Blueberry Muffin', category: 'Bakery', price: 90, isActive: false, emoji: '🧁' },
  { id: 'p5', name: 'Club Sandwich', category: 'Food', price: 180, isActive: true, emoji: '🥪' },
];

export const productCatalog: ProductCatalogItem[] = [
  { id: 'c1', name: 'Espresso', category: 'Coffee', emoji: '☕' },
  { id: 'c2', name: 'Latte', category: 'Coffee', emoji: '☕' },
  { id: 'c3', name: 'Matcha Latte', category: 'Coffee', emoji: '🍵' },
  { id: 'c4', name: 'Banana Bread', category: 'Bakery', emoji: '🍌' },
  { id: 'c5', name: 'Cheesecake Slice', category: 'Dessert', emoji: '🍰' },
];

export const defaultDeliveryPartners: DeliveryPartner[] = [
  {
    id: 'd1',
    name: 'Rahul Sharma',
    email: 'rahul@cafeconnect.com',
    totalDeliveries: 142,
    isActive: true,
  },
  {
    id: 'd2',
    name: 'Amit Kumar',
    email: 'amit@cafeconnect.com',
    totalDeliveries: 98,
    isActive: true,
  },
  {
    id: 'd3',
    name: 'Suresh Patel',
    email: 'suresh@cafeconnect.com',
    totalDeliveries: 67,
    isActive: false,
  },
];

export const defaultOrders: AppOrder[] = [
  {
    id: 'ORD-1024',
    customerName: 'Ananya Rao',
    customerPhone: '+91 98765 43210',
    pickupStore: 'Brewed Bliss Cafe',
    deliveryAddress: 'Block B, 3rd Floor, Tech Park, Whitefield',
    items: [
      { name: 'Cappuccino', qty: 2 },
      { name: 'Croissant', qty: 1 },
      { name: 'Muffin', qty: 1 },
    ],
    total: 485,
    status: 'pending',
    createdAgo: '2 min ago',
    assignedPartnerId: 'd1',
  },
  {
    id: 'ORD-1023',
    customerName: 'Vikram Jain',
    customerPhone: '+91 87654 32109',
    pickupStore: 'Brewed Bliss Cafe',
    deliveryAddress: 'Level 5, Innovation Hub, Electronic City',
    items: [
      { name: 'Cold Brew', qty: 1 },
      { name: 'Sandwich', qty: 2 },
    ],
    total: 320,
    status: 'pending',
    createdAgo: '8 min ago',
    assignedPartnerId: 'd2',
  },
  {
    id: 'ORD-1022',
    customerName: 'Nisha Kulkarni',
    customerPhone: '+91 99882 77441',
    pickupStore: 'Brewed Bliss Cafe',
    deliveryAddress: 'Tower 1, 7th Floor, Startup Center',
    items: [
      { name: 'Latte', qty: 1 },
      { name: 'Club Sandwich', qty: 1 },
    ],
    total: 280,
    status: 'completed',
    createdAgo: '15 min ago',
    assignedPartnerId: 'd1',
  },
  {
    id: 'ORD-1021',
    customerName: 'Rohit Gupta',
    customerPhone: '+91 90012 33109',
    pickupStore: 'Brewed Bliss Cafe',
    deliveryAddress: 'North Wing, 2nd Floor, Corporate Tower',
    items: [
      { name: 'Espresso', qty: 2 },
      { name: 'Cheesecake Slice', qty: 1 },
    ],
    total: 360,
    status: 'cancelled',
    createdAgo: '25 min ago',
    cancelReason: 'Customer requested cancellation due to meeting reschedule.',
    assignedPartnerId: 'd2',
  },
];
