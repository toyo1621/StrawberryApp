const API_TIMEOUT_MS = 6_000;
const API_ATTEMPTS = 2;
const MAX_RETRY_DELAY_MS = 2_000;
const rankingsApiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

export const hasRankingsApi = (): boolean => rankingsApiUrl.length > 0;

export class RankingsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryAfterMs?: number,
  ) {
    super(message);
  }
}

const isRetryableStatus = (status: number | undefined): boolean => (
  status === undefined
  || status === 408
  || status === 429
  || (status >= 500 && status <= 599)
);

export const isTemporaryApiFailure = (error: unknown): boolean => {
  const status = error instanceof RankingsApiError ? error.status : undefined;
  return isRetryableStatus(status);
};

export const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const wait = (durationMs: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
};

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
  }
  const date = Date.parse(value);
  if (!Number.isFinite(date)) {
    return undefined;
  }
  return Math.min(Math.max(0, date - Date.now()), MAX_RETRY_DELAY_MS);
};

const getRetryDelay = (error: unknown, attempt: number): number => {
  if (error instanceof RankingsApiError && error.retryAfterMs !== undefined) {
    return error.retryAfterMs;
  }
  const exponentialDelay = 250 * (2 ** attempt);
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS);
};

const requestOnce = async <T>(
  path: string,
  parse: (value: unknown) => T,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${rankingsApiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    const body = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const message = body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : 'Rankings API request failed.';
      throw new RankingsApiError(
        message,
        response.status,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }
    return parse(body);
  } finally {
    clearTimeout(timeout);
  }
};

export const apiRequest = async <T>(
  path: string,
  parse: (value: unknown) => T,
  init: RequestInit = {},
  policy: { attempts?: number; timeoutMs?: number } = {},
): Promise<T> => {
  if (!hasRankingsApi()) {
    throw new RankingsApiError('Rankings API URL is not configured.');
  }

  let lastError: unknown;
  const attempts = policy.attempts ?? API_ATTEMPTS;
  const timeoutMs = policy.timeoutMs ?? API_TIMEOUT_MS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await requestOnce(path, parse, init, timeoutMs);
    } catch (error) {
      lastError = error;
      const status = error instanceof RankingsApiError ? error.status : undefined;
      if (!isRetryableStatus(status) || attempt === attempts - 1) {
        throw error;
      }
      await wait(getRetryDelay(error, attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new RankingsApiError('Rankings API request failed.');
};
