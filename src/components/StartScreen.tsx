import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD, MARU_GOTHIC_FONT } from '../constants/fonts';
import { normalizePlayerName } from '../domain/rankings';
import { getIslandRegionLabel } from '../domain/islands';
import { GAME_MODE_CONFIG } from '../gameConfig';
import { savePlayerName } from '../services/playerService';
import { fetchRankingsForModeWithStatus } from '../services/rankingService';
import { getTheme } from '../theme';
import { GameMode, IslandRegion, RankingEntry, RankingPeriod, RankingsByMode } from '../types';
import IslandRegionSelector from './game/IslandRegionSelector';
import ModeSelector from './game/ModeSelector';
import PeriodTabs from './ranking/PeriodTabs';
import RankingList from './ranking/RankingList';
import StatusBanner from './ui/StatusBanner';

type StartScreenProps = {
  onStart: (name: string, mode: GameMode, islandRegion: IslandRegion) => void | Promise<void>;
  rankings: RankingsByMode;
  isLoading?: boolean;
  onShowRules: () => void;
  onShowMyPage: () => void;
  savedPlayerName?: string;
  initialMode?: GameMode;
  initialIslandRegion?: IslandRegion;
  error?: string | null;
  onDismissError?: () => void;
  notice?: string | null;
  onDismissNotice?: () => void;
  darkMode?: boolean;
  isPreparingGame?: boolean;
};

