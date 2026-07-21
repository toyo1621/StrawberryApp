import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ISLAND_NAMES } from '../constants';
import { GameMode, Island } from '../types';
import { islandAssets } from '../assets/islandAssets';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';
import { progressPercent, shuffle } from '../domain/game';
import { GAMEPLAY_RULES } from '../gameRules';

const RULES = GAMEPLAY_RULES[GameMode.ISLAND];

interface IslandGameScreenProps {
  onGameOver: (score: number) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onBackToHome?: () => void;
}

const IslandGameScreen: React.FC<IslandGameScreenProps> = ({ onGameOver, hapticsEnabled = true, darkMode = false, onBackToHome }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(RULES.initialTimeTicks);
  const [islands, setIslands] = useState<Island[]>([]);
  const [correctIslandIndex, setCorrectIslandIndex] = useState(-1);
  const [targetIslandName, setTargetIslandName] = useState('');
  const [targetIslandPrefecture, setTargetIslandPrefecture] = useState('');
  const [isGoldenIsland, setIsGoldenIsland] = useState(false);
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

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
    
    // ランダムに2つの島を選択
    const shuffledIslands = shuffle(ISLAND_NAMES);
    const selectedIslands = shuffledIslands.slice(0, 2);
    
    // どちらが正解かをランダムに決定
    const correctIndex = Math.floor(Math.random() * 2);
    const targetIsland = selectedIslands[correctIndex];
    
    setIslands(selectedIslands);
    setCorrectIslandIndex(correctIndex);
    setTargetIslandName(targetIsland.name);
    setTargetIslandPrefecture(targetIsland.prefecture || '');
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prevTime => {
        const newTime = prevTime - 1;
        
        if (newTime <= 0) {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setGameEnded(true);
            
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            setTimeout(() => {
              onGameOver(scoreRef.current);
            }, 0);
          }
          return 0;
        }
        
        return newTime;
      });
    }, 100);
  }, [onGameOver]);

  useEffect(() => {
    generateNewIslands();
    startTimer();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewIslands, startTimer]);

  const handleChoice = (index: number) => {
    if (feedback || isProcessingClick || gameEnded || gameEndedRef.current) {return;}
    
    setIsProcessingClick(true);

    const isCorrect = index === correctIslandIndex;

    if (isCorrect) {
      let points = RULES.regularPoints;
      // 時間ボーナス（0.3秒 = 3 * 0.1秒）
      setTimeLeft(prevTime => prevTime + RULES.regularTimeBonusTicks);
      
      if (isGoldenIsland) {
        points = RULES.golden.points;
        // 追加の時間ボーナス（1秒）
        setTimeLeft(prevTime => prevTime + RULES.golden.timeBonusTicks);
      }
      
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
      setTimeLeft(prevTime => Math.max(0, prevTime - RULES.penaltyTicks));
      setFeedback({ index, type: 'incorrect' });
      // ハプティックフィードバック（不正解）
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      if (!gameEndedRef.current) {
        setIsProcessingClick(false);
        generateNewIslands();
      }
    }, 300);
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
      <View style={styles.header}>
        <Text accessibilityLiveRegion="polite" style={[styles.scoreText, darkMode && styles.scoreTextDark]}>スコア: {score}</Text>
        <Text accessibilityLabel={`残り時間${displayTime}秒`} style={[styles.timeText, darkMode && styles.timeTextDark]}>時間: {displayTime}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="残り時間"
        accessibilityValue={{ min: 0, max: RULES.initialTimeTicks, now: Math.min(timeLeft, RULES.initialTimeTicks) }}
        style={styles.timeBarContainer}
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
            <Text style={styles.pointsText}>
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
                key={index}
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
          {encouragementMessage && feedback && feedback.type === 'correct' ? (
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
    color: '#facc15',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  choicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 384,
  },
  choiceButton: {
    width: 144,
    height: 144,
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
  encouragementPlaceholder: {
    height: 20, // テキストと同じ高さのプレースホルダー
  },
  homeButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 0,
    marginBottom: 4,
    marginRight: 0,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  homeButtonDark: {
    backgroundColor: 'rgba(190, 24, 93, 0.2)',
    borderColor: 'rgba(190, 24, 93, 0.4)',
  },
  homeButtonText: {
    color: '#ec4899',
    fontSize: 12,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    fontFamily: MARU_GOTHIC_FONT,
  },
  homeButtonTextDark: {
    color: '#f9a8d4',
  },
});

export default IslandGameScreen;
