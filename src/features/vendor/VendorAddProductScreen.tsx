import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createVendorProduct,
  createVendorProductSubcategory,
  fetchVendorProductFormOptions,
} from '../../api/vendorApi';
import { ApiError } from '../../api/httpClient';
import {
  ProductCategoryOption,
  ProductImageAsset,
  VendorProductVariantInput,
} from '../../types/vendor';
import { pickProductImage } from '../../utils/productImagePicker';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';

interface VariantDraft {
  localId: string;
  name: string;
  mrp: string;
  price: string;
  gstRate: string;
  isAvailable: boolean;
}

interface VariantFieldErrors {
  name?: string;
  mrp?: string;
  price?: string;
  gstRate?: string;
}

interface ProductFormErrors {
  photo?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  mrp?: string;
  price?: string;
  gstRate?: string;
  variantsMessage?: string;
  variants: Record<string, VariantFieldErrors>;
}

type ProductFieldErrorKey = Exclude<keyof ProductFormErrors, 'variants'>;

const FORM_ERROR_SUMMARY = 'Please correct the highlighted product details.';

function emptyFormErrors(): ProductFormErrors {
  return { variants: {} };
}

function hasFormErrors(errors: ProductFormErrors): boolean {
  return Object.entries(errors).some(([key, value]) => (
    key === 'variants' ? Object.keys(value as Record<string, VariantFieldErrors>).length > 0 : !!value
  ));
}

function validationMessage(value: unknown): string | null {
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return typeof value === 'string' ? value : null;
}

function serverFormErrors(error: unknown, variants: VariantDraft[]): ProductFormErrors | null {
  if (!(error instanceof ApiError) || typeof error.payload !== 'object' || error.payload === null) {
    return null;
  }

  const payload = error.payload as { errors?: unknown };
  if (typeof payload.errors !== 'object' || payload.errors === null || Array.isArray(payload.errors)) {
    return null;
  }

  const result = emptyFormErrors();
  Object.entries(payload.errors as Record<string, unknown>).forEach(([field, rawMessage]) => {
    const message = validationMessage(rawMessage);
    if (!message) return;

    if (field === 'photo') result.photo = message;
    else if (field === 'name') result.name = message;
    else if (field === 'category_id') result.category = message;
    else if (field === 'subcategory_id') result.subcategory = message;
    else if (field === 'mrp') result.mrp = message;
    else if (field === 'price') result.price = message;
    else if (field === 'gst_rate') result.gstRate = message;
    else if (field === 'variants') result.variantsMessage = message;
    else {
      const variantMatch = field.match(/^variants\.(\d+)\.(name|mrp|price|gst_rate)$/);
      if (!variantMatch) return;

      const variant = variants[Number(variantMatch[1])];
      if (!variant) return;

      const key = variantMatch[2] === 'gst_rate' ? 'gstRate' : variantMatch[2] as keyof VariantFieldErrors;
      result.variants[variant.localId] = {
        ...result.variants[variant.localId],
        [key]: message,
      };
    }
  });

  return hasFormErrors(result) ? result : null;
}

type TextInputFocusHandler = NonNullable<React.ComponentProps<typeof TextInput>['onFocus']>;

function numberOrNull(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}

function decimalOnly(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole, ...decimals] = cleaned.split('.');
  return decimals.length > 0 ? `${whole}.${decimals.join('')}` : whole;
}

