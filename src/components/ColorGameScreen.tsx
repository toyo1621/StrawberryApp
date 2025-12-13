import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { INITIAL_TIME, PENALTY_SECONDS, COLORS } from '../constants';
import { Color } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface ColorGameScreenProps {
  onGameOver: (score: number) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onBackToHome?: () => void;
}

const ColorGameScreen: React.FC<ColorGameScreenProps> = ({ onGameOver, hapticsEnabled = true, darkMode = false, onBackToHome }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME * 10);
  const [colors, setColors] = useState<Color[]>([]);
  const [correctColorIndex, setCorrectColorIndex] = useState(-1);
  const [targetColorName, setTargetColorName] = useState('');
  const [targetColorDescription, setTargetColorDescription] = useState('');
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

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

  // 色の系統を判定する関数
  const getColorCategory = (colorId: string): string => {
    const id = parseInt(colorId);
    if (id >= 1 && id <= 20) return 'red'; // 赤系
    if (id >= 21 && id <= 32) return 'yellow-red'; // 黄赤系
    if (id >= 33 && id <= 40) return 'yellow'; // 黄系
    if (id >= 41 && id <= 47) return 'yellow-green'; // 黄緑系
    if (id >= 48 && id <= 56) return 'green'; // 緑系
    if (id >= 57 && id <= 64) return 'blue-green'; // 青緑系
    if (id >= 65 && id <= 77) return 'blue'; // 青系
    if (id >= 78 && id <= 83) return 'blue-violet'; // 青紫系
    if (id >= 84 && id <= 89) return 'violet'; // 紫系
    if (id >= 90 && id <= 95) return 'red-violet'; // 赤紫系
    if (id >= 96 && id <= 108) return 'brown'; // 茶系・アースカラー
    if (id >= 109 && id <= 120) return 'grayish'; // グレイッシュカラー
    return 'achromatic'; // 無彩色系
  };

  const generateNewColors = useCallback(() => {
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    // ランダムに1つの色を選ぶ（正解）
    const shuffledColors = [...COLORS].sort(() => 0.5 - Math.random());
    const correctColor = shuffledColors[0];
    const correctCategory = getColorCategory(correctColor.id);
    
    // 同じ系統の色をフィルタリング
    const sameCategoryColors = COLORS.filter(color => 
      getColorCategory(color.id) === correctCategory && color.id !== correctColor.id
    );
    
    // 同じ系統の色からランダムに1つ選ぶ（選択肢）
    const wrongColor = sameCategoryColors.length > 0
      ? sameCategoryColors[Math.floor(Math.random() * sameCategoryColors.length)]
      : shuffledColors[1]; // 同じ系統がない場合はランダムに選ぶ（フォールバック）
    
    // どちらが正解かをランダムに決定
    const correctIndex = Math.floor(Math.random() * 2);
    const selectedColors = correctIndex === 0 
      ? [correctColor, wrongColor]
      : [wrongColor, correctColor];
    
    setColors(selectedColors);
    setCorrectColorIndex(correctIndex);
    setTargetColorName(correctColor.name);
    setTargetColorDescription(correctColor.description);
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
    generateNewColors();
    startTimer();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewColors, startTimer]);

  const handleChoice = (index: number) => {
    if (feedback || isProcessingClick || gameEnded || gameEndedRef.current) return;
    
    setIsProcessingClick(true);

    const isCorrect = index === correctColorIndex;

    if (isCorrect) {
      setScore(prevScore => {
        const newScore = prevScore + 1;
        scoreRef.current = newScore;
        return newScore;
      });
      // 時間ボーナス（1秒 = 10 * 0.1秒）
      setTimeLeft(prevTime => prevTime + 10);
      setFeedback({ index, type: 'correct' });
      // 応援メッセージをランダムに選択
      const randomMessage = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
      setEncouragementMessage(randomMessage);
      // ハプティックフィードバック（正解）
      if (hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      setTimeLeft(prevTime => Math.max(0, prevTime - (PENALTY_SECONDS * 10)));
      setFeedback({ index, type: 'incorrect' });
      // ハプティックフィードバック（不正解）
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      if (!gameEndedRef.current) {
        setIsProcessingClick(false);
        generateNewColors();
      }
    }, 300);
  };

  const timeBarWidth = (timeLeft / (INITIAL_TIME * 10)) * 100;
  const displayTime = (timeLeft / 10).toFixed(1);

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {onBackToHome && (
        <TouchableOpacity 
          onPress={onBackToHome} 
          style={[styles.homeButton, darkMode && styles.homeButtonDark]}
        >
          <Text style={[styles.homeButtonText, darkMode && styles.homeButtonTextDark]}>ゲームをやめる</Text>
        </TouchableOpacity>
      )}
      <View style={styles.header}>
        <Text style={[styles.scoreText, darkMode && styles.scoreTextDark]}>スコア: {score}</Text>
        <Text style={[styles.timeText, darkMode && styles.timeTextDark]}>時間: {displayTime}</Text>
      </View>
      <View style={[styles.timeBarContainer, darkMode && styles.timeBarContainerDark]}>
        <View
          style={[
            styles.timeBar,
            timeLeft <= 100 ? styles.timeBarDanger : styles.timeBarNormal,
            { width: `${timeBarWidth}%` }
          ]}
        />
      </View>
      
      <View style={styles.gameArea}>
        <View style={styles.questionContainer}>
          <Text style={[styles.colorNameText, darkMode && styles.colorNameTextDark]}>{targetColorName}</Text>
          <Text style={[styles.descriptionText, darkMode && styles.descriptionTextDark]}>{targetColorDescription}</Text>
        </View>
        <View style={styles.choicesContainer}>
          {colors.map((color, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleChoice(index)}
              disabled={!!feedback || gameEnded}
              style={[
                styles.choiceButton,
                darkMode && styles.choiceButtonDark,
                feedback && feedback.index !== index && styles.choiceButtonInactive,
                gameEnded && styles.choiceButtonInactive,
              ]}
            >
              <View style={[styles.colorBox, { backgroundColor: color.hex }]} />
              <Text style={[styles.munsellText, darkMode && styles.munsellTextDark]}>{color.munsell}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 応援メッセージ表示（常にスペースを確保） */}
        <View style={styles.encouragementContainer}>
          {encouragementMessage && feedback && feedback.type === 'correct' ? (
            <Text style={[styles.encouragementText, darkMode && styles.encouragementTextDark]}>
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
    borderRadius: 16,
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
    color: '#a855f7',
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
    backgroundColor: '#a855f7',
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
    borderRadius: 16,
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
    borderRadius: 12,
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
  containerDark: {
    backgroundColor: '#1f2937',
  },
  scoreTextDark: {
    color: '#c084fc',
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
  encouragementContainer: {
    alignItems: 'center',
    marginTop: 16,
    height: 32, // 固定の高さを設定
    justifyContent: 'center',
  },
  encouragementText: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#a855f7',
    fontFamily: MARU_GOTHIC_FONT,
  },
  encouragementTextDark: {
    color: '#c084fc',
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

export default ColorGameScreen;

