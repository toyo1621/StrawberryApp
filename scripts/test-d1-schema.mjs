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
  "SELECT name, type FROM sqlite_master WHERE name IN ('game_sessions', 'idx_game_sessions_expires', 'idx_rankings_game_region_score_created', 'idx_rankings_game_region_owner_score_created', 'idx_rankings_game_region_legacy_name_score_created', 'idx_rankings_owner_game_created', 'score_submission_buckets') ORDER BY name",
  '--json',
]);
const response = JSON.parse(output);
const rows = response[0]?.results ?? [];

assert.deepEqual(rows, [
  { name: 'game_sessions', type: 'table' },
  { name: 'idx_game_sessions_expires', type: 'index' },
  { name: 'idx_rankings_game_region_legacy_name_score_created', type: 'index' },
  { name: 'idx_rankings_game_region_owner_score_created', type: 'index' },
  { name: 'idx_rankings_game_region_score_created', type: 'index' },
  { name: 'idx_rankings_owner_game_created', type: 'index' },
  { name: 'score_submission_buckets', type: 'table' },
]);

const columnsOutput = run([
  'd1',
  'execute',
  ...commonArgs,
  '--command',
  "SELECT name FROM pragma_table_info('rankings') WHERE name IN ('island_region', 'owner_hash') ORDER BY name",
  '--json',
]);
const columns = JSON.parse(columnsOutput)[0]?.results ?? [];
assert.deepEqual(columns, [{ name: 'island_region' }, { name: 'owner_hash' }]);

const upgradePersistPath = resolve(root, '.tmp/d1-region-upgrade-test');
const upgradeArgs = [
  'strawberry-rankings',
  '--config',
  resolve(root, 'worker/wrangler.toml'),
  '--local',
  `--persist-to=${upgradePersistPath}`,
];
const runUpgrade = (args) => execFileSync(wrangler, args, {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, WRANGLER_LOG_PATH: resolve(root, '.tmp/wrangler-region-upgrade.log') },
  stdio: ['ignore', 'pipe', 'pipe'],
});

rmSync(upgradePersistPath, { recursive: true, force: true });
for (const migration of [
  '0001_initial.sql',
  '0002_minimize_rate_limit_data.sql',
  '0003_player_identity_index.sql',
  '0004_private_player_history.sql',
  '0005_atomic_rate_limits.sql',
  '0006_align_score_contract.sql',
]) {
  runUpgrade([
    'd1',
    'execute',
    ...upgradeArgs,
    '--file',
    resolve(root, 'worker/migrations', migration),
  ]);
}

runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  `INSERT INTO rankings (id, player_name, score, game_type, created_at, owner_hash)
   VALUES ('existing-island-score', '既存選手', 12, 'island_rush', '2026-07-21T00:00:00.000Z', '${'a'.repeat(64)}')`,
]);
runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--file',
  resolve(root, 'worker/migrations/0007_split_island_rankings_by_region.sql'),
]);
runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  `INSERT INTO rankings (id, player_name, score, game_type, island_region, created_at)
   VALUES
     ('existing-shikoku-score', '四国選手', 8, 'island_rush', 'shikoku', '2026-07-21T01:00:00.000Z'),
     ('existing-strawberry-score', 'いちご選手', 20, 'strawberry_rush', 'all', '2026-07-21T02:00:00.000Z')`,
]);
runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--file',
  resolve(root, 'worker/migrations/0008_move_legacy_island_rankings_to_kanto.sql'),
]);
runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--file',
  resolve(root, 'worker/migrations/0009_verified_game_sessions.sql'),
]);
runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--file',
  resolve(root, 'worker/migrations/0010_rank_leaderboards_by_owner.sql'),
]);