export function VendorAddProductScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => Promise<void>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const [categories, setCategories] = useState<ProductCategoryOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [mrp, setMrp] = useState('');
  const [price, setPrice] = useState('');
  const [gstRate, setGstRate] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [photo, setPhoto] = useState<ProductImageAsset | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProductFormErrors>(emptyFormErrors);

  const keepFocusedFieldVisible = useCallback<TextInputFocusHandler>((event): void => {
    const target: unknown = event.target;

    setTimeout(() => {
      if (Platform.OS === 'web' && typeof target === 'object' && target !== null && 'scrollIntoView' in target) {
        (target as { scrollIntoView: (options: { behavior: 'smooth'; block: 'center' }) => void })
          .scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (typeof target === 'number') {
        scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(target, 120, true);
      }
    }, Platform.OS === 'ios' ? 250 : 120);
  }, []);

  useAndroidBackHandler(() => {
    onBack();
    return true;
  }, { priority: 25 });

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    void fetchVendorProductFormOptions()
      .then((items) => {
        if (!active) return;
        setCategories(items);
        setCategoryId((currentCategoryId) => {
          if (currentCategoryId && items.some((item) => item.id === currentCategoryId)) {
            return currentCategoryId;
          }

          return items[0]?.id ?? null;
        });

        if (items.length === 0) {
          setError('No product category is configured for your vendor type. Please contact the administrator.');
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load product categories.');
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedSubcategory = selectedCategory?.subcategories.find((item) => item.id === subcategoryId) ?? null;
  const filteredSubcategories = useMemo(() => {
    const normalizedSearch = subcategorySearch.trim().toLowerCase();
    const items = selectedCategory?.subcategories ?? [];

    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) => item.name.toLowerCase().includes(normalizedSearch));
  }, [selectedCategory, subcategorySearch]);

  const parsedPrice = Number(price);
  const parsedMrp = numberOrNull(mrp);
  const parsedGst = numberOrNull(gstRate);
  const variantPayload = variants.map<VendorProductVariantInput>((variant) => ({
    name: variant.name.trim(),
    mrp: numberOrNull(variant.mrp),
    price: Number(variant.price),
    gst_rate: numberOrNull(variant.gstRate),
    is_available: variant.isAvailable,
  }));

  function clearValidationSummary(): void {
    setError((current) => current === FORM_ERROR_SUMMARY ? null : current);
  }

  function clearFieldError(field: ProductFieldErrorKey): void {
    clearValidationSummary();
    setFieldErrors((current) => current[field] ? { ...current, [field]: undefined } : current);
  }

  function clearVariantError(localId: string, field: keyof VariantFieldErrors): void {
    clearValidationSummary();
    setFieldErrors((current) => {
      if (!current.variants[localId]?.[field]) return current;
      const nextVariantErrors = { ...current.variants[localId], [field]: undefined };
      return {
        ...current,
        variants: { ...current.variants, [localId]: nextVariantErrors },
      };
    });
  }

  function validateProduct(): ProductFormErrors {
    const next = emptyFormErrors();

    if (!photo) next.photo = 'Choose a JPG, PNG, or WebP product image.';
    if (!name.trim()) next.name = 'Enter the product name.';
    if (!categoryId) next.category = 'No valid product category is available.';
    if (newSubcategory.trim()) {
      next.subcategory = 'Tap the + button to add this subcategory, or clear the typed name.';
    } else if (!subcategoryId) {
      next.subcategory = 'Choose or add a subcategory.';
    }

    if (price.trim() === '') next.price = 'Enter the final selling price.';
    else if (!Number.isFinite(parsedPrice) || parsedPrice < 1) next.price = 'Final price must be at least ₹1.';
    else if (parsedPrice > 9999.99) next.price = 'Final price cannot exceed ₹9,999.99.';

    if (mrp.trim() && (!Number.isFinite(parsedMrp) || (parsedMrp ?? -1) < 0)) {
      next.mrp = 'Enter a valid MRP.';
    } else if (parsedMrp !== null && parsedMrp > 9999.99) {
      next.mrp = 'MRP cannot exceed ₹9,999.99.';
    } else if (parsedMrp !== null && Number.isFinite(parsedPrice) && parsedPrice > parsedMrp) {
      next.price = 'Final price cannot be greater than MRP.';
    }

    if (gstRate.trim() && (!Number.isFinite(parsedGst) || (parsedGst ?? -1) < 0 || (parsedGst ?? 101) > 100)) {
      next.gstRate = 'GST rate must be between 0% and 100%.';
    }

    if (variants.length > 30) next.variantsMessage = 'A product can have a maximum of 30 variants.';
    const variantNameCounts = variantPayload.reduce<Record<string, number>>((counts, variant) => {
      const normalizedName = variant.name.toLowerCase();
      if (normalizedName) counts[normalizedName] = (counts[normalizedName] ?? 0) + 1;
      return counts;
    }, {});

    variants.forEach((variant, index) => {
      const payload = variantPayload[index];
      const errors: VariantFieldErrors = {};
      if (!payload.name) errors.name = 'Enter the variant name.';
      else if ((variantNameCounts[payload.name.toLowerCase()] ?? 0) > 1) errors.name = 'Variant names must be unique.';

      if (variant.price.trim() === '') errors.price = 'Enter the variant price.';
      else if (!Number.isFinite(payload.price) || payload.price < 0) errors.price = 'Enter a valid variant price.';
      else if (payload.price > 9999.99) errors.price = 'Variant price cannot exceed ₹9,999.99.';

      if (variant.mrp.trim() && (!Number.isFinite(payload.mrp) || (payload.mrp ?? -1) < 0)) {
        errors.mrp = 'Enter a valid variant MRP.';
      } else if (payload.mrp !== null && payload.mrp > 9999.99) {
        errors.mrp = 'Variant MRP cannot exceed ₹9,999.99.';
      } else if (payload.mrp !== null && Number.isFinite(payload.price) && payload.price > payload.mrp) {
        errors.price = 'Variant price cannot be greater than its MRP.';
      }

      if (variant.gstRate.trim() && (!Number.isFinite(payload.gst_rate) || (payload.gst_rate ?? -1) < 0 || (payload.gst_rate ?? 101) > 100)) {
        errors.gstRate = 'GST rate must be between 0% and 100%.';
      }

      if (Object.keys(errors).length > 0) next.variants[variant.localId] = errors;
    });

    return next;
  }

  function updateVariant(localId: string, patch: Partial<VariantDraft>): void {
    setVariants((current) => current.map((variant) => (
      variant.localId === localId ? { ...variant, ...patch } : variant
    )));
  }

  async function choosePhoto(): Promise<void> {
    setError(null);
    try {
      const selected = await pickProductImage();
      if (selected) {
        setPhoto(selected);
        clearFieldError('photo');
      }
    } catch (pickerError) {
      const message = pickerError instanceof Error ? pickerError.message : 'Could not choose image.';
      setFieldErrors((current) => ({ ...current, photo: message }));
      setError(FORM_ERROR_SUMMARY);
    }
  }

  async function addSubcategory(): Promise<void> {
    if (!categoryId || !newSubcategory.trim() || creatingSubcategory) return;
    setCreatingSubcategory(true);
    setError(null);
    try {
      const created = await createVendorProductSubcategory({
        category_id: categoryId,
        name: newSubcategory.trim(),
      });
      setCategories((current) => current.map((category) => (
        category.id === categoryId
          ? {
              ...category,
              subcategories: category.subcategories.some((item) => item.id === created.id)
                ? category.subcategories
                : [...category.subcategories, created].sort((a, b) => a.name.localeCompare(b.name)),
            }
          : category
      )));
      setSubcategoryId(created.id);
      setNewSubcategory('');
      setSubcategorySearch('');
      setSubcategoryOpen(false);
      clearFieldError('subcategory');
    } catch (subcategoryError) {
      const message = subcategoryError instanceof Error ? subcategoryError.message : 'Could not create subcategory.';
      setFieldErrors((current) => ({ ...current, subcategory: message }));
      setError(FORM_ERROR_SUMMARY);
    } finally {
      setCreatingSubcategory(false);
    }
  }

  async function submit(): Promise<void> {
    if (saving) return;

    const validationErrors = validateProduct();
    if (hasFormErrors(validationErrors)) {
      setFieldErrors(validationErrors);
      setError(FORM_ERROR_SUMMARY);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!photo || !categoryId || !subcategoryId) return;

    Keyboard.dismiss();
    setSaving(true);
    setError(null);
    setFieldErrors(emptyFormErrors());
    try {
      await createVendorProduct({
        name: name.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        mrp: parsedMrp,
        price: parsedPrice,
        gst_rate: parsedGst,
        photo,
        is_available: isAvailable,
        variants: variantPayload,
      });
      await onCreated();
    } catch (saveError) {
      const apiFieldErrors = serverFormErrors(saveError, variants);
      if (apiFieldErrors) {
        setFieldErrors(apiFieldErrors);
        setError(FORM_ERROR_SUMMARY);
      } else {
        setError(saveError instanceof Error ? saveError.message : 'Could not create product.');
      }
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.navRow}>
          <Pressable style={styles.iconButton} onPress={onBack} accessibilityLabel="Close add product">
            <Ionicons name="close" size={22} color="#666874" />
          </Pressable>
          <View style={styles.navText}>
            <Text style={styles.title}>Add Product</Text>
            <Text style={styles.subtitle}>It will be added to all your assigned buildings.</Text>
            <Text style={styles.requiredNote}>Required: product image, product name, subcategory and final price.</Text>
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Product image</Text>
          <Text style={styles.helper}>Required · JPG, PNG or WebP · maximum 5 MB</Text>
          <Pressable
            style={[
              styles.photoPicker,
              photo ? styles.photoPickerSelected : styles.photoPickerEmpty,
              fieldErrors.photo ? styles.invalidControl : null,
            ]}
            onPress={() => void choosePhoto()}
          >
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={32} color={tokens.colors.vendorPrimary} />
                <Text style={styles.photoPlaceholderTitle}>Choose product image</Text>
                <Text style={styles.photoPlaceholderText}>Square image works best</Text>
              </View>
            )}
          </Pressable>
          <InlineError message={fieldErrors.photo} />
          {photo ? (
            <View style={styles.photoActions}>
              <Pressable style={styles.softButton} onPress={() => void choosePhoto()}>
                <Ionicons name="images-outline" size={17} color={tokens.colors.vendorPrimary} />
                <Text style={styles.softButtonText}>Change</Text>
              </Pressable>
              <Pressable
                style={styles.removeButton}
                onPress={() => {
                  setPhoto(null);
                  clearFieldError('photo');
                }}
              >
                <Ionicons name="trash-outline" size={17} color={tokens.colors.danger} />
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic details</Text>
          <Field
            label="Product name *"
            value={name}
            onChangeText={(value) => {
              setName(value);
              clearFieldError('name');
            }}
            onFocus={keepFocusedFieldVisible}
            placeholder="Example: Masala Tea"
            maxLength={120}
            error={fieldErrors.name}
          />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Short product description"
            maxLength={255}
            multiline
            onFocus={keepFocusedFieldVisible}
            inputStyle={styles.multilineInput}
          />

          <Text style={styles.label}>Subcategory *</Text>
          <Text style={styles.helper}>Choose an existing one, or type a new name and tap + to add it.</Text>
          <Pressable
            style={[
              styles.selectButton,
              !selectedCategory ? styles.disabledControl : null,
              (fieldErrors.category || fieldErrors.subcategory) ? styles.invalidControl : null,
            ]}
            onPress={() => {
              if (!selectedCategory) return;
              setSubcategoryOpen((current) => {
                if (current) setSubcategorySearch('');
                return !current;
              });
            }}
            disabled={optionsLoading || !selectedCategory}
          >
            {optionsLoading ? <ActivityIndicator size="small" color={tokens.colors.vendorPrimary} /> : null}
            <Text style={[styles.selectText, !selectedSubcategory ? styles.placeholderText : null]}>
              {selectedSubcategory?.name ?? (optionsLoading ? 'Loading subcategories...' : 'Choose or add subcategory')}
            </Text>
            <Ionicons name={subcategoryOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#777986" />
          </Pressable>
          {subcategoryOpen && selectedCategory ? (
            <View style={styles.optionList}>
              <View style={styles.subcategorySearchBox}>
                <Ionicons name="search-outline" size={18} color="#8b8d97" />
                <TextInput
                  value={subcategorySearch}
                  onChangeText={setSubcategorySearch}
                  placeholder="Search subcategory"
                  placeholderTextColor="#999ba6"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={keepFocusedFieldVisible}
                  style={styles.subcategorySearchInput}
                />
                {subcategorySearch ? (
                  <Pressable onPress={() => setSubcategorySearch('')} hitSlop={8} accessibilityLabel="Clear subcategory search">
                    <Ionicons name="close-circle" size={18} color="#9b9da7" />
                  </Pressable>
                ) : null}
              </View>
              {filteredSubcategories.map((subcategory) => (
                <Pressable
                  key={subcategory.id}
                  style={[styles.optionRow, subcategory.id === subcategoryId ? styles.optionRowSelected : null]}
                  onPress={() => {
                    setSubcategoryId(subcategory.id);
                    setNewSubcategory('');
                    setSubcategorySearch('');
                    setSubcategoryOpen(false);
                    clearFieldError('subcategory');
                  }}
                >
                  <Text style={styles.optionText}>{subcategory.name}</Text>
                  {subcategory.id === subcategoryId ? <Ionicons name="checkmark-circle" size={19} color={tokens.colors.vendorPrimary} /> : null}
                </Pressable>
              ))}
              {filteredSubcategories.length === 0 && subcategorySearch.trim() ? (
                <Text style={styles.noSearchResults}>No matching subcategory found.</Text>
              ) : null}
            </View>
          ) : null}

          {selectedCategory ? (
            <View style={styles.addSubcategoryRow}>
              <TextInput
                value={newSubcategory}
                onChangeText={(value) => {
                  setNewSubcategory(value);
                  clearFieldError('subcategory');
                }}
                placeholder="New subcategory name"
                placeholderTextColor="#999ba6"
                maxLength={80}
                onFocus={keepFocusedFieldVisible}
                style={[styles.addSubcategoryInput, fieldErrors.subcategory ? styles.invalidControl : null]}
                returnKeyType="done"
                onSubmitEditing={() => void addSubcategory()}
              />
              <Pressable
                style={[styles.addSubcategoryButton, (!newSubcategory.trim() || creatingSubcategory) ? styles.disabledControl : null]}
                disabled={!newSubcategory.trim() || creatingSubcategory}
                onPress={() => void addSubcategory()}
              >
                {creatingSubcategory
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Ionicons name="add" size={20} color="#ffffff" />}
              </Pressable>
            </View>
          ) : null}
          <InlineError message={fieldErrors.category ?? fieldErrors.subcategory} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Price and availability</Text>
          <View style={styles.twoColumnRow}>
            <View style={styles.column}>
              <Field
                label="MRP (₹)"
                labelStyle={styles.priceFieldLabel}
                value={mrp}
                onChangeText={(value) => {
                  setMrp(decimalOnly(value));
                  clearFieldError('mrp');
                  clearFieldError('price');
                }}
                onFocus={keepFocusedFieldVisible}
                placeholder="Optional"
                keyboardType="decimal-pad"
                error={fieldErrors.mrp}
              />
            </View>
            <View style={styles.column}>
              <Field
                label="Discounted / Final Price (₹) *"
                labelStyle={styles.priceFieldLabel}
                value={price}
                onChangeText={(value) => {
                  setPrice(decimalOnly(value));
                  clearFieldError('price');
                }}
                onFocus={keepFocusedFieldVisible}
                placeholder="0"
                keyboardType="decimal-pad"
                error={fieldErrors.price}
              />
            </View>
          </View>
          <Field
            label="GST rate (%)"
            value={gstRate}
            onChangeText={(value) => {
              setGstRate(decimalOnly(value));
              clearFieldError('gstRate');
            }}
            onFocus={keepFocusedFieldVisible}
            placeholder="Optional"
            keyboardType="decimal-pad"
            error={fieldErrors.gstRate}
          />
          <View style={styles.onlineRow}>
            <View>
              <Text style={styles.onlineTitle}>Product online</Text>
              <Text style={styles.helper}>Customers can order it immediately.</Text>
            </View>
            <Toggle value={isAvailable} onChange={setIsAvailable} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.navText}>
              <Text style={styles.sectionTitle}>Variants</Text>
              <Text style={styles.helper}>Optional sizes, packs or flavours</Text>
            </View>
            <Pressable
              style={styles.addVariantButton}
              onPress={() => {
                clearFieldError('variantsMessage');
                setVariants((current) => [...current, {
                  localId: `variant-${Date.now()}-${current.length}`,
                  name: '',
                  mrp: '',
                  price: '',
                  gstRate: '',
                  isAvailable: true,
                }]);
              }}
            >
              <Ionicons name="add" size={18} color="#ffffff" />
              <Text style={styles.addVariantText}>Add</Text>
            </Pressable>
          </View>
          <InlineError message={fieldErrors.variantsMessage} />
          {variants.length === 0 ? <Text style={styles.emptyVariants}>No variants added. Default price will be used.</Text> : null}
          {variants.map((variant, index) => (
            <View key={variant.localId} style={styles.variantCard}>
              <View style={styles.variantHeader}>
                <Text style={styles.variantTitle}>{variant.name.trim() || `Variant ${index + 1}`}</Text>
                <View style={styles.variantActions}>
                  <Toggle value={variant.isAvailable} onChange={(value) => updateVariant(variant.localId, { isAvailable: value })} compact />
                  <Pressable
                    style={styles.variantDelete}
                    onPress={() => {
                      setVariants((current) => current.filter((item) => item.localId !== variant.localId));
                      setFieldErrors((current) => {
                        const nextVariants = { ...current.variants };
                        delete nextVariants[variant.localId];
                        return { ...current, variants: nextVariants };
                      });
                    }}
                  >
                    <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
                  </Pressable>
                </View>
              </View>
              <Field
                label="Variant name *"
                value={variant.name}
                onChangeText={(value) => {
                  updateVariant(variant.localId, { name: value });
                  clearVariantError(variant.localId, 'name');
                }}
                onFocus={keepFocusedFieldVisible}
                placeholder="Example: Large"
                maxLength={80}
                error={fieldErrors.variants[variant.localId]?.name}
              />
              <View style={styles.twoColumnRow}>
                <View style={styles.column}>
                  <Field
                    label="MRP"
                    value={variant.mrp}
                    onChangeText={(value) => {
                      updateVariant(variant.localId, { mrp: decimalOnly(value) });
                      clearVariantError(variant.localId, 'mrp');
                      clearVariantError(variant.localId, 'price');
                    }}
                    onFocus={keepFocusedFieldVisible}
                    placeholder="Optional"
                    keyboardType="decimal-pad"
                    error={fieldErrors.variants[variant.localId]?.mrp}
                  />
                </View>
                <View style={styles.column}>
                  <Field
                    label="Price *"
                    value={variant.price}
                    onChangeText={(value) => {
                      updateVariant(variant.localId, { price: decimalOnly(value) });
                      clearVariantError(variant.localId, 'price');
                    }}
                    onFocus={keepFocusedFieldVisible}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    error={fieldErrors.variants[variant.localId]?.price}
                  />
                </View>
              </View>
              <Field
                label="GST rate (%)"
                value={variant.gstRate}
                onChangeText={(value) => {
                  updateVariant(variant.localId, { gstRate: decimalOnly(value) });
                  clearVariantError(variant.localId, 'gstRate');
                }}
                onFocus={keepFocusedFieldVisible}
                placeholder="Uses product GST"
                keyboardType="decimal-pad"
                error={fieldErrors.variants[variant.localId]?.gstRate}
              />
            </View>
          ))}
        </View>

        <ActionButton
          label={saving ? 'Adding Product...' : 'Add Product'}
          icon="add-circle-outline"
          disabled={saving}
          onPress={() => void submit()}
        />
      </ScrollView>

      <Modal
        visible={saving}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => undefined}
      >
        <View style={styles.savingOverlay} accessibilityViewIsModal accessibilityLiveRegion="polite">
          <View style={styles.savingCard}>
            <View style={styles.savingSpinner}>
              <ActivityIndicator size="large" color={tokens.colors.vendorPrimary} />
            </View>
            <Text style={styles.savingTitle}>Adding product...</Text>
            <Text style={styles.savingMessage}>Uploading the image and saving product details. Please wait.</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  labelStyle,
  inputStyle,
  error,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  labelStyle?: object;
  inputStyle?: object;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, labelStyle]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#999ba6"
        style={[styles.input, error ? styles.invalidControl : null, inputStyle]}
      />
      <InlineError message={error} />
    </View>
  );
}

