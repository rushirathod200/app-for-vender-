import { API_ENDPOINTS } from '../config/api';
import { AuthUser, LoginResult } from '../types/auth';
import {
  extractDataEnvelope,
  extractMessage,
  isRecord,
  toBooleanValue,
  toNumberValue,
  toNullableString,
  toStringValue,
} from '../utils/parsers';
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
    email: toNullableString(payload.email),
    mobile,
    role: toStringValue(payload.role, 'vendor'),
    is_active: toBooleanValue(payload.is_active, true),
    store_open: toBooleanValue(payload.store_open, true),
    delivery_charge: toNumberValue(payload.delivery_charge, 0),
    below_minimum_order_mode:
      toStringValue(payload.below_minimum_order_mode, 'charge_delivery') === 'block_order'
        ? 'block_order'
        : 'charge_delivery',
    minimum_order_value: toNumberValue(payload.minimum_order_value, 50),
    office_wallet_credit_enabled: toBooleanValue(payload.office_wallet_credit_enabled, false),
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

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
  deviceName?: string;
}): Promise<LoginResult> {
  const payload = await apiClient.post<unknown>(API_ENDPOINTS.authLogin, {
    email: input.email,
    password: input.password,
    device_name: input.deviceName ?? 'building-cafe-app',
  });

  const envelope = extractDataEnvelope(payload);

  let user: AuthUser | null = null;
  if (isRecord(envelope)) {
    user = normalizeAuthUser(envelope.user) ?? normalizeAuthUser(envelope);
  }

  if (!user && isRecord(payload)) {
    user = normalizeAuthUser(payload.user) ?? normalizeAuthUser(payload);
  }

  return {
    message: extractMessage(payload, 'Logged in successfully.'),
    token: extractToken(payload),
    user,
  };
}

export async function fetchCurrentAuthUser(): Promise<AuthUser | null> {
  const payload = await apiClient.get<unknown>(API_ENDPOINTS.authMe);
  const envelope = extractDataEnvelope(payload);

  if (isRecord(envelope)) {
    return normalizeAuthUser(envelope.user) ?? normalizeAuthUser(envelope);
  }

  if (isRecord(payload)) {
    return normalizeAuthUser(payload.user) ?? normalizeAuthUser(payload);
  }

  return null;
}

export async function logoutCurrentSession(input?: { deviceToken?: string | null }): Promise<void> {
  await apiClient.post<unknown>(API_ENDPOINTS.authLogout, {
    device_token: input?.deviceToken ?? null,
  });
}
