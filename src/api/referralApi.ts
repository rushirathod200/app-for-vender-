import { API_ENDPOINTS } from '../config/api';
import { CoinsSummary, PayoutItem, ReferralSummary, WithdrawInput } from '../types/referral';
import { apiClient } from './httpClient';

interface Wrapped<T> {
  data: T;
}

export async function fetchReferralSummary(): Promise<ReferralSummary> {
  try {
    const response = await apiClient.get<Wrapped<ReferralSummary>>(API_ENDPOINTS.referrals);
    return response.data;
  } catch {
    return {
      enabled: false,
      code: 'DESKDROP',
      link: 'https://deskdrop.in',
      reward_coins: 0,
      coin_value_inr: 1.0,
      balance: 0,
      lifetime_earned: 0,
      referrals: [],
    };
  }
}

export async function fetchCoinsSummary(): Promise<CoinsSummary> {
  try {
    const response = await apiClient.get<Wrapped<CoinsSummary>>(API_ENDPOINTS.coins);
    return response.data;
  } catch {
    return {
      balance: 0,
      lifetime_earned: 0,
      coin_value_inr: 1.0,
      balance_inr: 0,
      min_payout_coins: 100,
      can_withdraw: false,
      coins_needed: 100,
      transactions: [],
      payouts: [],
    };
  }
}

export async function requestPayout(input: WithdrawInput): Promise<PayoutItem> {
  const response = await apiClient.post<Wrapped<PayoutItem>>(API_ENDPOINTS.payouts, input);
  return response.data;
}
