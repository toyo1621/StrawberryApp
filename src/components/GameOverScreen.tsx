import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { RankingEntry, GameMode } from '../types';
import { RankingPeriod, fetchRankingsByPeriod, fetchIslandRankingsByPeriod, fetchFlagRankingsByPeriod, fetchColorRankingsByPeriod } from '../services/rankingService';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface GameOverScreenProps {
  ranking: RankingEntry[];
  gameMode: GameMode;
  currentPlayer: { name: string; score: number };
  onPlayAgain: () => void;
  onGoHome: () => void;
  error?: string | null;
  onDismissError?: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ ranking, gameMode, currentPlayer, onPlayAgain, onGoHome, error, onDismissError }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<RankingPeriod>(RankingPeriod.ALL);
  const [periodRanking, setPeriodRanking] = useState<RankingEntry[]>([]);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);

  const isStrawberryMode = gameMode === GameMode.STRAWBERRY;
  const isIslandMode = gameMode === GameMode.ISLAND;
  const isFlagMode = gameMode === GameMode.FLAG;
  const isColorMode = gameMode === GameMode.COLOR;
  const unit = isStrawberryMode ? '個' : '問';

  // 期間別ランキングを取得
  useEffect(() => {
    const loadPeriodRankings = async () => {
      if (selectedPeriod === RankingPeriod.ALL) {
        setPeriodRanking([]);
        return;
      }

      setIsLoadingPeriod(true);
      try {
        let rankings: RankingEntry[] = [];
        if (isStrawberryMode) {
          rankings = await fetchRankingsByPeriod(selectedPeriod);
        } else if (isIslandMode) {
          rankings = await fetchIslandRankingsByPeriod(selectedPeriod);
        } else if (isColorMode) {
          rankings = await fetchColorRankingsByPeriod(selectedPeriod);
        } else {
          rankings = await fetchFlagRankingsByPeriod(selectedPeriod);
        }
        setPeriodRanking(rankings);
      } catch (error) {
        console.error('Failed to load period rankings:', error);
        setPeriodRanking([]);
      } finally {
        setIsLoadingPeriod(false);
      }
    };

    loadPeriodRankings();
  }, [selectedPeriod, isStrawberryMode, isIslandMode, isColorMode]);

  // 表示するランキングを決定
  const currentRanking = selectedPeriod === RankingPeriod.ALL ? ranking : periodRanking;

  // Find the current player's rank
  const playerRank = currentRanking.findIndex(entry => 
    entry.playerName === currentPlayer.name && entry.score === currentPlayer.score
  ) + 1;

  const getModeStyles = () => {
    if (isStrawberryMode) {
      return {
        rankingBg: styles.pinkRankingBg,
        rankingText: styles.pinkRankingText,
        scoreText: styles.pinkScoreText,
      };
    } else if (isIslandMode) {
      return {
        rankingBg: styles.blueRankingBg,
        rankingText: styles.blueRankingText,
        scoreText: styles.blueScoreText,
      };
    } else if (isColorMode) {
      return {
        rankingBg: styles.purpleRankingBg,
        rankingText: styles.purpleRankingText,
        scoreText: styles.purpleScoreText,
      };
    } else {
      return {
        rankingBg: styles.greenRankingBg,
        rankingText: styles.greenRankingText,
        scoreText: styles.greenScoreText,
      };
    }
  };

  const modeStyles = getModeStyles();

  return (
    <ScrollView 
      style={styles.scrollView} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>タイムアップ！</Text>
        <Text style={styles.scoreText}>
          {currentPlayer.name}さんのスコアは <Text style={styles.scoreValue}>{currentPlayer.score}</Text> {unit}でした！
        </Text>

        {playerRank > 0 && (
          <Text style={styles.rankText}>
            🎉 第{playerRank}位にランクイン！ 🎉
          </Text>
        )}

        {/* 期間選択タブ */}
        <View style={styles.periodTabsContainer}>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.ALL)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.ALL && styles.periodTabActive]}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.ALL && styles.periodTabTextActive]}>
              全体
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.DAILY)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.DAILY && styles.periodTabActive]}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.DAILY && styles.periodTabTextActive]}>
              日別
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.WEEKLY)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.WEEKLY && styles.periodTabActive]}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.WEEKLY && styles.periodTabTextActive]}>
              週別
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.MONTHLY)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.MONTHLY && styles.periodTabActive]}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.MONTHLY && styles.periodTabTextActive]}>
              月別
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.rankingContainer, modeStyles.rankingBg]}>
          <Text style={[styles.rankingTitle, modeStyles.rankingText]}>
            {isStrawberryMode ? 'いちご王' : 
             isIslandMode ? '島王' : 
             isColorMode ? '色王' :
             '国旗王'} ランキング
            {selectedPeriod !== RankingPeriod.ALL && (
              <Text style={styles.periodLabel}>
                {' '}({selectedPeriod === RankingPeriod.DAILY ? '日別' :
                       selectedPeriod === RankingPeriod.WEEKLY ? '週別' :
                       '月別'})
              </Text>
            )}
          </Text>
          {isLoadingPeriod ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isStrawberryMode ? '#ec4899' : isIslandMode ? '#3b82f6' : isColorMode ? '#a855f7' : '#10b981'} />
            </View>
          ) : (
            <ScrollView style={styles.rankingScroll}>
              {currentRanking.length > 0 ? (
                 currentRanking.slice(0, 30).map((entry, index) => (
                <View 
                  key={entry.id} 
                  style={[
                    styles.rankingItem,
                    entry.playerName === currentPlayer.name && entry.score === currentPlayer.score && styles.rankingItemHighlight
                  ]}
                >
                  <Text style={styles.rankingItemName}>{index + 1}. {entry.playerName}</Text>
                  <Text style={[styles.rankingItemScore, modeStyles.scoreText]}>{entry.score} {unit}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noRankingText}>まだランキングがありません。</Text>
            )}
            </ScrollView>
          )}
        </View>

        {/* エラーメッセージ表示 */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            {onDismissError && (
              <TouchableOpacity onPress={onDismissError} style={styles.errorDismissButton}>
                <Text style={styles.errorDismissText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            onPress={onPlayAgain}
            style={styles.playAgainButton}
          >
            <Text style={styles.playAgainButtonText}>もう一度遊ぶ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onGoHome}
            style={styles.goHomeButton}
          >
            <Text style={styles.goHomeButtonText}>ホームに戻る</Text>
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
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 448,
  },
  title: {
    fontSize: 48,
    fontWeight: '800',
    color: '#ec4899',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
    textAlign: 'center',
    width: '100%',
  },
  scoreText: {
    fontSize: 20,
    color: '#374151',
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  scoreValue: {
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 32,
    color: '#ef4444',
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankText: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#facc15',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingContainer: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    width: '100%',
  },
  pinkRankingBg: {
    backgroundColor: '#fdf2f8',
  },
  blueRankingBg: {
    backgroundColor: '#eff6ff',
  },
  greenRankingBg: {
    backgroundColor: '#f0fdf4',
  },
  purpleRankingBg: {
    backgroundColor: '#faf5ff',
  },
  rankingTitle: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  pinkRankingText: {
    color: '#db2777',
  },
  blueRankingText: {
    color: '#2563eb',
  },
  greenRankingText: {
    color: '#059669',
  },
  purpleRankingText: {
    color: '#9333ea',
  },
  rankingScroll: {
    maxHeight: 320,
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  rankingItemHighlight: {
    backgroundColor: '#fef3c7',
  },
  rankingItemName: {
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    fontSize: 18,
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingItemScore: {
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 18,
    fontFamily: MARU_GOTHIC_FONT,
  },
  pinkScoreText: {
    color: '#ec4899',
  },
  blueScoreText: {
    color: '#3b82f6',
  },
  greenScoreText: {
    color: '#10b981',
  },
  purpleScoreText: {
    color: '#a855f7',
  },
  noRankingText: {
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  playAgainButton: {
    width: '100%',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playAgainButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 20,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  goHomeButton: {
    width: '100%',
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'center',
    maxWidth: '70%',
  },
  goHomeButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 14,
    flex: 1,
    fontFamily: MARU_GOTHIC_FONT,
  },
  errorDismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorDismissText: {
    color: '#dc2626',
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  periodTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  periodTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    minWidth: 60,
    alignItems: 'center',
  },
  periodTabActive: {
    backgroundColor: '#ec4899',
  },
  periodTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: MARU_GOTHIC_FONT,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
  },
  periodTabTextActive: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
  },
  periodLabel: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GameOverScreen;
