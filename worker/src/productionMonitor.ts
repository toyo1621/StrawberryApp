import { RANKINGS_API_VERSION } from './generated/rankingContract';
import type { Env } from './types';

const MONITOR_NAME = 'production';
const REQUEST_TIMEOUT_MS = 10_000;
const DETAILS_LIMIT = 240;

type MonitorState = 'pending' | 'healthy' | 'unhealthy';

type MonitorRow = {
  status: MonitorState;
  checked_at: string;
  latency_ms: number;
  details: string;
};

export type ProductionMonitorStatus = {
  status: MonitorState;
  checkedAt: string;
  latencyMs: number;
  details: string;
};

const normalizeBaseUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('The monitored web URL must use HTTPS.');
  }
  return url.toString().replace(/\/$/, '');
};

const safeDetails = (value: unknown): string => {
  const message = value instanceof Error ? value.message : String(value);
  return message.replace(/[\r\n]+/g, ' ').slice(0, DETAILS_LIMIT);
};

export const getProductionMonitorStatus = async (
  env: Env,
): Promise<ProductionMonitorStatus | null> => {
  const row = await env.DB.prepare(
    `
      SELECT status, checked_at, latency_ms, details
      FROM service_heartbeats
      WHERE monitor_name = ?
    `,
  ).bind(MONITOR_NAME).first<MonitorRow>();
  return row ? {
    status: row.status,
    checkedAt: row.checked_at,
    latencyMs: row.latency_ms,
    details: row.details,
  } : null;
};

const writeMonitorStatus = async (
  env: Env,
  status: MonitorState,
  checkedAt: string,
  latencyMs: number,
  details: string,
): Promise<void> => {
  await env.DB.prepare(
    `
      INSERT INTO service_heartbeats (monitor_name, status, checked_at, latency_ms, details)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(monitor_name) DO UPDATE SET
        status = excluded.status,
        checked_at = excluded.checked_at,
        latency_ms = excluded.latency_ms,
        details = excluded.details
    `,
  ).bind(MONITOR_NAME, status, checkedAt, latencyMs, details).run();
};

const notifyTransition = async (
  env: Env,
  status: Exclude<MonitorState, 'pending'>,
  checkedAt: string,
  details: string,
): Promise<void> => {
  if (!env.MONITOR_ALERT_WEBHOOK_URL) {
    return;
  }
  const webhook = new URL(env.MONITOR_ALERT_WEBHOOK_URL);
  if (webhook.protocol !== 'https:') {
    throw new Error('The monitor webhook must use HTTPS.');
  }
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      service: 'StrawberryApp',
      source: 'cloudflare-cron',
      status,
      checkedAt,
      details,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Monitor webhook returned ${response.status}.`);
  }
};

const verifyWebRelease = async (webAppUrl: string): Promise<string> => {
  const [pageResponse, releaseResponse] = await Promise.all([
    fetch(`${webAppUrl}/`, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
    fetch(`${webAppUrl}/release.json`, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  ]);
  if (!pageResponse.ok || !pageResponse.headers.get('content-type')?.includes('text/html')) {
    throw new Error(`The web app returned ${pageResponse.status} without HTML.`);
  }
  if (!releaseResponse.ok) {
    throw new Error(`The web release metadata returned ${releaseResponse.status}.`);
  }
  const release = await releaseResponse.json() as { release?: unknown; apiVersion?: unknown };
  if (typeof release.release !== 'string'
    || !/^[0-9a-f]{40}$/.test(release.release)
    || release.apiVersion !== RANKINGS_API_VERSION) {
    throw new Error('The web release metadata is invalid or incompatible.');
  }
  return release.release;
};

export const runProductionMonitor = async (env: Env): Promise<void> => {
  if (!env.WEB_APP_URL) {
    return;
  }
  const previous = await getProductionMonitorStatus(env);
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  let status: Exclude<MonitorState, 'pending'> = 'healthy';
  let details = '';
  let failure: unknown = null;

  try {
    const webAppUrl = normalizeBaseUrl(env.WEB_APP_URL);
    const [database, release] = await Promise.all([
      env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>(),
      verifyWebRelease(webAppUrl),
    ]);
    if (database?.ok !== 1) {
      throw new Error('The D1 health query failed.');
    }
    details = `web_release=${release}`;
  } catch (error) {
    status = 'unhealthy';
    details = safeDetails(error);
    failure = error;
  }

  const latencyMs = Math.max(0, Date.now() - startedAt);
  await writeMonitorStatus(env, status, checkedAt, latencyMs, details);
  if (status === 'unhealthy') {
    console.error(JSON.stringify({ event: 'production_monitor_failed', checkedAt, latencyMs, details }));
  } else if (previous?.status === 'unhealthy') {
    console.warn(JSON.stringify({ event: 'production_monitor_recovered', checkedAt, latencyMs }));
  }

  const shouldNotify = status === 'unhealthy'
    ? previous?.status !== 'unhealthy'
    : previous?.status === 'unhealthy';
  if (shouldNotify) {
    try {
      await notifyTransition(env, status, checkedAt, details);
    } catch (notificationError) {
      console.error(JSON.stringify({
        event: 'production_monitor_notification_failed',
        error: safeDetails(notificationError),
      }));
    }
  }
  if (failure) {
    throw new Error(`Production monitor failed: ${details}`);
  }
};
