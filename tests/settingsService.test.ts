import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const values = new Map<string, string>();
const localStorage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage },
});

const settingsServicePromise = import('../src/services/settingsService');

beforeEach(() => values.clear());

test('legacy settings gain online ranking participation without losing preferences', async () => {
  const settingsService = await settingsServicePromise;
  values.set('app_settings', JSON.stringify({ darkMode: true, hapticsEnabled: false }));

  assert.deepEqual(await settingsService.loadSettings(), {
    darkMode: true,
    hapticsEnabled: false,
    onlineRankingsEnabled: true,
  });
});

test('concurrent settings updates preserve changes to different controls', async () => {
  const settingsService = await settingsServicePromise;

  await Promise.all([
    settingsService.updateSettings({ darkMode: true }),
    settingsService.updateSettings({ onlineRankingsEnabled: false }),
  ]);

  assert.deepEqual(await settingsService.loadSettings(), {
    darkMode: true,
    hapticsEnabled: true,
    onlineRankingsEnabled: false,
  });
});

test('invalid persisted settings are reset to privacy-documented defaults', async () => {
  const settingsService = await settingsServicePromise;
  const originalWarn = console.warn;
  console.warn = () => undefined;
  values.set('app_settings', JSON.stringify({ onlineRankingsEnabled: 'yes' }));
  try {
    assert.deepEqual(await settingsService.loadSettings(), settingsService.DEFAULT_SETTINGS);
    assert.equal(values.has('app_settings'), false);
  } finally {
    console.warn = originalWarn;
  }
});
