import { API_ENDPOINTS } from '../config/api';
import { AuthUser, SendOtpResult, VerifyOtpResult } from '../types/auth';
import {
  extractDataEnvelope,
  extractMessage,
  isRecord,
  toBooleanValue,
  toNumberValue,
  toNullableString,
  toStringValue,
} from '../utils/parsers';
import { requestWithFallback } from './requestWithFallback';
import { apiClient } from './httpClient';

function normalizeAuthUser(payload: unknown): AuthUser | null {
  if (!isRecord(payload)) {
    return null;
  }

  const id = toNumberValue(payload.id, 0);
  const mobile = toStringValue(payload.mobile, '');

  if (!id && !mobile) {
    return null;
  }

  return {
    id,
    name: toNullableString(payload.name),
    mobile,
    role: toStringValue(payload.role, 'vendor'),
    is_active: toBooleanValue(payload.is_active, true),
  };
}

function extractToken(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const envelope = extractDataEnvelope(payload);
  if (isRecord(envelope)) {
    const nestedToken =
      toNullableString(envelope.token) ??
      toNullableString(envelope.access_token) ??
      toNullableString(envelope.auth_token);

    if (nestedToken) {
      return nestedToken;
    }
  }

  return (
    toNullableString(payload.token) ??
    toNullableString(payload.access_token) ??
    toNullableString(payload.auth_token)
  );
}

export async function sendOtp(mobile: string): Promise<SendOtpResult> {
  const payload = await requestWithFallback<unknown>([
    () => apiClient.post(API_ENDPOINTS.sendOtp, { mobile }),
    () => apiClient.post('/otp/send', { mobile }),
  ]);

  const devOtp = isRecord(payload)
    ? toNullableString(payload.dev_otp) ??
      (isRecord(payload.data) ? toNullableString(payload.data.dev_otp) : null) ??
      undefined
    : undefined;

  return {
    message: extractMessage(payload, 'OTP sent successfully.'),
    devOtp,
  };
}

export async function verifyOtp(mobile: string, code: string): Promise<VerifyOtpResult> {
  const payload = await requestWithFallback<unknown>([
    () => apiClient.post(API_ENDPOINTS.verifyOtp, { mobile, code }),
    () => apiClient.post('/otp/verify', { mobile, code }),
  ]);

  const envelope = extractDataEnvelope(payload);

  let user: AuthUser | null = null;
  if (isRecord(envelope)) {
    user = normalizeAuthUser(envelope.user) ?? normalizeAuthUser(envelope);
  }

  if (!user && isRecord(payload)) {
    user = normalizeAuthUser(payload.user) ?? normalizeAuthUser(payload);
  }

  return {
    message: extractMessage(payload, 'OTP verified successfully.'),
    token: extractToken(payload),
    user,
  };
}

export async function fetchCurrentAuthUser(): Promise<AuthUser | null> {
  const payload = await requestWithFallback<unknown>([
    () => apiClient.get(API_ENDPOINTS.vendorMe),
    () => apiClient.get('/me'),
  ]);

  const envelope = extractDataEnvelope(payload);

  if (isRecord(envelope)) {
    return normalizeAuthUser(envelope.user) ?? normalizeAuthUser(envelope);
  }

  if (isRecord(payload)) {
    return normalizeAuthUser(payload.user) ?? normalizeAuthUser(payload);
  }

  return null;
}
