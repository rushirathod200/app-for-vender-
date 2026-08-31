export type ReferralStatus = 'pending' | 'contacted' | 'approved' | 'rejected';

export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';

export type PayoutMethod = 'upi' | 'bank';

export interface ReferralListItem {
  id: number;
  business_name: string;
  status: ReferralStatus;
  reward_coins: number;
  admin_notes: string | null;
  created_at: string | null;
}

export interface ReferralSummary {
  enabled: boolean;
  code: string;
  link: string;
  reward_coins: number;
  coin_value_inr: number;
  balance: number;
  lifetime_earned: number;
  referrals: ReferralListItem[];
}

export interface CoinTransactionItem {
  id: number;
  type: 'referral_credit' | 'payout_debit' | 'payout_reversal' | 'adjustment';
  amount: number;
  balance_after: number;
  created_at: string | null;
}

export interface PayoutItem {
  id: number;
  coins: number;
  amount_inr: number;
  method: PayoutMethod;
  destination: string;
  status: PayoutStatus;
  payment_reference: string | null;
  admin_notes: string | null;
  created_at: string | null;
}

export interface CoinsSummary {
  balance: number;
  lifetime_earned: number;
  coin_value_inr: number;
  balance_inr: number;
  min_payout_coins: number;
  can_withdraw: boolean;
  coins_needed: number;
  transactions: CoinTransactionItem[];
  payouts: PayoutItem[];
}

/** The amount is never sent — a withdrawal always takes the whole balance. */
export interface WithdrawInput {
  method: PayoutMethod;
  upi_id?: string;
  account_holder_name?: string;
  account_number?: string;
  ifsc?: string;
  bank_name?: string;
}
