import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { useVendorApp } from '../../context/VendorAppContext';
import { resolveVendorDisplayName } from '../../utils/vendor';
import { ActionButton, ModePill } from '../shared/ui';
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
  });

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

    setSaving(true);
    setInfo(null);

    try {
      await saveProfile({
        name: draft.name.trim(),
        email: draft.email.trim().toLowerCase(),
        mobile: draft.mobile,
        delivery_charge: draft.delivery_charge,
        store_open: draft.store_open,
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
        <ModePill text="🛵 Vendor — Profile" />

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

          <Text style={styles.helperText}>Update your store details and delivery settings.</Text>

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
