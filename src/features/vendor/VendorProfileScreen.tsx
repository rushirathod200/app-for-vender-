import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useVendorApp } from '../../context/VendorAppContext';
import { BelowMinimumOrderMode, StoreHours, StoreHoursDayKey, StoreHoursSlot } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { resolveVendorDisplayName } from '../../utils/vendor';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';
import { VendorBuildingDeliveryPricingScreen } from './VendorBuildingDeliveryPricingScreen';

const STORE_DAYS: Array<{ key: StoreHoursDayKey; short: string; label: string }> = [
  { key: 'mon', short: 'Mon', label: 'Monday' },
  { key: 'tue', short: 'Tue', label: 'Tuesday' },
  { key: 'wed', short: 'Wed', label: 'Wednesday' },
  { key: 'thu', short: 'Thu', label: 'Thursday' },
  { key: 'fri', short: 'Fri', label: 'Friday' },
  { key: 'sat', short: 'Sat', label: 'Saturday' },
  { key: 'sun', short: 'Sun', label: 'Sunday' },
];

function defaultStoreHours(): StoreHours {
  return {
    mon: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
    tue: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
    wed: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
    thu: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
    fri: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
    sat: { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
    sun: { is_open: false, slots: [{ opens_at: '08:00', closes_at: '20:00' }] },
  };
}

function storeHoursSummary(enabled: boolean, hours: StoreHours): string {
  if (!enabled) {
    return 'Weekly schedule off';
  }

  const openDays = STORE_DAYS.filter((day) => hours[day.key].is_open).length;
  return `${openDays} ${openDays === 1 ? 'day' : 'days'} open`;
}

function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function storeTimeToMinutes(value: string): number {
  if (!isValidTime(value)) return -1;
  const [hour, minute] = value.split(':').map(Number);
  return (hour * 60) + minute;
}

function minutesToStoreTime(value: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.round(value / 30) * 30));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function sortedStoreSlots(slots: StoreHoursSlot[]): StoreHoursSlot[] {
  return slots.map((slot) => ({ ...slot }))
    .sort((left, right) => storeTimeToMinutes(left.opens_at) - storeTimeToMinutes(right.opens_at));
}

function storeDaySummary(isOpen: boolean, slots: StoreHoursSlot[]): string {
  if (!isOpen) return 'Closed all day';
  return sortedStoreSlots(slots).map((slot) => `${slot.opens_at}–${slot.closes_at}`).join(' · ');
}

function storeScheduleError(hours: StoreHours): string | null {
  for (const day of STORE_DAYS) {
    const entry = hours[day.key];
    if (!entry.is_open) continue;
    if (entry.slots.length === 0) return `${day.label}: add at least one opening time.`;
    if (entry.slots.length > 4) return `${day.label}: maximum 4 time slots are allowed.`;

    const intervals = entry.slots.map((slot) => {
      const start = storeTimeToMinutes(slot.opens_at);
      const close = storeTimeToMinutes(slot.closes_at);
      return { start, close, end: close > start ? close : close + 1440 };
    });

    if (intervals.some((slot) => slot.start < 0 || slot.close < 0)) {
      return `${day.label}: use 24-hour time like 09:00 or 20:00.`;
    }
    if (intervals.length > 1 && intervals.some((slot) => slot.end > 1440)) {
      return `${day.label}: an overnight schedule can only have one time slot.`;
    }

    intervals.sort((left, right) => left.start - right.start);
    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index].start < intervals[index - 1].end) {
        return `${day.label}: opening time slots cannot overlap.`;
      }
    }
  }

  return null;
}

function normalizePriceInput(value: string): string {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, 2);

  return decimalParts.length ? `${whole.slice(0, 5)}.${decimal}` : whole.slice(0, 5);
}

const OTA_RELOAD_DELAY_MS = 400;
const APP_VERSION = Application.nativeApplicationVersion ?? '1.1.11';

interface VendorProfileScreenProps {
  onOpenReferral?: () => void;
}

