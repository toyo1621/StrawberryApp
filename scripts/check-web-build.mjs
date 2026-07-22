import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const buildDir = path.resolve('web-build');
const islandSourceDir = path.resolve('src/assets/islands');
const MAX_JS_BYTES = 950 * 1024;
const MAX_TOTAL_BYTES = 14 * 1024 * 1024;
const MAX_ISLAND_ASSET_BYTES = 12 * 1024 * 1024;
const MAX_SINGLE_ISLAND_ASSET_BYTES = 80 * 1024;
const EXPECTED_ISLAND_ASSET_COUNT = 415;
const PRODUCTION_BASE_PATH = '/StrawberryApp/';

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  }));
  return nested.flat();
};

const files = await walk(buildDir);
const sizes = await Promise.all(files.map(async (file) => ({ file, size: (await stat(file)).size })));
const jsFiles = sizes.filter(({ file }) => file.endsWith('.js'));
const builtSvgFiles = sizes.filter(({ file }) => file.endsWith('.svg'));
const totalBytes = sizes.reduce((total, { size }) => total + size, 0);
const largestJs = jsFiles.reduce((largest, current) => current.size > largest.size ? current : largest, {
  file: '',
  size: 0,
});

if (jsFiles.length === 0) {
  throw new Error('No JavaScript bundle was found in web-build.');
}
if (largestJs.size > MAX_JS_BYTES) {
  throw new Error(`Largest JavaScript bundle is ${largestJs.size} bytes; budget is ${MAX_JS_BYTES}.`);
}
if (totalBytes > MAX_TOTAL_BYTES) {
  throw new Error(`Web build is ${totalBytes} bytes; budget is ${MAX_TOTAL_BYTES}.`);
}
if (builtSvgFiles.length !== EXPECTED_ISLAND_ASSET_COUNT) {
  throw new Error(`Web build has ${builtSvgFiles.length} SVGs; expected ${EXPECTED_ISLAND_ASSET_COUNT}.`);
}

const islandAssetNames = (await readdir(islandSourceDir))
  .filter((file) => /^island-\d{3}\.svg$/.test(file))
  .sort();
const expectedIslandAssetNames = Array.from(
  { length: EXPECTED_ISLAND_ASSET_COUNT },
  (_, index) => `island-${String(index + 1).padStart(3, '0')}.svg`,
);
if (islandAssetNames.join('\n') !== expectedIslandAssetNames.join('\n')) {
  throw new Error('The source island assets are incomplete or have unstable sequence names.');
}
const islandAssetSizes = await Promise.all(
  islandAssetNames.map(async (file) => ({ file, size: (await stat(path.join(islandSourceDir, file))).size })),
);
const islandAssetBytes = islandAssetSizes.reduce((total, { size }) => total + size, 0);
const largestIslandAsset = islandAssetSizes.reduce(
  (largest, current) => current.size > largest.size ? current : largest,
  { file: '', size: 0 },
);
if (islandAssetBytes > MAX_ISLAND_ASSET_BYTES) {
  throw new Error(`Island SVGs use ${islandAssetBytes} bytes; budget is ${MAX_ISLAND_ASSET_BYTES}.`);
}
if (largestIslandAsset.size > MAX_SINGLE_ISLAND_ASSET_BYTES) {
  throw new Error(
    `${largestIslandAsset.file} uses ${largestIslandAsset.size} bytes; `
    + `single-island budget is ${MAX_SINGLE_ISLAND_ASSET_BYTES}.`,
  );
}

const textAssets = await Promise.all(
  files.filter((file) => /\.(?:html|js|css)$/.test(file)).map((file) => readFile(file, 'utf8')),
);
const indexHtml = await readFile(path.join(buildDir, 'index.html'), 'utf8');
const envExample = await readFile(path.resolve('.env.example'), 'utf8');
const expectedApiUrl = envExample.match(/^EXPO_PUBLIC_RANKINGS_API_URL=(.+)$/m)?.[1]?.trim();
if (textAssets.some((text) => text.includes('cdn.jsdelivr.net/npm/flag-icons'))) {
  throw new Error('The web build still depends on the external flag icon CDN.');
}
if (!indexHtml.includes('<html lang="ja">') || !indexHtml.includes(PRODUCTION_BASE_PATH)) {
  throw new Error('The production language or GitHub Pages base path is missing.');
}
if (!expectedApiUrl || !textAssets.some((text) => text.includes(expectedApiUrl))) {
  throw new Error('The production rankings API URL is missing from the web build.');
}
if (
  !indexHtml.includes('http-equiv="Content-Security-Policy"')
  || !indexHtml.includes("script-src 'self'")
  || !indexHtml.includes(`connect-src 'self' ${new URL(expectedApiUrl).origin}`)
  || !indexHtml.includes('<meta name="referrer" content="no-referrer" />')
) {
  throw new Error('The production Content Security Policy or referrer policy is missing.');
}

console.log(
  `Web build budget passed: ${(largestJs.size / 1024).toFixed(1)} KiB largest JS, `
  + `${(islandAssetBytes / 1024 / 1024).toFixed(2)} MiB across ${islandAssetNames.length} island SVGs, `
  + `${(totalBytes / 1024 / 1024).toFixed(2)} MiB total.`,
);
