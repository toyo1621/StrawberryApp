const apiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

if (!apiUrl) {
  console.error('EXPO_PUBLIC_RANKINGS_API_URL is required.');
  process.exit(1);
}

const assertOk = async (path) => {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }

  return response.json();
};

const health = await assertOk('/health');
if (health.ok !== true) {
  throw new Error('/health did not return ok: true');
}

const rankings = await assertOk('/rankings?gameType=strawberry_rush&period=all&limit=3');
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
