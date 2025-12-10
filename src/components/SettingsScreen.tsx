import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { loadSettings, updateSettings, AppSettings } from '../services/settingsService';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface SettingsScreenProps {
  onBack: () => void;
  onSettingsChanged?: (settings: AppSettings) => void;
  darkMode?: boolean;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onSettingsChanged, darkMode = false }) => {
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
    hapticsEnabled: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      const loadedSettings = await loadSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDarkMode = async (value: boolean) => {
    const newSettings = await updateSettings({ darkMode: value });
    setSettings(newSettings);
    if (onSettingsChanged) {
      onSettingsChanged(newSettings);
    }
  };

  const handleToggleHaptics = async (value: boolean) => {
    const newSettings = await updateSettings({ hapticsEnabled: value });
    setSettings(newSettings);
    if (onSettingsChanged) {
      onSettingsChanged(newSettings);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, darkMode && styles.containerDark]}>
        <Text style={[styles.loadingText, darkMode && styles.loadingTextDark]}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.container, darkMode && styles.containerDark]}>
        <View style={styles.header}>
          <Text style={[styles.title, darkMode && styles.titleDark]}>設定</Text>
        </View>

        <View style={styles.content}>
          {/* ダークモード設定 */}
          <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, darkMode && styles.settingTitleDark]}>ダークモード</Text>
              <Text style={[styles.settingDescription, darkMode && styles.settingDescriptionDark]}>
                画面を暗いテーマに変更します
              </Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={handleToggleDarkMode}
              trackColor={{ false: '#d1d5db', true: '#ec4899' }}
              thumbColor={settings.darkMode ? '#ffffff' : '#f3f4f6'}
            />
          </View>

          {/* 振動設定 */}
          <View style={[styles.settingItem, darkMode && styles.settingItemDark]}>
            <View style={styles.settingLeft}>
              <Text style={[styles.settingTitle, darkMode && styles.settingTitleDark]}>振動フィードバック</Text>
              <Text style={[styles.settingDescription, darkMode && styles.settingDescriptionDark]}>
                正解・不正解時にバイブレーションを鳴らします
              </Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={handleToggleHaptics}
              trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
              thumbColor={settings.hapticsEnabled ? '#ffffff' : '#f3f4f6'}
            />
          </View>
        </View>

        <View style={styles.backButtonContainer}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    minHeight: '100%',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    width: '100%',
    maxWidth: 448,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ec4899',
    fontFamily: MARU_GOTHIC_FONT,
  },
  content: {
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    color: '#1f2937',
    marginBottom: 4,
    fontFamily: MARU_GOTHIC_FONT,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    fontFamily: MARU_GOTHIC_FONT,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  loadingTextDark: {
    color: '#d1d5db',
  },
  containerDark: {
    backgroundColor: '#374151',
  },
  titleDark: {
    color: '#ec4899',
  },
  settingItemDark: {
    borderBottomColor: '#4b5563',
  },
  settingTitleDark: {
    color: '#f3f4f6',
  },
  settingDescriptionDark: {
    color: '#9ca3af',
  },
  backButtonContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#ec4899',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 18,
    fontFamily: MARU_GOTHIC_FONT,
  },
});

export default SettingsScreen;
