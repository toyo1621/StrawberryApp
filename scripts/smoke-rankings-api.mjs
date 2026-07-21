const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

if (!apiUrl) {
  console.error('EXPO_PUBLIC_RANKINGS_API_URL is required.');
  process.exit(1);
}

const fetchWithRetry = async (path, attempts = 4) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        throw new Error(`${path} returned ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw lastError;
};

const assertOk = async (path) => {
  const response = await fetchWithRetry(path);
  if (response.headers.get('x-content-type-options') !== 'nosniff') {
    throw new Error(`${path} is missing the nosniff security header.`);
  }

  return { body: await response.json(), headers: response.headers };
};

const { body: health, headers: healthHeaders } = await assertOk('/health');
if (health.ok !== true) {
  throw new Error('/health did not return ok: true');
}
if (healthHeaders.get('cache-control') !== 'no-store') {
  throw new Error('/health must not be cached.');
}

const { body: rankings } = await assertOk('/rankings?gameType=strawberry_rush&period=all&limit=3');
if (!Array.isArray(rankings)) {
  throw new Error('/rankings did not return an array');
}

for (const entry of rankings) {
  if (
    typeof entry.id !== 'string' ||
    typeof entry.playerName !== 'string' ||
    typeof entry.score !== 'number' ||
    entry.gameType !== 'strawberry_rush' ||
    typeof entry.createdAt !== 'string'
  ) {
    throw new Error('Ranking response includes an invalid entry shape.');
  }
}

console.log(`Rankings API smoke check passed (${rankings.length} sample entries).`);
