import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const platforms = ['ios', 'android'];
const MAX_BUNDLE_BYTES = 2.5 * 1024 * 1024;
const MAX_EXPORT_BYTES = 16 * 1024 * 1024;
const EXPECTED_ISLAND_ASSETS = 415;

for (const platform of platforms) {
  const exportDir = path.resolve(`.tmp/export-${platform}`);
  const metadata = JSON.parse(await readFile(path.join(exportDir, 'metadata.json'), 'utf8'));
  const platformMetadata = metadata.fileMetadata?.[platform];
  if (!platformMetadata?.bundle || !Array.isArray(platformMetadata.assets)) {
    throw new Error(`${platform} export metadata is incomplete.`);
  }

  const files = [platformMetadata.bundle, ...platformMetadata.assets.map(({ path: assetPath }) => assetPath)];
  const sizes = await Promise.all(files.map(async (file) => (await stat(path.join(exportDir, file))).size));
  const bundleBytes = sizes[0];
  const exportBytes = sizes.reduce((total, size) => total + size, 0);
  const islandAssets = platformMetadata.assets.filter(({ ext }) => ext === 'svg').length;

  if (!platformMetadata.bundle.endsWith('.hbc')) {
    throw new Error(`${platform} production bundle is not Hermes bytecode.`);
  }
  if (bundleBytes > MAX_BUNDLE_BYTES) {
    throw new Error(`${platform} bundle is ${bundleBytes} bytes; budget is ${MAX_BUNDLE_BYTES}.`);
  }
  if (exportBytes > MAX_EXPORT_BYTES) {
    throw new Error(`${platform} export is ${exportBytes} bytes; budget is ${MAX_EXPORT_BYTES}.`);
  }
  if (islandAssets !== EXPECTED_ISLAND_ASSETS) {
    throw new Error(`${platform} export has ${islandAssets} island SVGs; expected ${EXPECTED_ISLAND_ASSETS}.`);
  }

  console.log(
    `${platform} bundle budget passed: ${(bundleBytes / 1024 / 1024).toFixed(2)} MiB bytecode, `
    + `${(exportBytes / 1024 / 1024).toFixed(2)} MiB export, ${islandAssets} island SVGs.`,
  );
}
