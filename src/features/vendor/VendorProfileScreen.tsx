import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useVendorApp } from '../../context/VendorAppContext';
import { BelowMinimumOrderMode } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { resolveVendorDisplayName } from '../../utils/vendor';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';

export function VendorProfileScreen() {
  const { logout } = useAuth();
  const { profile, saveProfile, buildings, error } = useVendorApp();
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    mobile: '',
    delivery_charge: 0,
    store_open: true,
    below_minimum_order_mode: 'charge_delivery' as BelowMinimumOrderMode,
    minimum_order_value: 50,
    quick_request_tea_price: 15,
    quick_request_coffee_price: 20,
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
      store_open: profile.store_open,
      below_minimum_order_mode: profile.below_minimum_order_mode,
      minimum_order_value: profile.minimum_order_value,
      quick_request_tea_price: profile.quick_request_tea_price,
      quick_request_coffee_price: profile.quick_request_coffee_price,
      office_wallet_credit_enabled: profile.office_wallet_credit_enabled,
    });
  }, [profile]);

  const displayName = useMemo(
    () => resolveVendorDisplayName(draft.name || (profile?.name ?? null), buildings),
    [buildings, draft.name, profile?.name],
  );

  const saveChanges = async (): Promise<void> => {
    if (!draft.name.trim() || !draft.email.trim() || draft.mobile.replace(/\D/g, '').length !== 10) {
      setInfo('Please fill all mandatory vendor details correctly.');
      return;
    }

    if (draft.below_minimum_order_mode === 'block_order' && draft.minimum_order_value <= 0) {
      setInfo('Enter a valid minimum cart value greater than 0.');
      return;
    }

    if (draft.quick_request_tea_price <= 0 || draft.quick_request_coffee_price <= 0) {
      setInfo('Set valid tea and coffee prices for quick requests.');
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
        store_open: draft.store_open,
        below_minimum_order_mode: draft.below_minimum_order_mode,
        minimum_order_value: draft.minimum_order_value,
        quick_request_tea_price: draft.quick_request_tea_price,
        quick_request_coffee_price: draft.quick_request_coffee_price,
        office_wallet_credit_enabled: draft.office_wallet_credit_enabled,
      });
      setInfo('Profile settings updated.');
    } catch (saveError) {
      setInfo(saveError instanceof Error ? saveError.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

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

          <View style={styles.deliveryModeCard}>
            <Text style={styles.fieldLabel}>Delivery Option</Text>
            <Text style={styles.modeHelperText}>
              Choose whether to add delivery charges below ₹50 or block checkout below your own minimum cart value.
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
                    Allow orders below ₹50 and apply a delivery charge.
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
            </View>
          </View>

          {draft.below_minimum_order_mode === 'charge_delivery' ? (
            <ProfileField
              label="Delivery Charge (₹)"
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
          ) : (
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
          )}

          <View style={styles.addressCard}>
            <Text style={styles.addressLabel}>Quick Request Pricing</Text>
            <Text style={styles.helperText}>
              These prices are used when this cafe is selected as the default tea or coffee quick-request vendor for a building.
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
          </View>

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
});