const preservedOutput = runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  "SELECT id, player_name, score, game_type, island_region, created_at, owner_hash FROM rankings WHERE id LIKE 'existing-%-score' ORDER BY id",
  '--json',
]);
const preserved = JSON.parse(preservedOutput)[0]?.results ?? [];
assert.deepEqual(preserved, [
  {
    id: 'existing-island-score',
    player_name: '既存選手',
    score: 12,
    game_type: 'island_rush',
    island_region: 'kanto',
    created_at: '2026-07-21T00:00:00.000Z',
    owner_hash: 'a'.repeat(64),
  },
  {
    id: 'existing-shikoku-score',
    player_name: '四国選手',
    score: 8,
    game_type: 'island_rush',
    island_region: 'shikoku',
    created_at: '2026-07-21T01:00:00.000Z',
    owner_hash: null,
  },
  {
    id: 'existing-strawberry-score',
    player_name: 'いちご選手',
    score: 20,
    game_type: 'strawberry_rush',
    island_region: 'all',
    created_at: '2026-07-21T02:00:00.000Z',
    owner_hash: null,
  },
]);

runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  `INSERT INTO game_sessions (id, owner_hash, game_type, island_region, started_at, expires_at)
   VALUES ('01234567-89ab-4cde-8f01-23456789abcd', '${'b'.repeat(64)}', 'island_rush', 'okinawa', '2026-07-21T03:00:00.000Z', '2026-07-21T03:15:00.000Z')`,
]);
const sessionOutput = runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  "SELECT game_type, island_region, consumed_at, submission_id FROM game_sessions",
  '--json',
]);
assert.deepEqual(JSON.parse(sessionOutput)[0]?.results ?? [], [{
  game_type: 'island_rush',
  island_region: 'okinawa',
  consumed_at: null,
  submission_id: null,
}]);

const identityIndexesOutput = runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_rankings_game_region_%_score_created' ORDER BY name",
  '--json',
]);
assert.deepEqual(JSON.parse(identityIndexesOutput)[0]?.results ?? [], [
  { name: 'idx_rankings_game_region_legacy_name_score_created' },
  { name: 'idx_rankings_game_region_owner_score_created' },
]);

const leaderboardPlanOutput = runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  `EXPLAIN QUERY PLAN
   WITH owner_ranked AS (
     SELECT id, player_name, score, game_type, island_region, created_at,
       ROW_NUMBER() OVER (
         PARTITION BY owner_hash ORDER BY score DESC, created_at ASC
       ) AS rn
     FROM rankings
     WHERE game_type = 'strawberry_rush'
       AND island_region = 'all'
       AND owner_hash IS NOT NULL
   ), legacy_ranked AS (
     SELECT id, player_name, score, game_type, island_region, created_at,
       ROW_NUMBER() OVER (
         PARTITION BY lower(trim(player_name)) ORDER BY score DESC, created_at ASC
       ) AS rn
     FROM rankings
     WHERE game_type = 'strawberry_rush'
       AND island_region = 'all'
       AND owner_hash IS NULL
   )
   SELECT id, player_name, score, game_type, island_region, created_at
   FROM owner_ranked WHERE rn = 1
   UNION ALL
   SELECT id, player_name, score, game_type, island_region, created_at
   FROM legacy_ranked WHERE rn = 1`,
  '--json',
]);
const leaderboardPlan = (JSON.parse(leaderboardPlanOutput)[0]?.results ?? [])
  .map((row) => String(row.detail));
assert.equal(
  leaderboardPlan.some((detail) => detail.includes('idx_rankings_game_region_owner_score_created')),
  true,
);
assert.equal(
  leaderboardPlan.some((detail) => detail.includes('idx_rankings_game_region_legacy_name_score_created')),
  true,
);

assert.throws(() => runUpgrade([
  'd1',
  'execute',
  ...upgradeArgs,
  '--command',
  `INSERT INTO game_sessions (id, owner_hash, game_type, island_region, started_at, expires_at)
   VALUES ('fedcba98-7654-4321-8fed-cba987654321', '${'c'.repeat(64)}', 'flag_rush', 'okinawa', '2026-07-21T03:00:00.000Z', '2026-07-21T03:15:00.000Z')`,
]));

console.log('D1 migrations, data preservation, and indexed owner/legacy leaderboard plans verified.');
