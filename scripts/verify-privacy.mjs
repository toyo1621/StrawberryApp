import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [declarations, packageJson, privacyScreen, appConfigModule, workerSource] = await Promise.all([
  readFile(new URL('store/privacy-declarations.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('src/components/PrivacyPolicyScreen.tsx', root), 'utf8'),
  import(`../app.config.js?privacy=${Date.now()}`),
  readFile(new URL('worker/src/index.ts', root), 'utf8'),
]);

const failures = [];
const requireValue = (condition, message) => {
  if (!condition) {
    failures.push(message);
  }
};

requireValue(declarations.schemaVersion === 1, 'Privacy declaration schema version is invalid.');
requireValue(declarations.tracking === false, 'Cross-app tracking must remain disabled.');
requireValue(declarations.advertising === false, 'Advertising must remain disabled.');
requireValue(declarations.analytics === false, 'Behavioral analytics must remain disabled.');
requireValue(declarations.saleOfData === false, 'Data sale must remain disabled.');
requireValue(Array.isArray(declarations.data) && declarations.data.length > 0, 'Collected data inventory is empty.');
requireValue(
  declarations.data.every((entry) => entry.field && entry.purpose && entry.retention),
  'Every collected data field needs a purpose and retention rule.',
);

const dependencyNames = Object.keys({
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
});
const trackingDependency = dependencyNames.find((name) => (
  /(?:analytics|amplitude|appsflyer|adjust|advert|facebook-sdk|firebase-analytics|mixpanel|segment)/i.test(name)
));
requireValue(!trackingDependency, `Undeclared tracking or advertising dependency found: ${trackingDependency}`);
requireValue(privacyScreen.includes('広告SDKや行動分析SDKを組み込んでいません'), 'The in-app policy must disclose the absence of ad and analytics SDKs.');
requireValue(privacyScreen.includes('プレイヤーデータを削除'), 'The in-app policy must explain deletion.');
requireValue(
  privacyScreen.includes('所有者ハッシュや公開用の固定識別子は返しません'),
  'The in-app policy must explain private current-player personalization.',
);
requireValue(workerSource.includes("case 'DELETE /players/me/scores'"), 'The server-side deletion endpoint is missing.');

const manifests = appConfigModule.default?.expo?.ios?.privacyManifests?.NSPrivacyAccessedAPITypes;
requireValue(Array.isArray(manifests) && manifests.length > 0, 'The iOS Privacy Manifest is missing.');

if (failures.length > 0) {
  throw new Error(`Privacy verification failed:\n- ${failures.join('\n- ')}`);
}
console.log(`Privacy verification passed: ${declarations.data.length} data fields, no tracking or advertising SDKs.`);
