const API_TIMEOUT_MS = 6_000;
const API_ATTEMPTS = 2;
const rankingsApiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

export const hasRankingsApi = (): boolean => rankingsApiUrl.length > 0;

export class RankingsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export const isTemporaryApiFailure = (error: unknown): boolean => {
  const status = error instanceof RankingsApiError ? error.status : undefined;
  return status === undefined || status === 408 || status === 429 || (status >= 500 && status <= 599);
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
        throw new RankingsApiError(message, response.status);
      }

      return parse(body);
    } catch (error) {
      lastError = error;
      const status = error instanceof RankingsApiError ? error.status : undefined;
      const retryable = status === undefined || status === 408 || (status >= 500 && status <= 599);
      if (!retryable || attempt === attempts - 1) {
        throw error;
      }
      await wait(250 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new RankingsApiError('Rankings API request failed.');
};
