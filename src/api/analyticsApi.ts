import { API_ENDPOINTS } from '../config/api';
import {
  AnalyticsDateRangeKey,
  TodaySoFarData,
  VendorBusinessInsights,
  WeeklyReportData,
} from '../types/analytics';
import { extractDataEnvelope } from '../utils/parsers';
import { apiClient } from './httpClient';

export async function fetchVendorBusinessInsights(params?: {
  range?: AnalyticsDateRangeKey;
  startDate?: string;
  endDate?: string;
}): Promise<VendorBusinessInsights> {
  const queryParts: string[] = [];

  if (params?.range) {
    queryParts.push(`range=${encodeURIComponent(params.range)}`);
  }
  if (params?.startDate) {
    queryParts.push(`start_date=${encodeURIComponent(params.startDate)}`);
  }
  if (params?.endDate) {
    queryParts.push(`end_date=${encodeURIComponent(params.endDate)}`);
  }

  const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const response = await apiClient.get<unknown>(`${API_ENDPOINTS.vendorAnalyticsInsights}${queryStr}`);
  const payload = extractDataEnvelope(response);

  return payload as VendorBusinessInsights;
}

export async function fetchTodaySoFar(): Promise<TodaySoFarData> {
  const response = await apiClient.get<unknown>(API_ENDPOINTS.vendorAnalyticsToday);
  const payload = extractDataEnvelope(response);

  return payload as TodaySoFarData;
}

export async function fetchWeeklyReport(): Promise<WeeklyReportData> {
  const response = await apiClient.get<unknown>(API_ENDPOINTS.vendorAnalyticsWeeklyReport);
  const payload = extractDataEnvelope(response);

  return payload as WeeklyReportData;
}

export async function fetchProductAnalytics(productId: number): Promise<unknown> {
  const response = await apiClient.get<unknown>(`${API_ENDPOINTS.vendorAnalyticsProduct}/${productId}`);
  const payload = extractDataEnvelope(response);

  return payload;
}
