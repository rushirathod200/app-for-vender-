import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { topUpVendorWallet } from '../../api/vendorApi';
import { useVendorApp } from '../../context/VendorAppContext';
import { VendorWalletTargetType, VendorWalletTopUpReceipt } from '../../types/vendor';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { resolveVendorDisplayName } from '../../utils/vendor';
import { ActionButton } from '../shared/ui';
import { tokens } from '../shared/tokens';

interface VendorWalletTopUpScreenProps {
  onBack: () => void;
}

export function VendorWalletTopUpScreen({ onBack }: VendorWalletTopUpScreenProps) {
  const { profile, buildings, error } = useVendorApp();
  const scrollRef = useRef<ScrollView | null>(null);
  const [targetType, setTargetType] = useState<VendorWalletTargetType>('user');
  const [mobile, setMobile] = useState('');
  const [amount, setAmount] = useState('500');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<VendorWalletTopUpReceipt | null>(null);

  useAutoClearValue(feedback, () => setFeedback(null));

  const storeName = useMemo(
    () => resolveVendorDisplayName(profile?.name ?? null, buildings),
    [buildings, profile?.name],
  );

  const submit = async (): Promise<void> => {
    const cleanedMobile = mobile.replace(/\D/g, '');
    const numericAmount = Number(amount);

    if (cleanedMobile.length !== 10) {
      setFeedback('Enter a valid 10-digit mobile number.');
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeedback('Enter a valid amount greater than 0.');
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const result = await topUpVendorWallet({
        mobile: cleanedMobile,
        amount: numericAmount,
        target_type: targetType,
      });

      if (!result) {
        setFeedback('Could not complete wallet top-up.');
        return;
      }

      setReceipt(result);
      setFeedback(result.message);
      setMobile('');
      setAmount('500');
    } catch (submitError) {
      setFeedback(submitError instanceof Error ? submitError.message : 'Could not complete wallet top-up.');
    } finally {
      setSubmitting(false);
    }
  };

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
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={18} color="#232328" />
          </Pressable>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>Wallet Top-up</Text>
            <Text style={styles.headerSubtitle}>Add amount in anyone wallet using mobile number.</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Vendor Wallet Tool</Text>
          <Text style={styles.heroTitle}>{storeName}</Text>
          <Text style={styles.heroSub}>Credit customer or office wallets directly from the vendor app.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Select Wallet Type</Text>

          <View style={styles.typeRow}>
            <Pressable
              onPress={() => setTargetType('user')}
              style={[styles.typeCard, targetType === 'user' ? styles.typeCardActive : null]}
            >
              <Ionicons name="person-outline" size={18} color={targetType === 'user' ? '#ffffff' : tokens.colors.vendorPrimary} />
              <Text style={[styles.typeTitle, targetType === 'user' ? styles.typeTitleActive : null]}>User Wallet</Text>
              <Text style={[styles.typeSub, targetType === 'user' ? styles.typeSubActive : null]}>
                Credit normal customer wallet
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setTargetType('office')}
              style={[styles.typeCard, targetType === 'office' ? styles.typeCardActive : null]}
            >
              <Ionicons name="business-outline" size={18} color={targetType === 'office' ? '#ffffff' : tokens.colors.vendorPrimary} />
              <Text style={[styles.typeTitle, targetType === 'office' ? styles.typeTitleActive : null]}>Office Wallet</Text>
              <Text style={[styles.typeSub, targetType === 'office' ? styles.typeSubActive : null]}>
                Credit approved office wallet
              </Text>
            </Pressable>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color={tokens.colors.vendorPrimary} />
              <TextInput
                value={mobile}
                onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollTo({ y: 260, animated: true });
                  }, 120);
                }}
                placeholder="Enter linked mobile number"
                placeholderTextColor="#9a9aa3"
                style={styles.input}
                maxLength={10}
              />
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="wallet-outline" size={18} color={tokens.colors.vendorPrimary} />
              <TextInput
                value={amount}
                onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
                placeholder="Enter amount"
                placeholderTextColor="#9a9aa3"
                style={styles.input}
              />
            </View>
          </View>

          <ActionButton
            label={submitting ? 'Adding...' : 'Add Funds'}
            onPress={() => {
              void submit();
            }}
            disabled={submitting}
            icon="add-circle-outline"
          />

          {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {receipt ? (
          <View style={styles.receiptCard}>
            <Text style={styles.receiptEyebrow}>Last Top-up</Text>
            <Text style={styles.receiptTitle}>{receipt.wallet_label}</Text>
            <Text style={styles.receiptMeta}>
              {receipt.target_name ? `${receipt.target_name} • ` : ''}
              {receipt.mobile}
            </Text>

            <View style={styles.receiptBalanceRow}>
              <Text style={styles.receiptBalanceLabel}>Updated Balance</Text>
              <Text style={styles.receiptBalanceValue}>Rs {receipt.balance.toFixed(2)}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
  contentGrow: {
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f2f2f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
  },
  headerTitle: {
    color: '#202026',
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    marginTop: 2,
    color: '#7f7f89',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 22,
    backgroundColor: tokens.colors.vendorPrimary,
    padding: 14,
  },
  heroEyebrow: {
    color: '#ffe5d3',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  heroTitle: {
    marginTop: 4,
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroSub: {
    marginTop: 4,
    color: '#fff2e8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8e8ee',
    backgroundColor: '#f8f8fa',
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: '#202026',
    fontSize: 20,
    fontWeight: '900',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ececf0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 6,
  },
  typeCardActive: {
    borderColor: tokens.colors.vendorPrimary,
    backgroundColor: tokens.colors.vendorPrimary,
  },
  typeTitle: {
    color: '#202026',
    fontSize: 14,
    fontWeight: '800',
  },
  typeTitleActive: {
    color: '#ffffff',
  },
  typeSub: {
    color: '#8a8a94',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  typeSubActive: {
    color: '#fff1e6',
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    color: '#303038',
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e6e6ec',
    backgroundColor: '#f1f1f4',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#232328',
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackText: {
    color: '#2e2f36',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: tokens.colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  receiptCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#ffd4b4',
    backgroundColor: '#fff5ec',
    padding: 14,
    gap: 6,
  },
  receiptEyebrow: {
    color: tokens.colors.vendorPrimary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  receiptTitle: {
    color: '#202026',
    fontSize: 18,
    fontWeight: '900',
  },
  receiptMeta: {
    color: '#787882',
    fontSize: 13,
    fontWeight: '600',
  },
  receiptBalanceRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptBalanceLabel: {
    color: '#6c6c76',
    fontSize: 12,
    fontWeight: '700',
  },
  receiptBalanceValue: {
    color: '#202026',
    fontSize: 18,
    fontWeight: '900',
  },
});
