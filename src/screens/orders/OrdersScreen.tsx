import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { fetchAssignedBuildings, fetchVendorOrders, updateVendorOrderStatus } from '../../api/vendorApi';
import { AppButton } from '../../components/AppButton';
import { SectionCard } from '../../components/SectionCard';
import { StatusPill } from '../../components/StatusPill';
import { theme } from '../../config/theme';
import { Building, OrderStatus, VendorOrder } from '../../types/vendor';
import { formatCurrency, formatDateTime } from '../../utils/format';

const orderFilters: Array<{ label: string; value: '' | OrderStatus }> = [
  { label: 'All', value: '' },
  { label: 'Placed', value: 'placed' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Preparing', value: 'preparing' },
  { label: 'Out For Delivery', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const vendorTransitions: Record<OrderStatus, OrderStatus[]> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function OrdersScreen() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');

  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrderKey, setUpdatingOrderKey] = useState<string | null>(null);

  useEffect(() => {
    void loadBuildings();
  }, []);

  useEffect(() => {
    void loadOrders(false);
  }, [selectedBuildingId, statusFilter]);

  const loadBuildings = async (): Promise<void> => {
    try {
      const fetchedBuildings = await fetchAssignedBuildings();
      setBuildings(fetchedBuildings);
    } catch {
      // Building filter is optional for orders screen.
    }
  };

  const loadOrders = async (isRefresh: boolean): Promise<void> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const fetchedOrders = await fetchVendorOrders({
        status: statusFilter,
        buildingId: selectedBuildingId ?? undefined,
      });
      setOrders(fetchedOrders);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load orders.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (order: VendorOrder, nextStatus: OrderStatus): Promise<void> => {
    const key = `${order.id}:${nextStatus}`;
    setUpdatingOrderKey(key);
    setError(null);

    try {
      await updateVendorOrderStatus(order.id, nextStatus);
      setOrders((current) =>
        current.map((entry) =>
          entry.id === order.id
            ? {
                ...entry,
                status: nextStatus,
              }
            : entry,
        ),
      );
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Could not update order status.';
      setError(message);
    } finally {
      setUpdatingOrderKey(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void loadOrders(true);
          }}
        />
      }
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Filter Orders</Text>

        <View style={styles.chipsWrap}>
          {orderFilters.map((filter) => (
            <Chip
              key={filter.value || 'all'}
              label={filter.label}
              active={statusFilter === filter.value}
              onPress={() => setStatusFilter(filter.value)}
            />
          ))}
        </View>

        <View style={styles.chipsWrap}>
          <Chip
            label="All Buildings"
            active={selectedBuildingId === null}
            onPress={() => setSelectedBuildingId(null)}
          />
          {buildings.map((building) => (
            <Chip
              key={building.id}
              label={building.name}
              active={selectedBuildingId === building.id}
              onPress={() => setSelectedBuildingId(building.id)}
            />
          ))}
        </View>
      </SectionCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? <Text style={styles.mutedText}>Loading orders...</Text> : null}

      {!loading && orders.length === 0 ? <Text style={styles.mutedText}>No orders found.</Text> : null}

      {!loading
        ? orders.map((order) => {
            const transitions = vendorTransitions[order.status] ?? [];

            return (
              <SectionCard key={order.id}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderNo}>{order.order_no}</Text>
                    <Text style={styles.mutedText}>Placed: {formatDateTime(order.placed_at)}</Text>
                    <Text style={styles.mutedText}>Building: {order.building_name ?? '--'}</Text>
                    <Text style={styles.mutedText}>Office: {order.office_no ?? '--'}</Text>
                    <Text style={styles.mutedText}>
                      Customer: {order.customer_name ?? 'Customer'} {order.customer_mobile ? `(${order.customer_mobile})` : ''}
                    </Text>
                  </View>
                  <StatusPill status={order.status} />
                </View>

                <View style={styles.itemsBlock}>
                  {order.items.slice(0, 3).map((item) => (
                    <Text key={item.id || `${order.id}-${item.title}`} style={styles.itemText}>
                      {item.title} x {item.qty} = {formatCurrency(item.line_total)}
                    </Text>
                  ))}
                  {order.items.length > 3 ? (
                    <Text style={styles.mutedText}>+{order.items.length - 3} more items</Text>
                  ) : null}
                </View>

                <Text style={styles.totalText}>Total: {formatCurrency(order.total)}</Text>

                {transitions.length > 0 ? (
                  <View style={styles.actionButtons}>
                    {transitions.map((status) => {
                      const key = `${order.id}:${status}`;
                      return (
                        <AppButton
                          key={key}
                          title={`Mark ${status.replace(/_/g, ' ')}`}
                          variant={status === 'cancelled' ? 'danger' : 'outline'}
                          loading={updatingOrderKey === key}
                          onPress={() => {
                            void updateStatus(order, status);
                          }}
                        />
                      );
                    })}
                  </View>
                ) : null}
              </SectionCard>
            );
          })
        : null}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Text style={[styles.chipLabel, active ? styles.chipLabelActive : styles.chipLabelInactive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  chipInactive: {
    backgroundColor: '#ffffff',
    borderColor: theme.colors.border,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: theme.colors.primary,
  },
  chipLabelInactive: {
    color: theme.colors.subtext,
  },
  mutedText: {
    color: theme.colors.subtext,
    fontSize: 13,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 13,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  orderInfo: {
    flex: 1,
    gap: 2,
  },
  orderNo: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  itemsBlock: {
    gap: 4,
  },
  itemText: {
    color: theme.colors.text,
    fontSize: 13,
  },
  totalText: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtons: {
    gap: theme.spacing.sm,
  },
});
