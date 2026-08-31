import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
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
import { RemoteImage } from '../../components/RemoteImage';

import {
  deleteVendorMenuItem,
  removeVendorMenuItemPhoto,
  updateVendorMenuItem,
  updateVendorMenuItemPhoto,
} from '../../api/vendorApi';
import { useVendorApp } from '../../context/VendorAppContext';
import { MenuItem } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';
import { pickProductImage } from '../../utils/productImagePicker';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';
import { VendorAddProductScreen } from './VendorAddProductScreen';

type ProductsMode =
  | { screen: 'list' }
  | { screen: 'add' }
  | { screen: 'edit'; productId: number };

type ProductAvailabilityTab = 'online' | 'offline';

const PRODUCTS_PER_PAGE = 10;

interface VariantDraft {
  localId: string;
  id?: number;
  product_variant_id?: number | null;
  name: string;
  mrp: string;
  price: string;
  is_available: boolean;
}

interface EditProductFieldErrors {
  title?: string;
  mrp?: string;
  price?: string;
  variants?: string;
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
    updatingProductIds,
    error,
    refreshProducts,
    toggleProductActive,
  } = useVendorApp();

  const [mode, setMode] = useState<ProductsMode>({ screen: 'list' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [availabilityTab, setAvailabilityTab] = useState<ProductAvailabilityTab>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const productsListRef = useRef<FlatList<MenuItem>>(null);

  useAutoClearValue(actionError, () => setActionError(null));
  useAutoClearValue(actionSuccess, () => setActionSuccess(null));

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
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;

    return filteredProducts.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
  }, [currentPage, filteredProducts]);
  const visibleRangeStart = filteredProducts.length === 0
    ? 0
    : ((currentPage - 1) * PRODUCTS_PER_PAGE) + 1;
  const visibleRangeEnd = Math.min(currentPage * PRODUCTS_PER_PAGE, filteredProducts.length);

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);

    if (nextPage === currentPage) {
      return;
    }

    setCurrentPage(nextPage);
    productsListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [availabilityTab, searchQuery, selectedBuildingId, selectedCategory]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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

  if (mode.screen === 'add') {
    return (
      <VendorAddProductScreen
        onBack={() => setMode({ screen: 'list' })}
        onCreated={async () => {
          const refreshed = await refreshProducts({ force: true });
          setMode({ screen: 'list' });
          setAvailabilityTab('online');
          setSelectedCategory('All');
          setSearchQuery('');
          setActionSuccess('Product added successfully.');
          if (!refreshed) {
            setActionError('Product was added, but the list could not refresh. Pull down to try again.');
          }
        }}
      />
    );
  }

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
          const refreshed = await refreshProducts({ force: true });
          setMode({ screen: 'list' });
          if (!refreshed) {
            setActionError('Product was updated, but the list could not refresh. Pull down to try again.');
          }
        }}
        onProductImageChanged={async () => {
          await refreshProducts({ force: true });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        ref={productsListRef}
        data={paginatedProducts}
        keyExtractor={(product) => String(product.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={productsLoading}
            onRefresh={() => {
              void refreshProducts({ force: true });
            }}
          />
        }
        ListHeaderComponent={(
          <View style={styles.listHeader}>
            <View style={styles.headerRow}>
              <View style={styles.headerBlock}>
                <Text style={styles.screenTitle}>Products</Text>
                <Text style={styles.screenSubtitle}>
                  {`${activeCount} active products in your vendor menu`}
                </Text>
              </View>
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

            {actionSuccess ? (
              <View style={styles.successBox} accessibilityRole="alert">
                <Ionicons name="checkmark-circle" size={20} color="#16865a" />
                <Text style={styles.successText}>{actionSuccess}</Text>
              </View>
            ) : null}

            {!selectedBuilding ? <Text style={styles.emptyText}>No assigned building found for this vendor.</Text> : null}

            {selectedBuilding && products.length === 0 && !productsLoading ? (
              <Text style={styles.emptyText}>No menu items found for this building.</Text>
            ) : null}

            {selectedBuilding && products.length > 0 && filteredProducts.length === 0 ? (
              <Text style={styles.emptyText}>No products found in this filter.</Text>
            ) : null}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.productSeparator} />}
        ListFooterComponent={totalPages > 1 ? (
          <View style={styles.paginationContainer}>
            <Text style={styles.paginationSummary}>
              {`Showing ${visibleRangeStart}-${visibleRangeEnd} of ${filteredProducts.length}`}
            </Text>
            <View style={styles.paginationControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous products page"
                accessibilityState={{ disabled: currentPage === 1 }}
                disabled={currentPage === 1}
                onPress={() => goToPage(currentPage - 1)}
                style={({ pressed }) => [
                  styles.paginationButton,
                  currentPage === 1 ? styles.paginationButtonDisabled : null,
                  pressed && currentPage > 1 ? styles.paginationButtonPressed : null,
                ]}
              >
                <Ionicons name="chevron-back" size={19} color={currentPage === 1 ? '#b7b7bf' : tokens.colors.vendorPrimary} />
              </Pressable>

              <Text style={styles.paginationPageText}>{`${currentPage} / ${totalPages}`}</Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next products page"
                accessibilityState={{ disabled: currentPage === totalPages }}
                disabled={currentPage === totalPages}
                onPress={() => goToPage(currentPage + 1)}
                style={({ pressed }) => [
                  styles.paginationButton,
                  currentPage === totalPages ? styles.paginationButtonDisabled : null,
                  pressed && currentPage < totalPages ? styles.paginationButtonPressed : null,
                ]}
              >
                <Ionicons name="chevron-forward" size={19} color={currentPage === totalPages ? '#b7b7bf' : tokens.colors.vendorPrimary} />
              </Pressable>
            </View>
          </View>
        ) : null}
        renderItem={({ item: product }) => {
          const productKey = product.predefined_product_id ?? product.id;
          const isUpdating = updatingProductIds.includes(productKey);

          return (
          <View style={[styles.productCard, !product.is_available ? styles.productCardInactive : null]}>
            <View style={styles.mediaWrap}>
              {product.photo_url ? (
                <RemoteImage
                  accessibilityLabel={`${product.title} product image`}
                  uri={product.photo_url}
                  style={styles.productImage}
                />
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
                accessibilityRole="switch"
                accessibilityState={{ checked: product.is_available, disabled: isUpdating }}
                disabled={isUpdating}
                onPress={() => {
                  void toggleProductActive(product).catch((toggleError) => {
                    setActionError(toggleError instanceof Error ? toggleError.message : 'Could not update product.');
                  });
                }}
                style={[
                  styles.switchWrap,
                  product.is_available ? styles.switchWrapActive : styles.switchWrapInactive,
                  isUpdating ? styles.switchWrapUpdating : null,
                ]}
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
                    Alert.alert(
                      'Remove product?',
                      `${product.title} will be removed from your menu. Existing order history will stay safe.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => {
                            void deleteVendorMenuItem(product.id)
                              .then(() => refreshProducts({ force: true }))
                              .catch((deleteError) => {
                                setActionError(deleteError instanceof Error ? deleteError.message : 'Could not delete product.');
                              });
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={22} color="#df666c" />
                </Pressable>
              </View>
            </View>
          </View>
          );
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add product"
        hitSlop={8}
        style={({ pressed }) => [styles.floatingAddButton, pressed ? styles.floatingAddButtonPressed : null]}
        onPress={() => setMode({ screen: 'add' })}
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
  onProductImageChanged,
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
  onProductImageChanged: () => Promise<void>;
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
  const [photoSaving, setPhotoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<EditProductFieldErrors>({});

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
  const validateForm = (): boolean => {
    const nextErrors: EditProductFieldErrors = {};

    if (!titleInput.trim()) {
      nextErrors.title = 'Enter a product title.';
    }
    if (!priceInput.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      nextErrors.price = 'Enter a valid price greater than 0.';
    }
    if (mrpInput.trim() && (!Number.isFinite(parsedMrp) || (parsedMrp ?? 0) < 0)) {
      nextErrors.mrp = 'Enter a valid MRP or leave it blank.';
    }

    const hasInvalidVariant = variants.some((variant) => {
      const variantPrice = Number(variant.price);
      const variantMrp = variant.mrp.trim() === '' ? null : Number(variant.mrp);
      return (
        !variant.name.trim() ||
        !variant.price.trim() ||
        !Number.isFinite(variantPrice) ||
        variantPrice < 0 ||
        (variantMrp !== null && (!Number.isFinite(variantMrp) || variantMrp < 0))
      );
    });
    if (hasInvalidVariant) {
      nextErrors.variants = 'Complete the name and a valid price for every variant.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const updateVariant = (localId: string, patch: Partial<VariantDraft>): void => {
    if (fieldErrors.variants) {
      setFieldErrors((current) => ({ ...current, variants: undefined }));
    }
    setVariants((current) =>
      current.map((variant) => (variant.localId === localId ? { ...variant, ...patch } : variant)),
    );
  };

  const changePhoto = async (): Promise<void> => {
    if (photoSaving) return;
    setError(null);
    try {
      const selected = await pickProductImage();
      if (!selected) return;
      setPhotoSaving(true);
      await updateVendorMenuItemPhoto(product.id, selected);
      await onProductImageChanged();
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'Could not update product image.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const confirmRemovePhoto = (): void => {
    if (!product.photo_url || photoSaving) return;
    Alert.alert('Remove product image?', 'The product will use its default image if one is available.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPhotoSaving(true);
          setError(null);
          void removeVendorMenuItemPhoto(product.id)
            .then(onProductImageChanged)
            .catch((photoError) => {
              setError(photoError instanceof Error ? photoError.message : 'Could not remove product image.');
            })
            .finally(() => setPhotoSaving(false));
        },
      },
    ]);
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
              <RemoteImage
                accessibilityLabel={`${product.title} product image`}
                uri={product.photo_url}
                style={styles.editMediaImage}
              />
            ) : (
              <Ionicons name="fast-food-outline" size={26} color={tokens.colors.vendorPrimary} />
            )}
          </View>
          <View style={styles.editPhotoActions}>
            <Pressable
              style={[styles.editPhotoButton, photoSaving ? styles.controlDisabled : null]}
              disabled={photoSaving}
              onPress={() => void changePhoto()}
            >
              <Ionicons name="images-outline" size={17} color={tokens.colors.vendorPrimary} />
              <Text style={styles.editPhotoButtonText}>{photoSaving ? 'Saving...' : 'Change image'}</Text>
            </Pressable>
            {product.photo_url ? (
              <Pressable
                style={[styles.editPhotoRemoveButton, photoSaving ? styles.controlDisabled : null]}
                disabled={photoSaving}
                onPress={confirmRemovePhoto}
              >
                <Ionicons name="trash-outline" size={17} color={tokens.colors.danger} />
                <Text style={styles.editPhotoRemoveText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.editName}>{product.title}</Text>
          <Text style={styles.editCategory}>{productDisplayGroup(product)}</Text>

          <Text style={styles.inputLabel}>Product Title</Text>
          <TextInput
            value={titleInput}
            onChangeText={(value) => {
              setTitleInput(value);
              if (fieldErrors.title) setFieldErrors((current) => ({ ...current, title: undefined }));
            }}
            style={[styles.priceInput, fieldErrors.title ? styles.inputErrorBorder : null]}
            placeholder="Product title"
            placeholderTextColor="#9a9aa3"
          />
          {fieldErrors.title ? <Text style={styles.fieldErrorText}>{fieldErrors.title}</Text> : null}

          <Text style={styles.inputLabel}>MRP (₹)</Text>
          <TextInput
            value={mrpInput}
            onChangeText={(value) => {
              setMrpInput(value.replace(/[^0-9.]/g, ''));
              if (fieldErrors.mrp) setFieldErrors((current) => ({ ...current, mrp: undefined }));
            }}
            keyboardType="decimal-pad"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
            style={[styles.priceInput, fieldErrors.mrp ? styles.inputErrorBorder : null]}
            placeholder="Optional MRP"
            placeholderTextColor="#9a9aa3"
          />
          {fieldErrors.mrp ? <Text style={styles.fieldErrorText}>{fieldErrors.mrp}</Text> : null}

          <Text style={styles.inputLabel}>Default Discount Price (₹)</Text>
          <TextInput
            value={priceInput}
            onChangeText={(value) => {
              setPriceInput(value.replace(/[^0-9.]/g, ''));
              if (fieldErrors.price) setFieldErrors((current) => ({ ...current, price: undefined }));
            }}
            keyboardType="decimal-pad"
            onFocus={() => {
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 120);
            }}
            style={[styles.priceInput, fieldErrors.price ? styles.inputErrorBorder : null]}
            placeholder="Enter price"
            placeholderTextColor="#9a9aa3"
          />
          {fieldErrors.price ? <Text style={styles.fieldErrorText}>{fieldErrors.price}</Text> : null}

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
          {fieldErrors.variants ? <Text style={styles.fieldErrorText}>{fieldErrors.variants}</Text> : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ActionButton
          label={saving ? 'Updating...' : 'Update Price'}
          onPress={() => {
            if (saving) {
              return;
            }

            if (!validateForm()) {
              setError('Please correct the highlighted product details.');
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
          disabled={saving}
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
    paddingBottom: 104,
  },
  listHeader: {
    gap: 9,
    marginBottom: 9,
  },
  productSeparator: {
    height: 9,
  },
  paginationContainer: {
    minHeight: 62,
    marginTop: 14,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  paginationSummary: {
    flex: 1,
    color: '#777782',
    fontSize: 12,
    fontWeight: '700',
  },
  paginationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  paginationButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#ffd7bd',
    backgroundColor: '#fff7f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationButtonDisabled: {
    borderColor: '#e7e7eb',
    backgroundColor: '#f4f4f6',
  },
  paginationButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
  paginationPageText: {
    minWidth: 42,
    color: '#313139',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  keyboardContentGrow: {
    flexGrow: 1,
  },
  headerBlock: {
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  floatingAddButton: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#c65400',
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  floatingAddButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
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
  successBox: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: '#eaf8f1',
    borderWidth: 1,
    borderColor: '#bce8d2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  successText: {
    flex: 1,
    color: '#166b4c',
    fontSize: 13,
    fontWeight: '800',
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
  switchWrapUpdating: {
    opacity: 0.55,
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
  editPhotoActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  editPhotoButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#fff1e6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editPhotoButtonText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  editPhotoRemoveButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: '#fff0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editPhotoRemoveText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  controlDisabled: {
    opacity: 0.5,
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
  inputErrorBorder: {
    borderColor: tokens.colors.danger,
    backgroundColor: '#fff7f7',
  },
  fieldErrorText: {
    alignSelf: 'flex-start',
    color: tokens.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
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
