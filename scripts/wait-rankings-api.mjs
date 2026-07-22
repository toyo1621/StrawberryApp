const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');
const expectedVersion = process.env.EXPECTED_API_VERSION || '4';
const attempts = Number(process.env.API_WAIT_ATTEMPTS || 40);
const intervalMs = Number(process.env.API_WAIT_INTERVAL_MS || 15_000);

if (!apiUrl) {
  console.error('EXPO_PUBLIC_RANKINGS_API_URL is required.');
  process.exit(1);
}

if (!Number.isInteger(attempts) || attempts < 1 || !Number.isFinite(intervalMs) || intervalMs < 0) {
  console.error('API wait settings are invalid.');
  process.exit(1);
}

let lastStatus = 'no response';

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(`${apiUrl}/health?_compatibility=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(8_000),
    });
    const body = response.ok ? await response.json() : null;
    const headerVersion = response.headers.get('x-api-version');
    if (
      response.ok
      && headerVersion === expectedVersion
      && String(body?.version) === expectedVersion
      && body?.ok === true
    ) {
      console.log(`Rankings API v${expectedVersion} is ready (${body.release}).`);
      process.exit(0);
    }
    lastStatus = `HTTP ${response.status}, API ${headerVersion ?? 'unknown'}`;
  } catch (error) {
    lastStatus = error instanceof Error ? error.message : String(error);
  }

  if (attempt < attempts) {
    console.log(`Rankings API is not ready (${lastStatus}); retrying ${attempt}/${attempts}.`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

console.error(`Rankings API v${expectedVersion} did not become ready: ${lastStatus}`);
process.exit(1);
