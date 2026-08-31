import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { useVendorApp } from '../../context/VendorAppContext';
import { BelowMinimumOrderMode, Building, BuildingOrderPolicyInput } from '../../types/vendor';
import { tokens } from '../shared/tokens';

type PricingMode = 'default' | 'free' | 'custom' | 'block';

function money(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function priceInput(value: string): string {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, 2);

  return decimalParts.length ? `${whole.slice(0, 6)}.${decimal}` : whole.slice(0, 6);
}

function buildingMode(building: Building): PricingMode {
  if (building.uses_default_order_policy) return 'default';
  if (building.below_minimum_order_mode_override === 'block_order') return 'block';
  if (building.below_minimum_order_mode_override === 'free_delivery') return 'free';
  if (building.below_minimum_order_mode_override === 'charge_delivery') return 'custom';
  if (building.delivery_charge_override === null) return 'default';
  return building.delivery_charge_override === 0 ? 'free' : 'custom';
}

function policyDetail(mode: BelowMinimumOrderMode, minimum: number, charge: number): string {
  if (mode === 'block_order') return `Orders below ₹${money(minimum)} are blocked`;
  if (mode === 'free_delivery') return 'No minimum or delivery charge';
  return `₹${money(charge)} delivery charge below ₹${money(minimum)}`;
}

