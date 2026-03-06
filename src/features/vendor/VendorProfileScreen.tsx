import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ActionButton, ModePill } from '../shared/ui';
import { tokens } from '../shared/tokens';
import { StoreProfile } from '../../types/workflow';

export function VendorProfileScreen() {
  const { storeProfile, saveStoreProfile, logout } = useAppWorkflow();
  const [draft, setDraft] = useState<StoreProfile>(storeProfile);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setDraft(storeProfile);
  }, [storeProfile]);

  const saveProfile = (): void => {
    if (!draft.storeName.trim() || !draft.phoneNumber.trim() || !draft.address.trim()) {
      setInfo('Please fill all mandatory store details.');
      return;
    }

    saveStoreProfile(draft);
    setInfo('Profile settings updated.');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Vendor — Profile" />

        <View style={styles.heroCard}>
          <View style={styles.storeIconWrap}>
            <MaterialCommunityIcons name="storefront-outline" size={38} color="#ffffff" />
          </View>
          <Text style={styles.heroTitle}>{draft.storeName}</Text>
          <View style={styles.accountTypeBadge}>
            <Text style={styles.accountTypeText}>VENDOR ACCOUNT</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>Store Information</Text>

          <ProfileField
            label="Store Name"
            icon="storefront-outline"
            value={draft.storeName}
            onChangeText={(value) => setDraft((current) => ({ ...current, storeName: value }))}
          />

          <ProfileField
            label="Min. Order for Free Delivery (₹)"
            icon="cash-outline"
            keyboardType="number-pad"
            value={String(draft.freeDeliveryMinOrder)}
            onChangeText={(value) =>
              setDraft((current) => ({
                ...current,
                freeDeliveryMinOrder: Number(value.replace(/[^0-9]/g, '') || '0'),
              }))
            }
          />

          <Text style={styles.helperText}>🚚 Orders above this amount get free delivery</Text>

          <ProfileField
            label="Delivery Charge (₹)"
            icon="car-outline"
            keyboardType="number-pad"
            value={String(draft.deliveryCharge)}
            onChangeText={(value) =>
              setDraft((current) => ({
                ...current,
                deliveryCharge: Number(value.replace(/[^0-9]/g, '') || '0'),
              }))
            }
          />

          <ProfileField
            label="Phone Number"
            icon="call-outline"
            value={draft.phoneNumber}
            onChangeText={(value) => setDraft((current) => ({ ...current, phoneNumber: value }))}
          />

          <ProfileField
            label="Store Address"
            icon="location-outline"
            multiline
            value={draft.address}
            onChangeText={(value) => setDraft((current) => ({ ...current, address: value }))}
            style={styles.multilineInput}
          />

          <View style={styles.actionGroupCard}>
            <ActionButton label="Save Changes" onPress={saveProfile} />

            <View style={styles.orRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.divider} />
            </View>

            <ActionButton label="Logout" tone="muted" icon="log-out-outline" onPress={logout} />
          </View>

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
    fontSize: 38,
    fontWeight: '900',
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
    fontSize: 34,
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
  multilineInput: {
    minHeight: 66,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  helperText: {
    color: '#9c9ca5',
    fontSize: 13,
    fontWeight: '600',
    marginTop: -4,
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
  infoText: {
    marginTop: 2,
    color: '#6c6c76',
    fontSize: 14,
    fontWeight: '600',
  },
});
