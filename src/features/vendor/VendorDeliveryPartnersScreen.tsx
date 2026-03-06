import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAppWorkflow } from '../../context/AppWorkflowContext';
import { ActionButton, ModePill, SectionTitle, StatusBadge } from '../shared/ui';
import { DeliveryPartner } from '../../types/workflow';
import { tokens } from '../shared/tokens';

type DeliveryMode =
  | { screen: 'list' }
  | {
      screen: 'form';
      partnerId?: string;
    };

export function VendorDeliveryPartnersScreen() {
  const { deliveryPartners, toggleDeliveryPartnerStatus, upsertDeliveryPartner } = useAppWorkflow();
  const [mode, setMode] = useState<DeliveryMode>({ screen: 'list' });

  if (mode.screen === 'form') {
    const editingPartner = mode.partnerId
      ? deliveryPartners.find((partner) => partner.id === mode.partnerId) ?? null
      : null;

    return (
      <DeliveryPartnerForm
        title={editingPartner ? 'Edit Delivery Boy' : 'Add Delivery Boy'}
        initialName={editingPartner?.name ?? ''}
        initialEmail={editingPartner?.email ?? ''}
        submitLabel={editingPartner ? 'Update Delivery Boy' : 'Create Delivery Boy'}
        onBack={() => setMode({ screen: 'list' })}
        onSubmit={(payload) => {
          upsertDeliveryPartner({
            id: editingPartner?.id,
            name: payload.name,
            email: payload.email,
            password: payload.password,
          });
          setMode({ screen: 'list' });
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ModePill text="🛵 Vendor — Delivery" />

        <SectionTitle
          title="Delivery Boys"
          subtitle={`${deliveryPartners.filter((partner) => partner.isActive).length} active partners`}
        />

        {deliveryPartners.map((partner) => (
          <PartnerCard
            key={partner.id}
            partner={partner}
            onEdit={() => setMode({ screen: 'form', partnerId: partner.id })}
            onToggleStatus={() => toggleDeliveryPartnerStatus(partner.id)}
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
  partner: DeliveryPartner;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const firstLetter = partner.name.charAt(0).toUpperCase();

  return (
    <View style={[styles.partnerCard, !partner.isActive ? styles.partnerCardInactive : null]}>
      <View style={styles.partnerHeaderRow}>
        <View style={styles.partnerMain}>
          <View style={[styles.avatarCircle, !partner.isActive ? styles.avatarInactive : null]}>
            <Text style={styles.avatarLetter}>{firstLetter}</Text>
          </View>

          <View>
            <Text numberOfLines={1} style={styles.partnerName}>{partner.name}</Text>
            <Text numberOfLines={1} style={styles.partnerEmail}>{partner.email}</Text>
          </View>
        </View>

        <StatusBadge label={partner.isActive ? 'ACTIVE' : 'INACTIVE'} tone={partner.isActive ? 'green' : 'red'} />
      </View>

      <View style={styles.deliveryCountBox}>
        <Text style={styles.deliveryCountLabel}>Total Deliveries</Text>
        <Text style={styles.deliveryCountValue}>{partner.totalDeliveries}</Text>
      </View>

      <View style={styles.partnerActionsRow}>
        <ActionButton label="Edit" tone="muted" icon="create-outline" style={styles.partnerActionButton} onPress={onEdit} />
        <ActionButton
          label={partner.isActive ? 'Disable' : 'Activate'}
          tone={partner.isActive ? 'muted' : 'success'}
          icon={partner.isActive ? 'power-outline' : 'checkmark-outline'}
          style={[styles.partnerActionButton, partner.isActive ? styles.partnerDisableButton : null]}
          onPress={onToggleStatus}
        />
      </View>
    </View>
  );
}

interface DeliveryPartnerFormProps {
  title: string;
  initialName: string;
  initialEmail: string;
  submitLabel: string;
  onBack: () => void;
  onSubmit: (input: { name: string; email: string; password: string }) => void;
}

function DeliveryPartnerForm({
  title,
  initialName,
  initialEmail,
  submitLabel,
  onBack,
  onSubmit,
}: DeliveryPartnerFormProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');

  const canSubmit = useMemo(
    () => name.trim().length > 1 && email.includes('@') && (password.length >= 4 || initialName.length > 0),
    [name, email, password, initialName.length],
  );

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <ModePill text="🛵 Vendor — Delivery" />

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
            onChangeText={setName}
            placeholder="Enter full name"
          />

          <FormField
            label="Email Address"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <FormField
            label="Password"
            icon="key-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Set a password"
            secureTextEntry
          />
        </View>

        <ActionButton
          label={submitLabel}
          disabled={!canSubmit}
          onPress={() => {
            if (!canSubmit) {
              return;
            }

            onSubmit({
              name: name.trim(),
              email: email.trim().toLowerCase(),
              password,
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
  ...props
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <Ionicons name={icon} size={18} color={tokens.colors.vendorPrimary} />
        <TextInput placeholderTextColor="#9a9aa3" style={styles.fieldInput} {...props} />
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
    paddingTop: 8,
    paddingBottom: 86,
    gap: 12,
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
  deliveryCountBox: {
    borderRadius: 12,
    backgroundColor: '#f1f1f4',
    borderWidth: 1,
    borderColor: '#ececf2',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deliveryCountLabel: {
    color: '#9a9aa3',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryCountValue: {
    color: '#232328',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 1,
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
  fieldInput: {
    flex: 1,
    color: '#232328',
    fontSize: 14,
    fontWeight: '600',
  },
});
