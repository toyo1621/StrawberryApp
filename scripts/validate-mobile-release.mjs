import { readFile } from 'node:fs/promises';
import config from '../app.config.js';
import { validateMobileRelease } from './mobile-release-contract.mjs';

const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
validateMobileRelease({
  expo: config.expo, eas, platform: process.argv[2],
  submit: process.argv[3] === 'true', env: process.env,
});
console.log('Mobile production prerequisites verified. No build or submission has started.');
