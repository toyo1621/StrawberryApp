import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RANKINGS_API_VERSION } from './generated/rankingContract.mjs';

const indexPath = path.resolve('web-build/index.html');
const apiUrl = process.env.EXPO_PUBLIC_RANKINGS_API_URL?.trim();
const releaseId = process.env.EXPO_PUBLIC_RELEASE_ID?.trim() || 'development';
const requireProductionReleaseId = process.env.REQUIRE_PRODUCTION_RELEASE_ID === 'true';
const connectSources = ["'self'"];

if (requireProductionReleaseId && !/^[0-9a-f]{40}$/.test(releaseId)) {
  throw new Error('A 40-character production release ID is required for this web build.');
}

if (apiUrl) {
  const parsedApiUrl = new URL(apiUrl);
  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(parsedApiUrl.hostname);
  if (parsedApiUrl.protocol !== 'https:' && !isLocalDevelopment) {
    throw new Error('The rankings API must use HTTPS outside local development.');
  }
  connectSources.push(parsedApiUrl.origin);
}

const policy = [
  "default-src 'self'",
  "base-uri 'none'",
  `connect-src ${connectSources.join(' ')}`,
  "font-src 'self' data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

const securityMeta = [
  `    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
  '    <meta name="referrer" content="no-referrer" />',
].join('\n');
const html = await readFile(indexPath, 'utf8');
if (!html.includes('<meta charset="utf-8" />')) {
  throw new Error('The exported web document does not contain the expected charset metadata.');
}

const hardenedHtml = html.replace(
  '    <meta charset="utf-8" />',
  `    <meta charset="utf-8" />\n${securityMeta}`,
);
await writeFile(indexPath, hardenedHtml, 'utf8');
await writeFile(
  path.resolve('web-build/release.json'),
  `${JSON.stringify({ release: releaseId, apiVersion: RANKINGS_API_VERSION })}\n`,
  'utf8',
);

console.log(`Web security metadata and release ${releaseId} added (${connectSources.join(', ')}).`);
