import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { completedBuilds } from './mobile-release-contract.mjs';

const builds = completedBuilds(JSON.parse(await readFile(process.argv[2], 'utf8')), process.argv[3]);
for (const build of builds) {
  execFileSync('npx', [
    '--yes', 'eas-cli@19.1.0', 'submit', '--platform', build.platform,
    '--profile', 'production', '--id', build.id, '--non-interactive', '--wait',
  ], { stdio: 'inherit' });
}
