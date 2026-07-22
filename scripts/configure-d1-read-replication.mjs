const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = process.env.D1_DATABASE_ID;

if (!accountId || !apiToken || !databaseId) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and D1_DATABASE_ID are required.');
}

const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}`;
const headers = {
  authorization: `Bearer ${apiToken}`,
  'content-type': 'application/json',
};

const request = async (method, body) => {
  const response = await fetch(endpoint, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success !== true || !payload.result) {
    const message = payload?.errors?.[0]?.message ?? `Cloudflare API returned ${response.status}.`;
    throw new Error(`Could not configure D1 read replication: ${message}`);
  }
  return payload.result;
};

const current = await request('GET');
if (current.read_replication?.mode !== 'auto') {
  await request('PUT', { read_replication: { mode: 'auto' } });
}

const verified = await request('GET');
if (verified.read_replication?.mode !== 'auto') {
  throw new Error('D1 read replication did not reach auto mode.');
}

console.log(`D1 read replication is enabled for ${verified.name ?? databaseId}.`);
