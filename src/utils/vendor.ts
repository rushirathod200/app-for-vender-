import { Building, OrderStatus, VendorOrder } from '../types/vendor';

export type VendorOrderBucket = 'pending' | 'completed' | 'cancelled';

const vendorOrderTransitions: Record<OrderStatus, OrderStatus[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function groupVendorOrderStatus(status: OrderStatus): VendorOrderBucket {
  if (status === 'delivered') {
    return 'completed';
  }

  if (status === 'cancelled') {
    return 'cancelled';
  }

  return 'pending';
}

export function getVendorOrderTransitions(status: OrderStatus): OrderStatus[] {
  return vendorOrderTransitions[status] ?? [];
}

export function sortVendorOrders(orders: VendorOrder[]): VendorOrder[] {
  return [...orders].sort((left, right) => {
    const leftTimestamp = left.placed_at ? new Date(left.placed_at).getTime() : 0;
    const rightTimestamp = right.placed_at ? new Date(right.placed_at).getTime() : 0;

    return rightTimestamp - leftTimestamp;
  });
}

export function formatRelativeTime(value: string | null): string {
  if (!value) {
    return '--';
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) {
    return 'Just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function buildVendorOrderLocation(order: VendorOrder): string {
  const wingName = order.wing_name?.trim() || null;
  const segments = [order.building_name, wingName, order.office_no]
    .map((segment) => segment?.trim())
    .filter((segment): segment is string => Boolean(segment));

  return segments.length > 0 ? segments.join(' • ') : 'Location unavailable';
}

export function resolveVendorDisplayName(name: string | null, buildings: Building[]): string {
  if (name?.trim()) {
    return name.trim();
  }

  if (buildings[0]?.name) {
    return buildings[0].name;
  }

  return 'Vendor Workspace';
}

export function isSameCalendarDay(value: string | null, now = new Date()): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
