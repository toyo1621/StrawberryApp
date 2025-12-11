import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { INITIAL_TIME, PENALTY_SECONDS, COUNTRIES } from '../constants';
import { Country } from '../types';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface FlagGameScreenProps {
  onGameOver: (score: number) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onBackToHome?: () => void;
}

const FlagGameScreen: React.FC<FlagGameScreenProps> = ({ onGameOver, hapticsEnabled = true, darkMode = false, onBackToHome }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME * 10);
  const [countries, setCountries] = useState<Country[]>([]);
  const [correctCountryIndex, setCorrectCountryIndex] = useState(-1);
  const [targetCountryName, setTargetCountryName] = useState('');
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

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
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    // ランダムに2つの国を選択
    const shuffledCountries = [...COUNTRIES].sort(() => 0.5 - Math.random());
    const selectedCountries = shuffledCountries.slice(0, 2);
    
    // どちらが正解かをランダムに決定
    const correctIndex = Math.floor(Math.random() * 2);
    const targetCountry = selectedCountries[correctIndex];
    
    setCountries(selectedCountries);
    setCorrectCountryIndex(correctIndex);
    setTargetCountryName(targetCountry.name);
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
    generateNewCountries();
    startTimer();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewCountries, startTimer]);

  const handleChoice = (index: number) => {
    if (feedback || isProcessingClick || gameEnded || gameEndedRef.current) return;
    
    setIsProcessingClick(true);

    const isCorrect = index === correctCountryIndex;

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
        generateNewCountries();
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
          <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>{targetCountryName}</Text>
          <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>の国旗はどっち？</Text>
        </View>
        <View style={styles.choicesContainer}>
          {countries.map((country, index) => (
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
              <Image 
                source={{ uri: `https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${country.code}.svg` }}
                style={styles.choiceImage}
                contentFit="contain"
              />
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
    color: '#10b981',
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  choiceButtonInactive: {
    opacity: 0.5,
  },
  choiceImage: {
    width: '100%',
    height: '100%',
    aspectRatio: 4/3,
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
    color: '#10b981',
    fontFamily: MARU_GOTHIC_FONT,
  },
  encouragementTextDark: {
    color: '#6ee7b7',
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

export default FlagGameScreen;