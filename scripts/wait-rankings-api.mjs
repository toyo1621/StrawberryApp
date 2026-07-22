import { matchesRankingsRelease } from './operational-contracts.mjs';

const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');
const expectedVersion = process.env.EXPECTED_API_VERSION || '4';
const expectedReleaseId = process.env.EXPECTED_RELEASE_ID;
const attempts = Number(process.env.API_WAIT_ATTEMPTS || 40);
const intervalMs = Number(process.env.API_WAIT_INTERVAL_MS || 15_000);
const requiredConsecutiveSuccesses = Number(process.env.API_WAIT_CONSECUTIVE_SUCCESSES || 3);

if (!apiUrl) {
  console.error('EXPO_PUBLIC_RANKINGS_API_URL is required.');
  process.exit(1);
}

if (
  !Number.isInteger(attempts)
  || attempts < 1
  || !Number.isFinite(intervalMs)
  || intervalMs < 0
  || !Number.isInteger(requiredConsecutiveSuccesses)
  || requiredConsecutiveSuccesses < 1
  || requiredConsecutiveSuccesses > attempts
) {
  console.error('API wait settings are invalid.');
  process.exit(1);
}

let lastStatus = 'no response';
let consecutiveSuccesses = 0;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(`${apiUrl}/health?_compatibility=${Date.now()}`, {
      cache: 'no-store',
      headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(8_000),
    });
    const body = response.ok ? await response.json() : null;
    const headerVersion = response.headers.get('x-api-version');
    const headerReleaseId = response.headers.get('x-release-id');
    if (matchesRankingsRelease({
      ok: response.ok,
      headerVersion,
      headerReleaseId,
      body,
      expectedVersion,
      expectedReleaseId,
    })) {
      consecutiveSuccesses += 1;
      if (consecutiveSuccesses >= requiredConsecutiveSuccesses) {
        console.log(
          `Rankings API v${expectedVersion} is stable at release ${body.release} `
          + `(${requiredConsecutiveSuccesses} consecutive checks).`,
        );
        process.exit(0);
      }
      lastStatus = `matching release ${body.release} (${consecutiveSuccesses}/${requiredConsecutiveSuccesses})`;
    } else {
      consecutiveSuccesses = 0;
      lastStatus = `HTTP ${response.status}, API ${headerVersion ?? 'unknown'}, release ${headerReleaseId ?? 'unknown'}`;
    }
  } catch (error) {
    consecutiveSuccesses = 0;
    lastStatus = error instanceof Error ? error.message : String(error);
  }

  if (attempt < attempts) {
    console.log(`Rankings API is not ready (${lastStatus}); retrying ${attempt}/${attempts}.`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

console.error(
  `Rankings API v${expectedVersion}`
  + `${expectedReleaseId ? ` release ${expectedReleaseId}` : ''} did not become ready: ${lastStatus}`,
);
process.exit(1);
