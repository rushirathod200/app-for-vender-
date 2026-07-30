import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createVendorManualOfficeOrder, fetchVendorManualOffices } from '../../api/vendorApi';
import { useVendorApp } from '../../context/VendorAppContext';
import { Building, ManualOfficeDirectoryItem, ManualOfficePaymentMethod } from '../../types/vendor';
import { formatCurrency } from '../../utils/format';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { useDebouncedValue } from '../../utils/useDebouncedValue';
import { ActionButton, Field, QuantityStepper, SectionTitle } from '../shared/ui';
import { tokens } from '../shared/tokens';

export function VendorManualOrderScreen() {
  const { buildings, profile } = useVendorApp();
  const scrollRef = useRef<ScrollView | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [offices, setOffices] = useState<ManualOfficeDirectoryItem[]>([]);
  const [availableBuildings, setAvailableBuildings] = useState<Building[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<ManualOfficeDirectoryItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ManualOfficePaymentMethod>('cash');
  const [teaQty, setTeaQty] = useState(0);
  const [coffeeQty, setCoffeeQty] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query, 350);

  useAutoClearValue(error, () => setError(null));
  useAutoClearValue(message, () => setMessage(null));

  const buildingOptions = availableBuildings.length ? availableBuildings : buildings;
  const teaPrice = profile?.quick_request_tea_price ?? 0;
  const coffeePrice = profile?.quick_request_coffee_price ?? 0;
  const totalPreview = useMemo(() => {
    return (teaQty * teaPrice) + (coffeeQty * coffeePrice);
  }, [coffeePrice, coffeeQty, teaPrice, teaQty]);
  const hasSearchQuery = query.trim().length > 0;
  const compactResults = hasSearchQuery ? offices.slice(0, 6) : [];
  const officeWalletAvailable = Boolean(selectedOffice?.office_wallet_available);
  const officeWalletBalance = selectedOffice?.office_wallet_balance ?? 0;
  const officeWalletCreditEnabled = selectedOffice?.office_wallet_credit_enabled ?? false;
  const walletBalanceShort =
    paymentMethod === 'office_wallet' && totalPreview > officeWalletBalance && !officeWalletCreditEnabled;
  const walletShortfall = Math.max(totalPreview - officeWalletBalance, 0);
  const officeWalletSelectionBlocked = paymentMethod === 'office_wallet' && !officeWalletAvailable;

  useEffect(() => {
    if (!buildingOptions.length) {
      setSelectedBuildingId(undefined);
      return;
    }

    if (!selectedBuildingId || !buildingOptions.some((building) => building.id === selectedBuildingId)) {
      setSelectedBuildingId(buildingOptions[0].id);
    }
  }, [buildingOptions, selectedBuildingId]);

  useEffect(() => {
    void loadOffices();
  }, [selectedBuildingId, debouncedQuery]);

  function handleQueryChange(value: string): void {
    setQuery(value.replace(/\D/g, '').slice(0, 8));
  }

  function scrollToEntryFields(): void {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

  async function loadOffices(options?: { preserveSelection?: boolean }): Promise<void> {
    const preserveSelection = options?.preserveSelection ?? true;
    setLoading(true);
    setError(null);

    try {
        const data = await fetchVendorManualOffices({
          buildingId: selectedBuildingId,
          query: debouncedQuery,
        });
      setOffices(data.results);
      setAvailableBuildings(data.buildings);

      if (preserveSelection && selectedOffice) {
        const refreshedSelected =
          [...data.recent, ...data.results].find((office) => office.office_id === selectedOffice.office_id) ?? selectedOffice;
        setSelectedOffice(refreshedSelected);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load offices.');
    } finally {
      setLoading(false);
    }
  }

  async function saveManualOrder(): Promise<void> {
    if (!selectedOffice) {
      setError('Select an office first.');
      return;
    }

    if (teaQty + coffeeQty <= 0) {
      setError('Add at least one tea or coffee.');
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const receipt = await createVendorManualOfficeOrder({
        office_id: selectedOffice.office_id,
        tea_qty: teaQty,
        coffee_qty: coffeeQty,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
      });

      setMessage(
        receipt
          ? receipt.entry.payment_method === 'office_wallet'
            ? `Saved ${selectedOffice.office_name}. ${formatCurrency(receipt.entry.paid_amount)} cut from office wallet.`
            : receipt.entry.payment_method === 'pending'
              ? `Saved ${selectedOffice.office_name}. ${formatCurrency(receipt.entry.pending_amount)} recorded as pending.`
              : `Saved ${selectedOffice.office_name}. Cash entry recorded for ${formatCurrency(receipt.entry.total_amount)}.`
          : 'Manual office order saved.',
      );
      setSelectedOffice(null);
      setPaymentMethod('cash');
      setQuery('');
      setTeaQty(0);
      setCoffeeQty(0);
      setNotes('');
      await loadOffices({ preserveSelection: false });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save manual order.');
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
        contentContainerStyle={[styles.content, styles.contentGrow]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SectionTitle title="Manual Orders" subtitle="Search office, select it, then enter tea and coffee" />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Office</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {buildingOptions.map((building) => {
              const isActive = selectedBuildingId === building.id;
              return (
                <Pressable
                  key={building.id}
                  onPress={() => {
                    setSelectedBuildingId(building.id);
                    setSelectedOffice(null);
                    setPaymentMethod('cash');
                    setQuery('');
                  }}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : null]}
                >
                  <Text style={[styles.filterChipText, isActive ? styles.filterChipTextActive : null]}>
                    {building.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {!selectedOffice ? (
            <View style={styles.searchArea}>
              <Field
                label="Search Office"
                icon="search-outline"
                value={query}
                onChangeText={handleQueryChange}
                placeholder="Search office number like 202"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {compactResults.length ? (
                <View style={styles.compactResultList}>
                  {compactResults.map((office) => (
                    <Pressable
                      key={`${query ? 'search' : 'recent'}-${office.office_id}`}
                      onPress={() => {
                        setSelectedOffice(office);
                        setPaymentMethod('cash');
                        setQuery('');
                      }}
                      style={styles.compactResultItem}
                    >
                      <View style={styles.compactResultBody}>
                        <Text style={styles.compactResultTitle}>Office {office.office_name}</Text>
                        <Text style={styles.compactResultText}>{office.label}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : hasSearchQuery ? (
                <Text style={styles.emptyText}>{loading ? 'Loading offices...' : 'No office match found.'}</Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.selectedOfficeCard}>
              <View style={styles.selectedOfficeTop}>
                <View style={styles.selectedOfficeBody}>
                  <Text style={styles.selectedOfficeLabel}>Selected Office</Text>
                  <Text style={styles.selectedOfficeTitle}>Office {selectedOffice.office_name}</Text>
                  <Text style={styles.selectedOfficeText}>{selectedOffice.label}</Text>
                </View>
                <Pressable
                  style={styles.changeButton}
                  onPress={() => {
                    setSelectedOffice(null);
                    setPaymentMethod('cash');
                    setQuery('');
                  }}
                >
                  <Text style={styles.changeButtonText}>Change</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tea and Coffee Entry</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>Tea: {formatCurrency(teaPrice)}</Text>
            <Text style={styles.priceText}>Coffee: {formatCurrency(coffeePrice)}</Text>
          </View>

          {officeWalletAvailable ? (
            <View style={styles.paymentSection}>
              <Text style={styles.paymentLabel}>Payment</Text>
              <View style={styles.paymentRow}>
                <Pressable
                  onPress={() => setPaymentMethod('pending')}
                  style={[styles.paymentChip, paymentMethod === 'pending' ? styles.paymentChipActive : null]}
                >
                  <Text style={[styles.paymentChipText, paymentMethod === 'pending' ? styles.paymentChipTextActive : null]}>
                    Pending Amount
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPaymentMethod('office_wallet')}
                  style={[styles.paymentChip, paymentMethod === 'office_wallet' ? styles.paymentChipActive : null]}
                >
                  <Text
                    style={[
                      styles.paymentChipText,
                      paymentMethod === 'office_wallet' ? styles.paymentChipTextActive : null,
                    ]}
                  >
                    Cut Office Wallet
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.paymentHint}>Wallet balance: {formatCurrency(officeWalletBalance)}</Text>
              {paymentMethod === 'office_wallet' && officeWalletCreditEnabled && totalPreview > officeWalletBalance ? (
                <Text style={styles.messageText}>
                  Credit is ON. This office wallet can go to {formatCurrency(officeWalletBalance - totalPreview)}.
                </Text>
              ) : walletBalanceShort ? (
                <Text style={styles.errorText}>Need {formatCurrency(walletShortfall)} more in office wallet.</Text>
              ) : paymentMethod === 'office_wallet' ? (
                <Text style={styles.messageText}>This amount will be cut now from the office wallet.</Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.inlineRow}>
            <View style={styles.inlineField}>
              <QuantityStepper
                label="Tea Qty"
                value={teaQty}
                onChange={setTeaQty}
                tone="vendor"
              />
            </View>
            <View style={styles.inlineField}>
              <QuantityStepper
                label="Coffee Qty"
                value={coffeeQty}
                onChange={setCoffeeQty}
                tone="vendor"
              />
            </View>
          </View>

          <Field
            label="Notes"
            icon="create-outline"
            value={notes}
            onChangeText={setNotes}
            onFocus={scrollToEntryFields}
            placeholder="Optional note for this office entry"
          />

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>
              {paymentMethod === 'office_wallet' ? 'Wallet Charge Preview' : 'Pending Amount Preview'}
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(totalPreview)}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {message ? <Text style={styles.messageText}>{message}</Text> : null}

          <ActionButton
            label={saving ? 'Saving...' : 'Save Manual Office Order'}
            onPress={() => {
              void saveManualOrder();
            }}
            disabled={saving || !selectedOffice || walletBalanceShort}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.colors.appBg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
    gap: 12,
  },
  contentGrow: {
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ececf0',
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: '#222329',
    fontSize: 18,
    fontWeight: '900',
  },
  chipRow: {
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3e3e8',
    backgroundColor: '#f6f6f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: '#ffc18c',
    backgroundColor: '#fff1e5',
  },
  filterChipText: {
    color: '#74747f',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  searchArea: {
    gap: 8,
  },
  compactResultList: {
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ebe8f3',
    backgroundColor: '#ffffff',
    shadowColor: '#1f2937',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  compactResultItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f0eef6',
  },
  compactResultBody: {
    flex: 1,
    gap: 2,
  },
  compactResultTitle: {
    color: '#222329',
    fontSize: 13,
    fontWeight: '800',
  },
  compactResultText: {
    color: '#7a7a83',
    fontSize: 11,
    fontWeight: '600',
  },
  selectedOfficeCard: {
    borderRadius: 16,
    backgroundColor: '#fff4ea',
    borderWidth: 1,
    borderColor: '#ffd7b8',
    padding: 12,
  },
  selectedOfficeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectedOfficeBody: {
    flex: 1,
    gap: 4,
  },
  selectedOfficeLabel: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectedOfficeTitle: {
    color: '#222329',
    fontSize: 18,
    fontWeight: '900',
  },
  selectedOfficeText: {
    color: '#696974',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  changeButton: {
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffd7b8',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  changeButtonText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceText: {
    color: '#666670',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentSection: {
    gap: 8,
  },
  paymentLabel: {
    color: '#4d4d57',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentChip: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ece0d3',
    backgroundColor: '#faf7f2',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  paymentChipActive: {
    borderColor: '#ffc18c',
    backgroundColor: '#fff1e5',
  },
  paymentChipText: {
    color: '#7a7269',
    fontSize: 12,
    fontWeight: '800',
  },
  paymentChipTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  paymentHint: {
    color: '#7a7a83',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  totalCard: {
    borderRadius: 16,
    backgroundColor: '#fff6ef',
    padding: 12,
    gap: 4,
  },
  totalLabel: {
    color: '#8a5a32',
    fontSize: 12,
    fontWeight: '700',
  },
  totalValue: {
    color: tokens.colors.vendorPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  emptyText: {
    color: '#8d8d97',
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  messageText: {
    color: '#18794e',
    fontSize: 13,
    fontWeight: '700',
  },
});
