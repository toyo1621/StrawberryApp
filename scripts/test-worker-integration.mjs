import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const wrangler = resolve(root, 'node_modules/.bin/wrangler');
const port = 8_700 + (process.pid % 500);
const baseUrl = `http://127.0.0.1:${port}`;
const playerToken = crypto.randomUUID();
const secondPlayerToken = crypto.randomUUID();
const submissionId = crypto.randomUUID();
const secondSubmissionId = crypto.randomUUID();
const renamedSubmissionId = crypto.randomUUID();
const authorization = `Bearer ${playerToken}`;
const secondAuthorization = `Bearer ${secondPlayerToken}`;
let processOutput = '';

const worker = spawn(wrangler, [
  'dev',
  '--config', resolve(root, 'worker/wrangler.toml'),
  '--local',
  '--ip', '127.0.0.1',
  '--port', String(port),
  '--persist-to', resolve(root, '.tmp/d1-schema-test'),
  '--var', 'RATE_LIMIT_SALT:integration-test-rate-limit-salt',
  '--log-level', 'error',
  '--show-interactive-dev-session=false',
], {
  cwd: root,
  env: { ...process.env, WRANGLER_LOG_PATH: resolve(root, '.tmp/wrangler-integration.log') },
  stdio: ['ignore', 'pipe', 'pipe'],
});

for (const stream of [worker.stdout, worker.stderr]) {
  stream.on('data', (chunk) => {
    processOutput = `${processOutput}${chunk}`.slice(-12_000);
  });
}

const request = async (path, init = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...init.headers },
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.json();
  return { response, body };
};

const waitForWorker = async () => {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (worker.exitCode !== null) {
      throw new Error(`Local Worker exited early (${worker.exitCode}).\n${processOutput}`);
    }
    try {
      const result = await request('/health');
      if (result.response.ok && result.body.ok === true) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Local Worker did not become ready: ${lastError}\n${processOutput}`);
};

try {
  await waitForWorker();

  const sessionResult = await request('/game-sessions', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ gameType: 'island_rush', islandRegion: 'shikoku' }),
  });
  assert.equal(sessionResult.response.status, 201);
  assert.equal(sessionResult.body.islandRegion, 'shikoku');

  const scorePayload = {
    submissionId,
    gameSessionId: sessionResult.body.id,
    playerName: '統合テスト',
    score: 1,
    gameType: 'island_rush',
    islandRegion: 'shikoku',
    durationMs: 1_000,
  };
  const scoreResult = await request('/scores', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(scorePayload),
  });
  assert.equal(scoreResult.response.status, 201);
  assert.equal(scoreResult.body.id, submissionId);

  const retryResult = await request('/scores', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify(scorePayload),
  });
  assert.equal(retryResult.response.status, 200);

  const secondSessionResult = await request('/game-sessions', {
    method: 'POST',
    headers: { authorization: secondAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({ gameType: 'island_rush', islandRegion: 'shikoku' }),
  });
  assert.equal(secondSessionResult.response.status, 201);
  const secondScoreResult = await request('/scores', {
    method: 'POST',
    headers: { authorization: secondAuthorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      ...scorePayload,
      submissionId: secondSubmissionId,
      gameSessionId: secondSessionResult.body.id,
      score: 2,
    }),
  });
  assert.equal(secondScoreResult.response.status, 201);

  const renamedSessionResult = await request('/game-sessions', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ gameType: 'island_rush', islandRegion: 'shikoku' }),
  });
  assert.equal(renamedSessionResult.response.status, 201);
  const renamedScoreResult = await request('/scores', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({
      ...scorePayload,
      submissionId: renamedSubmissionId,
      gameSessionId: renamedSessionResult.body.id,
      playerName: '統合テスト改名後',
      score: 3,
    }),
  });
  assert.equal(renamedScoreResult.response.status, 201);

  const rankingsResult = await request('/rankings?gameType=island_rush&islandRegion=shikoku&period=all');
  assert.equal(rankingsResult.response.status, 200);
  const ownedRankingIds = rankingsResult.body
    .filter((entry) => [submissionId, secondSubmissionId, renamedSubmissionId].includes(entry.id))
    .map((entry) => entry.id);
  assert.deepEqual(ownedRankingIds, [renamedSubmissionId, secondSubmissionId]);

  const historyResult = await request('/players/me/history?gameType=island_rush', {
    headers: { authorization },
  });
  assert.equal(historyResult.response.status, 200);
  assert.equal(historyResult.body.some((entry) => entry.id === submissionId), true);
  assert.equal(historyResult.body.some((entry) => entry.id === renamedSubmissionId), true);
  assert.equal(historyResult.body.some((entry) => entry.id === secondSubmissionId), false);

  const secondHistoryResult = await request('/players/me/history?gameType=island_rush', {
    headers: { authorization: secondAuthorization },
  });
  assert.deepEqual(secondHistoryResult.body.map((entry) => entry.id), [secondSubmissionId]);

  const deleteResult = await request('/players/me/scores', {
    method: 'DELETE',
    headers: { authorization },
  });
  assert.equal(deleteResult.response.status, 200);
  assert.equal(deleteResult.body.deleted, 2);

  const deletedHistoryResult = await request('/players/me/history?gameType=island_rush', {
    headers: { authorization },
  });
  assert.deepEqual(deletedHistoryResult.body, []);

  const rankingAfterDelete = await request('/rankings?gameType=island_rush&islandRegion=shikoku&period=all');
  assert.equal(rankingAfterDelete.body.some((entry) => entry.id === renamedSubmissionId), false);
  assert.equal(rankingAfterDelete.body.some((entry) => entry.id === secondSubmissionId), true);

  console.log('Local Worker/D1 integration passed: owner-ranked leaderboard, rename, atomic retry, private history, verified deletion.');
} finally {
  if (worker.exitCode === null) {
    for (const cleanupAuthorization of [authorization, secondAuthorization]) {
      try {
        await request('/players/me/scores', {
          method: 'DELETE',
          headers: { authorization: cleanupAuthorization },
        });
      } catch {
        // The integration assertion is more useful than cleanup noise.
      }
    }
  }
  if (worker.exitCode === null) {
    worker.kill('SIGTERM');
    await Promise.race([
      new Promise((resolveExit) => worker.once('exit', resolveExit)),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5_000)),
    ]);
  }
}
