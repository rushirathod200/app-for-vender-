import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useVendorApp } from '../../context/VendorAppContext';
import { VendorDeliveryPartner } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { useAndroidBackHandler } from '../../utils/useAndroidBackHandler';
import { ActionButton, SectionTitle, StatusBadge } from '../shared/ui';
import { tokens } from '../shared/tokens';

type DeliveryMode =
  | { screen: 'list' }
  | {
      screen: 'form';
      partnerId?: number;
    };

interface DeliveryPartnerFieldErrors {
  name?: string;
  email?: string;
  mobile?: string;
  password?: string;
}

export function VendorDeliveryPartnersScreen() {
  const {
    deliveryPartners,
    deliveryPartnersLoading,
    error,
    refreshDeliveryPartners,
    toggleDeliveryPartnerStatus,
    upsertDeliveryPartner,
  } = useVendorApp();
  const [mode, setMode] = useState<DeliveryMode>({ screen: 'list' });
  const [actionError, setActionError] = useState<string | null>(null);
  const editingPartner =
    mode.screen === 'form' && mode.partnerId
      ? deliveryPartners.find((partner) => partner.id === mode.partnerId) ?? null
      : null;

  useAutoClearValue(actionError, () => setActionError(null));

  React.useEffect(() => {
    if (mode.screen === 'form' && mode.partnerId && !editingPartner) {
      setMode({ screen: 'list' });
    }
  }, [editingPartner, mode]);

  useAndroidBackHandler(
    () => {
      setMode({ screen: 'list' });
      return true;
    },
    { enabled: mode.screen === 'form', priority: 20 },
  );

  if (mode.screen === 'form') {
    return (
      <DeliveryPartnerForm
        title={editingPartner ? 'Edit Delivery Boy' : 'Add Delivery Boy'}
        initialName={editingPartner?.name ?? ''}
        initialEmail={editingPartner?.email ?? ''}
        initialMobile={editingPartner?.mobile ?? ''}
        initialCanCancelOrders={editingPartner?.can_cancel_orders ?? true}
        submitLabel={editingPartner ? 'Update Delivery Boy' : 'Create Delivery Boy'}
        onBack={() => setMode({ screen: 'list' })}
        onSubmit={async (payload) => {
          await upsertDeliveryPartner({
            id: editingPartner?.id,
            name: payload.name,
            email: payload.email,
            mobile: payload.mobile,
            password: payload.password,
            is_active: true,
            can_cancel_orders: payload.can_cancel_orders,
          });
          setMode({ screen: 'list' });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={deliveryPartnersLoading}
            onRefresh={() => {
              void refreshDeliveryPartners({ force: true });
            }}
          />
        }
      >
        <SectionTitle
          title="Delivery Boys"
          subtitle={`${deliveryPartners.filter((partner) => partner.partner_active).length} active partners`}
        />

        {Array.from(new Set([error, actionError].filter((message): message is string => !!message))).map((message) => (
          <Text key={message} style={styles.errorText}>{message}</Text>
        ))}

        {deliveryPartners.map((partner) => (
          <PartnerCard
            key={partner.id}
            partner={partner}
            onEdit={() => setMode({ screen: 'form', partnerId: partner.id })}
            onToggleStatus={() => {
              setActionError(null);
              void toggleDeliveryPartnerStatus(partner.id).catch((toggleError) => {
                setActionError(toggleError instanceof Error ? toggleError.message : 'Could not update delivery partner.');
              });
            }}
          />
        ))}
      </ScrollView>

      <Pressable style={styles.fabButton} onPress={() => setMode({ screen: 'form' })}>
        <Ionicons name="add" size={30} color="#ffffff" />
      </Pressable>
    </View>
  );
}

function PartnerCard({
  partner,
  onEdit,
  onToggleStatus,
}: {
  partner: VendorDeliveryPartner;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const firstLetter = partner.name.charAt(0).toUpperCase();
  const isActive = partner.partner_active && partner.app_access_active;

  return (
    <View style={[styles.partnerCard, !isActive ? styles.partnerCardInactive : null]}>
      <View style={styles.partnerHeaderRow}>
        <View style={styles.partnerMain}>
          <View style={[styles.avatarCircle, !isActive ? styles.avatarInactive : null]}>
            <Text style={styles.avatarLetter}>{firstLetter}</Text>
          </View>

          <View>
            <Text numberOfLines={1} style={styles.partnerName}>{partner.name}</Text>
            <Text numberOfLines={1} style={styles.partnerEmail}>{partner.email ?? partner.mobile ?? '--'}</Text>
          </View>
        </View>

        <StatusBadge label={isActive ? 'ACTIVE' : 'INACTIVE'} tone={isActive ? 'green' : 'red'} />
      </View>

      <View style={styles.permissionSummaryRow}>
        <Ionicons
          name={partner.can_cancel_orders ? 'checkmark-circle-outline' : 'shield-checkmark-outline'}
          size={15}
          color={partner.can_cancel_orders ? '#27865d' : '#b45309'}
        />
        <Text style={[styles.permissionSummaryText, !partner.can_cancel_orders ? styles.permissionSummaryBlocked : null]}>
          {partner.can_cancel_orders ? 'Can cancel orders' : 'Order cancellation blocked'}
        </Text>
      </View>

      <View style={styles.partnerActionsRow}>
        <ActionButton label="Edit" tone="muted" icon="create-outline" style={styles.partnerActionButton} onPress={onEdit} />
        <ActionButton
          label={isActive ? 'Disable' : 'Activate'}
          tone={isActive ? 'muted' : 'success'}
          icon={isActive ? 'power-outline' : 'checkmark-outline'}
          style={[styles.partnerActionButton, isActive ? styles.partnerDisableButton : null]}
          onPress={onToggleStatus}
        />
      </View>
    </View>
  );
}

function DeliveryPartnerForm({
  title,
  initialName,
  initialEmail,
  initialMobile,
  initialCanCancelOrders,
  submitLabel,
  onBack,
  onSubmit,
}: {
  title: string;
  initialName: string;
  initialEmail: string | null;
  initialMobile: string | null;
  initialCanCancelOrders: boolean;
  submitLabel: string;
  onBack: () => void;
  onSubmit: (input: {
    name: string;
    email: string;
    mobile: string;
    password?: string;
    can_cancel_orders: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail ?? '');
  const [mobile, setMobile] = useState(initialMobile ?? '');
  const [password, setPassword] = useState('');
  const [preventOrderCancellation, setPreventOrderCancellation] = useState(!initialCanCancelOrders);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<DeliveryPartnerFieldErrors>({});

  useAutoClearValue(error, () => setError(null));

  const editing = Boolean(initialName);
  const validateForm = (): boolean => {
    const nextErrors: DeliveryPartnerFieldErrors = {};
    const normalizedEmail = email.trim();
    const normalizedMobile = mobile.replace(/\D/g, '');

    if (name.trim().length < 2) {
      nextErrors.name = 'Enter the delivery partner’s full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (normalizedMobile.length !== 10) {
      nextErrors.mobile = 'Enter a valid 10 digit mobile number.';
    }
    if ((!editing && password.length < 8) || (editing && password.length > 0 && password.length < 8)) {
      nextErrors.password = editing
        ? 'New password must contain at least 8 characters.'
        : 'Password must contain at least 8 characters.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topNavRow}>
          <Pressable style={styles.backBtn} onPress={onBack}>
            <Ionicons name="close" size={20} color="#75757f" />
          </Pressable>
          <Text style={styles.formTitle}>{title}</Text>
        </View>

        <View style={styles.formCard}>
          <FormField
            label="Full Name"
            icon="person-outline"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (fieldErrors.name) setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Enter full name"
            error={fieldErrors.name}
          />

          <FormField
            label="Email Address"
            icon="mail-outline"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={fieldErrors.email}
          />

          <FormField
            label="Mobile Number"
            icon="call-outline"
            value={mobile}
            onChangeText={(value) => {
              setMobile(value.replace(/\D/g, '').slice(0, 10));
              if (fieldErrors.mobile) setFieldErrors((current) => ({ ...current, mobile: undefined }));
            }}
            placeholder="Enter 10 digit mobile"
            keyboardType="number-pad"
            maxLength={10}
            error={fieldErrors.mobile}
          />

          <FormField
            label={editing ? 'New Password (Optional)' : 'Password'}
            icon="key-outline"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            placeholder={editing ? 'Leave blank to keep current password' : 'Set a password'}
            secureTextEntry
            error={fieldErrors.password}
          />
        </View>

        <View style={styles.permissionsCard}>
          <View style={styles.permissionsHeadingRow}>
            <View style={styles.permissionsIcon}>
              <Ionicons name="shield-checkmark-outline" size={19} color={tokens.colors.vendorPrimary} />
            </View>
            <View style={styles.permissionsHeadingCopy}>
              <Text style={styles.permissionsTitle}>Order permissions</Text>
              <Text style={styles.permissionsSubtitle}>Control what this delivery boy can do.</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: preventOrderCancellation }}
            style={[styles.permissionOption, preventOrderCancellation ? styles.permissionOptionSelected : null]}
            onPress={() => setPreventOrderCancellation((current) => !current)}
          >
            <Ionicons
              name={preventOrderCancellation ? 'checkbox' : 'square-outline'}
              size={24}
              color={preventOrderCancellation ? tokens.colors.vendorPrimary : '#8a8a94'}
            />
            <View style={styles.permissionOptionCopy}>
              <Text style={styles.permissionOptionTitle}>Prevent order cancellation</Text>
              <Text style={styles.permissionOptionHelp}>
                They can accept and complete orders, but cannot cancel them.
              </Text>
            </View>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ActionButton
          label={saving ? 'Saving...' : submitLabel}
          disabled={saving}
          onPress={() => {
            if (saving) {
              return;
            }

            if (!validateForm()) {
              setError('Please correct the highlighted delivery partner details.');
              return;
            }

            setSaving(true);
            setError(null);
            void onSubmit({
              name: name.trim(),
              email: email.trim().toLowerCase(),
              mobile,
              can_cancel_orders: !preventOrderCancellation,
              ...(password.trim() ? { password } : {}),
            })
              .catch((submitError) => {
                setError(submitError instanceof Error ? submitError.message : 'Could not save delivery partner.');
              })
              .finally(() => {
                setSaving(false);
              });
          }}
        />
      </ScrollView>
    </View>
  );
}

function FormField({
  label,
  icon,
  error,
  ...props
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldInputWrap, error ? styles.fieldInputWrapError : null]}>
        <Ionicons name={icon} size={18} color={tokens.colors.vendorPrimary} />
        <TextInput placeholderTextColor="#9a9aa3" style={styles.fieldInput} {...props} />
      </View>
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
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
    paddingBottom: 86,
    gap: 12,
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  partnerCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 16,
    padding: 10,
    gap: 8,
  },
  partnerCardInactive: {
    opacity: 0.74,
  },
  partnerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  partnerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.vendorPrimary,
  },
  avatarInactive: {
    backgroundColor: '#f39d63',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  partnerName: {
    color: '#212127',
    fontSize: 15,
    fontWeight: '900',
  },
  partnerEmail: {
    color: '#8b8b95',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  permissionSummaryRow: {
    minHeight: 30,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  permissionSummaryText: {
    color: '#27865d',
    fontSize: 11,
    fontWeight: '800',
  },
  permissionSummaryBlocked: {
    color: '#b45309',
  },
  partnerActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  partnerActionButton: {
    flex: 1,
  },
  partnerDisableButton: {
    backgroundColor: '#fff1f0',
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
  formTitle: {
    color: '#232328',
    fontSize: 22,
    fontWeight: '900',
  },
  formCard: {
    backgroundColor: '#f7f7f8',
    borderWidth: 1,
    borderColor: '#ededf2',
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  permissionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ededf2',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 11,
  },
  permissionsHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  permissionsIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#fff3e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionsHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  permissionsTitle: {
    color: '#232328',
    fontSize: 14,
    fontWeight: '900',
  },
  permissionsSubtitle: {
    color: '#777782',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  permissionOption: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f7f7f8',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  permissionOptionSelected: {
    borderColor: '#f0b98e',
    backgroundColor: '#fff8f2',
  },
  permissionOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  permissionOptionTitle: {
    color: '#2e2e35',
    fontSize: 13,
    fontWeight: '900',
  },
  permissionOptionHelp: {
    color: '#777782',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 3,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: '#31313a',
    fontSize: 13,
    fontWeight: '700',
  },
  fieldInputWrap: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e4e4ea',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldInputWrapError: {
    borderColor: tokens.colors.danger,
    backgroundColor: '#fff7f7',
  },
  fieldErrorText: {
    color: tokens.colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  fieldInput: {
    flex: 1,
    color: '#232328',
    fontSize: 14,
    fontWeight: '600',
  },
});
