import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COUNTRIES } from '../constants';
import { Country, GameMode } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD } from '../constants/fonts';
import { countryCodeToFlagEmoji, shuffle } from '../domain/game';
import { ANSWER_FEEDBACK_MS, GAMEPLAY_RULES } from '../gameRules';
import { useGameTimer } from '../hooks/useGameTimer';
import AnswerFeedback from './game/AnswerFeedback';
import GameFrame from './game/GameFrame';

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

  return (
    <GameFrame
      mode={GameMode.FLAG}
      score={score}
      timeLeft={timeLeft}
      initialTimeTicks={RULES.initialTimeTicks}
      dangerThresholdTicks={RULES.dangerThresholdTicks}
      darkMode={darkMode}
      onBackToHome={onBackToHome}
    >
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
        <AnswerFeedback
          mode={GameMode.FLAG}
          feedbackType={feedback?.type ?? null}
          encouragementMessage={encouragementMessage}
          penaltyTicks={RULES.penaltyTicks}
          darkMode={darkMode}
        />
      </View>
    </GameFrame>
  );
};

const styles = StyleSheet.create({
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
  questionTextDark: {
    color: '#f9fafb',
  },
  choiceButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
});

export default FlagGameScreen;
