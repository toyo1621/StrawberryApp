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

const icon = await readFile(new URL('../assets/app-icon.png', import.meta.url));
requireValue(icon.toString('ascii', 1, 4) === 'PNG', 'App icon must be a PNG.');
requireValue(icon.readUInt32BE(16) === 1024 && icon.readUInt32BE(20) === 1024, 'App icon must be 1024 x 1024.');
requireValue(icon[25] === 2, 'App icon must not contain an alpha channel.');

const sourceFiles = [
  await readFile(new URL('../src/components/FlagGameScreen.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/services/rankingService.ts', import.meta.url), 'utf8'),
].join('\n');
requireValue(!sourceFiles.includes('cdn.jsdelivr.net'), 'Runtime source must not load flag assets from a CDN.');

const wrangler = await readFile(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');
requireValue(wrangler.includes('[observability]') && wrangler.includes('enabled = true'), 'Worker observability must be enabled.');
requireValue(wrangler.includes('[triggers]') && wrangler.includes('*/15 * * * *'), 'Rate-limit cleanup cron is missing.');

const schema = await readFile(new URL('../worker/schema.sql', import.meta.url), 'utf8');
requireValue(schema.includes('owner_hash'), 'Private history ownership is missing from the D1 schema.');
requireValue(schema.includes('island_region'), 'Island ranking regions are missing from the D1 schema.');
requireValue(schema.includes('score_submission_buckets'), 'Atomic rate-limit buckets are missing from the D1 schema.');

const qualityWorkflow = await readFile(new URL('../.github/workflows/quality.yml', import.meta.url), 'utf8');
requireValue(qualityWorkflow.includes('pull_request:'), 'The pull request quality workflow is missing.');
requireValue(qualityWorkflow.includes('build:native-bundles'), 'Native bundle compilation is missing from CI.');

const monitorWorkflow = await readFile(new URL('../.github/workflows/monitor-production.yml', import.meta.url), 'utf8');
requireValue(monitorWorkflow.includes('issues: write'), 'Production monitor incident permissions are missing.');
requireValue(monitorWorkflow.includes('production-monitor'), 'Production monitor issue automation is missing.');

await stat(new URL('../eas.json', import.meta.url));
await stat(new URL('../.env.example', import.meta.url));
await stat(new URL('../API.md', import.meta.url));
await stat(new URL('../QUALITY.md', import.meta.url));
await stat(new URL('../CHANGELOG.md', import.meta.url));
await stat(new URL('../worker/migrations/0004_private_player_history.sql', import.meta.url));
await stat(new URL('../worker/migrations/0005_atomic_rate_limits.sql', import.meta.url));
await stat(new URL('../worker/migrations/0006_align_score_contract.sql', import.meta.url));
await stat(new URL('../worker/migrations/0007_split_island_rankings_by_region.sql', import.meta.url));
await stat(new URL('../worker/migrations/0008_move_legacy_island_rankings_to_kanto.sql', import.meta.url));

if (failures.length > 0) {
  throw new Error(`Project verification failed:\n- ${failures.join('\n- ')}`);
}

console.log('Project configuration verification passed.');
