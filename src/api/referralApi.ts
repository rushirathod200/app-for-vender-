import { API_ENDPOINTS } from '../config/api';
import { CoinsSummary, PayoutItem, ReferralSummary, WithdrawInput } from '../types/referral';
import { apiClient } from './httpClient';

interface Wrapped<T> {
  data: T;
}

export async function fetchReferralSummary(): Promise<ReferralSummary> {
  const response = await apiClient.get<Wrapped<ReferralSummary>>(API_ENDPOINTS.referrals);
  return response.data;
}

export async function fetchCoinsSummary(): Promise<CoinsSummary> {
  const response = await apiClient.get<Wrapped<CoinsSummary>>(API_ENDPOINTS.coins);
  return response.data;
}

export async function requestPayout(input: WithdrawInput): Promise<PayoutItem> {
  const response = await apiClient.post<Wrapped<PayoutItem>>(API_ENDPOINTS.payouts, input);
  return response.data;
}
