import { isCompatibleProductionRelease } from './operational-contracts.mjs';

const webUrl = (process.env.WEB_URL || '').replace(/\/+$/, '');
const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

if (!webUrl || !apiUrl) {
  throw new Error('WEB_URL and EXPO_PUBLIC_RANKINGS_API_URL are required.');
}

let lastError;
for (let attempt = 1; attempt <= 4; attempt += 1) {
  try {
    const requestId = `${Date.now()}-${attempt}`;
    const [webResponse, apiResponse] = await Promise.all([
      fetch(`${webUrl}/release.json?_release_check=${requestId}`, {
        cache: 'no-store',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${apiUrl}/health?_release_check=${requestId}`, {
        cache: 'no-store',
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(10_000),
      }),
    ]);
    const webRelease = webResponse.ok ? await webResponse.json() : null;
    const apiHealth = apiResponse.ok ? await apiResponse.json() : null;
    if (!webResponse.ok || !apiResponse.ok || !isCompatibleProductionRelease({
      webRelease,
      apiHealth,
      apiHeaderRelease: apiResponse.headers.get('x-release-id'),
    })) {
      throw new Error(
        `Production release mismatch: web=${webRelease?.release ?? webResponse.status}, `
        + `api=${apiHealth?.release ?? apiResponse.status}.`,
      );
    }
    console.log(`Web and rankings API are serving release ${webRelease.release}.`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
}

throw lastError;
