import { API_BASE_URL, API_BASE_URL_IS_PLACEHOLDER } from '../config/api';
import { extractMessage, isRecord } from '../utils/parsers';

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | null | undefined>;
}

const GET_NETWORK_ATTEMPTS = 2;
const NETWORK_RETRY_DELAY_MS = 700;
const GET_REQUEST_TIMEOUT_MS = 12_000;
const MUTATION_REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function isNgrokUrl(value: string): boolean {
  try {
    return new URL(value).hostname.includes('ngrok');
  } catch {
    return false;
  }
}

function requestTimeoutMs(method: RequestOptions['method'], body: BodyInit | undefined): number {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return UPLOAD_REQUEST_TIMEOUT_MS;
  }

  return method === 'GET' ? GET_REQUEST_TIMEOUT_MS : MUTATION_REQUEST_TIMEOUT_MS;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

class HttpClient {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  async get<T>(path: string, query?: RequestOptions['query']): Promise<T> {
    return this.request<T>(path, { method: 'GET', query });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body });
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', body });
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (API_BASE_URL_IS_PLACEHOLDER) {
      throw new ApiError(
        'Set EXPO_PUBLIC_API_BASE_URL to a valid HTTPS URL ending with /api before using the app.',
        0,
        null,
      );
    }

    const url = this.buildUrl(path, options.query);
    const method = options.method ?? 'GET';

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (isNgrokUrl(API_BASE_URL)) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }

    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
        // Let fetch set the multipart boundary. Manually setting Content-Type
        // breaks React Native and browser uploads.
        body = options.body;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(options.body);
      }
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let response: Response | null = null;
    let lastNetworkError: unknown = null;
    const attempts = method === 'GET' ? GET_NETWORK_ATTEMPTS : 1;
    const timeoutMs = requestTimeoutMs(method, body);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        response = await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
        break;
      } catch (error) {
        lastNetworkError = isAbortError(error)
          ? new ApiError(
              'The request took too long. Please check your connection and try again.',
              0,
              { code: 'request_timeout', timeout_ms: timeoutMs },
            )
          : error;
        if (attempt < attempts) {
          await wait(NETWORK_RETRY_DELAY_MS * attempt);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response) {
      if (lastNetworkError instanceof ApiError) {
        throw lastNetworkError;
      }

      const nativeMessage = lastNetworkError instanceof Error
        ? lastNetworkError.message
        : String(lastNetworkError ?? 'Network request failed');
      throw new ApiError(
        `DeskDrop API request failed: ${url} (${nativeMessage})`,
        0,
        lastNetworkError,
      );
    }

    const payload = await this.readPayload(response);

    if (!response.ok) {
      const message = this.extractErrorMessage(payload, response.status);
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  }

  private buildUrl(path: string, query?: RequestOptions['query']): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${API_BASE_URL}${normalizedPath}`);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async readPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const text = await response.text();
    if (!text) {
      return null;
    }

    return { message: text };
  }

  private extractErrorMessage(payload: unknown, status: number): string {
    if (isRecord(payload) && isRecord(payload.errors)) {
      const firstField = Object.values(payload.errors)[0];
      if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
        return firstField[0];
      }
    }

    const message = extractMessage(payload, '');
    if (message) {
      return message;
    }

    if (status === 401) {
      return 'Unauthorized. Please login again.';
    }

    if (status === 403) {
      return 'You are not allowed to perform this action.';
    }

    return `Request failed (${status})`;
  }
}

export const apiClient = new HttpClient();
