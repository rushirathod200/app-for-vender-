import { ApiError } from './httpClient';

export async function requestWithFallback<T>(
  callbacks: Array<() => Promise<T>>,
  retryStatuses: number[] = [404, 405],
): Promise<T> {
  let lastError: unknown;

  for (const callback of callbacks) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;

      if (error instanceof ApiError && retryStatuses.includes(error.status)) {
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Request failed');
}