export function VendorProfileScreen({ onOpenReferral }: VendorProfileScreenProps = {}) {
  const { logout } = useAuth();
  const { profile, saveProfile, buildings, error } = useVendorApp();
  const [screen, setScreen] = useState<'profile' | 'store' | 'delivery' | 'operations' | 'hours' | 'pricing'>('profile');
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingOta, setCheckingOta] = useState(false);
  const [otaStatus, setOtaStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    mobile: '',
    delivery_charge: 0,
    estimated_waiting_time_minutes: null as number | null,
    store_open: true,
    store_hours_enabled: false,
    store_hours: defaultStoreHours(),
    below_minimum_order_mode: 'charge_delivery' as BelowMinimumOrderMode,
    minimum_order_value: 50,
    quick_request_tea_price: 15,
    quick_request_coffee_price: 20,
    print_bw_price: '2',
    print_color_price: '10',
    print_legal_price: '5',
    office_wallet_credit_enabled: false,
  });

  useAutoClearValue(info, () => setInfo(null));

  useEffect(() => {
    if (!profile) {
      return;
    }

    setDraft({
      name: profile.name ?? '',
      email: profile.email ?? '',
      mobile: profile.mobile,
      delivery_charge: profile.delivery_charge,
      estimated_waiting_time_minutes: profile.estimated_waiting_time_minutes,
      store_open: profile.store_open,
      store_hours_enabled: profile.store_hours_enabled,
      store_hours: profile.store_hours,
      below_minimum_order_mode: profile.below_minimum_order_mode,
      minimum_order_value: profile.minimum_order_value,
      quick_request_tea_price: profile.quick_request_tea_price,
      quick_request_coffee_price: profile.quick_request_coffee_price,
      print_bw_price: String(profile.print_bw_price),
      print_color_price: String(profile.print_color_price),
      print_legal_price: String(profile.print_legal_price),
      office_wallet_credit_enabled: profile.office_wallet_credit_enabled,
    });
  }, [profile]);

  const displayName = useMemo(
    () => resolveVendorDisplayName(draft.name || (profile?.name ?? null), buildings),
    [buildings, draft.name, profile?.name],
  );

  async function checkForOtaUpdate(): Promise<void> {
    if (checkingOta) {
      return;
    }

    const configuration = [
      `enabled=${Updates.isEnabled ? 'yes' : 'no'}`,
      `channel=${Updates.channel ?? 'none'}`,
      `runtime=${Updates.runtimeVersion ?? 'none'}`,
      `launch=${Updates.isEmbeddedLaunch ? 'embedded' : 'ota'}`,
      `update=${Updates.updateId?.slice(0, 8) ?? 'none'}`,
      Updates.isEmergencyLaunch ? `emergency=${Updates.emergencyLaunchReason ?? 'yes'}` : null,
    ].filter(Boolean).join(' • ');

    setCheckingOta(true);
    setOtaStatus(`Checking… • ${configuration}`);

    try {
      if (!Updates.isEnabled) {
        setOtaStatus(`OTA is disabled in this APK • ${configuration}`);
        return;
      }

      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setOtaStatus(`App is up to date • ${configuration}`);
        return;
      }

      await Updates.fetchUpdateAsync();
      setOtaStatus(`Update downloaded • ${configuration}`);
      Alert.alert(
        'App Update Ready',
        'A new DeskDrop Vendor update has been downloaded. Restart the app to apply it.',
        [
          { text: 'Later', style: 'cancel' },
          {
            text: 'Restart Now',
            onPress: () => {
              // Android needs the Alert to dismiss before the React Native
              // bridge is reloaded. Surface the native error if it still fails.
              setTimeout(() => {
                void Updates.reloadAsync().catch((reloadError: unknown) => {
                  const message = reloadError instanceof Error ? reloadError.message : String(reloadError);
                  setOtaStatus(`Restart failed: ${message} • ${configuration}`);
                  Alert.alert(
                    'Restart Failed',
                    `${message}\n\nPlease fully close DeskDrop Vendor and open it again to apply the downloaded update.`,
                  );
                });
              }, OTA_RELOAD_DELAY_MS);
            },
          },
        ],
        { cancelable: false },
      );
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : String(updateError);
      setOtaStatus(`OTA error: ${message} • ${configuration}`);
    } finally {
      setCheckingOta(false);
    }
  }
  const quickRequestBuilding = useMemo(
    () => profile?.assigned_buildings.find((building) => building.is_quick_request_vendor) ?? null,
    [profile?.assigned_buildings],
  );

  const saveChanges = async (): Promise<void> => {
    if (!draft.name.trim() || !draft.email.trim() || draft.mobile.replace(/\D/g, '').length !== 10) {
      setInfo('Please fill all mandatory vendor details correctly.');
      return;
    }

    if (draft.below_minimum_order_mode !== 'free_delivery' && draft.minimum_order_value <= 0) {
      setInfo('Enter a valid minimum cart value greater than 0.');
      return;
    }

    if (quickRequestBuilding && (draft.quick_request_tea_price <= 0 || draft.quick_request_coffee_price <= 0)) {
      setInfo('Set valid tea and coffee prices for quick requests.');
      return;
    }

    const printBwPrice = Number.parseFloat(draft.print_bw_price);
    const printColorPrice = Number.parseFloat(draft.print_color_price);
    const printLegalPrice = Number.parseFloat(draft.print_legal_price);
    if (
      profile?.can_manage_print_pricing &&
      (!Number.isFinite(printBwPrice) ||
        printBwPrice <= 0 ||
        !Number.isFinite(printColorPrice) ||
        printColorPrice <= 0 ||
        !Number.isFinite(printLegalPrice) ||
        printLegalPrice <= 0)
    ) {
      setInfo('Set valid B & W, color, and legal print prices greater than 0.');
      return;
    }

    if (draft.estimated_waiting_time_minutes !== null && (draft.estimated_waiting_time_minutes < 1 || draft.estimated_waiting_time_minutes > 240)) {
      setInfo('Estimated waiting time must be between 1 and 240 minutes.');
      return;
    }

    setSaving(true);
    setInfo(null);

    try {
      await saveProfile({
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        mobile: draft.mobile,
        delivery_charge: draft.delivery_charge,
        estimated_waiting_time_minutes: draft.estimated_waiting_time_minutes,
        store_open: draft.store_open,
        store_hours_enabled: draft.store_hours_enabled,
        store_hours: draft.store_hours,
        below_minimum_order_mode: draft.below_minimum_order_mode,
        minimum_order_value: draft.minimum_order_value,
        building_id: quickRequestBuilding?.id,
        quick_request_tea_price: quickRequestBuilding ? draft.quick_request_tea_price : undefined,
        quick_request_coffee_price: quickRequestBuilding ? draft.quick_request_coffee_price : undefined,
        print_bw_price: profile?.can_manage_print_pricing ? printBwPrice : undefined,
        print_color_price: profile?.can_manage_print_pricing ? printColorPrice : undefined,
        print_legal_price: profile?.can_manage_print_pricing ? printLegalPrice : undefined,
        office_wallet_credit_enabled: draft.office_wallet_credit_enabled,
      });
      setInfo('Profile settings updated.');
    } catch (saveError) {
      setInfo(saveError instanceof Error ? saveError.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const saveStoreHours = async (): Promise<void> => {
    if (!profile) {
      return;
    }

    setSaving(true);
    setInfo(null);

    try {
      await saveProfile({
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        mobile: draft.mobile,
        delivery_charge: draft.delivery_charge,
        estimated_waiting_time_minutes: draft.estimated_waiting_time_minutes,
        store_open: draft.store_open,
        store_hours_enabled: draft.store_hours_enabled,
        store_hours: draft.store_hours,
        below_minimum_order_mode: draft.below_minimum_order_mode,
        minimum_order_value: draft.minimum_order_value,
        building_id: quickRequestBuilding?.id,
        quick_request_tea_price: quickRequestBuilding ? draft.quick_request_tea_price : undefined,
        quick_request_coffee_price: quickRequestBuilding ? draft.quick_request_coffee_price : undefined,
        office_wallet_credit_enabled: draft.office_wallet_credit_enabled,
      });
      setInfo('Store hours updated.');
      setScreen('operations');
    } catch (saveError) {
      setInfo(saveError instanceof Error ? saveError.message : 'Could not update store hours.');
    } finally {
      setSaving(false);
    }
  };

  if (screen === 'hours') {
    return (
      <StoreHoursScreen
        hours={draft.store_hours}
        enabled={draft.store_hours_enabled}
        saving={saving}
        onBack={() => setScreen('operations')}
        onToggleEnabled={() =>
          setDraft((current) => ({ ...current, store_hours_enabled: !current.store_hours_enabled }))
        }
        onChangeHours={(storeHours) => setDraft((current) => ({ ...current, store_hours: storeHours }))}
        onSave={() => {
          void saveStoreHours();
        }}
      />
    );
  }

  if (screen === 'pricing') {
    return <VendorBuildingDeliveryPricingScreen onBack={() => setScreen('delivery')} />;
  }

  if (screen === 'store') {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.moduleContent} showsVerticalScrollIndicator={false}>
          <ModuleScreenHeader
            icon="storefront-outline"
            title="Profile & Store Info"
            subtitle="Your public details, availability and assigned buildings"
            onBack={() => setScreen('profile')}
          />

          <View style={styles.moduleSection}>
            <Text style={styles.moduleSectionTitle}>Store details</Text>
            <ProfileField
              label="Vendor Name"
              icon="person-outline"
              value={draft.name}
              onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
            />
            <ProfileField
              label="Email Address"
              icon="mail-outline"
              value={draft.email}
              onChangeText={(value) => setDraft((current) => ({ ...current, email: value }))}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <ProfileField
              label="Mobile Number"
              icon="call-outline"
              value={draft.mobile}
              onChangeText={(value) =>
                setDraft((current) => ({ ...current, mobile: value.replace(/\D/g, '').slice(0, 10) }))
              }
              keyboardType="number-pad"
              maxLength={10}
            />
            <ProfileField
              label="Estimated Waiting Time (minutes)"
              icon="time-outline"
              keyboardType="number-pad"
              value={draft.estimated_waiting_time_minutes === null ? '' : String(draft.estimated_waiting_time_minutes)}
              onChangeText={(value) =>
                setDraft((current) => ({
                  ...current,
                  estimated_waiting_time_minutes: value === '' ? null : Number(value.replace(/[^0-9]/g, '').slice(0, 3)),
                }))
              }
              maxLength={3}
            />
            <Text style={styles.helperText}>Customers see this estimate on the menu and after ordering.</Text>
          </View>

          <View style={styles.moduleSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleCopy}>
                <Text style={styles.moduleSectionTitle}>Store availability</Text>
                <Text style={styles.moduleSectionSubtitle}>Manual status overrides your weekly schedule.</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: draft.store_open }}
                onPress={() => setDraft((current) => ({ ...current, store_open: !current.store_open }))}
                style={[styles.statusPill, draft.store_open ? styles.statusPillOnline : styles.statusPillOffline]}
              >
                <View style={[styles.statusDot, draft.store_open ? styles.statusDotOnline : null]} />
                <Text style={[styles.statusPillText, draft.store_open ? styles.statusPillTextOnline : null]}>
                  {draft.store_open ? 'Online' : 'Offline'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.moduleSection}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleCopy}>
                <Text style={styles.moduleSectionTitle}>Assigned Buildings</Text>
                <Text style={styles.moduleSectionSubtitle}>{buildings.length} connected to this vendor</Text>
              </View>
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{buildings.length}</Text></View>
            </View>
            <View style={styles.buildingList}>
              {buildings.length ? buildings.map((building) => (
                <View key={building.id} style={styles.compactBuildingRow}>
                  <View style={styles.compactBuildingIcon}>
                    <Ionicons name="business-outline" size={19} color={tokens.colors.vendorPrimary} />
                  </View>
                  <View style={styles.compactBuildingCopy}>
                    <Text numberOfLines={1} style={styles.compactBuildingName}>{building.name}</Text>
                    {building.address ? <Text numberOfLines={1} style={styles.compactBuildingAddress}>{building.address}</Text> : null}
                  </View>
                </View>
              )) : <Text style={styles.emptyModuleText}>No assigned building found.</Text>}
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}
          <ActionButton label={saving ? 'Saving...' : 'Save Store Info'} onPress={() => { void saveChanges(); }} disabled={saving} />
        </ScrollView>
      </View>
    );
  }

  if (screen === 'delivery') {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.moduleContent} showsVerticalScrollIndicator={false}>
          <ModuleScreenHeader
            icon="car-outline"
            title="Delivery & Pricing"
            subtitle="Set your default rule and customize it for each building"
            onBack={() => setScreen('profile')}
          />

          <View style={styles.moduleSection}>
            <Text style={styles.moduleEyebrow}>VENDOR DEFAULT</Text>
            <Text style={styles.moduleSectionTitle}>Default order policy</Text>
            <Text style={styles.moduleSectionSubtitle}>Used for every building without a custom override.</Text>
            <View style={styles.modeOptionList}>
              <DeliveryModeOption
                active={draft.below_minimum_order_mode === 'charge_delivery'}
                icon="car-outline"
                title="Add Delivery Charge"
                detail={`Charge below ₹${draft.minimum_order_value || 0}; free delivery above it.`}
                onPress={() => setDraft((current) => ({ ...current, below_minimum_order_mode: 'charge_delivery' }))}
              />
              <DeliveryModeOption
                active={draft.below_minimum_order_mode === 'block_order'}
                icon="ban-outline"
                title="Block Low-Value Orders"
                detail="Do not allow checkout below your minimum cart value."
                onPress={() => setDraft((current) => ({ ...current, below_minimum_order_mode: 'block_order' }))}
              />
              <DeliveryModeOption
                active={draft.below_minimum_order_mode === 'free_delivery'}
                icon="gift-outline"
                title="Free Delivery"
                detail="Allow orders without a minimum or delivery charge."
                onPress={() => setDraft((current) => ({ ...current, below_minimum_order_mode: 'free_delivery' }))}
              />
            </View>
          </View>

          {draft.below_minimum_order_mode === 'charge_delivery' ? (
            <View style={styles.moduleSection}>
              <Text style={styles.moduleSectionTitle}>Default amounts</Text>
              <View style={styles.inlineFieldRow}>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="Free Delivery At (₹)"
                    icon="pricetag-outline"
                    keyboardType="number-pad"
                    value={String(draft.minimum_order_value)}
                    onChangeText={(value) => setDraft((current) => ({
                      ...current,
                      minimum_order_value: Number(value.replace(/[^0-9]/g, '') || '0'),
                    }))}
                  />
                </View>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="Delivery Charge (₹)"
                    icon="car-outline"
                    keyboardType="number-pad"
                    value={String(draft.delivery_charge)}
                    onChangeText={(value) => setDraft((current) => ({
                      ...current,
                      delivery_charge: Number(value.replace(/[^0-9]/g, '') || '0'),
                    }))}
                  />
                </View>
              </View>
            </View>
          ) : draft.below_minimum_order_mode === 'block_order' ? (
            <View style={styles.moduleSection}>
              <ProfileField
                label="Minimum Cart Value (₹)"
                icon="pricetag-outline"
                keyboardType="number-pad"
                value={String(draft.minimum_order_value)}
                onChangeText={(value) => setDraft((current) => ({
                  ...current,
                  minimum_order_value: Number(value.replace(/[^0-9]/g, '') || '0'),
                }))}
              />
            </View>
          ) : null}

          <Pressable style={styles.manageModuleCard} onPress={() => setScreen('pricing')}>
            <View style={styles.manageModuleIcon}>
              <Ionicons name="business-outline" size={24} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.manageModuleCopy}>
              <Text style={styles.manageModuleTitle}>Building-wise Pricing</Text>
              <Text style={styles.manageModuleText}>{buildings.length} buildings · Default, free, custom charge or block orders</Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color="#8c8d96" />
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}
          <ActionButton label={saving ? 'Saving...' : 'Save Delivery Policy'} onPress={() => { void saveChanges(); }} disabled={saving} />
        </ScrollView>
      </View>
    );
  }

  if (screen === 'operations') {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.moduleContent} showsVerticalScrollIndicator={false}>
          <ModuleScreenHeader
            icon="options-outline"
            title="Store Operations"
            subtitle="Hours, quick requests, print pricing and wallet controls"
            onBack={() => setScreen('profile')}
          />

          <Pressable style={styles.manageModuleCard} onPress={() => setScreen('hours')}>
            <View style={styles.manageModuleIcon}>
              <Ionicons name="time-outline" size={24} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.manageModuleCopy}>
              <Text style={styles.manageModuleTitle}>Store Hours</Text>
              <Text style={styles.manageModuleText}>{storeHoursSummary(draft.store_hours_enabled, draft.store_hours)} · Weekly auto availability</Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color="#8c8d96" />
          </Pressable>

          {quickRequestBuilding ? (
            <View style={styles.moduleSection}>
              <Text style={styles.moduleEyebrow}>QUICK REQUESTS</Text>
              <Text style={styles.moduleSectionTitle}>Tea & Coffee Pricing</Text>
              <Text style={styles.moduleSectionSubtitle}>Used for quick requests at {quickRequestBuilding.name}.</Text>
              <View style={styles.inlineFieldRow}>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="Tea Price (₹)"
                    icon="cafe-outline"
                    keyboardType="number-pad"
                    value={String(draft.quick_request_tea_price)}
                    onChangeText={(value) => setDraft((current) => ({
                      ...current,
                      quick_request_tea_price: Number(value.replace(/[^0-9]/g, '') || '0'),
                    }))}
                  />
                </View>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="Coffee Price (₹)"
                    icon="cafe"
                    keyboardType="number-pad"
                    value={String(draft.quick_request_coffee_price)}
                    onChangeText={(value) => setDraft((current) => ({
                      ...current,
                      quick_request_coffee_price: Number(value.replace(/[^0-9]/g, '') || '0'),
                    }))}
                  />
                </View>
              </View>
            </View>
          ) : null}

          {profile?.can_manage_print_pricing ? (
            <View style={styles.moduleSection}>
              <Text style={styles.moduleEyebrow}>STATIONERY ORDERS</Text>
              <Text style={styles.moduleSectionTitle}>Print Pricing</Text>
              <Text style={styles.moduleSectionSubtitle}>Per-page rates used for print orders.</Text>
              <View style={styles.inlineFieldRow}>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="B & W / Page (₹)"
                    icon="print-outline"
                    keyboardType="decimal-pad"
                    value={draft.print_bw_price}
                    onChangeText={(value) => setDraft((current) => ({ ...current, print_bw_price: normalizePriceInput(value) }))}
                  />
                </View>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="Color / Page (₹)"
                    icon="color-palette-outline"
                    keyboardType="decimal-pad"
                    value={draft.print_color_price}
                    onChangeText={(value) => setDraft((current) => ({ ...current, print_color_price: normalizePriceInput(value) }))}
                  />
                </View>
              </View>
              <ProfileField
                label="Legal / Page (₹)"
                icon="document-text-outline"
                keyboardType="decimal-pad"
                value={draft.print_legal_price}
                onChangeText={(value) => setDraft((current) => ({ ...current, print_legal_price: normalizePriceInput(value) }))}
              />
            </View>
          ) : null}

          <View style={styles.walletModuleCard}>
            <View style={styles.walletModuleIcon}>
              <Ionicons name="wallet-outline" size={23} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.creditCopy}>
              <Text style={styles.moduleSectionTitle}>Office Wallet Credit</Text>
              <Text style={styles.creditTitle}>{draft.office_wallet_credit_enabled ? 'Credit is ON' : 'Credit is OFF'}</Text>
              <Text style={styles.moduleSectionSubtitle}>Allow office-wallet orders when the wallet balance is low. The balance may go negative until topped up.</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: draft.office_wallet_credit_enabled }}
              onPress={() => setDraft((current) => ({
                ...current,
                office_wallet_credit_enabled: !current.office_wallet_credit_enabled,
              }))}
              style={[styles.creditToggle, draft.office_wallet_credit_enabled ? styles.creditToggleOn : styles.creditToggleOff]}
            >
              <View style={[
                styles.creditToggleThumb,
                draft.office_wallet_credit_enabled ? styles.creditToggleThumbOn : styles.creditToggleThumbOff,
              ]} />
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}
          <ActionButton label={saving ? 'Saving...' : 'Save Operations'} onPress={() => { void saveChanges(); }} disabled={saving} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.dashboardContent} showsVerticalScrollIndicator={false}>
        <View style={styles.dashboardHero}>
          <View style={styles.dashboardHeroTop}>
            <View style={styles.dashboardStoreIcon}>
              <MaterialCommunityIcons name="storefront-outline" size={28} color="#ffffff" />
            </View>
            <View style={styles.dashboardHeroCopy}>
              <Text numberOfLines={1} style={styles.dashboardHeroTitle}>{displayName}</Text>
              <Text style={styles.dashboardHeroLabel}>VENDOR ACCOUNT</Text>
            </View>
            <View style={[styles.heroStatus, draft.store_open ? styles.heroStatusOnline : styles.heroStatusOffline]}>
              <View style={styles.heroStatusDot} />
              <Text style={styles.heroStatusText}>{draft.store_open ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
          <Text style={styles.dashboardHeroMeta}>
            {draft.estimated_waiting_time_minutes ? `${draft.estimated_waiting_time_minutes} min wait` : 'No wait time set'} · {buildings.length} {buildings.length === 1 ? 'building' : 'buildings'}
          </Text>
        </View>

        <View style={styles.dashboardIntro}>
          <Text style={styles.dashboardTitle}>Manage your store</Text>
          <Text style={styles.dashboardSubtitle}>Everything is grouped into three simple sections.</Text>
        </View>

        <SettingsModuleCard
          number="01"
          icon="storefront-outline"
          title="Profile & Store Info"
          subtitle="Public details, waiting time, store status and assigned buildings"
          meta={draft.email || 'Add store contact details'}
          onPress={() => setScreen('store')}
        />
        <SettingsModuleCard
          number="02"
          icon="car-outline"
          title="Delivery & Building Pricing"
          subtitle="Default delivery rule and custom policy for every building"
          meta={draft.below_minimum_order_mode === 'charge_delivery'
            ? `₹${draft.delivery_charge} below ₹${draft.minimum_order_value}`
            : draft.below_minimum_order_mode === 'block_order'
              ? `Block below ₹${draft.minimum_order_value}`
              : 'Free delivery'}
          onPress={() => setScreen('delivery')}
        />
        <SettingsModuleCard
          number="03"
          icon="options-outline"
          title="Store Operations"
          subtitle="Hours, quick requests, print pricing and office wallet credit"
          meta={`${storeHoursSummary(draft.store_hours_enabled, draft.store_hours)} · Credit ${draft.office_wallet_credit_enabled ? 'on' : 'off'}`}
          onPress={() => setScreen('operations')}
        />

        <View style={styles.accountCard}>
          <View style={styles.accountCardHeader}>
            <Text style={styles.accountCardTitle}>Account & App</Text>
            <Text style={styles.appVersionInline}>v{APP_VERSION}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={checkingOta}
            onPress={() => { void checkForOtaUpdate(); }}
            style={styles.accountAction}
          >
            <View style={styles.accountActionIcon}>
              <Ionicons name="cloud-download-outline" size={19} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.accountActionCopy}>
              <Text style={styles.accountActionTitle}>{checkingOta ? 'Checking for update…' : 'Check for Update'}</Text>
              <Text style={styles.accountActionText}>Get the latest DeskDrop Vendor improvements</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color="#9a9ba4" />
          </Pressable>
          <View style={styles.accountDivider} />
          <Pressable accessibilityRole="button" onPress={logout} style={styles.accountAction}>
            <View style={[styles.accountActionIcon, styles.logoutIcon]}>
              <Ionicons name="log-out-outline" size={19} color="#c54242" />
            </View>
            <View style={styles.accountActionCopy}>
              <Text style={[styles.accountActionTitle, styles.logoutText]}>Logout</Text>
              <Text style={styles.accountActionText}>Sign out of this vendor account</Text>
            </View>
          </Pressable>
          {otaStatus ? <Text style={styles.otaStatusText}>{otaStatus}</Text> : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {info ? <Text style={styles.infoText}>{info}</Text> : null}
      </ScrollView>
    </View>
  );
}

