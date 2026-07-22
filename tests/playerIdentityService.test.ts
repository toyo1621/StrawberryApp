import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const values = new Map<string, string>();
const localStorage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => values.set(key, String(value)),
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage },
});

const servicePromise = import('../src/services/playerIdentityService');

beforeEach(() => values.clear());

test('creates and reuses a version 4 player identity', async () => {
  const service = await servicePromise;
  const created = await service.getPlayerToken();

  assert.match(created, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(await service.getStoredPlayerToken(), created);
  assert.equal(await service.getPlayerToken(), created);
});

test('replaces malformed stored identities and clears the replacement', async () => {
  const service = await servicePromise;
  values.set('player_private_token_v1', 'not-a-token');

  assert.equal(await service.getStoredPlayerToken(), null);
  const replacement = await service.getPlayerToken();
  assert.notEqual(replacement, 'not-a-token');

  await service.clearPlayerIdentity();
  assert.equal(await service.getStoredPlayerToken(), null);
});