const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  rankings,
  isLoading = false,
  onShowRules,
  onShowMyPage,
  savedPlayerName = '',
  initialMode = GameMode.STRAWBERRY,
  initialIslandRegion = IslandRegion.ALL,
  error,
  onDismissError,
  notice,
  onDismissNotice,
  darkMode = false,
  isPreparingGame = false,
}) => {
  const [name, setName] = useState(savedPlayerName);
  const [inputError, setInputError] = useState('');
  const [selectedMode, setSelectedMode] = useState(initialMode);
  const [selectedIslandRegion, setSelectedIslandRegion] = useState(initialIslandRegion);
  const [selectedPeriod, setSelectedPeriod] = useState(RankingPeriod.ALL);
  const [periodRanking, setPeriodRanking] = useState<RankingEntry[]>([]);
  const [periodError, setPeriodError] = useState('');
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
  const theme = getTheme(darkMode);
  const config = GAME_MODE_CONFIG[selectedMode];
  const accent = darkMode ? config.accentDark : config.accent;
  const actionAccent = config.accent;
  const islandRegionLabel = getIslandRegionLabel(selectedIslandRegion);
  const usesFetchedRanking = selectedMode === GameMode.ISLAND
    || selectedPeriod !== RankingPeriod.ALL;

  useEffect(() => {
    if (savedPlayerName) {
      setName(savedPlayerName);
    }
  }, [savedPlayerName]);

  useEffect(() => {
    let active = true;
    if (!usesFetchedRanking) {
      setPeriodRanking([]);
      setPeriodError('');
      setIsLoadingPeriod(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingPeriod(true);
    setPeriodError('');
    fetchRankingsForModeWithStatus(selectedMode, selectedPeriod, selectedIslandRegion)
      .then((result) => {
        if (active) {
          setPeriodRanking(result.entries);
          if (result.stale) {
            setPeriodError('通信できないため端末に保存したランキングを表示しています。');
          }
        }
      })
      .catch(() => {
        if (active) {
          setPeriodRanking([]);
          setPeriodError('ランキングを取得できませんでした。');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingPeriod(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedIslandRegion, selectedMode, selectedPeriod, usesFetchedRanking]);

  const currentRanking = useMemo(
    () => usesFetchedRanking ? periodRanking : rankings[selectedMode],
    [periodRanking, rankings, selectedMode, usesFetchedRanking],
  );

  const handleSubmit = async () => {
    const normalizedName = normalizePlayerName(name);
    if (!normalizedName) {
      setInputError('プレイヤー名を入力してください。');
      return;
    }
    if (normalizedName.length > 12) {
      setInputError('プレイヤー名は12文字までです。');
      return;
    }
    if (/[\u0000-\u001f\u007f<>]/.test(normalizedName)) {
      setInputError('使用できない文字が含まれています。');
      return;
    }

    setInputError('');
    try {
      await savePlayerName(normalizedName);
      await onStart(normalizedName, selectedMode, selectedIslandRegion);
    } catch {
      setInputError('プレイヤー名を端末に保存できませんでした。空き容量とブラウザ設定を確認してください。');
    }
  };

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Text accessible={false} style={styles.heroEmoji}>{config.emoji}</Text>
          <Text accessibilityRole="header" aria-level={1} style={[styles.title, { color: accent }]}>{config.title}</Text>
          <Text style={[styles.description, { color: theme.textMuted }]}>{config.description}</Text>
        </View>

        <ModeSelector value={selectedMode} onChange={setSelectedMode} darkMode={darkMode} />

        {selectedMode === GameMode.ISLAND && (
          <IslandRegionSelector
            value={selectedIslandRegion}
            onChange={setSelectedIslandRegion}
            darkMode={darkMode}
          />
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="ゲームルールを開く"
            onPress={onShowRules}
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>ルール</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="マイページを開く"
            onPress={onShowMyPage}
            style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>マイページ</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rankingSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.text }]}>
                {selectedMode === GameMode.ISLAND ? `${islandRegionLabel}ランキング` : 'ランキング'}
              </Text>
              <Text style={[styles.sectionCaption, { color: theme.textMuted }]}>
                {config.shortLabel}モード{selectedMode === GameMode.ISLAND ? `・${islandRegionLabel}` : ''}
              </Text>
            </View>
            <Text style={[styles.rankingMark, { color: accent }]}>{config.rankingTitle}</Text>
          </View>
          <PeriodTabs
            value={selectedPeriod}
            onChange={setSelectedPeriod}
            accent={actionAccent}
            darkMode={darkMode}
          />
          <RankingList
            entries={currentRanking}
            unit={config.unit}
            accent={accent}
            loading={isLoading || isLoadingPeriod}
            darkMode={darkMode}
          />
          {periodError && <StatusBanner message={periodError} darkMode={darkMode} />}
        </View>

        <View style={styles.startSection}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>プレイヤー名</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (inputError) {setInputError('');}
            }}
            onSubmitEditing={handleSubmit}
            accessibilityLabel="プレイヤー名"
            accessibilityHint="ランキングに表示する12文字までの名前です"
            accessibilityValue={inputError ? { text: `入力エラー: ${inputError}` } : undefined}
            autoCapitalize="none"
            autoCorrect={false}
            enterKeyHint="go"
            maxLength={12}
            placeholder="名前を入力"
            placeholderTextColor={theme.textMuted}
            returnKeyType="go"
            style={[
              styles.input,
              {
                backgroundColor: theme.input,
                borderColor: inputError ? theme.danger : theme.border,
                color: theme.text,
              },
            ]}
          />
          {inputError ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.inputError, { color: theme.danger }]}>
              {inputError}
            </Text>
          ) : (
            <Text style={[styles.inputHint, { color: theme.textMuted }]}>この名前が公開ランキングに表示されます。</Text>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${config.shortLabel}モードでゲームを開始`}
            accessibilityState={{ disabled: isPreparingGame, busy: isPreparingGame }}
            disabled={isPreparingGame}
            onPress={handleSubmit}
            style={[styles.startButton, { backgroundColor: actionAccent, opacity: isPreparingGame ? 0.65 : 1 }]}
          >
            <Text style={styles.startButtonText}>{isPreparingGame ? '準備中...' : 'ゲーム開始'}</Text>
          </TouchableOpacity>
        </View>

        {notice && (
          <StatusBanner
            message={notice}
            tone="success"
            onDismiss={onDismissNotice}
            darkMode={darkMode}
          />
        )}
        {error && (
          <StatusBanner message={error} onDismiss={onDismissError} darkMode={darkMode} />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
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
  header: { alignItems: 'center' },
  heroEmoji: { fontSize: 44, lineHeight: 52 },
  title: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: FONT_WEIGHT_BOLD,
    textAlign: 'center',
  },
  description: {
    marginTop: 4,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  rankingSection: { width: '100%', gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  sectionCaption: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 13,
    lineHeight: 18,
  },
  rankingMark: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  startSection: { width: '100%' },
  inputLabel: {
    marginBottom: 6,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
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
  inputError: {
    marginTop: 6,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
  },
  inputHint: {
    marginTop: 6,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 13,
    lineHeight: 18,
  },
  startButton: {
    width: '100%',
    minHeight: 52,
    marginTop: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#ffffff',
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
  },
});

export default StartScreen;
