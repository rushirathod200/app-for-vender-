import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VendorTabKey } from '../../types/workflow';
import { tokens } from './tokens';

type Tone = 'vendor' | 'delivery' | 'success' | 'danger' | 'muted';

const toneMap: Record<Tone, { bg: string; text: string }> = {
  vendor: { bg: tokens.colors.vendorPrimary, text: '#ffffff' },
  delivery: { bg: tokens.colors.deliveryPrimary, text: '#ffffff' },
  success: { bg: tokens.colors.success, text: '#ffffff' },
  danger: { bg: tokens.colors.danger, text: '#ffffff' },
  muted: { bg: '#ececef', text: '#585861' },
};

export function ModePill({ text }: { text: string }) {
  return (
    <View style={styles.modePill}>
      <Text numberOfLines={1} ellipsizeMode="tail" style={styles.modePillText}>
        {text}
      </Text>
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  tone?: Tone;
  disabled?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  labelNumberOfLines?: number;
}

export function ActionButton({
  label,
  tone = 'vendor',
  disabled,
  onPress,
  icon,
  style,
  labelStyle,
  labelNumberOfLines = 1,
}: ActionButtonProps) {
  const colors = toneMap[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: colors.bg },
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={16} color={colors.text} style={styles.actionIcon} /> : null}
      <Text
        numberOfLines={labelNumberOfLines}
        adjustsFontSizeToFit={labelNumberOfLines === 1}
        minimumFontScale={0.86}
        style={[styles.actionButtonText, { color: colors.text }, labelStyle]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface IconOnlyButtonProps {
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'soft' | 'danger' | 'success';
}

export function IconOnlyButton({ onPress, icon, tone = 'soft' }: IconOnlyButtonProps) {
  const palette =
    tone === 'danger'
      ? { bg: tokens.colors.dangerSoft, color: tokens.colors.danger }
      : tone === 'success'
        ? { bg: tokens.colors.successSoft, color: tokens.colors.success }
        : { bg: '#eeefff', color: '#6a74f8' };

  return (
    <Pressable onPress={onPress} style={[styles.iconButton, { backgroundColor: palette.bg }]}>
      <Ionicons name={icon} size={16} color={palette.color} />
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
}

export function Field({ label, icon, rightIcon, onRightIconPress, style, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        {icon ? <Ionicons name={icon} size={18} color={tokens.colors.vendorPrimary} /> : null}
        <TextInput
          placeholderTextColor="#9a9aa3"
          style={[styles.fieldInput, style]}
          {...props}
        />
        {rightIcon ? (
          <Pressable onPress={onRightIconPress} style={styles.rightIconButton}>
            <Ionicons name={rightIcon} size={18} color="#9a9aa3" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface QuantityStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  tone?: 'vendor' | 'delivery';
  min?: number;
}

export function QuantityStepper({
  label,
  value,
  onChange,
  tone = 'vendor',
  min = 0,
}: QuantityStepperProps) {
  const accent = tone === 'delivery' ? tokens.colors.deliveryPrimary : tokens.colors.vendorPrimary;
  const canDecrement = value > min;
  const [draftValue, setDraftValue] = React.useState(String(value));
  const [isEditing, setIsEditing] = React.useState(false);
  const displayedValue = isEditing ? draftValue : String(value);
  const quantityFontSize = displayedValue.length >= 4 ? 14 : displayedValue.length === 3 ? 16 : 18;

  React.useEffect(() => {
    if (!isEditing) {
      setDraftValue(String(value));
    }
  }, [isEditing, value]);

  function applyValue(nextValue: number): void {
    const normalizedValue = Math.max(min, nextValue);
    setIsEditing(false);
    setDraftValue(String(normalizedValue));
    onChange(normalizedValue);
  }

  function handleChangeText(text: string): void {
    const digitsOnly = text.replace(/\D/g, '');
    setDraftValue(digitsOnly);

    if (digitsOnly === '') {
      onChange(min);
      return;
    }

    onChange(Math.max(min, Number(digitsOnly)));
  }

  function handleBlur(): void {
    const normalizedValue = draftValue === '' ? min : Math.max(min, Number(draftValue));
    setIsEditing(false);
    setDraftValue(String(normalizedValue));
    onChange(normalizedValue);
  }

  return (
    <View style={styles.quantityStepperWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.quantityStepperCard}>
        <Pressable
          onPress={() => applyValue(value - 1)}
          disabled={!canDecrement}
          style={[
            styles.quantityStepperButton,
            styles.quantityStepperButtonLeft,
            !canDecrement ? styles.quantityStepperButtonDisabled : null,
          ]}
        >
          <Ionicons name="remove" size={18} color={canDecrement ? accent : '#b8b8c0'} />
        </Pressable>

        <View style={styles.quantityStepperValueWrap}>
          <TextInput
            value={displayedValue}
            onFocus={() => {
              setIsEditing(true);
              setDraftValue(String(value));
            }}
            onBlur={handleBlur}
            onChangeText={handleChangeText}
            keyboardType="number-pad"
            selectTextOnFocus
            maxLength={4}
            style={[styles.quantityStepperInput, { fontSize: quantityFontSize }]}
          />
        </View>

        <Pressable
          onPress={() => applyValue(value + 1)}
          style={[
            styles.quantityStepperButton,
            styles.quantityStepperButtonRight,
            { backgroundColor: tone === 'delivery' ? '#eff4ff' : '#fff1e5' },
          ]}
        >
          <Ionicons name="add" size={18} color={accent} />
        </Pressable>
      </View>
    </View>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: 'orange' | 'green' | 'red' | 'gray' }) {
  const palette =
    tone === 'orange'
      ? { bg: '#fff1e7', color: '#ff7a1a' }
      : tone === 'green'
        ? { bg: '#e6f8ed', color: '#23b263' }
        : tone === 'red'
          ? { bg: '#ffeceb', color: '#ef534f' }
          : { bg: '#f0f0f3', color: '#8f8f97' };

  return (
    <View style={[styles.statusBadge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.statusBadgeText, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

interface SegmentTab {
  key: string;
  label: string;
  count?: number;
}

interface SegmentTabsProps {
  tabs: SegmentTab[];
  activeKey: string;
  onChange: (key: string) => void;
  palette?: 'vendor' | 'delivery';
}

export function SegmentTabs({ tabs, activeKey, onChange, palette = 'vendor' }: SegmentTabsProps) {
  const activeBg = palette === 'vendor' ? tokens.colors.vendorPrimary : tokens.colors.deliveryPrimary;

  return (
    <View style={styles.segmentWrap}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.segmentTab, isActive ? { backgroundColor: activeBg } : styles.segmentTabInactive]}
          >
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.segmentLabel, isActive ? styles.segmentLabelActive : styles.segmentLabelInactive]}>
              {tab.label}
            </Text>
            {typeof tab.count === 'number' ? (
              <View style={[styles.segmentCount, isActive ? styles.segmentCountActive : styles.segmentCountInactive]}>
                <Text style={[styles.segmentCountText, isActive ? styles.segmentCountTextActive : styles.segmentCountTextInactive]}>
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const vendorTabMeta: Record<VendorTabKey, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  dashboard: { label: 'Dashboard', icon: 'view-grid-outline' },
  orders: { label: 'Orders', icon: 'clipboard-text-outline' },
  products: { label: 'Products', icon: 'package-variant-closed' },
  delivery: { label: 'Delivery', icon: 'bike-fast' },
  analytics: { label: 'Analytics', icon: 'chart-box-outline' },
  wallet: { label: 'Wallet', icon: 'wallet-plus-outline' },
  manual: { label: 'Manual', icon: 'notebook-plus-outline' },
  reports: { label: 'Reports', icon: 'file-chart-outline' },
  referral: { label: 'Refer', icon: 'account-multiple-outline' },
  profile: { label: 'Profile', icon: 'account-outline' },
};

interface VendorBottomTabsProps {
  activeTab: VendorTabKey;
  onPressTab: (tab: VendorTabKey) => void;
  tabs?: VendorTabKey[];
}

export function VendorBottomTabs({ activeTab, onPressTab, tabs }: VendorBottomTabsProps) {
  const orderedTabs: VendorTabKey[] = tabs ?? ['dashboard', 'orders', 'products', 'delivery', 'profile'];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTabletWidth = width >= 768;
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.bottomTabsShell, { paddingBottom: bottomInset }]}>
      <View style={[styles.bottomTabsWrap, isTabletWidth ? styles.bottomTabsWrapTablet : null]}>
        {orderedTabs.map((tab) => {
          const meta = vendorTabMeta[tab];
          const isActive = tab === activeTab;

          return (
            <Pressable
              key={tab}
              onPress={() => onPressTab(tab)}
              style={styles.bottomTabButton}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <View style={[styles.bottomTabIconWrap, isActive ? styles.bottomTabIconWrapActive : null]}>
                <MaterialCommunityIcons
                  name={meta.icon}
                  size={21}
                  color={isActive ? tokens.colors.vendorPrimary : '#9c9ca6'}
                />
              </View>
              <Text style={[styles.bottomTabLabel, isActive ? styles.bottomTabLabelActive : null]}>{meta.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modePill: {
    alignSelf: 'center',
    backgroundColor: tokens.colors.darkPill,
    borderRadius: tokens.radius.round,
    maxWidth: '96%',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modePillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButton: {
    height: 46,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: tokens.spacing.lg,
    gap: 8,
    shadowColor: '#f07d1c',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  actionIcon: {
    marginTop: 1,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    color: '#31313a',
    fontSize: 13,
    fontWeight: '700',
  },
  fieldInputWrap: {
    height: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.inputBg,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldInput: {
    flex: 1,
    color: tokens.colors.text,
    fontSize: 15,
  },
  rightIconButton: {
    padding: 4,
  },
  quantityStepperWrap: {
    gap: 8,
  },
  quantityStepperCard: {
    height: 48,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  quantityStepperButton: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f6f8',
  },
  quantityStepperButtonLeft: {
    borderRightWidth: 1,
    borderRightColor: tokens.colors.border,
  },
  quantityStepperButtonRight: {
    borderLeftWidth: 1,
    borderLeftColor: tokens.colors.border,
  },
  quantityStepperButtonDisabled: {
    backgroundColor: '#f2f2f4',
  },
  quantityStepperValueWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  quantityStepperInput: {
    alignSelf: 'stretch',
    minWidth: 0,
    color: tokens.colors.text,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  statusBadge: {
    borderRadius: tokens.radius.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  segmentWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentTab: {
    flex: 1,
    minHeight: 32,
    borderRadius: tokens.radius.sm,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentTabInactive: {
    backgroundColor: '#ececef',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: '#ffffff',
  },
  segmentLabelInactive: {
    color: '#8f8f97',
  },
  segmentCount: {
    borderRadius: tokens.radius.round,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  segmentCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentCountInactive: {
    backgroundColor: '#dfe0e5',
  },
  segmentCountText: {
    fontSize: 10,
    fontWeight: '800',
  },
  segmentCountTextActive: {
    color: '#ffffff',
  },
  segmentCountTextInactive: {
    color: '#8f8f97',
  },
  bottomTabsShell: {
    borderTopWidth: 1,
    borderTopColor: '#e5e6ea',
    backgroundColor: '#fbfbfc',
    alignItems: 'center',
  },
  bottomTabsWrap: {
    width: '100%',
    minHeight: 58,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 5,
  },
  bottomTabsWrapTablet: {
    maxWidth: 760,
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    minHeight: 46,
  },
  bottomTabIconWrap: {
    width: 36,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.sm,
  },
  bottomTabIconWrapActive: {
    backgroundColor: '#fff1e8',
  },
  bottomTabLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: '#9c9ca6',
    fontWeight: '600',
  },
  bottomTabLabelActive: {
    color: tokens.colors.vendorPrimary,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f1f24',
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#7f7f89',
    lineHeight: 18,
  },
});
