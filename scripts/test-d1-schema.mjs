import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = resolve(root, 'node_modules/.bin/wrangler');
const persistPath = resolve(root, '.tmp/d1-schema-test');
const commonArgs = [
  'strawberry-rankings',
  '--config',
  resolve(root, 'worker/wrangler.toml'),
  '--local',
  `--persist-to=${persistPath}`,
];

const run = (args) => execFileSync(wrangler, args, {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, WRANGLER_LOG_PATH: resolve(root, '.tmp/wrangler-schema.log') },
  stdio: ['ignore', 'pipe', 'pipe'],
});

rmSync(persistPath, { recursive: true, force: true });
run(['d1', 'migrations', 'apply', ...commonArgs]);

const output = run([
  'd1',
  'execute',
  ...commonArgs,
  '--command',
  "SELECT name, type FROM sqlite_master WHERE name IN ('idx_rankings_owner_game_created', 'score_submission_buckets') ORDER BY name",
  '--json',
]);
const response = JSON.parse(output);
const rows = response[0]?.results ?? [];

assert.deepEqual(rows, [
  { name: 'idx_rankings_owner_game_created', type: 'index' },
  { name: 'score_submission_buckets', type: 'table' },
]);

const columnsOutput = run([
  'd1',
  'execute',
  ...commonArgs,
  '--command',
  "SELECT name FROM pragma_table_info('rankings') WHERE name = 'owner_hash'",
  '--json',
]);
const columns = JSON.parse(columnsOutput)[0]?.results ?? [];
assert.deepEqual(columns, [{ name: 'owner_hash' }]);

console.log('D1 migrations and privacy/rate-limit schema verified.');
