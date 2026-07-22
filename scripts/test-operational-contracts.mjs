import assert from 'node:assert/strict';
import {
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

console.log('Release identity and production cleanup contracts verified.');
