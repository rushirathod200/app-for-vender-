import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useVendorApp } from '../../context/VendorAppContext';
import { BelowMinimumOrderMode, StoreHours, StoreHoursDayKey } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { resolveVendorDisplayName } from '../../utils/vendor';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';

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
    mon: { is_open: true, opens_at: '08:00', closes_at: '20:00' },
    tue: { is_open: true, opens_at: '08:00', closes_at: '20:00' },
    wed: { is_open: true, opens_at: '08:00', closes_at: '20:00' },
    thu: { is_open: true, opens_at: '08:00', closes_at: '20:00' },
    fri: { is_open: true, opens_at: '08:00', closes_at: '20:00' },
    sat: { is_open: true, opens_at: '08:00', closes_at: '20:00' },
    sun: { is_open: false, opens_at: '08:00', closes_at: '20:00' },
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

function normalizePriceInput(value: string): string {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, 2);

  return decimalParts.length ? `${whole.slice(0, 5)}.${decimal}` : whole.slice(0, 5);
}

const OTA_RELOAD_DELAY_MS = 400;

export function VendorProfileScreen() {
  const { logout } = useAuth();
  const { profile, saveProfile, buildings, error } = useVendorApp();
  const [screen, setScreen] = useState<'profile' | 'hours'>('profile');
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
      setScreen('profile');
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
        onBack={() => setScreen('profile')}
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.storeIconWrap}>
            <MaterialCommunityIcons name="storefront-outline" size={38} color="#ffffff" />
          </View>
          <Text style={styles.heroTitle}>{displayName}</Text>
          <View style={styles.accountTypeBadge}>
            <Text style={styles.accountTypeText}>VENDOR ACCOUNT</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Store Information</Text>

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

          <Text style={styles.helperText}>Update your store details and delivery settings.</Text>

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
          <Text style={styles.helperText}>Optional. Customers will see this on menu and after order.</Text>

          <View style={styles.deliveryModeCard}>
            <Text style={styles.fieldLabel}>Delivery Option</Text>
            <Text style={styles.modeHelperText}>
              Choose whether to add a delivery charge, block checkout below your minimum, or provide free delivery.
            </Text>

            <View style={styles.modeOptionList}>
              <Pressable
                onPress={() =>
                  setDraft((current) => ({ ...current, below_minimum_order_mode: 'charge_delivery' }))
                }
                style={[
                  styles.modeOption,
                  draft.below_minimum_order_mode === 'charge_delivery' ? styles.modeOptionActive : null,
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.modeOptionTitle,
                      draft.below_minimum_order_mode === 'charge_delivery' ? styles.modeOptionTitleActive : null,
                    ]}
                  >
                    Add Delivery Charge
                  </Text>
                  <Text
                    style={[
                      styles.modeOptionText,
                      draft.below_minimum_order_mode === 'charge_delivery' ? styles.modeOptionTextActive : null,
                    ]}
                  >
                    Charge below ₹{draft.minimum_order_value || 0}; free delivery at or above it.
                  </Text>
                </View>
                <View
                  style={[
                    styles.modeIndicator,
                    draft.below_minimum_order_mode === 'charge_delivery' ? styles.modeIndicatorActive : null,
                  ]}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  setDraft((current) => ({ ...current, below_minimum_order_mode: 'block_order' }))
                }
                style={[
                  styles.modeOption,
                  draft.below_minimum_order_mode === 'block_order' ? styles.modeOptionActive : null,
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.modeOptionTitle,
                      draft.below_minimum_order_mode === 'block_order' ? styles.modeOptionTitleActive : null,
                    ]}
                  >
                    Block Order
                  </Text>
                  <Text
                    style={[
                      styles.modeOptionText,
                      draft.below_minimum_order_mode === 'block_order' ? styles.modeOptionTextActive : null,
                    ]}
                  >
                    Do not allow checkout below your minimum cart value.
                  </Text>
                </View>
                <View
                  style={[
                    styles.modeIndicator,
                    draft.below_minimum_order_mode === 'block_order' ? styles.modeIndicatorActive : null,
                  ]}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  setDraft((current) => ({ ...current, below_minimum_order_mode: 'free_delivery' }))
                }
                style={[
                  styles.modeOption,
                  draft.below_minimum_order_mode === 'free_delivery' ? styles.modeOptionActive : null,
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.modeOptionTitle,
                      draft.below_minimum_order_mode === 'free_delivery' ? styles.modeOptionTitleActive : null,
                    ]}
                  >
                    Free Delivery
                  </Text>
                  <Text
                    style={[
                      styles.modeOptionText,
                      draft.below_minimum_order_mode === 'free_delivery' ? styles.modeOptionTextActive : null,
                    ]}
                  >
                    Allow orders without adding any delivery charge.
                  </Text>
                </View>
                <View
                  style={[
                    styles.modeIndicator,
                    draft.below_minimum_order_mode === 'free_delivery' ? styles.modeIndicatorActive : null,
                  ]}
                />
              </Pressable>
            </View>
          </View>

          {draft.below_minimum_order_mode === 'charge_delivery' ? (
            <>
              <ProfileField
                label="Free Delivery At (₹)"
                icon="pricetag-outline"
                keyboardType="number-pad"
                value={String(draft.minimum_order_value)}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    minimum_order_value: Number(value.replace(/[^0-9]/g, '') || '0'),
                  }))
                }
              />
              <ProfileField
                label="Delivery Charge Below Minimum (₹)"
                icon="car-outline"
                keyboardType="number-pad"
                value={String(draft.delivery_charge)}
                onChangeText={(value) =>
                  setDraft((current) => ({
                    ...current,
                    delivery_charge: Number(value.replace(/[^0-9]/g, '') || '0'),
                  }))
                }
              />
            </>
          ) : draft.below_minimum_order_mode === 'block_order' ? (
            <ProfileField
              label="Minimum Cart Value (₹)"
              icon="pricetag-outline"
              keyboardType="number-pad"
              value={String(draft.minimum_order_value)}
              onChangeText={(value) =>
                setDraft((current) => ({
                  ...current,
                  minimum_order_value: Number(value.replace(/[^0-9]/g, '') || '0'),
                }))
              }
              />
          ) : (
            <Text style={styles.helperText}>Customers can place orders without a minimum cart restriction or delivery charge.</Text>
          )}

          {quickRequestBuilding ? <View style={styles.addressCard}>
            <Text style={styles.addressLabel}>Quick Request Pricing</Text>
            <Text style={styles.helperText}>
              These prices are used for quick requests at {quickRequestBuilding.name}.
            </Text>

            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <ProfileField
                  label="Tea Price (₹)"
                  icon="cafe-outline"
                  keyboardType="number-pad"
                  value={String(draft.quick_request_tea_price)}
                  onChangeText={(value) =>
                    setDraft((current) => ({
                      ...current,
                      quick_request_tea_price: Number(value.replace(/[^0-9]/g, '') || '0'),
                    }))
                  }
                />
              </View>

              <View style={styles.inlineField}>
                <ProfileField
                  label="Coffee Price (₹)"
                  icon="cafe"
                  keyboardType="number-pad"
                  value={String(draft.quick_request_coffee_price)}
                  onChangeText={(value) =>
                    setDraft((current) => ({
                      ...current,
                      quick_request_coffee_price: Number(value.replace(/[^0-9]/g, '') || '0'),
                    }))
                  }
                />
              </View>
            </View>
          </View> : null}

          {profile?.can_manage_print_pricing ? (
            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>Print Pricing</Text>
              <Text style={styles.helperText}>
                These per-page rates are used for stationery print orders.
              </Text>

              <View style={styles.inlineFieldRow}>
                <View style={styles.inlineField}>
                  <ProfileField
                    label="B & W / Page (₹)"
                    icon="print-outline"
                    keyboardType="decimal-pad"
                    value={draft.print_bw_price}
                    onChangeText={(value) =>
                      setDraft((current) => ({ ...current, print_bw_price: normalizePriceInput(value) }))
                    }
                  />
                </View>

                <View style={styles.inlineField}>
                  <ProfileField
                    label="Color / Page (₹)"
                    icon="color-palette-outline"
                    keyboardType="decimal-pad"
                    value={draft.print_color_price}
                    onChangeText={(value) =>
                      setDraft((current) => ({ ...current, print_color_price: normalizePriceInput(value) }))
                    }
                  />
                </View>
              </View>

              <ProfileField
                label="Legal / Page (₹)"
                icon="document-text-outline"
                keyboardType="decimal-pad"
                value={draft.print_legal_price}
                onChangeText={(value) =>
                  setDraft((current) => ({ ...current, print_legal_price: normalizePriceInput(value) }))
                }
              />
            </View>
          ) : null}

          <View style={styles.creditCard}>
            <View style={styles.creditCopy}>
              <Text style={styles.addressLabel}>Office Wallet Credit</Text>
              <Text style={styles.creditTitle}>
                {draft.office_wallet_credit_enabled ? 'Credit is ON' : 'Credit is OFF'}
              </Text>
              <Text style={styles.addressText}>
                When credit is on, office-wallet orders can still go through even if the office wallet balance is low,
                and that office wallet can go negative until it is topped up.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  office_wallet_credit_enabled: !current.office_wallet_credit_enabled,
                }))
              }
              style={[
                styles.creditToggle,
                draft.office_wallet_credit_enabled ? styles.creditToggleOn : styles.creditToggleOff,
              ]}
            >
              <View
                style={[
                  styles.creditToggleThumb,
                  draft.office_wallet_credit_enabled ? styles.creditToggleThumbOn : styles.creditToggleThumbOff,
                ]}
              />
            </Pressable>
          </View>

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

          <View style={styles.statusRow}>
            <Text style={styles.fieldLabel}>Store Status</Text>
            <ActionButton
              label={draft.store_open ? 'Store Online' : 'Store Offline'}
              tone={draft.store_open ? 'success' : 'muted'}
              onPress={() => setDraft((current) => ({ ...current, store_open: !current.store_open }))}
            />
          </View>

          <Pressable style={styles.storeHoursCard} onPress={() => setScreen('hours')}>
            <View style={styles.storeHoursIcon}>
              <Ionicons name="time-outline" size={22} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.storeHoursCopy}>
              <Text style={styles.storeHoursTitle}>Store Hours</Text>
              <Text style={styles.storeHoursSubtitle}>{storeHoursSummary(draft.store_hours_enabled, draft.store_hours)}</Text>
              <Text style={styles.storeHoursNote}>
                {draft.store_open ? 'Auto availability by hours' : 'Store Offline overrides hours'}
              </Text>
            </View>
            <View style={styles.storeHoursEditButton}>
              <Text style={styles.storeHoursEditText}>Edit</Text>
              <Ionicons name="chevron-forward" size={17} color={tokens.colors.vendorPrimary} />
            </View>
          </Pressable>

          <View style={styles.addressCard}>
            <Text style={styles.addressLabel}>Assigned Buildings</Text>
            {buildings.length ? (
              buildings.map((building) => (
                <Text key={building.id} style={styles.addressText}>
                  {building.name}
                  {building.address ? ` • ${building.address}` : ''}
                </Text>
              ))
            ) : (
              <Text style={styles.addressText}>No assigned building found.</Text>
            )}
          </View>

          <View style={styles.actionGroupCard}>
            <ActionButton
              label={saving ? 'Saving...' : 'Save Changes'}
              onPress={() => {
                void saveChanges();
              }}
              disabled={saving}
            />

            <View style={styles.orRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.divider} />
            </View>

            <ActionButton label="Logout" tone="muted" icon="log-out-outline" onPress={logout} />
          </View>

          <Text style={styles.appVersionText}>App v1.1.10 • production</Text>
          <Pressable
            accessibilityRole="button"
            disabled={checkingOta}
            onPress={() => {
              void checkForOtaUpdate();
            }}
            style={({ pressed }) => [
              styles.otaCheckButton,
              pressed && !checkingOta ? styles.otaCheckButtonPressed : null,
            ]}
          >
            <Ionicons name="cloud-download-outline" size={16} color={tokens.colors.vendorPrimary} />
            <Text style={styles.otaCheckButtonText}>
              {checkingOta ? 'Checking for Update…' : 'Check for Update'}
            </Text>
          </Pressable>
          {otaStatus ? <Text style={styles.otaStatusText}>{otaStatus}</Text> : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}
        </View>
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
    const monday = hours.mon;
    setActiveQuickAction('copy');
    onChangeHours(
      STORE_DAYS.reduce<StoreHours>((next, day) => {
        next[day.key] = {
          ...hours[day.key],
          ...(hours[day.key].is_open ? { opens_at: monday.opens_at, closes_at: monday.closes_at } : null),
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

  const hasInvalidTime = STORE_DAYS.some((day) => {
    const entry = hours[day.key];
    return entry.is_open && (!isValidTime(entry.opens_at) || !isValidTime(entry.closes_at));
  });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.hoursContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hoursHeader}>
          <Pressable style={styles.hoursBackButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={26} color="#232328" />
          </Pressable>
          <View style={styles.hoursHeaderText}>
            <Text style={styles.hoursScreenTitle}>Store Hours</Text>
            <Text style={styles.hoursScreenSubtitle}>Set when customers can place orders.</Text>
          </View>
        </View>

        <View style={styles.weeklyCard}>
          <View style={styles.weeklyCopy}>
            <Text style={styles.weeklyEyebrow}>Weekly Schedule</Text>
            <Text style={styles.weeklyTitle}>{enabled ? `${openDays} ${openDays === 1 ? 'day' : 'days'} open` : 'Schedule off'}</Text>
            <Text style={styles.weeklyBody}>
              {enabled
                ? 'The store auto-closes outside these hours. Manual Offline still overrides this schedule.'
                : 'Turn this on to choose weekly opening hours. Until then, customers can order whenever Store Status is online.'}
            </Text>
          </View>
          <Pressable
            style={[styles.largeToggle, enabled ? styles.largeToggleOn : styles.largeToggleOff]}
            onPress={onToggleEnabled}
          >
            <View style={[styles.largeToggleThumb, enabled ? styles.largeToggleThumbOn : styles.largeToggleThumbOff]} />
          </Pressable>
        </View>

        {enabled ? (
          <>
            <View style={styles.hoursQuickRow}>
              <Pressable
                style={[styles.hoursQuickButton, activeQuickAction === 'copy' ? styles.hoursQuickButtonActive : null]}
                onPress={copyMondayToOpenDays}
              >
                <Ionicons
                  name="copy-outline"
                  size={17}
                  color={activeQuickAction === 'copy' ? '#ffffff' : tokens.colors.vendorPrimary}
                />
                <Text style={[styles.hoursQuickText, activeQuickAction === 'copy' ? styles.hoursQuickTextActive : null]}>
                  Copy Mon to open days
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
                  Weekend closed
                </Text>
              </Pressable>
            </View>

            {STORE_DAYS.map((day) => {
              const entry = hours[day.key];

              return (
                <View key={day.key} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{day.short}</Text>
                    </View>
                    <View style={styles.dayTitleWrap}>
                      <Text style={styles.dayTitle}>{day.label}</Text>
                      <Text style={styles.daySubtitle}>
                        {entry.is_open ? `${entry.opens_at} - ${entry.closes_at}` : 'Closed'}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.dayOpenButton, entry.is_open ? styles.dayOpenButtonActive : null]}
                      onPress={() => updateDay(day.key, { is_open: !entry.is_open })}
                    >
                      <Text style={[styles.dayOpenText, entry.is_open ? styles.dayOpenTextActive : null]}>
                        {entry.is_open ? 'Open' : 'Closed'}
                      </Text>
                    </Pressable>
                  </View>

                  {entry.is_open ? (
                    <View style={styles.timeRow}>
                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Opens</Text>
                        <View style={styles.timeInputWrap}>
                          <Ionicons name="time-outline" size={16} color={tokens.colors.vendorPrimary} />
                          <TextInput
                            value={entry.opens_at}
                            onChangeText={(value) => updateDay(day.key, { opens_at: normalizeTimeInput(value) })}
                            keyboardType="number-pad"
                            maxLength={5}
                            style={styles.timeInput}
                            placeholder="08:00"
                            placeholderTextColor="#9a9aa3"
                          />
                        </View>
                      </View>

                      <View style={styles.timeField}>
                        <Text style={styles.timeLabel}>Closes</Text>
                        <View style={styles.timeInputWrap}>
                          <Ionicons name="time-outline" size={16} color={tokens.colors.vendorPrimary} />
                          <TextInput
                            value={entry.closes_at}
                            onChangeText={(value) => updateDay(day.key, { closes_at: normalizeTimeInput(value) })}
                            keyboardType="number-pad"
                            maxLength={5}
                            style={styles.timeInput}
                            placeholder="20:00"
                            placeholderTextColor="#9a9aa3"
                          />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}

        {hasInvalidTime ? <Text style={styles.errorText}>Use 24-hour time like 08:00 or 20:00.</Text> : null}
      </ScrollView>

      <View style={styles.hoursBottomBar}>
        <ActionButton
          label={enabled ? (saving ? 'Saving...' : 'Save Hours') : 'Turn On Schedule'}
          onPress={() => {
            if (!enabled) {
              onToggleEnabled();
              return;
            }
            onSave();
          }}
          disabled={saving || hasInvalidTime}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 106,
    gap: 10,
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
    fontSize: 29,
    fontWeight: '900',
  },
  hoursScreenSubtitle: {
    color: '#777782',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  weeklyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  weeklyCopy: {
    flex: 1,
    minWidth: 0,
  },
  weeklyEyebrow: {
    color: tokens.colors.vendorPrimary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  weeklyTitle: {
    color: '#19191f',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  weeklyBody: {
    color: '#6f6f78',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 8,
  },
  largeToggle: {
    width: 60,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  largeToggleOn: {
    backgroundColor: tokens.colors.vendorPrimary,
    alignItems: 'flex-end',
  },
  largeToggleOff: {
    backgroundColor: '#d8d8e2',
    alignItems: 'flex-start',
  },
  largeToggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  largeToggleThumbOn: {},
  largeToggleThumbOff: {},
  hoursQuickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  hoursQuickButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
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
  hoursQuickText: {
    color: tokens.colors.vendorPrimary,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  hoursQuickTextActive: {
    color: '#ffffff',
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e7eb',
    padding: 10,
    gap: 8,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontSize: 18,
    fontWeight: '900',
  },
  daySubtitle: {
    color: '#777782',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  dayOpenButton: {
    minWidth: 72,
    minHeight: 36,
    borderRadius: 18,
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
    fontSize: 13,
    fontWeight: '900',
  },
  dayOpenTextActive: {
    color: tokens.colors.vendorPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timeField: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f6f6f8',
    padding: 9,
    gap: 5,
  },
  timeLabel: {
    color: '#777782',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timeInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timeInput: {
    flex: 1,
    color: '#19191f',
    fontSize: 18,
    fontWeight: '900',
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
});
