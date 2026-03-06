import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { fetchAssignedBuildings, fetchVendorMenu, updateMenuItemAvailability } from '../../api/vendorApi';
import { AppButton } from '../../components/AppButton';
import { AppTextField } from '../../components/AppTextField';
import { SectionCard } from '../../components/SectionCard';
import { theme } from '../../config/theme';
import { Building, MenuItem, StockFilter } from '../../types/vendor';
import { formatCurrency } from '../../utils/format';

const stockFilters: Array<{ label: string; value: StockFilter }> = [
  { label: 'All', value: '' },
  { label: 'In Stock', value: 'in_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' },
];

export function MenuScreen() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('');
  const [updatingItemIds, setUpdatingItemIds] = useState<Record<number, boolean>>({});

  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  );

  useEffect(() => {
    void loadBuildings();
  }, []);

  useEffect(() => {
    if (!selectedBuildingId) {
      return;
    }

    void loadMenuItems(selectedBuildingId, false);
  }, [selectedBuildingId, search, stockFilter]);

  const loadBuildings = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const fetchedBuildings = await fetchAssignedBuildings();
      setBuildings(fetchedBuildings);

      if (fetchedBuildings.length === 0) {
        setSelectedBuildingId(null);
        setMenuItems([]);
        return;
      }

      setSelectedBuildingId((current) => current ?? fetchedBuildings[0].id);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load assigned buildings.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadMenuItems = async (buildingId: number, isRefresh: boolean): Promise<void> => {
    if (!isRefresh) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const items = await fetchVendorMenu({
        buildingId,
        search,
        stock: stockFilter,
      });
      setMenuItems(items);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Could not load menu items.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applySearch = (): void => {
    setSearch(draftSearch.trim());
  };

  const handleToggleStock = async (item: MenuItem): Promise<void> => {
    const nextAvailability = !item.is_available;

    setUpdatingItemIds((current) => ({ ...current, [item.id]: true }));
    setMenuItems((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              is_available: nextAvailability,
            }
          : entry,
      ),
    );

    try {
      await updateMenuItemAvailability(item.id, nextAvailability);
    } catch (toggleError) {
      setMenuItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                is_available: item.is_available,
              }
            : entry,
        ),
      );

      const message = toggleError instanceof Error ? toggleError.message : 'Could not update stock.';
      setError(message);
    } finally {
      setUpdatingItemIds((current) => {
        const nextState = { ...current };
        delete nextState[item.id];
        return nextState;
      });
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
            if (selectedBuildingId) {
              void loadMenuItems(selectedBuildingId, true);
            }
          }}
        />
      }
    >
      <SectionCard>
        <Text style={styles.sectionTitle}>Building</Text>
        <View style={styles.chipsWrap}>
          {buildings.map((building) => (
            <Chip
              key={building.id}
              label={building.name}
              active={building.id === selectedBuildingId}
              onPress={() => setSelectedBuildingId(building.id)}
            />
          ))}
        </View>

        {selectedBuilding?.address ? <Text style={styles.mutedText}>{selectedBuilding.address}</Text> : null}
      </SectionCard>

      <SectionCard>
        <Text style={styles.sectionTitle}>Search</Text>
        <AppTextField
          label="Product"
          value={draftSearch}
          onChangeText={setDraftSearch}
          placeholder="Search title or product"
        />
        <AppButton title="Apply Search" onPress={applySearch} variant="outline" />

        <View style={styles.chipsWrap}>
          {stockFilters.map((filter) => (
            <Chip
              key={filter.value || 'all'}
              label={filter.label}
              active={stockFilter === filter.value}
              onPress={() => setStockFilter(filter.value)}
            />
          ))}
        </View>
      </SectionCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? <Text style={styles.mutedText}>Loading menu items...</Text> : null}

      {!loading && menuItems.length === 0 ? (
        <Text style={styles.mutedText}>No menu items found for current filters.</Text>
      ) : null}

      {!loading
        ? menuItems.map((item) => {
            const isUpdating = Boolean(updatingItemIds[item.id]);

            return (
              <SectionCard key={item.id}>
                <View style={styles.menuHeaderRow}>
                  <View style={styles.menuInfo}>
                    <Text style={styles.menuTitle}>{item.title}</Text>
                    {item.product_name ? <Text style={styles.mutedText}>{item.product_name}</Text> : null}
                    <Text style={styles.price}>{formatCurrency(item.price)}</Text>
                  </View>

                  {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.photo} /> : null}
                </View>

                <View style={styles.stockRow}>
                  <Text style={item.is_available ? styles.inStock : styles.outOfStock}>
                    {item.is_available ? 'In Stock' : 'Out Of Stock'}
                  </Text>
                  <AppButton
                    title={item.is_available ? 'Mark Out Of Stock' : 'Mark In Stock'}
                    onPress={() => {
                      void handleToggleStock(item);
                    }}
                    loading={isUpdating}
                    variant={item.is_available ? 'outline' : 'primary'}
                  />
                </View>
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
  menuHeaderRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  price: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
    backgroundColor: '#f1f5f9',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  inStock: {
    color: theme.colors.success,
    fontWeight: '700',
  },
  outOfStock: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
});
