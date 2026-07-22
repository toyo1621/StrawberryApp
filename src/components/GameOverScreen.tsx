import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FONT_WEIGHT_BOLD, MARU_GOTHIC_FONT } from '../constants/fonts';
import { getIslandRegionLabel } from '../domain/islands';
import { rankingIdentity } from '../domain/rankings';
import { GAME_MODE_CONFIG } from '../gameConfig';
import { fetchRankingsForModeWithStatus } from '../services/rankingService';
import { getTheme } from '../theme';
import { GameMode, IslandRegion, RankingEntry, RankingPeriod } from '../types';
import PeriodTabs from './ranking/PeriodTabs';
import RankingList from './ranking/RankingList';
import StatusBanner from './ui/StatusBanner';

type GameOverScreenProps = {
  ranking: RankingEntry[];
  gameMode: GameMode;
  islandRegion: IslandRegion;
  currentPlayer: { name: string; score: number };
  onPlayAgain: () => void;
  onGoHome: () => void;
  error?: string | null;
  onDismissError?: () => void;
  darkMode?: boolean;
  isPreparingGame?: boolean;
};

const GameOverScreen: React.FC<GameOverScreenProps> = ({
  ranking,
  gameMode,
  islandRegion,
  currentPlayer,
  onPlayAgain,
  onGoHome,
  error,
  onDismissError,
  darkMode = false,
  isPreparingGame = false,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState(RankingPeriod.ALL);
  const [periodRanking, setPeriodRanking] = useState<RankingEntry[]>([]);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);
  const [periodError, setPeriodError] = useState('');
  const theme = getTheme(darkMode);
  const config = GAME_MODE_CONFIG[gameMode];
  const accent = darkMode ? config.accentDark : config.accent;
  const actionAccent = config.accent;
  const rankingRegion = gameMode === GameMode.ISLAND ? islandRegion : IslandRegion.ALL;
  const islandRegionLabel = getIslandRegionLabel(rankingRegion);

  useEffect(() => {
    let active = true;
    if (selectedPeriod === RankingPeriod.ALL) {
      setPeriodRanking([]);
      setPeriodError('');
      setIsLoadingPeriod(false);
      return () => {
        active = false;
      };
    }

    setIsLoadingPeriod(true);
    setPeriodError('');
    fetchRankingsForModeWithStatus(gameMode, selectedPeriod, rankingRegion)
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
          setPeriodError('期間別ランキングを取得できませんでした。');
        }
      })
      .finally(() => {
        if (active) {setIsLoadingPeriod(false);}
      });

    return () => {
      active = false;
    };
  }, [gameMode, rankingRegion, selectedPeriod]);

  const currentRanking = selectedPeriod === RankingPeriod.ALL ? ranking : periodRanking;
  const rank = useMemo(() => {
    const playerIdentity = rankingIdentity(currentPlayer.name);
    const index = currentRanking.findIndex((entry) => (
      rankingIdentity(entry.playerName) === playerIdentity
      && entry.score === currentPlayer.score
    ));
    return index >= 0 ? index + 1 : null;
  }, [currentPlayer.name, currentPlayer.score, currentRanking]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.surface, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" aria-level={1} style={[styles.title, { color: theme.text }]}>ゲーム終了</Text>
          <Text style={[styles.modeLabel, { color: accent }]}>
            {config.emoji} {config.shortLabel}モード
            {gameMode === GameMode.ISLAND ? `・${islandRegionLabel}` : ''}
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLabel={`今回のスコアは${currentPlayer.score}${config.unit}です`}
            style={[styles.score, { color: accent }]}
          >
            {currentPlayer.score}<Text style={styles.scoreUnit}> {config.unit}</Text>
          </Text>
          <Text style={[styles.resultText, { color: theme.textMuted }]}>
            {rank ? `${selectedPeriod === RankingPeriod.ALL ? '全体' : '選択期間'} ${rank}位` : 'ランキング集計中'}
          </Text>
        </View>

        <View style={styles.rankingSection}>
          <Text accessibilityRole="header" aria-level={2} style={[styles.sectionTitle, { color: theme.text }]}>
            {gameMode === GameMode.ISLAND ? `${islandRegionLabel}ランキング` : `${config.rankingTitle}ランキング`}
          </Text>
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
            loading={isLoadingPeriod}
            limit={30}
            highlightedPlayerName={currentPlayer.name}
            highlightedScore={currentPlayer.score}
            darkMode={darkMode}
          />
          {periodError && <StatusBanner message={periodError} darkMode={darkMode} />}
        </View>

        {error && <StatusBanner message={error} onDismiss={onDismissError} darkMode={darkMode} />}

        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`${config.shortLabel}モードをもう一度遊ぶ`}
            accessibilityState={{ disabled: isPreparingGame, busy: isPreparingGame }}
            disabled={isPreparingGame}
            onPress={onPlayAgain}
            style={[styles.primaryButton, { backgroundColor: actionAccent, opacity: isPreparingGame ? 0.65 : 1 }]}
          >
            <Text style={styles.primaryButtonText}>{isPreparingGame ? '準備中...' : 'もう一度遊ぶ'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="ホームに戻る"
            onPress={onGoHome}
            style={[styles.secondaryButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>ホームに戻る</Text>
          </TouchableOpacity>
        </View>
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
  title: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  modeLabel: {
    marginTop: 4,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  score: {
    marginTop: 8,
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 52,
    lineHeight: 60,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  scoreUnit: { fontSize: 18, lineHeight: 24 },
  resultText: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
  },
  rankingSection: { width: '100%', gap: 12 },
  sectionTitle: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  actions: { width: '100%', gap: 10 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 17,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 15,
    fontWeight: FONT_WEIGHT_BOLD,
  },
});

export default GameOverScreen;
