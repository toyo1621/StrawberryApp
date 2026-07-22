export interface PlayerIdentityStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const createMigratingPlayerIdentityStorage = (
  secureStorage: PlayerIdentityStorage,
  legacyStorage: PlayerIdentityStorage,
): PlayerIdentityStorage => ({
  getItem: async (key) => {
    const secured = await secureStorage.getItem(key);
    if (secured) {
      return secured;
    }

    const legacy = await legacyStorage.getItem(key);
    if (!legacy) {
      return null;
    }

    await secureStorage.setItem(key, legacy);
    await legacyStorage.removeItem(key);
    return legacy;
  },
  setItem: async (key, value) => {
    await secureStorage.setItem(key, value);
    await legacyStorage.removeItem(key);
  },
  removeItem: async (key) => {
    await Promise.all([
      secureStorage.removeItem(key),
      legacyStorage.removeItem(key),
    ]);
  },
});
