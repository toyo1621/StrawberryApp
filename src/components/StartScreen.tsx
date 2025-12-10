import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { RankingEntry, GameMode } from '../types';
import { RankingPeriod, fetchRankingsByPeriod, fetchIslandRankingsByPeriod, fetchFlagRankingsByPeriod } from '../services/rankingService';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD, FONT_WEIGHT_MEDIUM } from '../constants/fonts';

interface StartScreenProps {
  onStart: (name: string, mode: GameMode) => void;
  ranking: RankingEntry[];
  islandRanking: RankingEntry[];
  flagRanking: RankingEntry[];
  isLoading?: boolean;
  onShowRules: () => void;
  onShowMyPage: () => void;
  savedPlayerName?: string;
  error?: string | null;
  onDismissError?: () => void;
  onRankingPeriodChange?: (period: RankingPeriod) => void;
}

const StartScreen = ({ onStart, ranking, islandRanking, flagRanking, isLoading, onShowRules, onShowMyPage, savedPlayerName, error, onDismissError, onRankingPeriodChange }: StartScreenProps) => {
  const [name, setName] = useState(savedPlayerName || '');
  const [inputError, setInputError] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.STRAWBERRY);
  const [selectedPeriod, setSelectedPeriod] = useState<RankingPeriod>(RankingPeriod.ALL);
  const [periodRanking, setPeriodRanking] = useState<RankingEntry[]>([]);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState(false);

  useEffect(() => {
    if (savedPlayerName) {
      setName(savedPlayerName);
    }
  }, [savedPlayerName]);

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
        if (selectedMode === GameMode.STRAWBERRY) {
          rankings = await fetchRankingsByPeriod(selectedPeriod);
        } else if (selectedMode === GameMode.ISLAND) {
          rankings = await fetchIslandRankingsByPeriod(selectedPeriod);
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
    if (onRankingPeriodChange) {
      onRankingPeriodChange(selectedPeriod);
    }
  }, [selectedPeriod, selectedMode, onRankingPeriodChange]);

  const handleSubmit = (mode: GameMode) => {
    if (name.trim() === '') {
      setInputError('名前を入力してください！');
      return;
    }
    if (name.length > 12) {
      setInputError('名前は12文字までです。');
      return;
    }
    onStart(name, mode);
  };

  const handleNameChange = (text: string) => {
    setName(text);
    if (inputError) {
      setInputError('');
    }
  };

  const currentRanking = selectedPeriod === RankingPeriod.ALL
    ? (selectedMode === GameMode.STRAWBERRY ? ranking : 
       selectedMode === GameMode.ISLAND ? islandRanking : 
       flagRanking)
    : periodRanking;

  const getModeStyles = () => {
    if (selectedMode === GameMode.STRAWBERRY) {
      return {
        bg: styles.pinkBg,
        text: styles.pinkText,
        rankingBg: styles.pinkRankingBg,
        rankingText: styles.pinkRankingText,
        scoreText: styles.pinkScoreText,
        buttonBg: styles.redButtonBg,
      };
    } else if (selectedMode === GameMode.ISLAND) {
      return {
        bg: styles.blueBg,
        text: styles.blueText,
        rankingBg: styles.blueRankingBg,
        rankingText: styles.blueRankingText,
        scoreText: styles.blueScoreText,
        buttonBg: styles.blueButtonBg,
      };
    } else {
      return {
        bg: styles.greenBg,
        text: styles.greenText,
        rankingBg: styles.greenRankingBg,
        rankingText: styles.greenRankingText,
        scoreText: styles.greenScoreText,
        buttonBg: styles.greenButtonBg,
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
        {/* ヘッダーセクション */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>
            {selectedMode === GameMode.STRAWBERRY ? 'いちごつめ！' : 
             selectedMode === GameMode.ISLAND ? '島つめ！' : 
             '国旗つめ！'}
          </Text>
          <Text style={styles.description}>
            {selectedMode === GameMode.STRAWBERRY ? '時間内にいちごをたくさんつめよう！' : 
             selectedMode === GameMode.ISLAND ? '時間内に島をたくさん当てよう！' : 
             '時間内に国旗をたくさん当てよう！'
            }
          </Text>
        </View>
        
        {/* ゲームモード選択 */}
        <View style={styles.modeSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.modeButtons}
            style={styles.modeButtonsContainer}
          >
            <TouchableOpacity
              onPress={() => setSelectedMode(GameMode.STRAWBERRY)}
              style={[
                styles.modeButton,
                selectedMode === GameMode.STRAWBERRY ? styles.modeButtonActivePink : styles.modeButtonInactive,
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.modeButtonEmoji}>🍓</Text>
              <Text style={selectedMode === GameMode.STRAWBERRY ? styles.modeButtonTextActive : styles.modeButtonTextInactive}>
                いちごモード
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedMode(GameMode.ISLAND)}
              style={[
                styles.modeButton,
                selectedMode === GameMode.ISLAND ? styles.modeButtonActiveBlue : styles.modeButtonInactive,
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.modeButtonEmoji}>🏝️</Text>
              <Text style={selectedMode === GameMode.ISLAND ? styles.modeButtonTextActive : styles.modeButtonTextInactive}>
                島モード
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedMode(GameMode.FLAG)}
              style={[
                styles.modeButton,
                selectedMode === GameMode.FLAG ? styles.modeButtonActiveGreen : styles.modeButtonInactive,
                { marginRight: 0 }
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.modeButtonEmoji}>🏁</Text>
              <Text style={selectedMode === GameMode.FLAG ? styles.modeButtonTextActive : styles.modeButtonTextInactive}>
                国旗モード
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        
        {/* ルールボタンとマイページボタン */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            onPress={onShowRules}
            style={styles.actionButton}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>ルール</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onShowMyPage}
            style={styles.actionButton}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>マイページ</Text>
          </TouchableOpacity>
        </View>
        
        {/* 期間選択タブ */}
        <View style={styles.periodTabs}>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.ALL)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.ALL && styles.periodTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.ALL && styles.periodTabTextActive]}>
              全体
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.DAILY)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.DAILY && styles.periodTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.DAILY && styles.periodTabTextActive]}>
              日別
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.WEEKLY)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.WEEKLY && styles.periodTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.WEEKLY && styles.periodTabTextActive]}>
              週別
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSelectedPeriod(RankingPeriod.MONTHLY)}
            style={[styles.periodTab, selectedPeriod === RankingPeriod.MONTHLY && styles.periodTabActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.periodTabText, selectedPeriod === RankingPeriod.MONTHLY && styles.periodTabTextActive]}>
              月別
            </Text>
          </TouchableOpacity>
        </View>

        {/* ランキング表示 */}
        <View style={styles.rankingCard}>
          <View style={[styles.rankingHeader, modeStyles.rankingBg]}>
            <Text style={[styles.rankingTitle, modeStyles.rankingText]}>
              {selectedMode === GameMode.STRAWBERRY ? 'いちごモード' : 
               selectedMode === GameMode.ISLAND ? '島モード' : 
               '国旗モード'} {selectedPeriod === RankingPeriod.ALL ? '' : 
               selectedPeriod === RankingPeriod.DAILY ? '日別' :
               selectedPeriod === RankingPeriod.WEEKLY ? '週別' :
               '月別'} ランキング
            </Text>
          </View>
          <View style={styles.rankingContent}>
            {(isLoading || isLoadingPeriod) ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#6b7280" />
                <Text style={styles.loadingText}>読み込み中...</Text>
              </View>
            ) : currentRanking.length > 0 ? (
              <View>
                {currentRanking.slice(0, 10).map((entry, index) => {
                  const isTopThree = index < 3;
                  const medalEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                  return (
                    <View 
                      key={entry.id} 
                      style={[
                        styles.rankingItem,
                        isTopThree && styles.rankingItemTopThree
                      ]}
                    >
                      <View style={styles.rankingItemLeft}>
                        <Text style={styles.rankingItemRank}>
                          {isTopThree ? medalEmoji : `${index + 1}.`}
                        </Text>
                        <Text style={[
                          styles.rankingItemName,
                          isTopThree && styles.rankingItemNameTopThree
                        ]}>
                          {entry.playerName}
                        </Text>
                      </View>
                      <Text style={[
                        styles.rankingItemScore, 
                        modeStyles.scoreText,
                        isTopThree && styles.rankingItemScoreTopThree
                      ]}>
                        {entry.score} {selectedMode === GameMode.STRAWBERRY ? '個' : '問'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyRanking}>
                <Text style={styles.emptyRankingEmoji}>📊</Text>
                <Text style={styles.noRankingText}>まだランキングがありません。</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>プレイヤー名</Text>
            <TextInput
              value={name}
              onChangeText={handleNameChange}
              placeholder="名前を入力 (12文字まで)"
              placeholderTextColor="#9ca3af"
              maxLength={12}
              style={[
                styles.input,
                inputError && styles.inputError,
                name && styles.inputFilled
              ]}
            />
            {inputError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{inputError}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => handleSubmit(selectedMode)}
            style={[styles.startButton, modeStyles.buttonBg]}
            activeOpacity={0.9}
          >
            <Text style={styles.startButtonEmoji}>▶</Text>
            <Text style={styles.startButtonText}>ゲーム開始！</Text>
          </TouchableOpacity>
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
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 480,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ec4899',
    marginBottom: 6,
    fontFamily: MARU_GOTHIC_FONT,
  },
  description: {
    color: '#6b7280',
    marginBottom: 0,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: MARU_GOTHIC_FONT,
  },
  badge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  badgeText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: FONT_WEIGHT_BOLD,
    letterSpacing: 0.5,
    fontFamily: MARU_GOTHIC_FONT,
  },
  modeSection: {
    marginBottom: 20,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    color: '#6b7280',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  modeButtonsContainer: {
    marginHorizontal: -4,
  },
  modeButtons: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  modeButton: {
    width: 120,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    marginRight: 10,
  },
  modeButtonActivePink: {
    backgroundColor: '#ec4899',
    borderWidth: 2,
    borderColor: '#db2777',
  },
  modeButtonActiveBlue: {
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  modeButtonActiveGreen: {
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#059669',
  },
  modeButtonInactive: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modeButtonEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  modeButtonTextActive: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  modeButtonTextInactive: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: FONT_WEIGHT_MEDIUM,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  periodTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  periodTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  periodTabActive: {
    backgroundColor: '#ec4899',
    borderColor: '#db2777',
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    color: '#6b7280',
    fontFamily: MARU_GOTHIC_FONT,
  },
  periodTabTextActive: {
    color: '#ffffff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: '#10b981',
  },
  actionButtonEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontSize: 13,
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingCard: {
    width: '100%',
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  rankingHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankingIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  rankingTitle: {
    fontSize: 15,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingContent: {
    padding: 12,
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
  pinkRankingText: {
    color: '#db2777',
  },
  blueRankingText: {
    color: '#2563eb',
  },
  greenRankingText: {
    color: '#059669',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    color: '#6b7280',
    textAlign: 'center',
    marginLeft: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
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
    fontWeight: '700',
  },
  rankingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#ffffff',
  },
  rankingItemTopThree: {
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  rankingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankingItemRank: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    width: 28,
    marginRight: 8,
  },
  rankingItemName: {
    fontWeight: FONT_WEIGHT_MEDIUM,
    color: '#374151',
    fontSize: 14,
    flex: 1,
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingItemNameTopThree: {
    color: '#78350f',
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingItemScore: {
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontSize: 14,
    fontFamily: MARU_GOTHIC_FONT,
  },
  rankingItemScoreTopThree: {
    fontWeight: FONT_WEIGHT_BOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  emptyRanking: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyRankingEmoji: {
    fontSize: 48,
    marginBottom: 12,
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
  inputSection: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: FONT_WEIGHT_MEDIUM,
    color: '#6b7280',
    marginBottom: 6,
    paddingLeft: 2,
    fontFamily: MARU_GOTHIC_FONT,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#fbcfe8',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
    fontFamily: MARU_GOTHIC_FONT,
  },
  inputFilled: {
    borderColor: '#ec4899',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  startButton: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonEmoji: {
    fontSize: 16,
    marginRight: 6,
    color: '#ffffff',
  },
  redButtonBg: {
    backgroundColor: '#dc2626',
  },
  blueButtonBg: {
    backgroundColor: '#2563eb',
  },
  greenButtonBg: {
    backgroundColor: '#059669',
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontSize: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  contactLink: {
    marginTop: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  contactLinkText: {
    color: '#9ca3af',
    fontSize: 11,
    textDecorationLine: 'underline',
    fontFamily: MARU_GOTHIC_FONT,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 16,
  },
  legalLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  legalLinkText: {
    color: '#9ca3af',
    fontSize: 10,
    textDecorationLine: 'underline',
    fontFamily: MARU_GOTHIC_FONT,
  },
  // 未使用のスタイル（将来の拡張用）
  pinkBg: {},
  blueBg: {},
  greenBg: {},
  pinkText: {},
  blueText: {},
  greenText: {},
});

export default StartScreen;
