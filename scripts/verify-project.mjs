import { readFile, stat } from 'node:fs/promises';

const configModule = await import(`../app.config.js?verify=${Date.now()}`);
const expo = configModule.default?.expo;
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const failures = [];

const requireValue = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

requireValue(expo?.ios?.bundleIdentifier === 'com.strawberrygame.app', 'iOS bundle identifier is missing.');
requireValue(expo?.android?.package === 'com.strawberrygame.app', 'Android package name is missing.');
requireValue(Number.isInteger(expo?.android?.versionCode), 'Android versionCode must be an integer.');
requireValue(/^\d+$/.test(expo?.ios?.buildNumber || ''), 'iOS buildNumber must be numeric.');
requireValue(expo?.web?.lang === 'ja', 'The web document language must be Japanese.');
requireValue(expo?.experiments?.baseUrl, 'A GitHub Pages base URL is required.');
requireValue(expo?.version === packageJson.version, 'Expo and package versions must match.');
requireValue(expo?.plugins?.includes('expo-secure-store'), 'SecureStore config plugin is missing.');
requireValue(
  /^\d+\.\d+\.\d+$/.test(packageJson.devDependencies?.['expo-doctor'] || ''),
  'Expo Doctor must be pinned to an exact version.',
);
const easConfig = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
requireValue(/^\d+\.\d+\.\d+$/.test(easConfig?.cli?.version || ''), 'EAS CLI must be pinned exactly.');
requireValue(
  easConfig?.build?.production?.env?.EXPO_PUBLIC_RANKINGS_API_URL === 'https://strawberry-rankings-api.toyo1621.workers.dev',
  'The native production build must use the production rankings API.',
);
requireValue(
  packageJson.scripts?.['build:web']?.includes('harden-web-build.mjs')
    && packageJson.scripts?.['build:web:e2e']?.includes('harden-web-build.mjs'),
  'Web builds must inject the security policy metadata.',
);
requireValue(
  packageJson.scripts?.check?.includes('check:maintainability')
    && packageJson.scripts?.['check:maintainability']?.includes('check-maintainability.mjs'),
  'The maintainability architecture gate is missing.',
);

const icon = await readFile(new URL('../assets/app-icon.png', import.meta.url));
requireValue(icon.toString('ascii', 1, 4) === 'PNG', 'App icon must be a PNG.');
requireValue(icon.readUInt32BE(16) === 1024 && icon.readUInt32BE(20) === 1024, 'App icon must be 1024 x 1024.');
requireValue(icon[25] === 2, 'App icon must not contain an alpha channel.');

const sourceFiles = [
  await readFile(new URL('../src/components/FlagGameScreen.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/services/rankingService.ts', import.meta.url), 'utf8'),
].join('\n');
requireValue(!sourceFiles.includes('cdn.jsdelivr.net'), 'Runtime source must not load flag assets from a CDN.');

const leaderboardSource = await readFile(new URL('../worker/src/leaderboards.ts', import.meta.url), 'utf8');
requireValue(
  leaderboardSource.includes("withSession.call(database, 'first-unconstrained')")
    && leaderboardSource.includes('caches.default')
    && leaderboardSource.includes('WITH owner_ranked AS')
    && leaderboardSource.includes('legacy_ranked AS'),
  'Replica-backed, cached, owner/legacy indexed leaderboard reads are incomplete.',
);

