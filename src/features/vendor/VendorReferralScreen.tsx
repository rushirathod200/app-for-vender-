import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { fetchCoinsSummary, fetchReferralSummary, requestPayout } from '../../api/referralApi';
import {
  CoinsSummary,
  PayoutMethod,
  PayoutStatus,
  ReferralStatus,
  ReferralSummary,
  WithdrawInput,
} from '../../types/referral';
import { extractMessage } from '../../utils/parsers';
import { useAutoClearValue } from '../../utils/useAutoClearValue';
import { ActionButton, Field, SectionTitle, SegmentTabs } from '../shared/ui';
import { tokens } from '../shared/tokens';

const statusCopy: Record<ReferralStatus, string> = {
  pending: 'Under review',
  contacted: 'We called them',
  approved: 'Approved',
  rejected: 'Not approved',
};

const txnLabels: Record<string, string> = {
  referral_credit: 'Referral reward',
  payout_debit: 'Withdrawal requested',
  payout_reversal: 'Withdrawal returned',
  adjustment: 'Adjustment',
};

export function VendorReferralScreen() {
  const [tab, setTab] = useState<'refer' | 'coins'>('refer');
  const [referral, setReferral] = useState<ReferralSummary | null>(null);
  const [coins, setCoins] = useState<CoinsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [method, setMethod] = useState<PayoutMethod>('upi');
  const [upiId, setUpiId] = useState('');
  const [holder, setHolder] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  useAutoClearValue(success, () => setSuccess(null));

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const [summary, wallet] = await Promise.all([fetchReferralSummary(), fetchCoinsSummary()]);
      setReferral(summary);
      setCoins(wallet);
    } catch (caught) {
      setError(extractMessage(caught, 'Could not load Refer & Earn. Please try again.'));
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function share(): Promise<void> {
    if (!referral) {
      return;
    }

    try {
      await Share.share({
        message: `Register your shop on DeskDrop and sell to offices in your building:\n${referral.link}`,
      });
    } catch {
      // Dismissing the share sheet is not an error worth showing.
    }
  }

  async function withdraw(): Promise<void> {
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    // No amount is sent: the server always pays out the whole balance.
    const input: WithdrawInput =
      method === 'upi'
        ? { method, upi_id: upiId.trim() }
        : {
            method,
            account_holder_name: holder.trim(),
            account_number: account.trim(),
            ifsc: ifsc.trim().toUpperCase(),
            bank_name: bankName.trim() || undefined,
          };

    try {
      await requestPayout(input);
      setSuccess('Withdrawal requested. Money reaches you within 24-48 working hours.');
      setUpiId('');
      setHolder('');
      setAccount('');
      setIfsc('');
      setBankName('');
      await load();
    } catch (caught) {
      setError(extractMessage(caught, 'Could not submit the withdrawal. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  function statusColor(status: ReferralStatus | PayoutStatus): string {
    if (status === 'approved' || status === 'paid') {
      return tokens.colors.success;
    }
    if (status === 'rejected') {
      return tokens.colors.danger;
    }
    return tokens.colors.vendorPrimaryDark;
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={tokens.colors.vendorPrimary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={tokens.colors.vendorPrimary} />}
    >
      <SectionTitle title="Refer & Earn" subtitle="Bring a shop, earn real money" />

      <SegmentTabs
        tabs={[
          { key: 'refer', label: 'Refer' },
          { key: 'coins', label: 'My coins' },
        ]}
        activeKey={tab}
        onChange={(key) => setTab(key as 'refer' | 'coins')}
      />

      {success ? <Text style={styles.success}>{success}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {tab === 'refer' && referral ? (
        <>
          <View style={styles.card}>
            <Text style={styles.hero}>Earn {referral.reward_coins} coins for every shop you bring in</Text>
            <Text style={styles.body}>
              Know a cafe, tiffin service or stationery shop? Share your link. Once we approve them the coins are yours,
              and 1 coin is Rs. {referral.coin_value_inr.toFixed(2)}.
            </Text>
            {!referral.enabled ? (
              <Text style={styles.notice}>New referrals are paused right now. Your coins are safe.</Text>
            ) : null}
          </View>

          <View style={styles.statRow}>
            <View style={[styles.stat, { backgroundColor: tokens.colors.vendorSoft }]}>
              <Text style={styles.statLabel}>COINS</Text>
              <Text style={styles.statValue}>{referral.balance}</Text>
            </View>
            <View style={[styles.stat, { backgroundColor: tokens.colors.surface }]}>
              <Text style={styles.statLabel}>TOTAL EARNED</Text>
              <Text style={styles.statValue}>{referral.lifetime_earned}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>YOUR INVITE CODE</Text>
            <Text style={styles.code}>{referral.code}</Text>
            <Text style={styles.link} numberOfLines={1}>{referral.link}</Text>
            <ActionButton label="Share invite link" icon="share-social-outline" onPress={() => void share()} style={styles.cta} />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>YOUR REFERRALS</Text>
            {referral.referrals.length === 0 ? (
              <Text style={styles.body}>No referrals yet. Share your link to get started.</Text>
            ) : (
              referral.referrals.map((item, index) => (
                <View key={item.id} style={[styles.row, index < referral.referrals.length - 1 ? styles.rowDivider : null]}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.business_name}</Text>
                    <Text style={[styles.rowMeta, { color: statusColor(item.status) }]}>
                      {statusCopy[item.status]}
                      {item.status === 'rejected' && item.admin_notes ? ` · ${item.admin_notes}` : ''}
                    </Text>
                  </View>
                  {item.reward_coins > 0 ? (
                    <Text style={styles.rowPlus}>+{item.reward_coins}</Text>
                  ) : (
                    <Ionicons name="ellipsis-horizontal" size={16} color={tokens.colors.muted} />
                  )}
                </View>
              ))
            )}
          </View>
        </>
      ) : null}

      {tab === 'coins' && coins ? (
        <>
          <View style={[styles.card, styles.balanceCard]}>
            <Text style={styles.label}>YOUR BALANCE</Text>
            <Text style={styles.balance}>Rs. {coins.balance_inr.toFixed(2)}</Text>
            <Text style={styles.body}>
              {coins.balance} coins · 1 coin = Rs. {coins.coin_value_inr.toFixed(2)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>WITHDRAW</Text>

            {!coins.can_withdraw ? (
              <Text style={styles.body}>
                {coins.balance <= 0
                  ? `You have no coins yet. Refer a shop to earn your first ${coins.min_payout_coins} coins.`
                  : `You need at least ${coins.min_payout_coins} coins to withdraw. You have ${coins.balance} — ${coins.coins_needed} more to go.`}
              </Text>
            ) : (
              <>
                <Text style={styles.body}>
                  Your whole balance goes out in one request — there is no part withdrawal.
                </Text>

                <View style={styles.methods}>
                  {(['upi', 'bank'] as PayoutMethod[]).map((value) => {
                    const selected = method === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => setMethod(value)}
                        style={[
                          styles.method,
                          {
                            backgroundColor: selected ? tokens.colors.vendorSoft : tokens.colors.card,
                            borderColor: selected ? tokens.colors.vendorPrimary : tokens.colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.methodLabel, { color: selected ? tokens.colors.vendorPrimaryDark : tokens.colors.muted }]}>
                          {value === 'upi' ? 'UPI' : 'Bank transfer'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {method === 'upi' ? (
                  <Field
                    autoCapitalize="none"
                    label="UPI ID"
                    onChangeText={setUpiId}
                    placeholder="name@okhdfcbank"
                    value={upiId}
                  />
                ) : (
                  <>
                    <Field label="Account holder name" onChangeText={setHolder} value={holder} />
                    <Field keyboardType="number-pad" label="Account number" onChangeText={setAccount} value={account} />
                    <Field
                      autoCapitalize="characters"
                      label="IFSC"
                      maxLength={11}
                      onChangeText={setIfsc}
                      placeholder="HDFC0001234"
                      value={ifsc}
                    />
                    <Field label="Bank name" onChangeText={setBankName} value={bankName} />
                  </>
                )}

                <ActionButton
                  disabled={submitting}
                  label={submitting ? 'Submitting...' : `Withdraw Rs. ${coins.balance_inr.toFixed(2)}`}
                  onPress={() => void withdraw()}
                  style={styles.cta}
                />
                <Text style={styles.fine}>Your bank and UPI details are stored encrypted.</Text>
              </>
            )}
          </View>

          {coins.payouts.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.label}>WITHDRAWALS</Text>
              {coins.payouts.map((payout, index) => (
                <View key={payout.id} style={[styles.row, index < coins.payouts.length - 1 ? styles.rowDivider : null]}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>Rs. {payout.amount_inr.toFixed(2)}</Text>
                    <Text style={styles.rowMeta}>
                      {payout.destination}
                      {payout.payment_reference ? ` · ${payout.payment_reference}` : ''}
                      {payout.status === 'rejected' && payout.admin_notes ? ` · ${payout.admin_notes}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.rowStatus, { color: statusColor(payout.status) }]}>{payout.status}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.label}>COIN HISTORY</Text>
            {coins.transactions.length === 0 ? (
              <Text style={styles.body}>Nothing yet.</Text>
            ) : (
              coins.transactions.map((txn, index) => (
                <View key={txn.id} style={[styles.row, index < coins.transactions.length - 1 ? styles.rowDivider : null]}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{txnLabels[txn.type] ?? txn.type}</Text>
                    <Text style={styles.rowMeta}>Balance after: {txn.balance_after}</Text>
                  </View>
                  <Text style={[styles.rowPlus, txn.amount < 0 ? styles.rowMinus : null]}>
                    {txn.amount > 0 ? '+' : ''}
                    {txn.amount}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  content: { gap: tokens.spacing.md, padding: tokens.spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: tokens.colors.card,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    padding: tokens.spacing.lg,
  },
  balanceCard: { alignItems: 'center' },
  hero: { color: tokens.colors.text, fontSize: 18, fontWeight: '800', lineHeight: 25 },
  body: { color: tokens.colors.muted, fontSize: 13, fontWeight: '500', lineHeight: 20, marginTop: 8 },
  notice: {
    backgroundColor: tokens.colors.warningSoft,
    borderRadius: tokens.radius.xs,
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    padding: 10,
  },
  statRow: { flexDirection: 'row', gap: tokens.spacing.sm },
  stat: { borderRadius: tokens.radius.md, flex: 1, padding: tokens.spacing.lg },
  statLabel: { color: tokens.colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  statValue: { color: tokens.colors.text, fontSize: 24, fontWeight: '800', marginTop: 5 },
  label: { color: tokens.colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  code: { color: tokens.colors.vendorPrimaryDark, fontSize: 24, fontWeight: '800', letterSpacing: 4, marginTop: 8 },
  link: { color: tokens.colors.muted, fontSize: 11, fontWeight: '500', marginTop: 5 },
  balance: { color: tokens.colors.text, fontSize: 32, fontWeight: '800', marginTop: 8 },
  cta: { marginTop: tokens.spacing.md },
  fine: { color: tokens.colors.muted, fontSize: 11, fontWeight: '500', marginTop: 8, textAlign: 'center' },
  methods: { flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
  method: { alignItems: 'center', borderRadius: tokens.radius.sm, borderWidth: 1.5, flex: 1, paddingVertical: 12 },
  methodLabel: { fontSize: 13, fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', gap: tokens.spacing.sm, paddingVertical: 12 },
  rowDivider: { borderBottomColor: tokens.colors.border, borderBottomWidth: 1 },
  rowCopy: { flex: 1 },
  rowTitle: { color: tokens.colors.text, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: tokens.colors.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  rowPlus: { color: tokens.colors.success, fontSize: 15, fontWeight: '800' },
  rowMinus: { color: tokens.colors.muted },
  rowStatus: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  success: { color: tokens.colors.success, fontSize: 12, fontWeight: '700' },
  error: { color: tokens.colors.danger, fontSize: 12, fontWeight: '700' },
});
