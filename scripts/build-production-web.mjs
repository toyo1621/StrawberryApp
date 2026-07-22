import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const expo = resolve(root, 'node_modules/.bin/expo');
const rankingsApiUrl = process.env.EXPO_PUBLIC_RANKINGS_API_URL
  || 'https://strawberry-rankings-api.toyo1621.workers.dev';
const env = {
  ...process.env,
  EXPO_PUBLIC_RANKINGS_API_URL: rankingsApiUrl,
};

execFileSync(expo, [
  'export',
  '--platform',
  'web',
  '--output-dir',
  'web-build',
], { cwd: root, env, stdio: 'inherit' });
execFileSync(process.execPath, [
  resolve(root, 'scripts/harden-web-build.mjs'),
], { cwd: root, env, stdio: 'inherit' });