export function VendorBuildingDeliveryPricingScreen({ onBack }: { onBack: () => void }) {
  const { buildings, profile, saveBuildingDeliveryCharge } = useVendorApp();
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [mode, setMode] = useState<PricingMode>('default');
  const [customCharge, setCustomCharge] = useState('');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const defaultCharge = profile?.delivery_charge ?? buildings[0]?.default_delivery_charge ?? 0;
  const threshold = profile?.minimum_order_value ?? 0;
  const defaultMode = profile?.below_minimum_order_mode ?? 'charge_delivery';
  const customCount = useMemo(
    () => buildings.filter((building) => !building.uses_default_order_policy).length,
    [buildings],
  );

  const openEditor = (building: Building): void => {
    const currentMode = buildingMode(building);
    setSelectedBuilding(building);
    setMode(currentMode);
    setCustomCharge(currentMode === 'custom' ? money(building.delivery_charge_override ?? 0) : '');
    setMinimumAmount(currentMode === 'block'
      ? money(building.minimum_order_value_override ?? building.effective_minimum_order_value)
      : '');
    setMessage(null);
    setError(null);
  };

  const closeEditor = (): void => {
    if (saving) return;
    Keyboard.dismiss();
    setTimeout(() => {
      setSelectedBuilding(null);
      setError(null);
    }, Platform.OS === 'android' ? 200 : 0);
  };

  const selectMode = (nextMode: PricingMode): void => {
    setMode(nextMode);
    setError(null);

    if (nextMode !== 'custom') {
      Keyboard.dismiss();
    }
  };

  const save = async (): Promise<void> => {
    if (!selectedBuilding || saving) return;

    let input: BuildingOrderPolicyInput = {
      delivery_charge_override: null,
      below_minimum_order_mode_override: null,
      minimum_order_value_override: null,
    };

    if (mode === 'free') {
      input = {
        delivery_charge_override: 0,
        below_minimum_order_mode_override: 'free_delivery',
        minimum_order_value_override: null,
      };
    } else if (mode === 'custom') {
      const parsed = Number(customCharge);
      if (!customCharge.trim() || !Number.isFinite(parsed) || parsed <= 0 || parsed > 9999.99) {
        setError('Enter a custom charge between ₹0.01 and ₹9,999.99. Use Free for ₹0.');
        return;
      }
      input = {
        delivery_charge_override: Math.round(parsed * 100) / 100,
        below_minimum_order_mode_override: 'charge_delivery',
        minimum_order_value_override: null,
      };
    } else if (mode === 'block') {
      const parsed = Number(minimumAmount);
      if (!minimumAmount.trim() || !Number.isFinite(parsed) || parsed < 1 || parsed > 999999.99) {
        setError('Enter a minimum order amount between ₹1 and ₹9,99,999.99.');
        return;
      }
      input = {
        delivery_charge_override: null,
        below_minimum_order_mode_override: 'block_order',
        minimum_order_value_override: Math.round(parsed * 100) / 100,
      };
    }

    setSaving(true);
    setError(null);
    try {
      await saveBuildingDeliveryCharge(selectedBuilding.id, input);
      setSelectedBuilding(null);
      setMessage(`${selectedBuilding.name} delivery pricing updated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update delivery pricing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={23} color="#22222a" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Delivery Pricing</Text>
            <Text style={styles.subtitle}>Set pricing or a minimum for each building</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="car-outline" size={25} color={tokens.colors.vendorPrimary} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryEyebrow}>VENDOR DEFAULT</Text>
            <Text style={styles.summaryValue}>
              {defaultMode === 'block_order'
                ? `Min ₹${money(threshold)}`
                : defaultMode === 'free_delivery'
                  ? 'Free'
                  : `₹${money(defaultCharge)}`}
            </Text>
            <Text style={styles.summaryNote}>
              {policyDetail(defaultMode, threshold, defaultCharge)} • {buildings.length - customCount} of {buildings.length} use default
            </Text>
          </View>
        </View>

        {message ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={20} color="#168c4e" />
            <Text style={styles.successText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Assigned Buildings</Text>
          <Text style={styles.sectionCount}>{buildings.length}</Text>
        </View>

        {buildings.length ? buildings.map((building) => {
          const currentMode = buildingMode(building);
          const effectiveMode = building.effective_below_minimum_order_mode;
          const badge = currentMode === 'default'
            ? 'DEFAULT'
            : currentMode === 'free'
              ? 'FREE'
              : currentMode === 'block'
                ? 'BLOCK'
                : 'CUSTOM';
          const amount = effectiveMode === 'block_order'
            ? `Minimum ₹${money(building.effective_minimum_order_value)}`
            : effectiveMode === 'free_delivery'
              ? 'Free delivery'
              : `₹${money(building.effective_delivery_charge)}`;
          const effectiveDetail = policyDetail(
            effectiveMode,
            building.effective_minimum_order_value,
            building.effective_delivery_charge,
          );
          const detail = currentMode === 'default'
            ? `Follows vendor default · ${effectiveDetail}`
            : effectiveDetail;

          return (
            <View key={building.id} style={styles.buildingCard}>
              <View style={styles.buildingTopRow}>
                <View style={styles.buildingIcon}>
                  <Ionicons name="business-outline" size={21} color="#5d6470" />
                </View>
                <View style={styles.buildingCopy}>
                  <Text numberOfLines={1} style={styles.buildingName}>{building.name}</Text>
                  {building.address ? <Text numberOfLines={1} style={styles.buildingAddress}>{building.address}</Text> : null}
                </View>
                <View style={[
                  styles.badge,
                  currentMode === 'free' ? styles.freeBadge : null,
                  currentMode === 'custom' ? styles.customBadge : null,
                  currentMode === 'block' ? styles.blockBadge : null,
                ]}>
                  <Text style={[
                    styles.badgeText,
                    currentMode === 'free' ? styles.freeBadgeText : null,
                    currentMode === 'custom' ? styles.customBadgeText : null,
                    currentMode === 'block' ? styles.blockBadgeText : null,
                  ]}>{badge}</Text>
                </View>
              </View>

              <View style={styles.buildingBottomRow}>
                <View style={styles.amountCopy}>
                  <Text style={styles.amount}>{amount}</Text>
                  <Text style={styles.amountDetail}>{detail}</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => openEditor(building)} style={styles.editButton}>
                  <Ionicons name="create-outline" size={16} color={tokens.colors.vendorPrimary} />
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              </View>
            </View>
          );
        }) : (
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={28} color="#9c9ca5" />
            <Text style={styles.emptyTitle}>No assigned buildings</Text>
            <Text style={styles.emptyText}>Ask an administrator to assign your vendor to a building.</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedBuilding} transparent animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.backdrop} onPress={closeEditor} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderCopy}>
                <Text style={styles.sheetTitle}>Building delivery rule</Text>
                <Text numberOfLines={1} style={styles.sheetSubtitle}>{selectedBuilding?.name}</Text>
              </View>
              <Pressable accessibilityRole="button" disabled={saving} onPress={closeEditor} style={styles.closeButton}>
                <Ionicons name="close" size={23} color="#565661" />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetScrollContent}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.sheetScroll}
            >
              <View style={styles.optionList}>
                <PriceOption
                  active={mode === 'default'}
                  icon="sync-outline"
                  title="Use vendor default"
                  detail={policyDetail(defaultMode, threshold, defaultCharge)}
                  onPress={() => selectMode('default')}
                />
                <PriceOption
                  active={mode === 'free'}
                  icon="gift-outline"
                  title="Free delivery"
                  detail="₹0 delivery charge for this building"
                  onPress={() => selectMode('free')}
                />
                <PriceOption
                  active={mode === 'block'}
                  icon="ban-outline"
                  title="Block low-value orders"
                  detail="Set a minimum order amount for this building"
                  onPress={() => selectMode('block')}
                />
                <PriceOption
                  active={mode === 'custom'}
                  icon="options-outline"
                  title="Custom charge"
                  detail="Set a different amount for this building"
                  onPress={() => selectMode('custom')}
                />
              </View>

              {mode === 'custom' ? (
                <View style={styles.customFieldWrap}>
                  <Text style={styles.customLabel}>Custom delivery charge</Text>
                  <View style={styles.customField}>
                    <Text style={styles.currency}>₹</Text>
                    <TextInput
                      autoFocus
                      editable={!saving}
                      keyboardType="decimal-pad"
                      placeholder="20.00"
                      placeholderTextColor="#a0a0a9"
                      value={customCharge}
                      onChangeText={(value) => setCustomCharge(priceInput(value))}
                      style={styles.customInput}
                    />
                  </View>
                </View>
              ) : null}

              {mode === 'block' ? (
                <View style={styles.customFieldWrap}>
                  <Text style={styles.customLabel}>Minimum order amount</Text>
                  <View style={styles.customField}>
                    <Text style={styles.currency}>₹</Text>
                    <TextInput
                      autoFocus
                      editable={!saving}
                      keyboardType="decimal-pad"
                      placeholder="90.00"
                      placeholderTextColor="#a0a0a9"
                      value={minimumAmount}
                      onChangeText={(value) => setMinimumAmount(priceInput(value))}
                      style={styles.customInput}
                    />
                  </View>
                  <Text style={styles.fieldHint}>Customers cannot place an order below this amount.</Text>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </ScrollView>

            <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="checkmark" size={20} color="#ffffff" />}
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Rule'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function PriceOption({
  active,
  icon,
  title,
  detail,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.option, active ? styles.optionActive : null]}>
      <View style={[styles.optionIcon, active ? styles.optionIconActive : null]}>
        <Ionicons name={icon} size={20} color={active ? tokens.colors.vendorPrimary : '#777782'} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, active ? styles.optionTitleActive : null]}>{title}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
      </View>
      <View style={[styles.radio, active ? styles.radioActive : null]}>{active ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.appBg },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 2 },
  backButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8e8ed' },
  headerCopy: { flex: 1 },
  title: { color: '#1d1d23', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#777782', fontSize: 13, fontWeight: '700', marginTop: 1 },
  summaryCard: { backgroundColor: '#fff7f0', borderRadius: 20, borderWidth: 1, borderColor: '#f2d2ba', padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 },
  summaryIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1 },
  summaryEyebrow: { color: '#a45a20', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  summaryValue: { color: '#24242b', fontSize: 27, fontWeight: '900', marginTop: 1 },
  summaryNote: { color: '#765f50', fontSize: 12, fontWeight: '700', marginTop: 2 },
  inactiveBanner: { backgroundColor: '#fff5db', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  inactiveText: { flex: 1, color: '#76521d', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  successBanner: { backgroundColor: '#e8f9ef', borderRadius: 14, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8 },
  successText: { flex: 1, color: '#167442', fontSize: 12, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  sectionTitle: { color: '#28282e', fontSize: 18, fontWeight: '900' },
  sectionCount: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: '#dedee3', color: '#676770', textAlign: 'center', textAlignVertical: 'center', fontSize: 12, fontWeight: '900', paddingTop: Platform.OS === 'ios' ? 4 : 0 },
  buildingCard: { backgroundColor: '#fff', borderRadius: 19, borderWidth: 1, borderColor: '#e4e4e9', padding: 13, gap: 12 },
  buildingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buildingIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#f1f1f4', alignItems: 'center', justifyContent: 'center' },
  buildingCopy: { flex: 1, minWidth: 0 },
  buildingName: { color: '#25252b', fontSize: 17, fontWeight: '900' },
  buildingAddress: { color: '#898993', fontSize: 11, fontWeight: '600', marginTop: 2 },
  badge: { borderRadius: 999, backgroundColor: '#eeeef2', paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: '#6c6c75', fontSize: 10, fontWeight: '900', letterSpacing: 0.35 },
  freeBadge: { backgroundColor: '#e7faef' },
  freeBadgeText: { color: '#168c4e' },
  customBadge: { backgroundColor: '#fff0e4' },
  customBadgeText: { color: '#c65b08' },
  blockBadge: { backgroundColor: '#ffebe9' },
  blockBadgeText: { color: '#c43f36' },
  buildingBottomRow: { borderTopWidth: 1, borderTopColor: '#eeeeF2', paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  amountCopy: { flex: 1, minWidth: 0 },
  amount: { color: '#292930', fontSize: 20, fontWeight: '900' },
  amountDetail: { color: '#8a8a94', fontSize: 11, fontWeight: '700', marginTop: 2 },
  editButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: '#f2c9aa', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { color: tokens.colors.vendorPrimary, fontSize: 13, fontWeight: '900' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 26, alignItems: 'center', gap: 7 },
  emptyTitle: { color: '#34343b', fontSize: 17, fontWeight: '900' },
  emptyText: { color: '#8b8b95', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,20,26,0.5)' },
  sheet: { maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 17, paddingTop: 9, paddingBottom: Platform.OS === 'ios' ? 32 : 20, gap: 13 },
  sheetHandle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 3, backgroundColor: '#dedee5', marginBottom: 2 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetHeaderCopy: { flex: 1 },
  sheetTitle: { color: '#202027', fontSize: 24, fontWeight: '900' },
  sheetSubtitle: { color: '#81818b', fontSize: 13, fontWeight: '700', marginTop: 1 },
  closeButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#f2f2f5', alignItems: 'center', justifyContent: 'center' },
  sheetScroll: { flexShrink: 1 },
  sheetScrollContent: { gap: 13, paddingBottom: 2 },
  optionList: { gap: 8 },
  option: { minHeight: 68, borderRadius: 16, borderWidth: 1, borderColor: '#e5e5ea', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionActive: { borderColor: '#f0aa74', backgroundColor: '#fff9f4' },
  optionIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#f1f1f4', alignItems: 'center', justifyContent: 'center' },
  optionIconActive: { backgroundColor: '#fff0e4' },
  optionCopy: { flex: 1 },
  optionTitle: { color: '#35353c', fontSize: 15, fontWeight: '900' },
  optionTitleActive: { color: '#bd570b' },
  optionDetail: { color: '#8a8a94', fontSize: 11, fontWeight: '700', marginTop: 2 },
  radio: { width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: '#c8c8cf', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: tokens.colors.vendorPrimary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: tokens.colors.vendorPrimary },
  customFieldWrap: { gap: 6 },
  customLabel: { color: '#34343b', fontSize: 13, fontWeight: '800' },
  customField: { height: 52, borderRadius: 15, borderWidth: 1, borderColor: '#e1e1e7', backgroundColor: '#f4f4f6', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency: { color: tokens.colors.vendorPrimary, fontSize: 20, fontWeight: '900' },
  customInput: { flex: 1, color: '#24242b', fontSize: 18, fontWeight: '800' },
  fieldHint: { color: '#85858f', fontSize: 11, lineHeight: 16, fontWeight: '700' },
  errorText: { color: '#d43f3a', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  saveButton: { height: 52, borderRadius: 16, backgroundColor: tokens.colors.vendorPrimary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveButtonDisabled: { opacity: 0.65 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
