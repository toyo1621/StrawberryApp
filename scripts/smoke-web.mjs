const webUrl = (process.env.WEB_URL || '').replace(/\/+$/, '');

if (!webUrl) {
  console.error('WEB_URL is required.');
  process.exit(1);
}

let lastError;
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
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
    if (!contentType.includes('text/html') || !html.includes('<html') || !html.includes('いちごつめ')) {
      throw new Error('Web app did not return the expected application shell.');
    }

    console.log(`Web smoke check passed (${response.url}).`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
}

throw lastError;
