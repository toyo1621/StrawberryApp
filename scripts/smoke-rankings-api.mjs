import { isSyntheticCleanupComplete } from './operational-contracts.mjs';

const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID;
const maximumRequestDurationMs = Number(process.env.MAX_API_REQUEST_DURATION_MS || 4_000);
const allowedOrigin = 'https://toyo1621.github.io';
const gameTypes = ['strawberry_rush', 'island_rush', 'flag_rush', 'color_rush'];
const islandRegions = [
  'all',
  'hokkaido_tohoku',
  'kanto',
  'chubu_kinki',
  'chugoku',
  'shikoku',
  'kyushu',
  'okinawa',
];

if (!apiUrl) {
  console.error('EXPO_PUBLIC_RANKINGS_API_URL is required.');
  process.exit(1);
}

const fetchWithRetry = async (path, init = {}, attempts = 4) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const separator = path.includes('?') ? '&' : '?';
      const smokePath = `${path}${separator}_smoke=${Date.now()}-${attempt}`;
      const response = await fetch(`${apiUrl}${smokePath}`, {
        cache: 'no-store',
        ...init,
        headers: {
          accept: 'application/json',
          'cache-control': 'no-cache',
          ...init.headers,
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }
      return { response, durationMs: Date.now() - startedAt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw lastError;
};

const assertOk = async (path, init) => {
  const { response, durationMs } = await fetchWithRetry(path, init);
  if (response.headers.get('x-content-type-options') !== 'nosniff') {
    throw new Error(`${path} is missing the nosniff security header.`);
  }
  if (
    response.headers.get('strict-transport-security') !== 'max-age=31536000; includeSubDomains'
    || response.headers.get('x-frame-options') !== 'DENY'
    || !response.headers.get('content-security-policy')?.includes("default-src 'none'")
    || !response.headers.get('x-request-id')
  ) {
    throw new Error(`${path} is missing hardened transport or response metadata.`);
  }
  if (response.headers.get('x-api-version') !== '4') {
    throw new Error(`${path} is not serving API version 4.`);
  }
  if (durationMs > maximumRequestDurationMs) {
    throw new Error(`${path} exceeded the ${maximumRequestDurationMs} ms latency budget.`);
  }
  return { body: await response.json(), headers: response.headers, durationMs };
};

const durations = [];
const healthResult = await assertOk('/health');
durations.push(healthResult.durationMs);
if (
  healthResult.body.ok !== true
  || healthResult.body.version !== 4
  || typeof healthResult.body.release !== 'string'
) {
  throw new Error('/health did not return the expected versioned status.');
}
if (
  expectedReleaseId
  && (
    healthResult.body.release !== expectedReleaseId
    || healthResult.headers.get('x-release-id') !== expectedReleaseId
  )
) {
  throw new Error(`/health is serving release ${healthResult.body.release}, expected ${expectedReleaseId}.`);
}
if (healthResult.headers.get('cache-control') !== 'no-store') {
  throw new Error('/health must not be cached.');
}

const rankingScopes = [
  ...gameTypes.filter((gameType) => gameType !== 'island_rush').map((gameType) => ({
    gameType,
    islandRegion: 'all',
  })),
  ...islandRegions.map((islandRegion) => ({ gameType: 'island_rush', islandRegion })),
];

for (const { gameType, islandRegion } of rankingScopes) {
  const result = await assertOk(
    `/rankings?gameType=${gameType}&islandRegion=${islandRegion}&period=all&limit=3`,
  );
  durations.push(result.durationMs);
  if (!Array.isArray(result.body)) {
    throw new Error(`/rankings did not return an array for ${gameType}.`);
  }
  for (const entry of result.body) {
    if (
      typeof entry.id !== 'string'
      || typeof entry.playerName !== 'string'
      || typeof entry.score !== 'number'
      || entry.gameType !== gameType
      || entry.islandRegion !== islandRegion
      || typeof entry.createdAt !== 'string'
    ) {
      throw new Error(`Ranking response includes an invalid ${gameType} entry.`);
    }
  }
}

const fetchCacheableLeaderboard = async () => {
  const startedAt = Date.now();
  const response = await fetch(
    `${apiUrl}/rankings?gameType=strawberry_rush&islandRegion=all&period=all&limit=30`,
    {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    },
  );
  const durationMs = Date.now() - startedAt;
  if (!response.ok || !Array.isArray(await response.json())) {
    throw new Error('The cacheable leaderboard request failed.');
  }
  if (durationMs > maximumRequestDurationMs) {
    throw new Error(`The cacheable leaderboard exceeded ${maximumRequestDurationMs} ms.`);
  }
  const cacheStatus = response.headers.get('x-rankings-cache');
  if (!['hit', 'miss', 'stale'].includes(cacheStatus)) {
    throw new Error(`The cacheable leaderboard returned an invalid cache status: ${cacheStatus}.`);
  }
  if (!response.headers.get('cache-control')?.includes('max-age=30')) {
    throw new Error('The cacheable leaderboard is missing its 30 second fresh TTL.');
  }
  if (!['true', 'false'].includes(response.headers.get('x-d1-primary'))) {
    throw new Error('The cacheable leaderboard is missing D1 primary metadata.');
  }
  if (!response.headers.get('x-d1-region') || response.headers.get('x-d1-region') === 'unknown') {
    throw new Error('The cacheable leaderboard is missing D1 region metadata.');
  }
  return { cacheStatus, durationMs };
};

const firstCacheObservation = await fetchCacheableLeaderboard();
durations.push(firstCacheObservation.durationMs);
let finalCacheObservation = firstCacheObservation;
for (let attempt = 0; attempt < 4 && finalCacheObservation.cacheStatus !== 'hit'; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 500));
  finalCacheObservation = await fetchCacheableLeaderboard();
  durations.push(finalCacheObservation.durationMs);
}
if (finalCacheObservation.cacheStatus !== 'hit') {
  throw new Error('The production leaderboard cache did not produce a hit.');
}

