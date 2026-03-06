import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ActionButton, IconOnlyButton, ModePill, SectionTitle } from '../shared/ui';
import { ProductCatalogItem } from '../../types/workflow';
import { tokens } from '../shared/tokens';

type ProductsMode =
  | { screen: 'list' }
  | { screen: 'edit'; productId: string }
  | { screen: 'add' };

export function VendorProductsScreen() {
  const {
    products,
    toggleProductActive,
    deleteProduct,
    updateProductPrice,
    addProductFromCatalog,
    availableCatalogItems,
  } = useAppWorkflow();

  const [mode, setMode] = useState<ProductsMode>({ screen: 'list' });

  if (mode.screen === 'edit') {
    const selectedProduct = products.find((item) => item.id === mode.productId);

    if (!selectedProduct) {
      setMode({ screen: 'list' });
      return null;
    }

    return (
      <EditPriceScreen
        productName={selectedProduct.name}
        category={selectedProduct.category}
        emoji={selectedProduct.emoji}
        initialPrice={selectedProduct.price}
        onBack={() => setMode({ screen: 'list' })}
        onSave={(nextPrice) => {
          updateProductPrice(selectedProduct.id, nextPrice);
          setMode({ screen: 'list' });
        }}
      />
    );
  }

  if (mode.screen === 'add') {
    return (
      <AddProductScreen
        catalog={availableCatalogItems()}
        onBack={() => setMode({ screen: 'list' })}
        onAdd={(catalogItem, price) => {
          addProductFromCatalog(catalogItem.id, price);
          setMode({ screen: 'list' });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Vendor — Products" />

        <SectionTitle title="Products" subtitle={`${products.filter((item) => item.isActive).length} active products`} />

        {products.map((product) => (
          <View key={product.id} style={[styles.productCard, !product.isActive ? styles.productCardInactive : null]}>
            <View style={styles.productTopRow}>
              <View style={styles.productMainWrap}>
                <View style={styles.emojiWrap}>
                  <Text style={styles.emoji}>{product.emoji}</Text>
                </View>

                <View style={styles.productTextWrap}>
                  <Text numberOfLines={1} style={[styles.productName, !product.isActive ? styles.productNameInactive : null]}>
                    {product.name}
                  </Text>
                  <Text style={styles.productCategory}>{product.category}</Text>
                </View>
              </View>

              <Pressable
                onPress={() => toggleProductActive(product.id)}
                style={[styles.switchWrap, product.isActive ? styles.switchWrapActive : styles.switchWrapInactive]}
              >
                <View style={[styles.switchDot, product.isActive ? styles.switchDotActive : styles.switchDotInactive]} />
              </Pressable>
            </View>

            <View style={styles.productBottomRow}>
              <View style={[styles.priceBadge, !product.isActive ? styles.priceBadgeInactive : null]}>
                <Text style={[styles.priceText, !product.isActive ? styles.priceTextInactive : null]}>₹{product.price}</Text>
              </View>

              <View style={styles.rightActions}>
                <IconOnlyButton onPress={() => setMode({ screen: 'edit', productId: product.id })} icon="create-outline" />
                <IconOnlyButton onPress={() => deleteProduct(product.id)} icon="trash-outline" tone="danger" />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable style={styles.fabButton} onPress={() => setMode({ screen: 'add' })}>
        <Ionicons name="add" size={30} color="#ffffff" />
      </Pressable>
    </View>
  );
}

interface EditPriceScreenProps {
  productName: string;
  category: string;
  emoji: string;
  initialPrice: number;
  onSave: (price: number) => void;
  onBack: () => void;
}

function EditPriceScreen({ productName, category, emoji, initialPrice, onSave, onBack }: EditPriceScreenProps) {
  const [priceInput, setPriceInput] = useState(String(initialPrice));

  const parsedPrice = Number(priceInput);
  const isValid = Number.isFinite(parsedPrice) && parsedPrice > 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ModePill text="🛵 Vendor — Products" />

        <View style={styles.topNavRow}>
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Ionicons name="close" size={20} color="#75757f" />
          </Pressable>
          <Text style={styles.editTitle}>Edit Price</Text>
        </View>

        <View style={styles.editCard}>
          <Text style={styles.editEmoji}>{emoji}</Text>
          <Text style={styles.editName}>{productName}</Text>
          <Text style={styles.editCategory}>{category}</Text>

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

        <ActionButton
          label="Update Price"
          onPress={() => {
            if (!isValid) {
              return;
            }

            onSave(parsedPrice);
          }}
          disabled={!isValid}
        />
      </ScrollView>
    </View>
  );
}

interface AddProductScreenProps {
  catalog: ProductCatalogItem[];
  onBack: () => void;
  onAdd: (selected: ProductCatalogItem, price: number) => void;
}

function AddProductScreen({ catalog, onBack, onAdd }: AddProductScreenProps) {
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(catalog[0]?.id ?? null);
  const [priceInput, setPriceInput] = useState('');

  const selectedItem = useMemo(
    () => catalog.find((item) => item.id === selectedCatalogId) ?? null,
    [catalog, selectedCatalogId],
  );

  const parsedPrice = Number(priceInput);
  const canSubmit = !!selectedItem && Number.isFinite(parsedPrice) && parsedPrice > 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Vendor — Products" />

        <View style={styles.topNavRow}>
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Ionicons name="close" size={20} color="#75757f" />
          </Pressable>
          <Text style={styles.editTitle}>Add Product</Text>
        </View>

        <Text style={styles.addSubtitle}>Select a product from admin's catalog</Text>

        {catalog.length === 0 ? (
          <View style={styles.emptyCatalogCard}>
            <Text style={styles.emptyCatalogText}>All available catalog products are already added.</Text>
          </View>
        ) : (
          catalog.map((item) => {
            const isSelected = item.id === selectedCatalogId;

            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedCatalogId(item.id)}
                style={[styles.catalogCard, isSelected ? styles.catalogCardSelected : null]}
              >
                <View style={styles.catalogMain}>
                  <Text style={styles.catalogEmoji}>{item.emoji}</Text>
                  <View style={styles.catalogTextWrap}>
                    <Text numberOfLines={1} style={styles.catalogName}>{item.name}</Text>
                    <Text style={styles.catalogCategory}>{item.category}</Text>
                  </View>
                </View>

                <View style={[styles.catalogSelectDot, isSelected ? styles.catalogSelectDotActive : null]}>
                  {isSelected ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                </View>
              </Pressable>
            );
          })
        )}

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
          label="Add Product"
          disabled={!canSubmit}
          onPress={() => {
            if (!selectedItem || !canSubmit) {
              return;
            }

            onAdd(selectedItem, parsedPrice);
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
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f2f2f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
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
    textDecorationLine: 'line-through',
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
  editEmoji: {
    fontSize: 46,
  },
  editName: {
    fontSize: 22,
    color: '#212127',
    fontWeight: '900',
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
  catalogTextWrap: {
    flex: 1,
  },
  catalogEmoji: {
    fontSize: 24,
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
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginTop: 2,
  },
});
