import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  darkMode: boolean;
  hapticsEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  hapticsEnabled: true,
};

export const loadSettings = async (): Promise<AppSettings> => {
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

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const updateSettings = async (updates: Partial<AppSettings>): Promise<AppSettings> => {
  const currentSettings = await loadSettings();
  const newSettings = { ...currentSettings, ...updates };
  await saveSettings(newSettings);
  return newSettings;
};

export const clearSettings = async (): Promise<void> => {
  await AsyncStorage.removeItem(SETTINGS_KEY);
};