const preflight = await fetch(`${apiUrl}/scores`, {
  method: 'OPTIONS',
  headers: {
    origin: allowedOrigin,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'authorization,content-type',
  },
  signal: AbortSignal.timeout(8_000),
});
if (
  preflight.status !== 204
  || preflight.headers.get('access-control-allow-origin') !== allowedOrigin
  || !preflight.headers.get('access-control-allow-headers')?.includes('authorization')
  || preflight.headers.get('x-api-version') !== '4'
  || !preflight.headers.get('x-release-id')
  || preflight.headers.get('x-frame-options') !== 'DENY'
) {
  throw new Error('Allowed CORS preflight failed.');
}

const rejectedPreflight = await fetch(`${apiUrl}/scores`, {
  method: 'OPTIONS',
  headers: { origin: 'https://example.com', 'access-control-request-method': 'POST' },
  signal: AbortSignal.timeout(8_000),
});
if (rejectedPreflight.status !== 403) {
  throw new Error('Disallowed CORS preflight was not rejected.');
}

const unknownPreflight = await fetch(`${apiUrl}/missing`, {
  method: 'OPTIONS',
  headers: { origin: allowedOrigin, 'access-control-request-method': 'GET' },
  signal: AbortSignal.timeout(8_000),
});
if (unknownPreflight.status !== 404) {
  throw new Error('An unknown CORS preflight was not rejected.');
}

const unsupportedPreflightMethod = await fetch(`${apiUrl}/scores`, {
  method: 'OPTIONS',
  headers: { origin: allowedOrigin, 'access-control-request-method': 'GET' },
  signal: AbortSignal.timeout(8_000),
});
if (
  unsupportedPreflightMethod.status !== 405
  || unsupportedPreflightMethod.headers.get('allow') !== 'POST, OPTIONS'
) {
  throw new Error('A known path accepted an unsupported CORS method.');
}

const unsupportedMethod = await fetch(`${apiUrl}/rankings`, {
  method: 'POST',
  headers: { origin: allowedOrigin, 'content-type': 'application/json' },
  body: '{}',
  signal: AbortSignal.timeout(8_000),
});
if (unsupportedMethod.status !== 405 || unsupportedMethod.headers.get('allow') !== 'GET, OPTIONS') {
  throw new Error('Known API paths do not expose the expected method contract.');
}

const playerToken = crypto.randomUUID();
const submissionId = crypto.randomUUID();
const authorization = `Bearer ${playerToken}`;
let syntheticScoreCreated = false;

try {
  const session = await assertOk('/game-sessions', {
    method: 'POST',
    headers: { authorization, origin: allowedOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ gameType: 'strawberry_rush', islandRegion: 'all' }),
  });
  durations.push(session.durationMs);
  if (
    typeof session.body.id !== 'string'
    || session.body.gameType !== 'strawberry_rush'
    || session.body.islandRegion !== 'all'
    || typeof session.body.expiresAt !== 'string'
  ) {
    throw new Error('Verified game session returned an invalid result.');
  }

  const created = await assertOk('/scores', {
    method: 'POST',
    headers: { authorization, origin: allowedOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({
      submissionId,
      gameSessionId: session.body.id,
      playerName: '監視チェック',
      score: 1,
      gameType: 'strawberry_rush',
      durationMs: 1_000,
    }),
  });
  durations.push(created.durationMs);
  if (created.body.id !== submissionId) {
    throw new Error('Synthetic score submission returned the wrong ID.');
  }
  syntheticScoreCreated = true;

  const history = await assertOk('/players/me/history?gameType=strawberry_rush&limit=5', {
    headers: { authorization },
  });
  durations.push(history.durationMs);
  if (!Array.isArray(history.body) || !history.body.some((entry) => entry.id === submissionId)) {
    throw new Error('Synthetic score was not visible in private history.');
  }
} finally {
  const deleted = await assertOk('/players/me/scores', {
    method: 'DELETE',
    headers: { authorization, origin: allowedOrigin },
  });
  durations.push(deleted.durationMs);
  const historyAfterDelete = await assertOk('/players/me/history?gameType=strawberry_rush&limit=5', {
    headers: { authorization },
  });
  durations.push(historyAfterDelete.durationMs);
  if (!isSyntheticCleanupComplete({
    syntheticScoreCreated,
    deleted: deleted.body.deleted,
    history: historyAfterDelete.body,
    submissionId,
  })) {
    throw new Error('Synthetic score cleanup did not remove the created score.');
  }
}

console.log(
  `Rankings API smoke check passed (release ${healthResult.body.release}, ${gameTypes.length} modes, `
  + `edge cache, verified session/write/read/delete, max ${Math.max(...durations)} ms).`,
);
