import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../constants/fonts';
import { getIslandRegionLabel } from '../domain/islands';
import {
  getPlayerNameValidationError,
  normalizePlayerName,
} from '../domain/rankings';
import { GAME_MODE_CONFIG } from '../gameConfig';
import { loadPlayerName, savePlayerName } from '../services/playerService';
import { fetchPlayerScoreHistory } from '../services/rankingService';
import { getTheme } from '../theme';
import { GameMode, RankingEntry } from '../types';
import ModeSelector from './game/ModeSelector';
import StatusBanner from './ui/StatusBanner';

type MyPageScreenProps = {
  onBack: () => void;
  onNameChanged: (name: string) => void;
  onShowSettings?: () => void;
  onShowPrivacyPolicy?: () => void;
  onShowTermsOfService?: () => void;
  onDeleteData: () => Promise<number>;
  darkMode?: boolean;
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '日時不明';
  }
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const MyPageScreen: React.FC<MyPageScreenProps> = ({
  onBack,
  onNameChanged,
  onShowSettings,
  onShowPrivacyPolicy,
  onShowTermsOfService,
  onDeleteData,
  darkMode = false,
}) => {
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [historyMode, setHistoryMode] = useState(GameMode.STRAWBERRY);
  const [scoreHistory, setScoreHistory] = useState<RankingEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const theme = getTheme(darkMode);
  const historyConfig = GAME_MODE_CONFIG[historyMode];
  const accent = darkMode ? historyConfig.accentDark : historyConfig.accent;

  useEffect(() => {
    loadPlayerName()
      .then(setName)
      .catch(() => setMessage({ text: '保存済みの名前を読み込めませんでした。', tone: 'error' }))
      .finally(() => setIsLoading(false));
  }, []);

  const loadScoreHistory = async (mode: GameMode = historyMode) => {
    const normalizedName = normalizePlayerName(name);
    if (!normalizedName) {
      setMessage({ text: '履歴を表示するにはプレイヤー名を入力してください。', tone: 'error' });
      return;
    }

    setIsLoadingHistory(true);
    setMessage(null);
    try {
      const history = await fetchPlayerScoreHistory(normalizedName, GAME_MODE_CONFIG[mode].apiType);
      setScoreHistory(history);
      setShowHistory(true);
    } catch {
      setMessage({ text: 'スコア履歴を読み込めませんでした。', tone: 'error' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSave = async () => {
    const normalizedName = normalizePlayerName(name);
    const validationError = getPlayerNameValidationError(normalizedName);
    if (validationError) {
      setMessage({ text: validationError, tone: 'error' });
      return;
    }

    try {
      await savePlayerName(normalizedName);
      setName(normalizedName);
      onNameChanged(normalizedName);
      setMessage({ text: 'プレイヤー名を保存しました。', tone: 'success' });
    } catch {
      setMessage({ text: 'プレイヤー名を保存できませんでした。', tone: 'error' });
    }
  };

  const handleOpenContactForm = async () => {
    const url = 'https://forms.gle/yqPN2tyeFfXdH4nR9';
    try {
      if (!(await Linking.canOpenURL(url))) {
        throw new Error('Unsupported URL');
      }
      await Linking.openURL(url);
    } catch {
      setMessage({ text: 'お問い合わせフォームを開けませんでした。', tone: 'error' });
    }
  };

  const handleDeleteData = async () => {
    setIsDeletingData(true);
    setMessage(null);
    try {
      await onDeleteData();
    } catch (error) {
      console.error('Failed to delete player data:', error);
      setMessage({
        text: 'データを削除できませんでした。通信状態を確認して、もう一度お試しください。',
        tone: 'error',
      });
      setShowDeleteConfirmation(false);
    } finally {
      setIsDeletingData(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator accessibilityLabel="マイページを読み込み中" color={theme.focus} />
        <Text accessibilityLiveRegion="polite" style={[styles.loadingText, { color: theme.textMuted }]}>読み込み中</Text>
      </View>
    );
  }

  const menuItems = [
    { label: '設定', onPress: onShowSettings },
    { label: 'プライバシーポリシー', onPress: onShowPrivacyPolicy },
    { label: '利用規約', onPress: onShowTermsOfService },
  ].filter((item): item is { label: string; onPress: () => void } => Boolean(item.onPress));

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text accessibilityRole="header" aria-level={1} style={[styles.title, { color: theme.text }]}>マイページ</Text>

        {message && (
          <StatusBanner
            message={message.text}
            tone={message.tone}
            onDismiss={() => setMessage(null)}
            darkMode={darkMode}
          />
        )}

        <View style={styles.section}>
          <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.text }]}>プレイヤー名</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="プレイヤー名"
            accessibilityHint="公開ランキングに表示する12文字までの名前です"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="名前を入力"
            placeholderTextColor={theme.textMuted}
            style={[
              styles.input,
              { backgroundColor: theme.input, borderColor: theme.border, color: theme.text },
            ]}
          />
          <Text style={[styles.caption, { color: theme.textMuted }]}>この名前は公開ランキングに表示されます。</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="プレイヤー名を保存"
            onPress={handleSave}
            style={[styles.primaryButton, { backgroundColor: theme.action }]}
          >
            <Text style={styles.primaryButtonText}>名前を保存</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.text }]}>データ管理</Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>
            この端末から登録した公開スコア、プレイヤー名、設定、保存待ちスコアを削除します。
          </Text>
          {showDeleteConfirmation ? (
            <View accessibilityRole="alert" style={styles.deleteConfirmation}>
              <Text style={[styles.confirmationText, { color: theme.danger }]}>この操作は元に戻せません。削除しますか？</Text>
              <View style={styles.confirmationActions}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="データ削除をキャンセル"
                  disabled={isDeletingData}
                  onPress={() => setShowDeleteConfirmation(false)}
                  style={[styles.confirmationButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                >
                  <Text style={[styles.outlineButtonText, { color: theme.text }]}>キャンセル</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="すべてのプレイヤーデータを削除"
                  accessibilityState={{ disabled: isDeletingData }}
                  disabled={isDeletingData}
                  onPress={handleDeleteData}
                  style={[styles.confirmationButton, styles.dangerButton]}
                >
                  <Text style={styles.dangerButtonText}>{isDeletingData ? '削除中' : '削除する'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="プレイヤーデータの削除確認を開く"
              onPress={() => setShowDeleteConfirmation(true)}
              style={[styles.outlineButton, { borderColor: theme.danger }]}
            >
              <Text style={[styles.outlineButtonText, { color: theme.danger }]}>プレイヤーデータを削除</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.text }]}>スコア履歴</Text>
          <ModeSelector
            value={historyMode}
            onChange={(mode) => {
              setHistoryMode(mode);
              if (showHistory) {
                void loadScoreHistory(mode);
              }
            }}
            darkMode={darkMode}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${historyConfig.shortLabel}モードのスコア履歴を表示`}
            accessibilityState={{ disabled: isLoadingHistory || !normalizePlayerName(name) }}
            disabled={isLoadingHistory || !normalizePlayerName(name)}
            onPress={() => loadScoreHistory()}
            style={[
              styles.outlineButton,
              { borderColor: accent },
              (isLoadingHistory || !normalizePlayerName(name)) && styles.disabled,
            ]}
          >
            <Text style={[styles.outlineButtonText, { color: accent }]}>
              {isLoadingHistory ? '読み込み中' : '履歴を表示'}
            </Text>
          </TouchableOpacity>

          {showHistory && (
            <View style={[styles.history, { borderColor: theme.border }]}>
              {scoreHistory.length === 0 ? (
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>このモードの履歴はありません。</Text>
              ) : scoreHistory.slice(0, 10).map((entry) => {
                const regionLabel = historyMode === GameMode.ISLAND
                  ? getIslandRegionLabel(entry.islandRegion)
                  : null;
                return (
                  <View
                    key={entry.id}
                    accessible
                    accessibilityLabel={`${entry.score}${historyConfig.unit}${regionLabel ? `、${regionLabel}` : ''}、${formatDate(entry.createdAt)}`}
                    style={[styles.historyRow, { borderBottomColor: theme.border }]}
                  >
                    <View style={styles.historyScoreGroup}>
                      <Text style={[styles.historyScore, { color: accent }]}>{entry.score} {historyConfig.unit}</Text>
                      {regionLabel && (
                        <Text style={[styles.historyRegion, { color: theme.textMuted }]}>{regionLabel}</Text>
                      )}
                    </View>
                    <Text style={[styles.historyDate, { color: theme.textMuted }]}>{formatDate(entry.createdAt)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.text }]}>サポート</Text>
          <Text style={[styles.bodyText, { color: theme.textMuted }]}>お問い合わせはGoogleフォームで開きます。</Text>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel="お問い合わせフォームを外部ブラウザで開く"
            onPress={handleOpenContactForm}
            style={[styles.outlineButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.outlineButtonText, { color: theme.text }]}>お問い合わせ</Text>
          </TouchableOpacity>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={`${item.label}を開く`}
              onPress={item.onPress}
              style={[styles.menuButton, { borderBottomColor: theme.border }]}
            >
              <Text style={[styles.menuText, { color: theme.text }]}>{item.label}</Text>
              <Text accessible={false} style={[styles.menuArrow, { color: theme.textMuted }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="ホームに戻る"
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
        >
          <Text style={[styles.backButtonText, { color: theme.text }]}>ホームに戻る</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: MARU_GOTHIC_FONT, fontSize: 14 },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 20 },
  surface: {
    width: '100%',
    maxWidth: 560,
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    gap: 22,
  },
  title: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: FONT_WEIGHT_BOLD,
    textAlign: 'center',
  },
  section: { width: '100%', gap: 10 },
  sectionTitle: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  input: {
    width: '100%',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 16,
  },
  caption: { fontFamily: MARU_GOTHIC_FONT, fontSize: 13, lineHeight: 18 },
  bodyText: { fontFamily: MARU_GOTHIC_FONT, fontSize: 14, lineHeight: 20 },
  deleteConfirmation: { width: '100%', gap: 10 },
  confirmationText: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  confirmationActions: { flexDirection: 'row', gap: 10 },
  confirmationButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dangerButton: { backgroundColor: '#b91c1c', borderColor: '#b91c1c' },
  dangerButtonText: { color: '#ffffff', fontFamily: MARU_GOTHIC_FONT, fontSize: 14, fontWeight: FONT_WEIGHT_BOLD },
  primaryButton: { minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontFamily: MARU_GOTHIC_FONT, fontSize: 15, fontWeight: FONT_WEIGHT_BOLD },
  outlineButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  outlineButtonText: { fontFamily: MARU_GOTHIC_FONT, fontSize: 14, fontWeight: FONT_WEIGHT_BOLD },
  disabled: { opacity: 0.45 },
  history: { width: '100%', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  historyRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyScoreGroup: { flexShrink: 1 },
  historyScore: { fontFamily: MARU_GOTHIC_FONT, fontSize: 15, fontWeight: FONT_WEIGHT_BOLD },
  historyRegion: { marginTop: 2, fontFamily: MARU_GOTHIC_FONT, fontSize: 12 },
  historyDate: { marginLeft: 10, fontFamily: MARU_GOTHIC_FONT, fontSize: 12 },
  emptyText: { padding: 20, fontFamily: MARU_GOTHIC_FONT, fontSize: 14, textAlign: 'center' },
  menuButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuText: { fontFamily: MARU_GOTHIC_FONT, fontSize: 15, fontWeight: FONT_WEIGHT_BOLD },
  menuArrow: { fontSize: 26, lineHeight: 30 },
  backButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { fontFamily: MARU_GOTHIC_FONT, fontSize: 15, fontWeight: FONT_WEIGHT_BOLD },
});

export default MyPageScreen;