function InlineError({ message }: { message?: string }) {
  return message ? <Text style={styles.inlineError}>{message}</Text> : null;
}

function Toggle({ value, onChange, compact = false }: { value: boolean; onChange: (value: boolean) => void; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[styles.toggle, compact ? styles.toggleCompact : null, value ? styles.toggleOn : styles.toggleOff]}
    >
      <View style={[styles.toggleDot, compact ? styles.toggleDotCompact : null]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100, gap: 12 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navText: { flex: 1, minWidth: 0 },
  iconButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#eceef2', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#202128', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#7d7f8b', fontSize: 12, fontWeight: '600', marginTop: 2 },
  requiredNote: { color: '#575965', fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 5 },
  errorBox: { borderRadius: 12, padding: 11, backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#ffd4d6' },
  errorText: { color: tokens.colors.danger, fontSize: 13, fontWeight: '800' },
  card: { borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e8e9ee', padding: 14, gap: 11 },
  sectionTitle: { color: '#22232a', fontSize: 18, fontWeight: '900' },
  helper: { color: '#858793', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  photoPicker: { borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#ffc79d', backgroundColor: '#fff8f2' },
  photoPickerEmpty: { width: '100%', height: 138 },
  photoPickerSelected: { width: 84, height: 84, borderRadius: 20, alignSelf: 'center' },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  photoPlaceholderTitle: { color: '#34353c', fontSize: 15, fontWeight: '900' },
  photoPlaceholderText: { color: '#8b8d97', fontSize: 12, fontWeight: '600' },
  photoActions: { flexDirection: 'row', gap: 9 },
  softButton: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: '#fff1e6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  softButtonText: { color: tokens.colors.vendorPrimary, fontSize: 13, fontWeight: '900' },
  removeButton: { flex: 1, minHeight: 40, borderRadius: 12, backgroundColor: '#fff0f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  removeButtonText: { color: tokens.colors.danger, fontSize: 13, fontWeight: '900' },
  field: { gap: 6 },
  label: { color: '#41434c', fontSize: 13, fontWeight: '800' },
  input: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#e1e3e9', backgroundColor: '#f7f8fa', paddingHorizontal: 13, color: '#25262d', fontSize: 14, fontWeight: '700' },
  invalidControl: { borderColor: tokens.colors.danger, backgroundColor: '#fff8f8' },
  inlineError: { color: tokens.colors.danger, fontSize: 12, lineHeight: 16, fontWeight: '700' },
  multilineInput: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  selectButton: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: '#e1e3e9', backgroundColor: '#f7f8fa', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectText: { flex: 1, color: '#25262d', fontSize: 14, fontWeight: '800' },
  placeholderText: { color: '#999ba6' },
  optionList: { borderWidth: 1, borderColor: '#e3e4e9', borderRadius: 13, overflow: 'hidden' },
  subcategorySearchBox: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f7f8fa', borderBottomWidth: 1, borderBottomColor: '#e3e4e9' },
  subcategorySearchInput: { flex: 1, minWidth: 0, color: '#303139', fontSize: 13, fontWeight: '700', paddingVertical: 10 },
  noSearchResults: { color: '#8b8d97', fontSize: 12, fontWeight: '700', textAlign: 'center', paddingHorizontal: 12, paddingVertical: 16 },
  optionRow: { minHeight: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e9ed' },
  optionRowSelected: { backgroundColor: '#fff5ed' },
  optionText: { color: '#363740', fontSize: 13, fontWeight: '800' },
  disabledControl: { opacity: 0.5 },
  addSubcategoryRow: { flexDirection: 'row', gap: 8 },
  addSubcategoryInput: { flex: 1, height: 44, borderRadius: 13, borderWidth: 1, borderColor: '#e1e3e9', backgroundColor: '#f7f8fa', paddingHorizontal: 13, color: '#25262d', fontWeight: '700' },
  addSubcategoryButton: { width: 46, height: 44, borderRadius: 13, backgroundColor: tokens.colors.vendorPrimary, alignItems: 'center', justifyContent: 'center' },
  twoColumnRow: { flexDirection: 'row', gap: 9 },
  column: { flex: 1, minWidth: 0 },
  priceFieldLabel: { minHeight: 34 },
  onlineRow: { minHeight: 58, borderRadius: 14, borderWidth: 1, borderColor: '#e8e9ed', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  onlineTitle: { color: '#2b2c33', fontSize: 14, fontWeight: '900' },
  toggle: { width: 50, height: 29, borderRadius: 15, paddingHorizontal: 4, justifyContent: 'center' },
  toggleCompact: { width: 43, height: 26 },
  toggleOn: { backgroundColor: tokens.colors.vendorPrimary, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: '#d8dae0', alignItems: 'flex-start' },
  toggleDot: { width: 21, height: 21, borderRadius: 11, backgroundColor: '#ffffff' },
  toggleDotCompact: { width: 18, height: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  addVariantButton: { minHeight: 38, borderRadius: 13, paddingHorizontal: 12, backgroundColor: tokens.colors.vendorPrimary, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addVariantText: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  emptyVariants: { color: '#858793', fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  variantCard: { borderRadius: 15, borderWidth: 1, borderColor: '#e4e5ea', backgroundColor: '#fafafa', padding: 11, gap: 10 },
  variantHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  variantTitle: { flex: 1, color: '#31323a', fontSize: 14, fontWeight: '900' },
  variantActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  variantDelete: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  validationHint: { color: '#8a5d39', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  savingOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: 'rgba(22, 23, 28, 0.48)' },
  savingCard: { width: '100%', maxWidth: 330, borderRadius: 22, backgroundColor: '#ffffff', paddingHorizontal: 24, paddingVertical: 26, alignItems: 'center', gap: 10, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  savingSpinner: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff3e9', marginBottom: 2 },
  savingTitle: { color: '#25262d', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  savingMessage: { color: '#777986', fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
});
