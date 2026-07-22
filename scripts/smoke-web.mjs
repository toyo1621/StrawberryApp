const webUrl = (process.env.WEB_URL || '').replace(/\/+$/, '');
const maximumDurationMs = Number(process.env.MAX_WEB_REQUEST_DURATION_MS || 5_000);

if (!webUrl) {
  console.error('WEB_URL is required.');
  process.exit(1);
}

let lastError;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    const startedAt = Date.now();
    const response = await fetch(`${webUrl}/`, {
      headers: { accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Web app returned ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();
    if (
      !contentType.includes('text/html')
      || !html.includes('<html lang="ja">')
      || !html.includes('いちごつめ')
      || !html.includes('http-equiv="Content-Security-Policy"')
      || !html.includes("script-src 'self'")
      || !html.includes('<meta name="referrer" content="no-referrer" />')
    ) {
      throw new Error('Web app did not return the expected application shell.');
    }

    const scriptPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
    if (!scriptPath) {
      throw new Error('Web app shell does not reference its JavaScript bundle.');
    }
    const scriptResponse = await fetch(new URL(scriptPath, response.url), {
      headers: { accept: 'text/javascript' },
      signal: AbortSignal.timeout(10_000),
    });
    const scriptBytes = await scriptResponse.arrayBuffer();
    if (
      !scriptResponse.ok
      || !scriptResponse.headers.get('content-type')?.includes('javascript')
      || scriptBytes.byteLength < 100_000
    ) {
      throw new Error('Web app JavaScript bundle is missing or invalid.');
    }

    const faviconResponse = await fetch(`${webUrl}/favicon.ico`, {
      headers: { accept: 'image/*' },
      signal: AbortSignal.timeout(10_000),
    });
    const faviconBytes = await faviconResponse.arrayBuffer();
    if (!faviconResponse.ok || faviconBytes.byteLength < 100) {
      throw new Error('Web app favicon is missing or empty.');
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > maximumDurationMs) {
      throw new Error(`Web smoke exceeded the ${maximumDurationMs} ms latency budget (${durationMs} ms).`);
    }

    console.log(
      `Web smoke check passed (${response.url}, ${durationMs} ms, `
      + `${(scriptBytes.byteLength / 1024).toFixed(1)} KiB JS, favicon verified).`,
    );
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
}

throw lastError;
