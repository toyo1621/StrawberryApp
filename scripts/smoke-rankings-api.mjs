const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');
const allowedOrigin = 'https://toyo1621.github.io';
const gameTypes = ['strawberry_rush', 'island_rush', 'flag_rush', 'color_rush'];

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
  if (response.headers.get('x-api-version') !== '2') {
    throw new Error(`${path} is not serving API version 2.`);
  }
  return { body: await response.json(), headers: response.headers, durationMs };
};

const durations = [];
const healthResult = await assertOk('/health');
durations.push(healthResult.durationMs);
if (healthResult.body.ok !== true || healthResult.body.version !== 2) {
  throw new Error('/health did not return the expected versioned status.');
}
if (healthResult.headers.get('cache-control') !== 'no-store') {
  throw new Error('/health must not be cached.');
}

for (const gameType of gameTypes) {
  const result = await assertOk(`/rankings?gameType=${gameType}&period=all&limit=3`);
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
      || typeof entry.createdAt !== 'string'
    ) {
      throw new Error(`Ranking response includes an invalid ${gameType} entry.`);
    }
  }
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

const playerToken = crypto.randomUUID();
const submissionId = crypto.randomUUID();
const authorization = `Bearer ${playerToken}`;

try {
  const created = await assertOk('/scores', {
    method: 'POST',
    headers: { authorization, origin: allowedOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({
      submissionId,
      playerName: '監視チェック',
      score: 1,
      gameType: 'strawberry_rush',
      durationMs: 30_000,
    }),
  });
  durations.push(created.durationMs);
  if (created.body.id !== submissionId) {
    throw new Error('Synthetic score submission returned the wrong ID.');
  }

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
  if (!Number.isInteger(deleted.body.deleted)) {
    throw new Error('Synthetic score cleanup returned an invalid result.');
  }
}

console.log(
  `Rankings API smoke check passed (${gameTypes.length} modes, write/read/delete, max ${Math.max(...durations)} ms).`,
);
