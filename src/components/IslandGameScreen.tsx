import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { GameMode, Island, IslandRegion } from '../types';
import { islandAssets } from '../assets/islandAssets';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';
import { progressPercent } from '../domain/game';
import { createIslandRound, getIslandRegionLabel, getIslandsForRegion } from '../domain/islands';
import { ANSWER_FEEDBACK_MS, GAMEPLAY_RULES, ticksToSeconds } from '../gameRules';
import { useGameTimer } from '../hooks/useGameTimer';

const RULES = GAMEPLAY_RULES[GameMode.ISLAND];

interface IslandGameScreenProps {
  onGameOver: (score: number) => void;
  region?: IslandRegion;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onBackToHome?: () => void;
}

const IslandGameScreen: React.FC<IslandGameScreenProps> = ({
  onGameOver,
  region = IslandRegion.ALL,
  hapticsEnabled = true,
  darkMode = false,
  onBackToHome,
}) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [islands, setIslands] = useState<Island[]>([]);
  const [correctIslandIndex, setCorrectIslandIndex] = useState(-1);
  const [targetIslandName, setTargetIslandName] = useState('');
  const [targetIslandPrefecture, setTargetIslandPrefecture] = useState('');
  const [isGoldenIsland, setIsGoldenIsland] = useState(false);
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');
  const islandPool = useMemo(() => getIslandsForRegion(region), [region]);
  const regionLabel = getIslandRegionLabel(region);

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingClickRef = useRef(false);
  const handleTimeExpired = useCallback(() => onGameOver(scoreRef.current), [onGameOver]);
  const { adjustTime, gameEnded, gameEndedRef, timeLeft } = useGameTimer({
    initialTicks: RULES.initialTimeTicks,
    maximumDurationTicks: RULES.maxSessionTicks,
    onExpire: handleTimeExpired,
  });

  // 応援の言葉リスト（島モード用）
  const encouragementMessages = [
    'ナイス島',
    'いい島',
    '島来ちゃう？',
    '島にようこそ',
    'よっ島マスター',
    '島はいいぞ',
  ];

  const generateNewIslands = useCallback(() => {
    if (gameEndedRef.current) {return;}
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    // ゴールデン島の判定（3%の確率）
    const shouldBeGolden = Math.random() < RULES.golden.chance;
    setIsGoldenIsland(shouldBeGolden);
    
    const round = createIslandRound(islandPool);
    
    setIslands(round.choices);
    setCorrectIslandIndex(round.correctIndex);
    setTargetIslandName(round.targetIsland.name);
    setTargetIslandPrefecture(round.targetIsland.prefecture);
  }, [gameEndedRef, islandPool]);

  useEffect(() => {
    generateNewIslands();
    
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewIslands]);

  const handleChoice = (index: number) => {
    if (feedback || processingClickRef.current || gameEnded || gameEndedRef.current) {return;}
    
    processingClickRef.current = true;

    const isCorrect = index === correctIslandIndex;

    if (isCorrect) {
      let points: number = RULES.regularPoints;
      let bonusTicks: number = RULES.regularTimeBonusTicks;
      
      if (isGoldenIsland) {
        points = RULES.golden.points;
        bonusTicks += RULES.golden.timeBonusTicks;
      }
      adjustTime(bonusTicks);
      
      setScore(prevScore => {
        const newScore = prevScore + points;
        scoreRef.current = newScore;
        return newScore;
      });
      setFeedback({ index, type: 'correct' });
      // 応援メッセージをランダムに選択
      const randomMessage = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
      setEncouragementMessage(randomMessage);
      // ハプティックフィードバック（正解）
      if (hapticsEnabled) {
        if (isGoldenIsland) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } else {
      adjustTime(-RULES.penaltyTicks);
      setFeedback({ index, type: 'incorrect' });
      // ハプティックフィードバック（不正解）
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      if (!gameEndedRef.current) {
        processingClickRef.current = false;
        generateNewIslands();
      }
    }, ANSWER_FEEDBACK_MS);
  };

  const timeBarWidth = progressPercent(timeLeft, RULES.initialTimeTicks);
  const displayTime = (timeLeft / 10).toFixed(1);

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {onBackToHome && (
        <TouchableOpacity 
          accessibilityRole="button"
          accessibilityLabel="ゲームをやめてホームに戻る"
          onPress={onBackToHome} 
          style={[styles.homeButton, darkMode && styles.homeButtonDark]}
        >
          <Text style={[styles.homeButtonText, darkMode && styles.homeButtonTextDark]}>ゲームをやめる</Text>
        </TouchableOpacity>
      )}
      <Text
        accessibilityLabel={`出題エリア、${regionLabel}、${islandPool.length}島`}
        style={[styles.regionLabel, darkMode && styles.regionLabelDark]}
      >
        {regionLabel}・{islandPool.length}島
      </Text>
      <View style={styles.header}>
        <Text accessibilityLiveRegion="polite" style={[styles.scoreText, darkMode && styles.scoreTextDark]}>スコア: {score}</Text>
        <Text accessibilityLabel={`残り時間${displayTime}秒`} style={[styles.timeText, darkMode && styles.timeTextDark]}>時間: {displayTime}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="残り時間"
        accessibilityValue={{ min: 0, max: RULES.initialTimeTicks, now: Math.min(timeLeft, RULES.initialTimeTicks) }}
        style={[styles.timeBarContainer, darkMode && styles.timeBarContainerDark]}
      >
        <View
          style={[
            styles.timeBar,
            timeLeft <= RULES.dangerThresholdTicks ? styles.timeBarDanger : styles.timeBarNormal,
            { width: `${timeBarWidth}%` }
          ]}
        />
      </View>
      
      <View style={styles.gameArea}>
        {isGoldenIsland ? (
          <>
            <View style={styles.questionContainer}>
              <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>
                ✨ ゴールデン{targetIslandName}{targetIslandPrefecture ? `（${targetIslandPrefecture}）` : ''}
              </Text>
              <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>
                はどっち？ ✨
              </Text>
            </View>
            <Text style={[styles.pointsText, darkMode && styles.pointsTextDark]}>
              🏆 3点ゲット！
            </Text>
          </>
        ) : (
          <View style={styles.questionContainer}>
            <Text style={[styles.questionTextNormal, darkMode && styles.questionTextNormalDark]}>
              {targetIslandName}{targetIslandPrefecture ? `（${targetIslandPrefecture}）` : ''}
            </Text>
            <Text style={[styles.questionTextNormal, darkMode && styles.questionTextNormalDark]}>
              はどっち？
            </Text>
          </View>
        )}
        <View style={styles.choicesContainer}>
          {islands.map((island, index) => {
            // ゴールデン島の時、正解の島の画像をゴールデン色に変更
            const isGoldenIslandImage = isGoldenIsland && index === correctIslandIndex;
            
            return (
              <TouchableOpacity
                key={island.id}
                accessibilityRole="button"
                accessibilityLabel={`選択肢${index + 1}、${island.name}の島影`}
                accessibilityState={{ disabled: Boolean(feedback) || gameEnded }}
                onPress={() => handleChoice(index)}
                disabled={!!feedback || gameEnded}
                style={[
                  styles.choiceButton,
                  darkMode && styles.choiceButtonDark,
                  feedback && feedback.index !== index && styles.choiceButtonInactive,
                  gameEnded && styles.choiceButtonInactive,
                ]}
              >
                <Image 
                  accessible={false}
                  alt={`${island.name}の島影`}
                  accessibilityLabel={`${island.name}の島影`}
                  source={islandAssets[island.file]}
                  style={styles.choiceImage}
                  contentFit="contain"
                  tintColor={isGoldenIslandImage ? '#fbbf24' : undefined}
                />
              </TouchableOpacity>
            );
          })}
        </View>
        {/* 応援メッセージ表示（常にスペースを確保） */}
        <View style={styles.encouragementContainer}>
          {feedback?.type === 'incorrect' ? (
            <Text accessibilityLiveRegion="assertive" style={[styles.incorrectText, darkMode && styles.incorrectTextDark]}>
              不正解。残り時間が{ticksToSeconds(RULES.penaltyTicks)}秒減りました。
            </Text>
          ) : encouragementMessage && feedback?.type === 'correct' ? (
            <Text accessibilityLiveRegion="polite" style={[styles.encouragementText, darkMode && styles.encouragementTextDark]}>
              {encouragementMessage}
            </Text>
          ) : (
            <View style={styles.encouragementPlaceholder} />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 24,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    margin: 16,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  regionLabel: {
    alignSelf: 'center',
    marginBottom: 10,
    color: '#2563eb',
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  regionLabelDark: {
    color: '#93c5fd',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#3b82f6',
    fontFamily: MARU_GOTHIC_FONT,
  },
  timeText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    fontFamily: MARU_GOTHIC_FONT,
  },
  timeBarContainer: {
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    height: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  timeBar: {
    height: '100%',
    borderRadius: 999,
  },
  timeBarNormal: {
    backgroundColor: '#60a5fa',
  },
  timeBarDanger: {
    backgroundColor: '#ef4444',
  },
  gameArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  questionContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  questionText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  questionTextNormal: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#854d0e',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  pointsTextDark: {
    color: '#fde047',
  },
  choicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    maxWidth: 384,
  },
  choiceButton: {
    width: '48%',
    maxWidth: 144,
    aspectRatio: 1,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  choiceButtonInactive: {
    opacity: 0.5,
  },
  choiceImage: {
    width: '100%',
    height: '100%',
  },
  containerDark: {
    backgroundColor: '#1f2937',
  },
  scoreTextDark: {
    color: '#f9fafb',
  },
  timeTextDark: {
    color: '#f9fafb',
  },
  questionTextDark: {
    color: '#f9fafb',
  },
  questionTextNormalDark: {
    color: '#f9fafb',
  },
  choiceButtonDark: {
    backgroundColor: '#374151',
  },
  timeBarContainerDark: {
    backgroundColor: '#4b5563',
  },
  encouragementContainer: {
    alignItems: 'center',
    marginTop: 16,
    height: 32, // 固定の高さを設定
    justifyContent: 'center',
  },
  encouragementText: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#3b82f6',
    fontFamily: MARU_GOTHIC_FONT,
  },
  encouragementTextDark: {
    color: '#93c5fd',
  },
  incorrectText: {
    color: '#b91c1c',
    fontFamily: MARU_GOTHIC_FONT,
    fontSize: 16,
    fontWeight: FONT_WEIGHT_BOLD,
  },
  incorrectTextDark: {
    color: '#fecaca',
  },
  encouragementPlaceholder: {
    height: 20, // テキストと同じ高さのプレースホルダー
  },
  homeButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 0,
    marginBottom: 4,
    marginRight: 0,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    justifyContent: 'center',
  },
  homeButtonDark: {
    backgroundColor: 'rgba(190, 24, 93, 0.2)',
    borderColor: 'rgba(190, 24, 93, 0.4)',
  },
  homeButtonText: {
    color: '#be185d',
    fontSize: 14,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  homeButtonTextDark: {
    color: '#f9a8d4',
  },
});

export default IslandGameScreen;
