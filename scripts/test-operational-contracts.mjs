import assert from 'node:assert/strict';
import {
  extractJavaScriptPaths,
  hasHealthyJavaScriptBundles,
  isSyntheticCleanupComplete,
  matchesRankingsRelease,
} from './operational-contracts.mjs';

const release = {
  ok: true,
  headerVersion: '4',
  headerReleaseId: 'commit-a',
  body: { ok: true, version: 4, release: 'commit-a' },
  expectedVersion: '4',
  expectedReleaseId: 'commit-a',
};

assert.equal(matchesRankingsRelease(release), true);
assert.equal(matchesRankingsRelease({ ...release, expectedReleaseId: 'commit-b' }), false);
assert.equal(matchesRankingsRelease({ ...release, headerReleaseId: 'commit-b' }), false);
assert.equal(matchesRankingsRelease({ ...release, headerVersion: '3' }), false);
assert.equal(matchesRankingsRelease({ ...release, expectedReleaseId: undefined }), true);

const cleanup = {
  syntheticScoreCreated: true,
  deleted: 1,
  history: [],
  submissionId: 'synthetic-score',
};

assert.equal(isSyntheticCleanupComplete(cleanup), true);
assert.equal(isSyntheticCleanupComplete({ ...cleanup, deleted: 0 }), false);
assert.equal(isSyntheticCleanupComplete({
  ...cleanup,
  history: [{ id: cleanup.submissionId }],
}), false);
assert.equal(isSyntheticCleanupComplete({ ...cleanup, history: null }), false);
assert.equal(isSyntheticCleanupComplete({ ...cleanup, syntheticScoreCreated: false, deleted: 0 }), true);

const splitBundleHtml = `
  <script src="/runtime.js" defer></script>
  <script src="/common.js" defer></script>
  <script src="/main.js" defer></script>
  <script src="/main.js" defer></script>
`;
assert.deepEqual(extractJavaScriptPaths(splitBundleHtml), [
  '/runtime.js',
  '/common.js',
  '/main.js',
]);
assert.deepEqual(extractJavaScriptPaths(null), []);

const splitBundles = [
  { ok: true, contentType: 'text/javascript; charset=utf-8', byteLength: 3_800 },
  { ok: true, contentType: 'application/javascript', byteLength: 54_000 },
  { ok: true, contentType: 'text/javascript', byteLength: 630_000 },
];
assert.equal(hasHealthyJavaScriptBundles(splitBundles), true);
assert.equal(hasHealthyJavaScriptBundles([
  ...splitBundles.slice(0, 2),
  { ...splitBundles[2], ok: false },
]), false);
assert.equal(hasHealthyJavaScriptBundles([
  { ok: true, contentType: 'text/javascript', byteLength: 99_999 },
]), false);

console.log('Release identity and production cleanup contracts verified.');