function ProfileField(
  props: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  } & React.ComponentProps<typeof TextInput>,
) {
  const { label, icon, style, ...inputProps } = props;

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <Ionicons name={icon} size={18} color={tokens.colors.vendorPrimary} />
        <TextInput
          placeholderTextColor="#9a9aa3"
          style={[styles.fieldInput, style]}
          {...inputProps}
        />
      </View>
    </View>
  );
}

function ModuleScreenHeader({
  icon,
  title,
  subtitle,
  onBack,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.moduleHeader}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={onBack} style={styles.moduleBackButton}>
        <Ionicons name="arrow-back" size={22} color="#252631" />
      </Pressable>
      <View style={styles.moduleHeaderIcon}>
        <Ionicons name={icon} size={23} color={tokens.colors.vendorPrimary} />
      </View>
      <View style={styles.moduleHeaderCopy}>
        <Text style={styles.moduleHeaderTitle}>{title}</Text>
        <Text style={styles.moduleHeaderSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function SettingsModuleCard({
  number,
  icon,
  title,
  subtitle,
  meta,
  onPress,
}: {
  number: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.settingsModuleCard, pressed ? styles.settingsModuleCardPressed : null]}>
      <View style={styles.settingsModuleTop}>
        <View style={styles.settingsModuleIcon}>
          <Ionicons name={icon} size={25} color={tokens.colors.vendorPrimary} />
        </View>
        <Text style={styles.settingsModuleNumber}>{number}</Text>
      </View>
      <Text style={styles.settingsModuleTitle}>{title}</Text>
      <Text style={styles.settingsModuleSubtitle}>{subtitle}</Text>
      <View style={styles.settingsModuleFooter}>
        <Text numberOfLines={1} style={styles.settingsModuleMeta}>{meta}</Text>
        <View style={styles.settingsModuleArrow}>
          <Ionicons name="arrow-forward" size={17} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}

function DeliveryModeOption({
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
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={onPress} style={[styles.deliveryPolicyOption, active ? styles.deliveryPolicyOptionActive : null]}>
      <View style={[styles.deliveryPolicyIcon, active ? styles.deliveryPolicyIconActive : null]}>
        <Ionicons name={icon} size={20} color={active ? tokens.colors.vendorPrimary : '#72737d'} />
      </View>
      <View style={styles.deliveryPolicyCopy}>
        <Text style={[styles.deliveryPolicyTitle, active ? styles.deliveryPolicyTitleActive : null]}>{title}</Text>
        <Text style={styles.deliveryPolicyDetail}>{detail}</Text>
      </View>
      <View style={[styles.deliveryPolicyRadio, active ? styles.deliveryPolicyRadioActive : null]}>
        {active ? <View style={styles.deliveryPolicyRadioDot} /> : null}
      </View>
    </Pressable>
  );
}

function StoreHoursScreen({
  hours,
  enabled,
  saving,
  onBack,
  onToggleEnabled,
  onChangeHours,
  onSave,
}: {
  hours: StoreHours;
  enabled: boolean;
  saving: boolean;
  onBack: () => void;
  onToggleEnabled: () => void;
  onChangeHours: (hours: StoreHours) => void;
  onSave: () => void;
}) {
  const openDays = STORE_DAYS.filter((day) => hours[day.key].is_open).length;
  const [activeQuickAction, setActiveQuickAction] = useState<'copy' | 'weekend' | null>(null);
  const [expandedDay, setExpandedDay] = useState<StoreHoursDayKey | null>('mon');
  const scheduleError = enabled ? storeScheduleError(hours) : null;
  const mondayCanBeCopied = hours.mon.is_open && hours.mon.slots.length > 0;

  const updateDay = (day: StoreHoursDayKey, patch: Partial<StoreHours[StoreHoursDayKey]>): void => {
    onChangeHours({
      ...hours,
      [day]: {
        ...hours[day],
        ...patch,
      },
    });
  };

  const copyMondayToOpenDays = (): void => {
    if (!mondayCanBeCopied) return;
    const monday = hours.mon;
    setActiveQuickAction('copy');
    onChangeHours(
      STORE_DAYS.reduce<StoreHours>((next, day) => {
        next[day.key] = {
          ...hours[day.key],
          slots: hours[day.key].is_open
            ? monday.slots.map((slot) => ({ ...slot }))
            : hours[day.key].slots.map((slot) => ({ ...slot })),
        };
        return next;
      }, { ...hours }),
    );
  };

  const closeWeekend = (): void => {
    setActiveQuickAction('weekend');
    onChangeHours({
      ...hours,
      sat: { ...hours.sat, is_open: false },
      sun: { ...hours.sun, is_open: false },
    });
  };

  const toggleDay = (day: StoreHoursDayKey): void => {
    const entry = hours[day];
    updateDay(day, {
      is_open: !entry.is_open,
      slots: entry.slots.length > 0 ? entry.slots : [{ opens_at: '08:00', closes_at: '20:00' }],
    });
    if (!entry.is_open) setExpandedDay(day);
    setActiveQuickAction(null);
  };

  const updateSlot = (day: StoreHoursDayKey, slotIndex: number, patch: Partial<StoreHoursSlot>): void => {
    const slots = hours[day].slots.map((slot, index) => index === slotIndex ? { ...slot, ...patch } : slot);
    updateDay(day, { slots });
    setActiveQuickAction(null);
  };

  const addSlot = (day: StoreHoursDayKey): void => {
    const entry = hours[day];
    if (entry.slots.length >= 4) return;

    if (entry.slots.length === 0) {
      updateDay(day, { is_open: true, slots: [{ opens_at: '08:00', closes_at: '20:00' }] });
      return;
    }

    if (entry.slots.length === 1) {
      const original = entry.slots[0];
      const start = storeTimeToMinutes(original.opens_at);
      const close = storeTimeToMinutes(original.closes_at);
      if (start >= 0 && close > start + 180) {
        const preferredBreakStart = start < 720 && close > 840 ? 720 : Math.round((start + close) / 60) * 30;
        const preferredBreakEnd = Math.min(close - 30, preferredBreakStart + (close > 840 ? 120 : 60));
        if (preferredBreakStart > start && preferredBreakEnd < close) {
          updateDay(day, {
            slots: [
              { opens_at: original.opens_at, closes_at: minutesToStoreTime(preferredBreakStart) },
              { opens_at: minutesToStoreTime(preferredBreakEnd), closes_at: original.closes_at },
            ],
          });
          return;
        }
      }
    }

    const sorted = sortedStoreSlots(entry.slots);
    const lastClose = storeTimeToMinutes(sorted[sorted.length - 1].closes_at);
    if (lastClose >= 0 && lastClose <= 1260) {
      sorted.push({
        opens_at: minutesToStoreTime(lastClose + 60),
        closes_at: minutesToStoreTime(lastClose + 180),
      });
      updateDay(day, { slots: sorted });
    }
  };

  const removeSlot = (day: StoreHoursDayKey, slotIndex: number): void => {
    const slots = hours[day].slots.filter((_, index) => index !== slotIndex);
    updateDay(day, { slots, is_open: slots.length > 0 });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.hoursContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hoursHeader}>
          <Pressable style={styles.hoursBackButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={26} color="#232328" />
          </Pressable>
          <View style={styles.hoursHeaderText}>
            <Text style={styles.hoursScreenTitle}>Store Hours</Text>
            <Text style={styles.hoursScreenSubtitle}>Set ordering hours and breaks.</Text>
          </View>
          <Pressable
            style={[styles.scheduleToggle, enabled ? styles.scheduleToggleOn : styles.scheduleToggleOff]}
            onPress={onToggleEnabled}
            accessibilityRole="switch"
            accessibilityState={{ checked: enabled }}
          >
            <View style={styles.scheduleToggleThumb} />
          </Pressable>
        </View>

        <View style={styles.scheduleSummaryBar}>
          <Ionicons name={enabled ? 'time-outline' : 'pause-circle-outline'} size={17} color={tokens.colors.vendorPrimary} />
          <Text style={styles.scheduleSummaryText}>
            {enabled
              ? `${openDays} ${openDays === 1 ? 'day' : 'days'} open · Manual Offline overrides schedule`
              : 'Schedule is off · Store follows the manual Online/Offline status'}
          </Text>
        </View>

        {enabled ? (
          <>
            <View style={styles.hoursQuickRow}>
              <Pressable
                style={[
                  styles.hoursQuickButton,
                  activeQuickAction === 'copy' ? styles.hoursQuickButtonActive : null,
                  !mondayCanBeCopied ? styles.hoursQuickButtonDisabled : null,
                ]}
                onPress={copyMondayToOpenDays}
                disabled={!mondayCanBeCopied}
              >
                <Ionicons
                  name="copy-outline"
                  size={17}
                  color={activeQuickAction === 'copy' ? '#ffffff' : tokens.colors.vendorPrimary}
                />
                <Text style={[styles.hoursQuickText, activeQuickAction === 'copy' ? styles.hoursQuickTextActive : null]}>
                  Copy Mon hours
                </Text>
              </Pressable>
              <Pressable
                style={[styles.hoursQuickButton, activeQuickAction === 'weekend' ? styles.hoursQuickButtonActive : null]}
                onPress={closeWeekend}
              >
                <Ionicons
                  name="calendar-outline"
                  size={17}
                  color={activeQuickAction === 'weekend' ? '#ffffff' : tokens.colors.vendorPrimary}
                />
                <Text style={[styles.hoursQuickText, activeQuickAction === 'weekend' ? styles.hoursQuickTextActive : null]}>
                  Close weekend
                </Text>
              </Pressable>
            </View>
            {activeQuickAction ? (
              <Text style={styles.quickActionFeedback}>
                {activeQuickAction === 'copy'
                  ? 'Monday time slots copied to every open day.'
                  : 'Saturday and Sunday are now closed.'}
              </Text>
            ) : null}

            {STORE_DAYS.map((day) => {
              const entry = hours[day.key];
              const slots = entry.slots;
              const isExpanded = expandedDay === day.key;

              return (
                <View key={day.key} style={[styles.dayCard, isExpanded ? styles.dayCardExpanded : null]}>
                  <View style={styles.dayHeader}>
                    <Pressable
                      style={styles.daySummaryButton}
                      onPress={() => setExpandedDay((current) => current === day.key ? null : day.key)}
                    >
                      <View style={styles.dayBadge}>
                        <Text style={styles.dayBadgeText}>{day.short}</Text>
                      </View>
                      <View style={styles.dayTitleWrap}>
                        <Text style={styles.dayTitle}>{day.label}</Text>
                        <Text style={styles.daySubtitle} numberOfLines={1}>
                          {storeDaySummary(entry.is_open, slots)}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={[styles.dayOpenButton, entry.is_open ? styles.dayOpenButtonActive : null]}
                      onPress={() => toggleDay(day.key)}
                    >
                      <Text style={[styles.dayOpenText, entry.is_open ? styles.dayOpenTextActive : null]}>
                        {entry.is_open ? 'Open' : 'Closed'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={styles.dayChevronButton}
                      onPress={() => setExpandedDay((current) => current === day.key ? null : day.key)}
                      accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${day.label}`}
                    >
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#858690" />
                    </Pressable>
                  </View>

                  {isExpanded && entry.is_open ? (
                    <View style={styles.slotsEditor}>
                      {slots.map((slot, slotIndex) => (
                        <React.Fragment key={`${day.key}-${slotIndex}`}>
                          {slotIndex > 0 && storeTimeToMinutes(slots[slotIndex - 1].closes_at) < storeTimeToMinutes(slot.opens_at) ? (
                            <View style={styles.breakRow}>
                              <View style={styles.breakLine} />
                              <Text style={styles.breakText}>
                                Break {slots[slotIndex - 1].closes_at}–{slot.opens_at}
                              </Text>
                              <View style={styles.breakLine} />
                            </View>
                          ) : null}
                          <View style={styles.slotRow}>
                            <View style={styles.compactTimeField}>
                              <Text style={styles.timeLabel}>Opens</Text>
                              <TextInput
                                value={slot.opens_at}
                                onChangeText={(value) => updateSlot(day.key, slotIndex, { opens_at: normalizeTimeInput(value) })}
                                keyboardType="number-pad"
                                maxLength={5}
                                style={styles.compactTimeInput}
                                placeholder="09:00"
                                placeholderTextColor="#9a9aa3"
                              />
                            </View>
                            <Ionicons name="arrow-forward" size={15} color="#9899a2" />
                            <View style={styles.compactTimeField}>
                              <Text style={styles.timeLabel}>Closes</Text>
                              <TextInput
                                value={slot.closes_at}
                                onChangeText={(value) => updateSlot(day.key, slotIndex, { closes_at: normalizeTimeInput(value) })}
                                keyboardType="number-pad"
                                maxLength={5}
                                style={styles.compactTimeInput}
                                placeholder="20:00"
                                placeholderTextColor="#9a9aa3"
                              />
                            </View>
                            <Pressable
                              style={styles.removeSlotButton}
                              onPress={() => removeSlot(day.key, slotIndex)}
                              accessibilityLabel={`Remove ${day.label} time slot ${slotIndex + 1}`}
                            >
                              <Ionicons name="trash-outline" size={17} color={tokens.colors.danger} />
                            </Pressable>
                          </View>
                        </React.Fragment>
                      ))}
                      <Pressable
                        style={[styles.addSlotButton, slots.length >= 4 ? styles.addSlotButtonDisabled : null]}
                        onPress={() => addSlot(day.key)}
                        disabled={slots.length >= 4}
                      >
                        <Ionicons name="add" size={17} color={tokens.colors.vendorPrimary} />
                        <Text style={styles.addSlotText}>Add time slot</Text>
                      </Pressable>
                    </View>
                  ) : isExpanded ? (
                    <Pressable style={styles.closedDayAction} onPress={() => toggleDay(day.key)}>
                      <Ionicons name="add-circle-outline" size={17} color={tokens.colors.vendorPrimary} />
                      <Text style={styles.closedDayActionText}>Add opening hours</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {scheduleError ? <Text style={styles.errorText}>{scheduleError}</Text> : null}
        {enabled ? (
          <Text style={styles.scheduleFootnote}>
            Existing accepted orders continue during a break. Only new orders are paused.
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.hoursBottomBar}>
        <ActionButton
          label={saving ? 'Saving...' : 'Save Schedule'}
          onPress={onSave}
          disabled={saving || !!scheduleError}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  heroCard: {
    backgroundColor: tokens.colors.vendorPrimary,
    borderRadius: 28,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  storeIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  accountTypeBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  accountTypeText: {
    color: '#fff5ec',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.45,
  },
  infoCard: {
    backgroundColor: '#f7f7f8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ededf2',
    padding: 14,
    gap: 10,
  },
  storeHoursCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  storeHoursIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#fff1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeHoursCopy: {
    flex: 1,
    minWidth: 0,
  },
  storeHoursTitle: {
    color: '#202027',
    fontSize: 18,
    fontWeight: '900',
  },
  storeHoursSubtitle: {
    color: '#6f6f78',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  storeHoursNote: {
    color: '#8d8d96',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  storeHoursEditButton: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1caa9',
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  storeHoursEditText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  cardTitle: {
    color: '#222329',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 2,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: '#31313a',
    fontSize: 15,
    fontWeight: '700',
  },
  fieldInputWrap: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldInput: {
    flex: 1,
    color: '#232328',
    fontSize: 16,
    fontWeight: '600',
  },
  helperText: {
    color: '#9c9ca5',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
  },
  hoursContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 106,
    gap: 8,
  },
  hoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hoursBackButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eeeeF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursHeaderText: {
    flex: 1,
  },
  hoursScreenTitle: {
    color: '#19191f',
    fontSize: 25,
    fontWeight: '900',
  },
  hoursScreenSubtitle: {
    color: '#777782',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  scheduleToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  scheduleToggleOn: {
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'flex-end',
  },
  scheduleToggleOff: {
    backgroundColor: '#d8d8e2',
    alignItems: 'flex-start',
  },
  scheduleToggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
  },
  scheduleSummaryBar: {
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#f1d7c4',
    backgroundColor: '#fffaf6',
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  scheduleSummaryText: {
    flex: 1,
    color: '#6c5a4f',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  hoursQuickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hoursQuickButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1caa9',
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hoursQuickButtonActive: {
    borderColor: tokens.colors.vendorPrimary,
    backgroundColor: tokens.colors.vendorPrimary,
  },
  hoursQuickButtonDisabled: {
    opacity: 0.45,
  },
  hoursQuickText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  hoursQuickTextActive: {
    color: '#ffffff',
  },
  quickActionFeedback: {
    color: '#72737c',
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
    paddingHorizontal: 3,
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 8,
    gap: 7,
  },
  dayCardExpanded: {
    borderColor: '#f2c8aa',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  daySummaryButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayBadge: {
    width: 40,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#fff1e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  dayTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  dayTitle: {
    color: '#19191f',
    fontSize: 15,
    fontWeight: '900',
  },
  daySubtitle: {
    color: '#777782',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  dayOpenButton: {
    minWidth: 58,
    minHeight: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#dddde4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOpenButtonActive: {
    borderColor: '#f1caa9',
    backgroundColor: '#fffaf6',
  },
  dayOpenText: {
    color: '#777782',
    fontSize: 11,
    fontWeight: '900',
  },
  dayOpenTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  dayChevronButton: {
    width: 28,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsEditor: {
    borderTopWidth: 1,
    borderTopColor: '#eeeeF2',
    paddingTop: 8,
    gap: 6,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTimeField: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f7f7f9',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  compactTimeInput: {
    color: '#19191f',
    fontSize: 16,
    fontWeight: '900',
    paddingVertical: 0,
  },
  removeSlotButton: {
    width: 32,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 38,
  },
  breakLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1cdb6',
  },
  breakText: {
    color: '#dc6517',
    fontSize: 10,
    fontWeight: '900',
  },
  addSlotButton: {
    minHeight: 36,
    marginRight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ee9d67',
    backgroundColor: '#fff9f5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addSlotButtonDisabled: {
    opacity: 0.45,
  },
  addSlotText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  closedDayAction: {
    minHeight: 38,
    borderTopWidth: 1,
    borderTopColor: '#eeeeF2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  closedDayActionText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  scheduleFootnote: {
    color: '#7d7e87',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  timeLabel: {
    color: '#777782',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  hoursBottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ececf2',
  },
  deliveryModeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  modeHelperText: {
    color: '#7b7b84',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  modeOptionList: {
    gap: 8,
  },
  modeOption: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f6f6f8',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modeOptionActive: {
    borderColor: tokens.colors.vendorPrimary,
    backgroundColor: '#fff2e8',
  },
  modeOptionTitle: {
    color: '#232328',
    fontSize: 14,
    fontWeight: '800',
  },
  modeOptionTitleActive: {
    color: tokens.colors.vendorPrimary,
  },
  modeOptionText: {
    marginTop: 2,
    color: '#76767f',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    maxWidth: 240,
  },
  modeOptionTextActive: {
    color: '#a85011',
  },
  modeIndicator: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#d0d0d8',
    backgroundColor: '#ffffff',
  },
  modeIndicatorActive: {
    borderColor: tokens.colors.vendorPrimary,
    backgroundColor: tokens.colors.vendorPrimary,
  },
  statusRow: {
    gap: 8,
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 12,
    gap: 6,
  },
  addressLabel: {
    color: '#31313a',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  addressText: {
    color: '#6c6c76',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  creditCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creditCopy: {
    flex: 1,
    gap: 4,
  },
  creditTitle: {
    color: '#222329',
    fontSize: 16,
    fontWeight: '900',
  },
  creditToggle: {
    width: 58,
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  creditToggleOn: {
    backgroundColor: '#ff8f3d',
  },
  creditToggleOff: {
    backgroundColor: '#d8dbe4',
  },
  creditToggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    shadowColor: '#111827',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  creditToggleThumbOn: {
    alignSelf: 'flex-end',
  },
  creditToggleThumbOff: {
    alignSelf: 'flex-start',
  },
  actionGroupCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 12,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#ededf2',
  },
  orText: {
    color: '#9c9ca5',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  errorText: {
    marginTop: 2,
    color: tokens.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  infoText: {
    marginTop: 2,
    color: '#6c6c76',
    fontSize: 14,
    fontWeight: '600',
  },
  appVersionText: {
    color: '#9c9ca5',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  otaCheckButton: {
    alignSelf: 'center',
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ffd2b5',
    backgroundColor: '#fff8f2',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  otaCheckButtonPressed: {
    opacity: 0.72,
  },
  otaCheckButtonText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  otaStatusText: {
    color: '#6c6c76',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    textAlign: 'center',
  },
  dashboardContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 12,
  },
  dashboardHero: {
    borderRadius: 24,
    backgroundColor: tokens.colors.vendorPrimary,
    padding: 16,
    gap: 12,
    shadowColor: tokens.colors.vendorPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  dashboardHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  dashboardStoreIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashboardHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  dashboardHeroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  dashboardHeroLabel: {
    color: '#ffe8d8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginTop: 3,
  },
  heroStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatusOnline: {
    backgroundColor: '#188c4f',
  },
  heroStatusOffline: {
    backgroundColor: 'rgba(37,38,49,0.52)',
  },
  heroStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  heroStatusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  dashboardHeroMeta: {
    color: '#fff5ed',
    fontSize: 13,
    fontWeight: '700',
  },
  dashboardIntro: {
    marginTop: 8,
    gap: 2,
  },
  dashboardTitle: {
    color: '#171822',
    fontSize: 24,
    fontWeight: '900',
  },
  dashboardSubtitle: {
    color: '#787984',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsModuleCard: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e8ee',
    padding: 15,
    gap: 7,
    shadowColor: '#172033',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  settingsModuleCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  settingsModuleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsModuleIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsModuleNumber: {
    color: '#d8d8de',
    fontSize: 27,
    fontWeight: '900',
  },
  settingsModuleTitle: {
    color: '#1b1c25',
    fontSize: 19,
    fontWeight: '900',
  },
  settingsModuleSubtitle: {
    color: '#747580',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  settingsModuleFooter: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#efeff3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsModuleMeta: {
    flex: 1,
    color: '#565762',
    fontSize: 12,
    fontWeight: '800',
  },
  settingsModuleArrow: {
    width: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCard: {
    marginTop: 4,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e8ee',
    padding: 14,
  },
  accountCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  accountCardTitle: {
    color: '#252631',
    fontSize: 16,
    fontWeight: '900',
  },
  appVersionInline: {
    color: '#8c8d96',
    fontSize: 12,
    fontWeight: '800',
  },
  accountAction: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    backgroundColor: '#fff0f0',
  },
  accountActionCopy: {
    flex: 1,
  },
  accountActionTitle: {
    color: '#2c2d36',
    fontSize: 14,
    fontWeight: '900',
  },
  accountActionText: {
    color: '#8a8b94',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  logoutText: {
    color: '#b93636',
  },
  accountDivider: {
    height: 1,
    backgroundColor: '#efeff3',
  },
  moduleContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 12,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 3,
  },
  moduleBackButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e6ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  moduleHeaderTitle: {
    color: '#1c1d26',
    fontSize: 20,
    fontWeight: '900',
  },
  moduleHeaderSubtitle: {
    color: '#7b7c86',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 1,
  },
  moduleSection: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7e7ed',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 11,
  },
  moduleEyebrow: {
    color: tokens.colors.vendorPrimary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  moduleSectionTitle: {
    color: '#22232d',
    fontSize: 17,
    fontWeight: '900',
  },
  moduleSectionSubtitle: {
    color: '#80818b',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  countBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 11,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  statusPill: {
    minHeight: 38,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 0,
  },
  statusPillOnline: {
    backgroundColor: '#e9f8ef',
  },
  statusPillOffline: {
    backgroundColor: '#eeeeF2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#8a8b94',
  },
  statusDotOnline: {
    backgroundColor: '#16a35b',
  },
  statusPillText: {
    color: '#696a74',
    fontSize: 12,
    fontWeight: '900',
  },
  statusPillTextOnline: {
    color: '#14834b',
  },
  buildingList: {
    gap: 8,
  },
  compactBuildingRow: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#f7f7f9',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactBuildingIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBuildingCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactBuildingName: {
    color: '#2a2b34',
    fontSize: 14,
    fontWeight: '900',
  },
  compactBuildingAddress: {
    color: '#898a93',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyModuleText: {
    color: '#8c8d96',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
  },
  deliveryPolicyOption: {
    minHeight: 74,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e4e4e9',
    backgroundColor: '#fafafa',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deliveryPolicyOptionActive: {
    borderColor: '#ffc28f',
    backgroundColor: '#fff8f1',
  },
  deliveryPolicyIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#eeeeF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryPolicyIconActive: {
    backgroundColor: '#ffe9d8',
  },
  deliveryPolicyCopy: {
    flex: 1,
    minWidth: 0,
  },
  deliveryPolicyTitle: {
    color: '#373842',
    fontSize: 14,
    fontWeight: '900',
  },
  deliveryPolicyTitleActive: {
    color: '#a8400b',
  },
  deliveryPolicyDetail: {
    color: '#81828b',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  deliveryPolicyRadio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#c4c5cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryPolicyRadioActive: {
    borderColor: tokens.colors.vendorPrimary,
  },
  deliveryPolicyRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: tokens.colors.vendorPrimary,
  },
  manageModuleCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#ffffff',
    padding: 13,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  manageModuleIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageModuleCopy: {
    flex: 1,
    minWidth: 0,
  },
  manageModuleTitle: {
    color: '#252631',
    fontSize: 16,
    fontWeight: '900',
  },
  manageModuleText: {
    color: '#7f8089',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 3,
  },
  walletModuleCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7e7ed',
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  walletModuleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#fff1e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