const wrangler = await readFile(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
requireValue(wrangler.includes('[observability]') && wrangler.includes('enabled = true'), 'Worker observability must be enabled.');
requireValue(wrangler.includes('[triggers]') && wrangler.includes('*/15 * * * *'), 'Rate-limit cleanup cron is missing.');
requireValue(wrangler.includes('[version_metadata]'), 'Worker version metadata binding is missing.');

const schema = await readFile(new URL('../worker/schema.sql', import.meta.url), 'utf8');
requireValue(schema.includes('owner_hash'), 'Private history ownership is missing from the D1 schema.');
requireValue(schema.includes('island_region'), 'Island ranking regions are missing from the D1 schema.');
requireValue(schema.includes('score_submission_buckets'), 'Atomic rate-limit buckets are missing from the D1 schema.');
requireValue(schema.includes('game_sessions'), 'Verified game sessions are missing from the D1 schema.');
requireValue(
  schema.includes('idx_rankings_game_region_owner_score_created')
    && schema.includes('idx_rankings_game_region_legacy_name_score_created'),
  'Owner-ranked leaderboard indexes are missing from the D1 schema.',
);

const qualityWorkflow = await readFile(new URL('../.github/workflows/quality.yml', import.meta.url), 'utf8');
requireValue(qualityWorkflow.includes('pull_request:'), 'The pull request quality workflow is missing.');
requireValue(qualityWorkflow.includes('build:native-bundles'), 'Native bundle compilation is missing from CI.');
requireValue(qualityWorkflow.includes('check:native-build'), 'Native bundle budgets are missing from CI.');
requireValue(qualityWorkflow.includes('npm run doctor'), 'The pinned Expo Doctor check is missing from CI.');
requireValue(
  qualityWorkflow.includes('chromium firefox webkit'),
  'Cross-browser Playwright installation is missing from CI.',
);

const pagesWorkflow = await readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
requireValue(pagesWorkflow.includes('npm run check && npm run doctor'), 'Expo Doctor is missing from the Pages release gate.');
requireValue(
  pagesWorkflow.includes('uses: ./.github/workflows/deploy-worker.yml')
    && pagesWorkflow.includes('EXPECTED_RELEASE_ID: ${{ github.sha }}')
    && pagesWorkflow.includes('EXPO_PUBLIC_RELEASE_ID: ${{ github.sha }}')
    && pagesWorkflow.includes('smoke:release'),
  'Pages must deploy and verify the Worker from the same Git SHA.',
);

const workerWorkflow = await readFile(new URL('../.github/workflows/deploy-worker.yml', import.meta.url), 'utf8');
requireValue(workerWorkflow.includes('workflow_call:'), 'The Worker release workflow must be reusable by Pages.');
requireValue(
  workerWorkflow.includes('Verify ranking count after migration'),
  'The Worker release workflow must verify that D1 migrations preserve ranking rows.',
);
requireValue(
  workerWorkflow.includes('Enable D1 global read replication')
    && workerWorkflow.includes('d1:enable-read-replication'),
  'The Worker release workflow must enable D1 read replication before deployment.',
);
const workerReleaseWaitIndex = workerWorkflow.indexOf('- name: Wait for deployed API release');
const workerSmokeIndex = workerWorkflow.indexOf('- name: Verify production API');
requireValue(
  workerReleaseWaitIndex > -1
    && workerSmokeIndex > workerReleaseWaitIndex
    && workerWorkflow.includes('run: npm run wait:rankings-api')
    && workerWorkflow.includes('API_WAIT_INTERVAL_MS'),
  'The Worker release workflow must wait for edge propagation before its production smoke test.',
);

const dataSources = await readFile(new URL('../DATA_SOURCES.md', import.meta.url), 'utf8');
requireValue(
  dataSources.includes('国土地理院「地理院地図」')
    && dataSources.includes('toyo1621')
    && dataSources.includes('https://maps.gsi.go.jp/'),
  'Island attribution must identify GSI Maps and the original editor.',
);

const monitorWorkflow = await readFile(new URL('../.github/workflows/monitor-production.yml', import.meta.url), 'utf8');
requireValue(monitorWorkflow.includes('issues: write'), 'Production monitor incident permissions are missing.');
requireValue(monitorWorkflow.includes('production-monitor'), 'Production monitor issue automation is missing.');
requireValue(
  monitorWorkflow.includes('2,17,32,47 * * * *')
    && monitorWorkflow.includes('MONITOR_ALERT_WEBHOOK_URL')
    && monitorWorkflow.includes('smoke-release-consistency.mjs'),
  'The 15-minute monitor or optional external alert channel is missing.',
);

const mobileWorkflow = await readFile(new URL('../.github/workflows/mobile-release.yml', import.meta.url), 'utf8');
requireValue(
  mobileWorkflow.includes('eas-cli@19.1.0') && mobileWorkflow.includes('EXPO_TOKEN'),
  'The pinned EAS mobile release workflow is incomplete.',
);

const workflowSources = await Promise.all([
  'quality.yml',
  'deploy-pages.yml',
  'deploy-worker.yml',
  'mobile-release.yml',
  'monitor-production.yml',
].map((file) => readFile(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8')));
requireValue(
  workflowSources.every((source) => [...source.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/g)]
    .every(([, revision]) => /^[0-9a-f]{40}$/.test(revision))),
  'Every third-party GitHub Action must be pinned to an immutable commit SHA.',
);

await stat(new URL('../eas.json', import.meta.url));
await stat(new URL('../.env.example', import.meta.url));
await stat(new URL('../API.md', import.meta.url));
await stat(new URL('../QUALITY.md', import.meta.url));
await stat(new URL('../CHANGELOG.md', import.meta.url));
await stat(new URL('../DATA_SOURCES.md', import.meta.url));
await stat(new URL('../worker/migrations/0004_private_player_history.sql', import.meta.url));
await stat(new URL('../worker/migrations/0005_atomic_rate_limits.sql', import.meta.url));
await stat(new URL('../worker/migrations/0006_align_score_contract.sql', import.meta.url));
await stat(new URL('../worker/migrations/0007_split_island_rankings_by_region.sql', import.meta.url));
await stat(new URL('../worker/migrations/0008_move_legacy_island_rankings_to_kanto.sql', import.meta.url));
await stat(new URL('../worker/migrations/0009_verified_game_sessions.sql', import.meta.url));
await stat(new URL('../worker/migrations/0010_rank_leaderboards_by_owner.sql', import.meta.url));

if (failures.length > 0) {
  throw new Error(`Project verification failed:\n- ${failures.join('\n- ')}`);
}

console.log('Project configuration verification passed.');
