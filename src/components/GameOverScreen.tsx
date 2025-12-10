import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { RankingEntry, GameMode } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface GameOverScreenProps {
  ranking: RankingEntry[];
  gameMode: GameMode;
  currentPlayer: { name: string; score: number };
  onRestart: () => void;
  error?: string | null;
  onDismissError?: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ ranking, gameMode, currentPlayer, onRestart, error, onDismissError }) => {
  // Find the current player's rank
  const playerRank = ranking.findIndex(entry => 
    entry.playerName === currentPlayer.name && entry.score === currentPlayer.score
  ) + 1;

  const isStrawberryMode = gameMode === GameMode.STRAWBERRY;
  const isIslandMode = gameMode === GameMode.ISLAND;
  const isFlagMode = gameMode === GameMode.FLAG;
  const unit = isStrawberryMode ? '個' : '問';

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
        <Text style={styles.title}>タイムアップ！</Text>
        <Text style={styles.scoreText}>
          {currentPlayer.name}さんのスコアは <Text style={styles.scoreValue}>{currentPlayer.score}</Text> {unit}でした！
        </Text>

        {playerRank > 0 && (
          <Text style={styles.rankText}>
            🎉 第{playerRank}位にランクイン！ 🎉
          </Text>
        )}

        <View style={[styles.rankingContainer, modeStyles.rankingBg]}>
          <Text style={[styles.rankingTitle, modeStyles.rankingText]}>
            {isStrawberryMode ? 'いちごモード' : 
             isIslandMode ? '島モード' : 
             '国旗モード'} ランキング
          </Text>
          <ScrollView style={styles.rankingScroll}>
            {ranking.length > 0 ? (
               ranking.slice(0, 30).map((entry, index) => (
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

        <TouchableOpacity
          onPress={onRestart}
          style={styles.restartButton}
        >
          <Text style={styles.restartButtonText}>もう一度プレイ</Text>
        </TouchableOpacity>
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
  noRankingText: {
    color: '#6b7280',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  restartButton: {
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
  restartButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_BOLD,
    fontSize: 20,
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
});

export default GameOverScreen;
