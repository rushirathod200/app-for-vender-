import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createVendorMenuItem,
  deleteVendorMenuItem,
  fetchCatalogProducts,
  updateVendorMenuItem,
} from '../../api/vendorApi';
import { useVendorApp } from '../../context/VendorAppContext';
import { CatalogProduct, MenuItem } from '../../types/vendor';
import { ActionButton, IconOnlyButton, SectionTitle } from '../shared/ui';
import { tokens } from '../shared/tokens';

type ProductsMode =
  | { screen: 'list' }
  | { screen: 'edit'; productId: number }
  | { screen: 'add' };

export function VendorProductsScreen() {
  const {
    buildings,
    selectedBuildingId,
    setSelectedBuildingId,
    products,
    productsLoading,
    error,
    refreshProducts,
    toggleProductActive,
  } = useVendorApp();

  const [mode, setMode] = useState<ProductsMode>({ screen: 'list' });
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => (mode.screen === 'edit' ? products.find((item) => item.id === mode.productId) ?? null : null),
    [mode, products],
  );
  const selectedBuilding = useMemo(
    () => buildings.find((building) => building.id === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  );
  const activeCount = useMemo(
    () => products.filter((product) => product.is_available).length,
    [products],
  );

  useEffect(() => {
    if (mode.screen === 'edit' && !selectedProduct) {
      setMode({ screen: 'list' });
    }
  }, [mode, selectedProduct]);

  useEffect(() => {
    if (!selectedBuildingId) {
      return;
    }

    void refreshProducts();
  }, [selectedBuildingId]);

  if (mode.screen === 'edit') {
    if (!selectedProduct) {
      return null;
    }

    return (
      <EditPriceScreen
        product={selectedProduct}
        onBack={() => setMode({ screen: 'list' })}
        onSave={async (nextPrice) => {
          await updateVendorMenuItem(selectedProduct.id, {
            title: selectedProduct.title,
            price: nextPrice,
            is_available: selectedProduct.is_available,
          });
          await refreshProducts();
          setMode({ screen: 'list' });
        }}
      />
    );
  }

  if (mode.screen === 'add') {
    return (
      <AddProductScreen
        buildingId={selectedBuildingId}
        buildingName={selectedBuilding?.name ?? null}
        onBack={() => setMode({ screen: 'list' })}
        onAdd={async (catalogItem, price) => {
          if (!selectedBuildingId) {
            throw new Error('Select a building before adding a product.');
          }

          await createVendorMenuItem({
            building_id: selectedBuildingId,
            predefined_product_id: catalogItem.id,
            title: catalogItem.name,
            price,
            is_available: true,
          });
          await refreshProducts();
          setMode({ screen: 'list' });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={productsLoading}
            onRefresh={() => {
              void refreshProducts();
            }}
          />
        }
      >
        <SectionTitle
          title="Products"
          subtitle={
            selectedBuilding
              ? `${activeCount} active products in ${selectedBuilding.name}`
              : 'Select a building to manage the live menu'
          }
        />

        {buildings.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.buildingChips}
          >
            {buildings.map((building) => {
              const isSelected = building.id === selectedBuildingId;

              return (
                <Pressable
                  key={building.id}
                  style={[styles.buildingChip, isSelected ? styles.buildingChipActive : null]}
                  onPress={() => setSelectedBuildingId(building.id)}
                >
                  <Text style={[styles.buildingChipText, isSelected ? styles.buildingChipTextActive : null]}>
                    {building.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {selectedBuilding?.address ? <Text style={styles.buildingAddress}>{selectedBuilding.address}</Text> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        {!selectedBuilding ? <Text style={styles.emptyText}>No assigned building found for this vendor.</Text> : null}

        {selectedBuilding && products.length === 0 && !productsLoading ? (
          <Text style={styles.emptyText}>No menu items found for this building.</Text>
        ) : null}

        {products.map((product) => (
          <View key={product.id} style={[styles.productCard, !product.is_available ? styles.productCardInactive : null]}>
            <View style={styles.productTopRow}>
              <View style={styles.productMainWrap}>
                <View style={styles.mediaWrap}>
                  {product.photo_url ? (
                    <Image source={{ uri: product.photo_url }} style={styles.productImage} />
                  ) : (
                    <Ionicons name="fast-food-outline" size={20} color={tokens.colors.vendorPrimary} />
                  )}
                </View>

                <View style={styles.productTextWrap}>
                  <Text numberOfLines={1} style={[styles.productName, !product.is_available ? styles.productNameInactive : null]}>
                    {product.title}
                  </Text>
                  <Text style={styles.productCategory}>{product.category ?? product.product_name ?? 'Menu Item'}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  void toggleProductActive(product).catch((toggleError) => {
                    setActionError(toggleError instanceof Error ? toggleError.message : 'Could not update product.');
                  });
                }}
                style={[styles.switchWrap, product.is_available ? styles.switchWrapActive : styles.switchWrapInactive]}
              >
                <View style={[styles.switchDot, product.is_available ? styles.switchDotActive : styles.switchDotInactive]} />
              </Pressable>
            </View>

            <View style={styles.productBottomRow}>
              <View style={[styles.priceBadge, !product.is_available ? styles.priceBadgeInactive : null]}>
                <Text style={[styles.priceText, !product.is_available ? styles.priceTextInactive : null]}>₹{product.price}</Text>
              </View>

              <View style={styles.rightActions}>
                <IconOnlyButton onPress={() => setMode({ screen: 'edit', productId: product.id })} icon="create-outline" />
                <IconOnlyButton
                  onPress={() => {
                    void deleteVendorMenuItem(product.id)
                      .then(() => refreshProducts())
                      .catch((deleteError) => {
                        setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete product.');
                      });
                  }}
                  icon="trash-outline"
                  tone="danger"
                />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        style={[styles.fabButton, !selectedBuilding ? styles.fabButtonDisabled : null]}
        onPress={() => setMode({ screen: 'add' })}
        disabled={!selectedBuilding}
      >
        <Ionicons name="add" size={30} color="#ffffff" />
      </Pressable>
    </View>
  );
}

function EditPriceScreen({
  product,
  onSave,
  onBack,
}: {
  product: MenuItem;
  onSave: (price: number) => Promise<void>;
  onBack: () => void;
}) {
  const [priceInput, setPriceInput] = useState(String(product.price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedPrice = Number(priceInput);
  const isValid = Number.isFinite(parsedPrice) && parsedPrice > 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topNavRow}>
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Ionicons name="close" size={20} color="#75757f" />
          </Pressable>
          <Text style={styles.editTitle}>Edit Price</Text>
        </View>

        <View style={styles.editCard}>
          <View style={styles.editMediaWrap}>
            {product.photo_url ? (
              <Image source={{ uri: product.photo_url }} style={styles.editMediaImage} />
            ) : (
              <Ionicons name="fast-food-outline" size={26} color={tokens.colors.vendorPrimary} />
            )}
          </View>
          <Text style={styles.editName}>{product.title}</Text>
          <Text style={styles.editCategory}>{product.category ?? product.product_name ?? 'Menu Item'}</Text>

          <Text style={styles.inputLabel}>New Price (₹)</Text>
          <TextInput
            value={priceInput}
            onChangeText={(value) => setPriceInput(value.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.priceInput}
            placeholder="Enter price"
            placeholderTextColor="#9a9aa3"
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ActionButton
          label={saving ? 'Updating...' : 'Update Price'}
          onPress={() => {
            if (!isValid || saving) {
              return;
            }

            setSaving(true);
            setError(null);
            void onSave(parsedPrice)
              .catch((saveError) => {
                setError(saveError instanceof Error ? saveError.message : 'Could not update product.');
              })
              .finally(() => {
                setSaving(false);
              });
          }}
          disabled={!isValid || saving}
        />
      </ScrollView>
    </View>
  );
}

function AddProductScreen({
  buildingId,
  buildingName,
  onBack,
  onAdd,
}: {
  buildingId: number | null;
  buildingName: string | null;
  onBack: () => void;
  onAdd: (selected: CatalogProduct, price: number) => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCatalog = async (showLoader: boolean): Promise<void> => {
      if (!buildingId) {
        if (isMounted) {
          setCatalog([]);
          setLoading(false);
        }
        return;
      }

      if (showLoader && isMounted) {
        setLoading(true);
      }

      try {
        const items = await fetchCatalogProducts({ buildingId });
        const available = items.filter((item) => item.is_active && !item.is_added);

        if (!isMounted) {
          return;
        }

        setCatalog(available);
        setSelectedCatalogId((current) =>
          current && available.some((item) => item.id === current) ? current : (available[0]?.id ?? null),
        );
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Could not load catalog products.');
      } finally {
        if (showLoader && isMounted) {
          setLoading(false);
        }
      }
    };

    void loadCatalog(true);

    return () => {
      isMounted = false;
    };
  }, [buildingId]);

  const selectedItem = useMemo(
    () => catalog.find((item) => item.id === selectedCatalogId) ?? null,
    [catalog, selectedCatalogId],
  );

  const parsedPrice = Number(priceInput);
  const canSubmit = !!selectedItem && Number.isFinite(parsedPrice) && parsedPrice > 0 && !saving;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topNavRow}>
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Ionicons name="close" size={20} color="#75757f" />
          </Pressable>
          <Text style={styles.editTitle}>Add Product</Text>
        </View>

        <Text style={styles.addSubtitle}>
          {buildingName ? `Select a product for ${buildingName}` : 'Select a product from the vendor catalog'}
        </Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? <Text style={styles.emptyText}>Loading catalog...</Text> : null}

        {!loading && catalog.length === 0 ? (
          <View style={styles.emptyCatalogCard}>
            <Text style={styles.emptyCatalogText}>All available catalog products are already added.</Text>
          </View>
        ) : null}

        {!loading
          ? catalog.map((item) => {
              const isSelected = item.id === selectedCatalogId;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedCatalogId(item.id)}
                  style={[styles.catalogCard, isSelected ? styles.catalogCardSelected : null]}
                >
                  <View style={styles.catalogMain}>
                    <View style={styles.catalogMediaWrap}>
                      {item.default_image_url ? (
                        <Image source={{ uri: item.default_image_url }} style={styles.catalogMediaImage} />
                      ) : (
                        <Ionicons name="fast-food-outline" size={20} color={tokens.colors.vendorPrimary} />
                      )}
                    </View>
                    <View style={styles.catalogTextWrap}>
                      <Text numberOfLines={1} style={styles.catalogName}>{item.name}</Text>
                      <Text style={styles.catalogCategory}>{item.category ?? 'Product'}</Text>
                    </View>
                  </View>

                  <View style={[styles.catalogSelectDot, isSelected ? styles.catalogSelectDotActive : null]}>
                    {isSelected ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                  </View>
                </Pressable>
              );
            })
          : null}

        <View style={styles.priceBox}>
          <Text style={styles.inputLabel}>Set Price for {selectedItem?.name ?? 'Selected Product'} (₹)</Text>
          <TextInput
            value={priceInput}
            onChangeText={(value) => setPriceInput(value.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.priceInput}
            placeholder="Enter price e.g. 120"
            placeholderTextColor="#9a9aa3"
          />
        </View>

        <ActionButton
          label={saving ? 'Adding...' : 'Add Product'}
          disabled={!canSubmit}
          onPress={() => {
            if (!selectedItem || !canSubmit) {
              return;
            }

            setSaving(true);
            setError(null);
            void onAdd(selectedItem, parsedPrice)
              .catch((addError) => {
                setError(addError instanceof Error ? addError.message : 'Could not add product.');
              })
              .finally(() => {
                setSaving(false);
              });
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
    gap: 10,
  },
  buildingChips: {
    gap: 8,
    paddingRight: 16,
  },
  buildingChip: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: '#ececef',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingChipActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  buildingChipText: {
    color: '#7f7f89',
    fontSize: 12,
    fontWeight: '700',
  },
  buildingChipTextActive: {
    color: '#ffffff',
  },
  buildingAddress: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '600',
    marginTop: -2,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: '#8b8b95',
    fontSize: 13,
    fontWeight: '600',
  },
  productCard: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    padding: 10,
    gap: 8,
  },
  productCardInactive: {
    opacity: 0.66,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productMainWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  mediaWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f2f2f4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productTextWrap: {
    flex: 1,
  },
  productName: {
    color: '#212127',
    fontSize: 15,
    fontWeight: '900',
  },
  productNameInactive: {
    color: '#82828d',
  },
  productCategory: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  switchWrap: {
    width: 40,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchWrapActive: {
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'flex-end',
  },
  switchWrapInactive: {
    backgroundColor: '#d8d8de',
    alignItems: 'flex-start',
  },
  switchDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  switchDotActive: {
    backgroundColor: '#ffffff',
  },
  switchDotInactive: {
    backgroundColor: '#f2f2f4',
  },
  productBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceBadge: {
    backgroundColor: '#fff1e8',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  priceBadgeInactive: {
    backgroundColor: '#f4e5d9',
  },
  priceText: {
    color: tokens.colors.vendorPrimary,
    fontWeight: '900',
    fontSize: 15,
  },
  priceTextInactive: {
    color: '#d69d70',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fabButton: {
    position: 'absolute',
    right: 18,
    bottom: 14,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ee7c1e',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  fabButtonDisabled: {
    opacity: 0.5,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    marginBottom: 6,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ececef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editTitle: {
    color: '#232328',
    fontSize: 22,
    fontWeight: '900',
  },
  editCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  editMediaWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#f2f2f4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  editMediaImage: {
    width: '100%',
    height: '100%',
  },
  editName: {
    fontSize: 22,
    color: '#212127',
    fontWeight: '900',
    textAlign: 'center',
  },
  editCategory: {
    fontSize: 12,
    color: '#8c8c94',
    fontWeight: '600',
    marginBottom: 8,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: '#34343c',
  },
  priceInput: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#232328',
  },
  addSubtitle: {
    color: '#7f7f89',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  emptyCatalogCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 14,
    padding: 14,
  },
  emptyCatalogText: {
    color: '#7e7e88',
    fontSize: 12,
    fontWeight: '600',
  },
  catalogCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catalogCardSelected: {
    borderColor: tokens.colors.vendorPrimary,
  },
  catalogMain: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    flex: 1,
  },
  catalogMediaWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#f2f2f4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  catalogMediaImage: {
    width: '100%',
    height: '100%',
  },
  catalogTextWrap: {
    flex: 1,
  },
  catalogName: {
    color: '#222329',
    fontSize: 14,
    fontWeight: '900',
  },
  catalogCategory: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  catalogSelectDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d6d6dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogSelectDotActive: {
    backgroundColor: tokens.colors.vendorPrimary,
    borderColor: tokens.colors.vendorPrimary,
  },
  priceBox: {
    backgroundColor: '#f7f7f8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    padding: 12,
    gap: 8,
  },
});
