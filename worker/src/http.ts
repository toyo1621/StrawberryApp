import type { Env } from './types';
import { RANKINGS_API_VERSION } from './generated/rankingContract';

const MAX_REQUEST_BODY_BYTES = 2_048;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://toyo1621.github.io',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
];
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,96}$/;

export const getReleaseId = (env?: Env) => (
  env?.CF_VERSION_METADATA?.tag || env?.CF_VERSION_METADATA?.id || 'development'
);

export const getRequestId = (request: Request): string => {
  const candidate = request.headers.get('cf-ray') ?? '';
  return SAFE_REQUEST_ID_PATTERN.test(candidate) ? candidate : crypto.randomUUID();
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const getConfiguredOrigins = (env?: Env): string[] => {
  const configured = env?.ALLOWED_ORIGINS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;
};

export const getAllowedOrigin = (origin?: string, env?: Env): string => {
  if (!origin) {
    return '*';
  }

  const allowed = getConfiguredOrigins(env);
  return allowed.includes(origin) ? origin : allowed[0];
};

export const isAllowedOrigin = (origin?: string, env?: Env): boolean => (
  Boolean(origin && getConfiguredOrigins(env).includes(origin))
);

export const setCorsHeaders = (headers: Headers, origin?: string, env?: Env): void => {
  headers.set('access-control-allow-origin', getAllowedOrigin(origin, env));
  headers.set('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  headers.set('access-control-allow-headers', 'authorization,content-type');
  headers.set(
    'access-control-expose-headers',
    'x-api-version,x-d1-primary,x-d1-region,x-rankings-cache,x-release-id,x-request-id',
  );
  headers.set('access-control-max-age', '86400');
  headers.append('vary', 'Origin');
};

export const setSecurityHeaders = (headers: Headers): void => {
  headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
};

export const json = (
  data: unknown,
  init: ResponseInit = {},
  origin?: string,
  env?: Env,
): Response => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  setSecurityHeaders(headers);
  headers.set('x-api-version', String(RANKINGS_API_VERSION));
  headers.set('x-release-id', getReleaseId(env));
  setCorsHeaders(headers, origin, env);

  return new Response(JSON.stringify(data), { ...init, headers });
};

export const requireAllowedBrowserOrigin = (origin: string | undefined, env: Env): void => {
  if (origin && !isAllowedOrigin(origin, env)) {
    throw new HttpError(403, 'Browser write requests require an allowed origin.');
  }
};

export const readJsonBody = async (
  request: Request,
): Promise<Record<string, unknown> | null> => {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large.');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large.');
  }

  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
};
