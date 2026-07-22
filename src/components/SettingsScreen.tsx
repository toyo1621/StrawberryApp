import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  FONT_WEIGHT_BOLD,
  FONT_WEIGHT_SEMIBOLD,
  MARU_GOTHIC_FONT,
} from '../constants/fonts';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  updateSettings,
  type AppSettings,
} from '../services/settingsService';
import { getTheme } from '../theme';
import StatusBanner from './ui/StatusBanner';

type SettingsScreenProps = {
  onBack: () => void;
  onSettingsChanged?: (settings: AppSettings) => void | Promise<void>;
  darkMode?: boolean;
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onSettingsChanged,
  darkMode = false,
}) => {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof AppSettings | null>(null);
  const [error, setError] = useState('');
  const theme = getTheme(darkMode);

  useEffect(() => {
    loadSettings()
      .then(setSettings)
      .catch((loadError) => {
        console.error('Failed to load settings:', loadError);
        setError('設定を読み込めませんでした。');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const persistSetting = async (
    key: keyof AppSettings,
    value: boolean,
    failureMessage: string,
  ): Promise<void> => {
    if (savingKey) {
      return;
    }
    setSavingKey(key);
    let nextSettings: AppSettings;
    try {
      nextSettings = await updateSettings({ [key]: value });
      setSettings(nextSettings);
      setError('');
    } catch (saveError) {
      console.error(`Failed to update ${key}:`, saveError);
      setError(failureMessage);
      setSavingKey(null);
      return;
    }
    try {
      await onSettingsChanged?.(nextSettings);
    } catch (relatedUpdateError) {
      console.error(`Failed to apply related changes for ${key}:`, relatedUpdateError);
      setError('設定は保存しましたが、関連する端末データを更新できませんでした。');
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator accessibilityLabel="設定を読み込み中" color={theme.focus} />
        <Text accessibilityLiveRegion="polite" style={[styles.loadingText, { color: theme.textMuted }]}>読み込み中</Text>
      </View>
    );
  }

  const switchDisabled = savingKey !== null;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text accessibilityRole="header" aria-level={1} style={[styles.title, { color: theme.text }]}>設定</Text>

        {error && <StatusBanner message={error} onDismiss={() => setError('')} darkMode={darkMode} />}

        <View style={styles.content}>
          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>オンラインランキング</Text>
              <Text style={[styles.settingDescription, { color: theme.textMuted }]}>オフにすると端末保存だけに切り替え、公開送信待ちも解除します</Text>
            </View>
            <Switch
              accessibilityLabel="オンラインランキングへ参加"
              accessibilityHint="スコアを公開ランキングへ送信するか切り替えます"
              accessibilityState={{ disabled: switchDisabled, busy: savingKey === 'onlineRankingsEnabled' }}
              disabled={switchDisabled}
              value={settings.onlineRankingsEnabled}
              onValueChange={(value) => persistSetting(
                'onlineRankingsEnabled',
                value,
                'オンラインランキング設定を保存できませんでした。',
              )}
              trackColor={{ false: '#9ca3af', true: '#ec4899' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>ダークモード</Text>
              <Text style={[styles.settingDescription, { color: theme.textMuted }]}>画面を暗いテーマに変更します</Text>
            </View>
            <Switch
              accessibilityLabel="ダークモード"
              accessibilityHint="画面の配色を暗いテーマに切り替えます"
              accessibilityState={{ disabled: switchDisabled, busy: savingKey === 'darkMode' }}
              disabled={switchDisabled}
              value={settings.darkMode}
              onValueChange={(value) => persistSetting(
                'darkMode',
                value,
                'ダークモード設定を保存できませんでした。',
              )}
              trackColor={{ false: '#9ca3af', true: '#ec4899' }}
              thumbColor="#ffffff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>振動フィードバック</Text>
              <Text style={[styles.settingDescription, { color: theme.textMuted }]}>正解と不正解を振動で知らせます</Text>
            </View>
            <Switch
              accessibilityLabel="振動フィードバック"
              accessibilityHint="正解と不正解を振動で知らせます"
              accessibilityState={{ disabled: switchDisabled, busy: savingKey === 'hapticsEnabled' }}
              disabled={switchDisabled}
              value={settings.hapticsEnabled}
              onValueChange={(value) => persistSetting(
                'hapticsEnabled',
                value,
                '振動設定を保存できませんでした。',
              )}
              trackColor={{ false: '#9ca3af', true: '#3b82f6' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="前の画面に戻る"
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.action }]}
        >
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: MARU_GOTHIC_FONT, fontSize: 14 },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  surface: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    gap: 20,
  },
  title: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: FONT_WEIGHT_BOLD,
    textAlign: 'center',
  },
  content: { width: '100%' },
  settingItem: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  settingCopy: { flex: 1 },
  settingTitle: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
  },
  settingDescription: {
    marginTop: 3,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 13,
    lineHeight: 19,
  },
  backButton: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 16,
    fontWeight: FONT_WEIGHT_BOLD,
  },
});

export default SettingsScreen;
