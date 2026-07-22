import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COUNTRIES } from '../constants';
import { Country, GameMode } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';
import { countryCodeToFlagEmoji, progressPercent, shuffle } from '../domain/game';
import { ANSWER_FEEDBACK_MS, GAMEPLAY_RULES, ticksToSeconds } from '../gameRules';
import { useGameTimer } from '../hooks/useGameTimer';

const RULES = GAMEPLAY_RULES[GameMode.FLAG];

interface FlagGameScreenProps {
  onGameOver: (score: number) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onBackToHome?: () => void;
}

const FlagGameScreen: React.FC<FlagGameScreenProps> = ({ onGameOver, hapticsEnabled = true, darkMode = false, onBackToHome }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [countries, setCountries] = useState<Country[]>([]);
  const [correctCountryIndex, setCorrectCountryIndex] = useState(-1);
  const [targetCountryName, setTargetCountryName] = useState('');
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');

  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingClickRef = useRef(false);
  const handleTimeExpired = useCallback(() => onGameOver(scoreRef.current), [onGameOver]);
  const { adjustTime, gameEnded, gameEndedRef, timeLeft } = useGameTimer({
    initialTicks: RULES.initialTimeTicks,
    maximumDurationTicks: RULES.maxSessionTicks,
    onExpire: handleTimeExpired,
  });

  // 応援の言葉リスト（国旗モード用）
  const encouragementMessages = [
    'ナイス国旗',
    'いい国旗',
    '国旗つめ！',
    '世界一周',
    'よっ国旗マスター',
    '国旗はいいぞ',
    '世界を知る',
    'センター地理100点デスカ？',
  ];

  const generateNewCountries = useCallback(() => {
    if (gameEndedRef.current) {return;}
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    // ランダムに2つの国を選択
    const shuffledCountries = shuffle(COUNTRIES);
    const selectedCountries = shuffledCountries.slice(0, 2);
    
    // どちらが正解かをランダムに決定
    const correctIndex = Math.floor(Math.random() * 2);
    const targetCountry = selectedCountries[correctIndex];
    
    setCountries(selectedCountries);
    setCorrectCountryIndex(correctIndex);
    setTargetCountryName(targetCountry.name);
  }, [gameEndedRef]);

  useEffect(() => {
    generateNewCountries();
    
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewCountries]);

  const handleChoice = (index: number) => {
    if (feedback || processingClickRef.current || gameEnded || gameEndedRef.current) {return;}
    
    processingClickRef.current = true;

    const isCorrect = index === correctCountryIndex;

    if (isCorrect) {
      setScore(prevScore => {
        const newScore = prevScore + RULES.regularPoints;
        scoreRef.current = newScore;
        return newScore;
      });
      adjustTime(RULES.regularTimeBonusTicks);
      setFeedback({ index, type: 'correct' });
      // 応援メッセージをランダムに選択
      const randomMessage = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
      setEncouragementMessage(randomMessage);
      // ハプティックフィードバック（正解）
      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        generateNewCountries();
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
      <View style={styles.header}>
        <Text accessibilityLiveRegion="polite" style={[styles.scoreText, darkMode && styles.scoreTextDark]}>スコア: {score}</Text>
        <Text accessibilityLabel={`残り時間${displayTime}秒`} style={[styles.timeText, darkMode && styles.timeTextDark]}>時間: {displayTime}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="残り時間"
        aria-valuemin={0}
        aria-valuemax={ticksToSeconds(RULES.initialTimeTicks)}
        aria-valuenow={ticksToSeconds(Math.min(timeLeft, RULES.initialTimeTicks))}
        aria-valuetext={`残り${displayTime}秒`}
        accessibilityValue={{
          min: 0,
          max: ticksToSeconds(RULES.initialTimeTicks),
          now: ticksToSeconds(Math.min(timeLeft, RULES.initialTimeTicks)),
          text: `残り${displayTime}秒`,
        }}
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
        <View style={styles.questionContainer}>
          <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>{targetCountryName}</Text>
          <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>の国旗はどっち？</Text>
        </View>
        <View style={styles.choicesContainer}>
          {countries.map((country, index) => (
            <TouchableOpacity
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`選択肢${index + 1}、${country.name}の国旗`}
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
              <Text accessible={false} style={styles.flagEmoji}>{countryCodeToFlagEmoji(country.code)}</Text>
            </TouchableOpacity>
          ))}
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
  scoreText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#047857',
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
    backgroundColor: '#4ade80',
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
  choicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 384,
  },
  choiceButton: {
    width: 144,
    height: 144,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  choiceButtonInactive: {
    opacity: 0.5,
  },
  flagEmoji: {
    fontSize: 72,
    lineHeight: 88,
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
  choiceButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
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
    color: '#047857',
    fontFamily: MARU_GOTHIC_FONT,
  },
  encouragementTextDark: {
    color: '#6ee7b7',
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

export default FlagGameScreen;
