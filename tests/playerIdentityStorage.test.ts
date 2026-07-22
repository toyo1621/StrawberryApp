import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMigratingPlayerIdentityStorage,
  type PlayerIdentityStorage,
} from '../src/services/playerIdentityStorageCore';

const createStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  const storage: PlayerIdentityStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  return { storage, values };
};

test('migrates a legacy player identity into secure storage on first read', async () => {
  const secure = createStorage();
  const legacy = createStorage({ identity: 'existing-token' });
  const storage = createMigratingPlayerIdentityStorage(secure.storage, legacy.storage);

  assert.equal(await storage.getItem('identity'), 'existing-token');
  assert.equal(secure.values.get('identity'), 'existing-token');
  assert.equal(legacy.values.has('identity'), false);
});

test('prefers an existing secure identity and removes legacy copies on writes', async () => {
  const secure = createStorage({ identity: 'secure-token' });
  const legacy = createStorage({ identity: 'legacy-token' });
  const storage = createMigratingPlayerIdentityStorage(secure.storage, legacy.storage);

  assert.equal(await storage.getItem('identity'), 'secure-token');
  await storage.setItem('identity', 'new-token');
  assert.equal(secure.values.get('identity'), 'new-token');
  assert.equal(legacy.values.has('identity'), false);
});

test('clears both secure and legacy identity stores', async () => {
  const secure = createStorage({ identity: 'secure-token' });
  const legacy = createStorage({ identity: 'legacy-token' });
  const storage = createMigratingPlayerIdentityStorage(secure.storage, legacy.storage);

  await storage.removeItem('identity');
  assert.equal(secure.values.has('identity'), false);
  assert.equal(legacy.values.has('identity'), false);
});
