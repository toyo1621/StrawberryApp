import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  darkMode: boolean;
  hapticsEnabled: boolean;
  onlineRankingsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  hapticsEnabled: true,
  onlineRankingsEnabled: true,
};

let settingsWriteTail: Promise<void> = Promise.resolve();

const withSettingsWriteLock = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = settingsWriteTail.then(operation, operation);
  settingsWriteTail = result.then(() => undefined, () => undefined);
  return result;
};

const readSettings = async (): Promise<AppSettings> => {
  const stored = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!stored) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<AppSettings> | null;
    if (
      !parsed
      || typeof parsed !== 'object'
      || (parsed.darkMode !== undefined && typeof parsed.darkMode !== 'boolean')
      || (parsed.hapticsEnabled !== undefined && typeof parsed.hapticsEnabled !== 'boolean')
      || (parsed.onlineRankingsEnabled !== undefined
        && typeof parsed.onlineRankingsEnabled !== 'boolean')
    ) {
      throw new Error('Invalid settings shape.');
    }

    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.warn('Invalid saved settings were reset.', error);
    await AsyncStorage.removeItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS };
  }
};

export const loadSettings = async (): Promise<AppSettings> => {
  await settingsWriteTail;
  return readSettings();
};

const writeSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const saveSettings = (settings: AppSettings): Promise<void> => (
  withSettingsWriteLock(() => writeSettings(settings))
);

export const updateSettings = async (updates: Partial<AppSettings>): Promise<AppSettings> => {
  return withSettingsWriteLock(async () => {
    const currentSettings = await readSettings();
    const newSettings = { ...currentSettings, ...updates };
    await writeSettings(newSettings);
    return newSettings;
  });
};

export const clearSettings = async (): Promise<void> => {
  await withSettingsWriteLock(() => AsyncStorage.removeItem(SETTINGS_KEY));
};
