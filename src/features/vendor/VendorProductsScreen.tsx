import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  deleteVendorMenuItem,
  updateVendorMenuItem,
} from '../../api/vendorApi';
import { useVendorApp } from '../../context/VendorAppContext';
import { MenuItem } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';

type ProductsMode =
  | { screen: 'list' }
  | { screen: 'edit'; productId: number };

type ProductAvailabilityTab = 'online' | 'offline';

interface VariantDraft {
  localId: string;
  id?: number;
  product_variant_id?: number | null;
  name: string;
  mrp: string;
  price: string;
  is_available: boolean;
}

function productDisplayGroup(product: MenuItem): string {
  return product.subcategory ?? product.category ?? product.product_name ?? 'Menu Item';
}

export function VendorProductsScreen() {
  const {
    buildings,
    selectedBuildingId,
    products,
    productsLoading,
    error,
    refreshProducts,
    toggleProductActive,
  } = useVendorApp();

  const [mode, setMode] = useState<ProductsMode>({ screen: 'list' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [availabilityTab, setAvailabilityTab] = useState<ProductAvailabilityTab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useAutoClearValue(actionError, () => setActionError(null));

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
  const inactiveCount = useMemo(
    () => products.filter((product) => !product.is_available).length,
    [products],
  );
  const categories = useMemo(() => {
    const seen = new Set<string>();

    products.forEach((product) => {
      const category = productDisplayGroup(product);

      if (category) {
        seen.add(category);
      }
    });

    return ['All', ...Array.from(seen)];
  }, [products]);
  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesAvailability =
        availabilityTab === 'online' ? product.is_available : !product.is_available;
      const category = productDisplayGroup(product);
      const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
      const matchesSearch =
        !normalizedSearch ||
        product.title.toLowerCase().includes(normalizedSearch) ||
        category.toLowerCase().includes(normalizedSearch);

      return matchesAvailability && matchesCategory && matchesSearch;
    });
  }, [availabilityTab, products, searchQuery, selectedCategory]);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

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

  useAndroidBackHandler(
    () => {
      setMode({ screen: 'list' });
      return true;
    },
    { enabled: mode.screen !== 'list', priority: 20 },
  );

  if (mode.screen === 'edit') {
    if (!selectedProduct) {
      return null;
    }

    return (
      <EditPriceScreen
        product={selectedProduct}
        onBack={() => setMode({ screen: 'list' })}
        onSave={async (input) => {
          await updateVendorMenuItem(selectedProduct.id, {
            title: input.title,
            price: input.price,
            mrp: input.mrp,
            is_available: input.is_available,
            variants: input.variants,
          });
          await refreshProducts({ force: true });
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
              void refreshProducts({ force: true });
            }}
          />
        }
      >
        <View style={styles.headerBlock}>
          <Text style={styles.screenTitle}>Products</Text>
          <Text style={styles.screenSubtitle}>
            {`${activeCount} active products in your vendor menu`}
          </Text>
        </View>

        <View style={styles.availabilityTabs}>
          <Pressable
            style={styles.availabilityTab}
            onPress={() => setAvailabilityTab('online')}
          >
            <Text style={[styles.availabilityTabText, availabilityTab === 'online' ? styles.availabilityTabTextActive : null]}>
              Online ({activeCount})
            </Text>
            <View style={[styles.tabIndicator, availabilityTab === 'online' ? styles.tabIndicatorActive : null]} />
          </Pressable>
          <Pressable
            style={styles.availabilityTab}
            onPress={() => setAvailabilityTab('offline')}
          >
            <Text style={[styles.availabilityTabText, availabilityTab === 'offline' ? styles.availabilityTabTextActive : null]}>
              Offline ({inactiveCount})
            </Text>
            <View style={[styles.tabIndicator, availabilityTab === 'offline' ? styles.tabIndicatorActive : null]} />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={22} color="#9a9aa4" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            placeholder="Search your menu"
            placeholderTextColor="#a2a2aa"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryChips}
        >
          {categories.map((category) => {
            const isSelected = category === selectedCategory;

            return (
              <Pressable
                key={category}
                style={[styles.categoryChip, isSelected ? styles.categoryChipActive : null]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.categoryChipText, isSelected ? styles.categoryChipTextActive : null]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {Array.from(new Set([error, actionError].filter((message): message is string => !!message))).map((message) => (
          <Text key={message} style={styles.errorText}>{message}</Text>
        ))}

        {!selectedBuilding ? <Text style={styles.emptyText}>No assigned building found for this vendor.</Text> : null}

        {selectedBuilding && products.length === 0 && !productsLoading ? (
          <Text style={styles.emptyText}>No menu items found for this building.</Text>
        ) : null}

        {selectedBuilding && products.length > 0 && filteredProducts.length === 0 ? (
          <Text style={styles.emptyText}>No products found in this filter.</Text>
        ) : null}

        {filteredProducts.map((product) => (
          <View key={product.id} style={[styles.productCard, !product.is_available ? styles.productCardInactive : null]}>
            <View style={styles.mediaWrap}>
              {product.photo_url ? (
                <Image source={{ uri: product.photo_url }} style={styles.productImage} />
              ) : (
                <Ionicons name="fast-food-outline" size={24} color={tokens.colors.vendorPrimary} />
              )}
            </View>

            <View style={styles.productTextWrap}>
              <Text numberOfLines={1} style={[styles.productName, !product.is_available ? styles.productNameInactive : null]}>
                {product.title}
              </Text>
              <Text style={styles.productCategory}>{productDisplayGroup(product)}</Text>
              <View style={[styles.priceBadge, !product.is_available ? styles.priceBadgeInactive : null]}>
                <Text style={[styles.priceText, !product.is_available ? styles.priceTextInactive : null]}>₹{product.price}</Text>
              </View>
            </View>

            <View style={styles.productControls}>
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

              <View style={styles.rightActions}>
                <Pressable style={styles.editActionButton} onPress={() => setMode({ screen: 'edit', productId: product.id })}>
                  <Ionicons name="create-outline" size={22} color="#6f70c8" />
                </Pressable>
                <Pressable
                  style={styles.deleteActionButton}
                  onPress={() => {
                    void deleteVendorMenuItem(product.id)
                      .then(() => refreshProducts({ force: true }))
                      .catch((deleteError) => {
                        setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete product.');
                      });
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#df666c" />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

    </View>
  );
}

function EditPriceScreen({
  product,
  onSave,
  onBack,
}: {
  product: MenuItem;
  onSave: (input: {
    title: string;
    price: number;
    mrp: number | null;
    is_available: boolean;
    variants: Array<{
      id?: number;
      product_variant_id?: number | null;
      name: string;
      mrp?: number | null;
      price: number;
      is_available: boolean;
    }>;
  }) => Promise<void>;
  onBack: () => void;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [titleInput, setTitleInput] = useState(product.title);
  const [mrpInput, setMrpInput] = useState(product.mrp ? String(product.mrp) : '');
  const [priceInput, setPriceInput] = useState(String(product.price));
  const [isAvailable, setIsAvailable] = useState(product.is_available);
  const [variants, setVariants] = useState<VariantDraft[]>(
    product.variants.map((variant) => ({
      localId: `existing-${variant.id}`,
      id: variant.id,
      product_variant_id: variant.product_variant_id,
      name: variant.name,
      mrp: variant.mrp === null ? '' : String(variant.mrp),
      price: String(variant.price),
      is_available: variant.is_available,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useAutoClearValue(error, () => setError(null));

  const parsedPrice = Number(priceInput);
  const parsedMrp = mrpInput.trim() === '' ? null : Number(mrpInput);
  const variantPayload = variants
    .map((variant) => {
      const name = variant.name.trim();
      const price = Number(variant.price);
      const mrp = variant.mrp.trim() === '' ? null : Number(variant.mrp);

      if (!name) {
        return null;
      }

      return {
        id: variant.id,
        product_variant_id: variant.product_variant_id,
        name,
        mrp,
        price,
        is_available: variant.is_available,
      };
    })
    .filter((variant): variant is NonNullable<typeof variant> => !!variant);
  const variantsValid = variantPayload.every(
    (variant) =>
      Number.isFinite(variant.price) &&
      variant.price >= 0 &&
      (variant.mrp === null || (Number.isFinite(variant.mrp) && variant.mrp >= 0)),
  );
  const isValid =
    titleInput.trim().length > 0 &&
    Number.isFinite(parsedPrice) &&
    parsedPrice > 0 &&
    (parsedMrp === null || (Number.isFinite(parsedMrp) && parsedMrp >= 0)) &&
    variantsValid;

  const updateVariant = (localId: string, patch: Partial<VariantDraft>): void => {
    setVariants((current) =>
      current.map((variant) => (variant.localId === localId ? { ...variant, ...patch } : variant)),
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, styles.keyboardContentGrow]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
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
          <Text style={styles.editCategory}>{productDisplayGroup(product)}</Text>

          <Text style={styles.inputLabel}>Product Title</Text>
          <TextInput
            value={titleInput}
            onChangeText={setTitleInput}
            style={styles.priceInput}
            placeholder="Product title"
            placeholderTextColor="#9a9aa3"
          />

          <Text style={styles.inputLabel}>MRP (₹)</Text>
          <TextInput
            value={mrpInput}
            onChangeText={(value) => setMrpInput(value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
            style={styles.priceInput}
            placeholder="Optional MRP"
            placeholderTextColor="#9a9aa3"
          />

          <Text style={styles.inputLabel}>Default Discount Price (₹)</Text>
          <TextInput
            value={priceInput}
            onChangeText={(value) => setPriceInput(value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
            style={styles.priceInput}
            placeholder="Enter price"
            placeholderTextColor="#9a9aa3"
          />

          <View style={styles.editOnlineRow}>
            <Text style={styles.editOnlineText}>Product Online</Text>
            <Pressable
              onPress={() => setIsAvailable((current) => !current)}
              style={[styles.switchWrap, isAvailable ? styles.switchWrapActive : styles.switchWrapInactive]}
            >
              <View style={[styles.switchDot, isAvailable ? styles.switchDotActive : styles.switchDotInactive]} />
            </Pressable>
          </View>
        </View>

        <View style={styles.variantsCard}>
          <View style={styles.variantsHeader}>
            <View>
              <Text style={styles.variantsTitle}>Variants</Text>
              <Text style={styles.variantsSubtitle}>Name, MRP, discount price</Text>
            </View>
            <Pressable
              style={styles.addVariantButton}
              onPress={() => {
                setVariants((current) => [
                  ...current,
                  {
                    localId: `new-${Date.now()}-${current.length}`,
                    name: '',
                    mrp: '',
                    price: '',
                    is_available: true,
                  },
                ]);
              }}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.addVariantText}>Add</Text>
            </Pressable>
          </View>
          {variants.length === 0 ? (
            <Text style={styles.variantsEmpty}>No variants. This product uses the default price above.</Text>
          ) : null}

          {variants.map((variant) => (
            <View key={variant.localId} style={styles.variantRow}>
              <View style={styles.variantRowHeader}>
                <Text style={styles.variantRowTitle}>{variant.name.trim() || 'New Variant'}</Text>
                <View style={styles.variantRowActions}>
                  <Pressable
                    onPress={() => updateVariant(variant.localId, { is_available: !variant.is_available })}
                    style={[styles.variantSwitchWrap, variant.is_available ? styles.switchWrapActive : styles.switchWrapInactive]}
                  >
                    <View style={[styles.variantSwitchDot, variant.is_available ? styles.switchDotActive : styles.switchDotInactive]} />
                  </Pressable>
                  <Pressable
                    style={styles.variantDeleteButton}
                    onPress={() => setVariants((current) => current.filter((item) => item.localId !== variant.localId))}
                  >
                    <Ionicons name="trash-outline" size={18} color="#df666c" />
                  </Pressable>
                </View>
              </View>

              <TextInput
                value={variant.name}
                onChangeText={(value) => updateVariant(variant.localId, { name: value })}
                style={styles.variantInput}
                placeholder="Variant name"
                placeholderTextColor="#9a9aa3"
              />
              <View style={styles.variantPriceRow}>
                <View style={styles.variantField}>
                  <Text style={styles.variantFieldLabel}>MRP</Text>
                  <TextInput
                    value={variant.mrp}
                    onChangeText={(value) => updateVariant(variant.localId, { mrp: value.replace(/[^0-9.]/g, '') })}
                    keyboardType="decimal-pad"
                    style={styles.variantInput}
                    placeholder="0"
                    placeholderTextColor="#9a9aa3"
                  />
                </View>
                <View style={styles.variantField}>
                  <Text style={styles.variantFieldLabel}>Discount Price</Text>
                  <TextInput
                    value={variant.price}
                    onChangeText={(value) => updateVariant(variant.localId, { price: value.replace(/[^0-9.]/g, '') })}
                    keyboardType="decimal-pad"
                    style={styles.variantInput}
                    placeholder="0"
                    placeholderTextColor="#9a9aa3"
                  />
                </View>
              </View>
            </View>
          ))}
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
            void onSave({
              title: titleInput.trim(),
              price: parsedPrice,
              mrp: parsedMrp,
              is_available: isAvailable,
              variants: variantPayload,
            })
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 84,
    gap: 9,
  },
  keyboardContentGrow: {
    flexGrow: 1,
  },
  headerBlock: {
    gap: 6,
  },
  screenTitle: {
    color: '#19191f',
    fontSize: 26,
    fontWeight: '900',
  },
  screenSubtitle: {
    color: '#777782',
    fontSize: 14,
    fontWeight: '500',
  },
  buildingChips: {
    gap: 8,
    paddingRight: 16,
  },
  buildingChip: {
    minHeight: 36,
    borderRadius: 18,
    backgroundColor: '#ececef',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingChipActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  buildingChipText: {
    color: '#7f7f89',
    fontSize: 13,
    fontWeight: '700',
  },
  buildingChipTextActive: {
    color: '#ffffff',
  },
  availabilityTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dedee4',
    marginTop: 4,
  },
  availabilityTab: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  availabilityTabText: {
    color: '#6f6f7a',
    fontSize: 15,
    fontWeight: '900',
  },
  availabilityTabTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  tabIndicator: {
    width: '100%',
    height: 3,
    backgroundColor: 'transparent',
  },
  tabIndicatorActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  searchBox: {
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    shadowColor: '#b9b9c4',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: '#262630',
    fontSize: 14,
    fontWeight: '700',
  },
  categoryChips: {
    gap: 8,
    paddingRight: 16,
  },
  categoryChip: {
    minHeight: 42,
    maxWidth: 150,
    borderRadius: 21,
    backgroundColor: '#f4f4f6',
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: tokens.colors.vendorPrimary,
  },
  categoryChipText: {
    color: '#5f6070',
    fontSize: 14,
    fontWeight: '900',
  },
  categoryChipTextActive: {
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 10,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#b5b5bf',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  productCardInactive: {
    opacity: 0.66,
  },
  mediaWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
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
    minWidth: 0,
  },
  productName: {
    color: '#212127',
    fontSize: 16,
    fontWeight: '900',
  },
  productNameInactive: {
    color: '#82828d',
  },
  productCategory: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  switchWrap: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 4,
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
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  switchDotActive: {
    backgroundColor: '#ffffff',
  },
  switchDotInactive: {
    backgroundColor: '#f2f2f4',
  },
  priceBadge: {
    backgroundColor: '#fff1e8',
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
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
  productControls: {
    alignItems: 'flex-end',
    gap: 12,
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editActionButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#f1f0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#fff0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabButton: {
    position: 'absolute',
    right: 20,
    bottom: 78,
    width: 76,
    height: 76,
    borderRadius: 24,
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
    gap: 9,
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
    fontSize: 14,
    color: '#8c8c94',
    fontWeight: '600',
    marginBottom: 10,
  },
  inputLabel: {
    alignSelf: 'flex-start',
    fontSize: 14,
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
  editOnlineRow: {
    width: '100%',
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e7ed',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editOnlineText: {
    color: '#232328',
    fontSize: 16,
    fontWeight: '900',
  },
  variantsCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  variantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addVariantButton: {
    minHeight: 36,
    borderRadius: 13,
    backgroundColor: tokens.colors.vendorPrimary,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addVariantText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  variantsTitle: {
    color: '#232328',
    fontSize: 20,
    fontWeight: '900',
  },
  variantsSubtitle: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  variantsEmpty: {
    color: '#8b8b95',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  variantRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e6ec',
    backgroundColor: '#ffffff',
    padding: 9,
    gap: 9,
  },
  variantRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  variantRowTitle: {
    flex: 1,
    color: '#232328',
    fontSize: 14,
    fontWeight: '900',
  },
  variantRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantSwitchWrap: {
    width: 42,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  variantSwitchDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  variantDeleteButton: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#fff0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantInput: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '800',
    color: '#232328',
  },
  variantPriceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  variantField: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  variantFieldLabel: {
    color: '#6f6f78',
    fontSize: 11,
    fontWeight: '900',
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
