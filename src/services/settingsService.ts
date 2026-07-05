import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  darkMode: boolean;
  hapticsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  hapticsEnabled: true,
};

// 設定を読み込む
export const loadSettings = async (): Promise<AppSettings> => {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return DEFAULT_SETTINGS;
  }
};

// 設定を保存する
export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

// 設定を更新する
export const updateSettings = async (updates: Partial<AppSettings>): Promise<AppSettings> => {
  const currentSettings = await loadSettings();
  const newSettings = { ...currentSettings, ...updates };
  await saveSettings(newSettings);
  return newSettings;
};
