import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const buildDir = path.resolve('web-build');
const MAX_JS_BYTES = 800 * 1024;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;
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

console.log(
  `Web build budget passed: ${(largestJs.size / 1024).toFixed(1)} KiB largest JS, `
  + `${(totalBytes / 1024 / 1024).toFixed(2)} MiB total.`,
);
