import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants';
import { Color, GameMode } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';
import { createColorRound } from '../domain/game';
import { ANSWER_FEEDBACK_MS, GAMEPLAY_RULES } from '../gameRules';
import { useGameTimer } from '../hooks/useGameTimer';
import AnswerFeedback from './game/AnswerFeedback';
import GameFrame from './game/GameFrame';

const RULES = GAMEPLAY_RULES[GameMode.COLOR];

interface ColorGameScreenProps {
  onGameOver: (score: number) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onBackToHome?: () => void;
}

const ColorGameScreen: React.FC<ColorGameScreenProps> = ({ onGameOver, hapticsEnabled = true, darkMode = false, onBackToHome }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [colors, setColors] = useState<Color[]>([]);
  const [correctColorIndex, setCorrectColorIndex] = useState(-1);
  const [targetColorName, setTargetColorName] = useState('');
  const [targetColorDescription, setTargetColorDescription] = useState('');
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

  // 応援の言葉リスト（色モード用）
  const encouragementMessages = [
    'ナイス色',
    'いい色',
    '色つめ！',
    '色彩検定',
    'よっ色マスター',
    '色はいいぞ',
    'カラフル',
    '色彩豊か',
  ];

  const generateNewColors = useCallback(() => {
    if (gameEndedRef.current) {return;}
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    const round = createColorRound(COLORS);
    setColors(round.choices);
    setCorrectColorIndex(round.correctIndex);
    setTargetColorName(round.target.name);
    setTargetColorDescription(round.target.description);
  }, [gameEndedRef]);

  useEffect(() => {
    generateNewColors();
    
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewColors]);

  const handleChoice = (index: number) => {
    if (feedback || processingClickRef.current || gameEnded || gameEndedRef.current) {return;}
    
    processingClickRef.current = true;

    const isCorrect = index === correctColorIndex;

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
        generateNewColors();
      }
    }, ANSWER_FEEDBACK_MS);
  };

  return (
    <GameFrame
      mode={GameMode.COLOR}
      score={score}
      timeLeft={timeLeft}
      initialTimeTicks={RULES.initialTimeTicks}
      dangerThresholdTicks={RULES.dangerThresholdTicks}
      darkMode={darkMode}
      onBackToHome={onBackToHome}
    >
      <View style={styles.gameArea}>
        <View style={styles.questionContainer}>
          <Text style={[styles.colorNameText, darkMode && styles.colorNameTextDark]}>{targetColorName}</Text>
          <Text style={[styles.descriptionText, darkMode && styles.descriptionTextDark]}>{targetColorDescription}</Text>
        </View>
        <View style={styles.choicesContainer}>
          {colors.map((color, index) => (
            <TouchableOpacity
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`選択肢${index + 1}、マンセル値${color.munsell}、カラーコード${color.hex}`}
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
              <View accessible={false} style={[styles.colorBox, { backgroundColor: color.hex }]} />
              <Text style={[styles.munsellText, darkMode && styles.munsellTextDark]}>{color.munsell} / {color.hex}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <AnswerFeedback
          mode={GameMode.COLOR}
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
    paddingHorizontal: 16,
  },
  questionText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
    marginBottom: 16,
  },
  choicesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 384,
    gap: 16,
  },
  choiceButton: {
    flex: 1,
    backgroundColor: '#faf5ff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    minHeight: 200,
  },
  choiceButtonInactive: {
    opacity: 0.5,
  },
  colorBox: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  munsellText: {
    fontSize: 14,
    fontWeight: FONT_WEIGHT_SEMIBOLD,
    color: '#6b7280',
    fontFamily: MARU_GOTHIC_FONT,
  },
  colorNameText: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    fontFamily: MARU_GOTHIC_FONT,
    marginBottom: 12,
    textAlign: 'center',
  },
  descriptionText: {
    fontSize: 13,
    color: '#6b7280',
    fontFamily: MARU_GOTHIC_FONT,
    textAlign: 'center',
    lineHeight: 20,
  },
  questionTextDark: {
    color: '#f9fafb',
  },
  choiceButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4b5563',
  },
  colorCodeTextDark: {
    color: '#f9fafb',
  },
  munsellTextDark: {
    color: '#d1d5db',
  },
  colorNameTextDark: {
    color: '#f9fafb',
  },
  descriptionTextDark: {
    color: '#d1d5db',
  },
});

export default ColorGameScreen;
