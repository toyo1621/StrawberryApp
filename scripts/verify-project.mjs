import { readFile, stat } from 'node:fs/promises';

const configModule = await import(`../app.config.js?verify=${Date.now()}`);
const expo = configModule.default?.expo;
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

await stat(new URL('../eas.json', import.meta.url));
await stat(new URL('../.env.example', import.meta.url));

if (failures.length > 0) {
  throw new Error(`Project verification failed:\n- ${failures.join('\n- ')}`);
}

console.log('Project configuration verification passed.');
