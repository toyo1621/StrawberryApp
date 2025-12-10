import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { INITIAL_TIME, PENALTY_SECONDS, DISTRACTOR_EMOJIS, CHOICE_COUNT, GOLD_STRAWBERRY_CHANCE, GOLD_STRAWBERRY_POINTS, GOLD_STRAWBERRY_TIME_BONUS, WHOLE_CAKE_CHANCE, WHOLE_CAKE_POINTS, WHOLE_CAKE_TIME_BONUS, MEMORY_GAME_CHANCE } from '../constants';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface GameScreenProps {
  onGameOver: (score: number) => void;
  onMemoryGame: (score: number, lastDistractor: string, firstDistractor: string) => void;
  hapticsEnabled?: boolean;
}

const GameScreen: React.FC<GameScreenProps> = ({ onGameOver, onMemoryGame, hapticsEnabled = true }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME * 10); // 0.1秒単位で管理
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [items, setItems] = useState<string[]>([]);
  const [strawberryIndex, setStrawberryIndex] = useState(-1);
  const [isGoldStrawberry, setIsGoldStrawberry] = useState(false);
  const [isWholeCake, setIsWholeCake] = useState(false);
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [allDistractors, setAllDistractors] = useState<string[]>([]);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [currentDistractor, setCurrentDistractor] = useState<string>('');

  // タイマー用のref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

  const generateNewItems = useCallback(() => {
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    
    // フィーバーモード判定（残り10秒 = 100 * 0.1秒）
    const isFeverMode = timeLeft <= 100;
    const feverMultiplier = isFeverMode ? 5 : 1;
    
    // Check if this should be a whole cake (highest priority)
    const shouldBeWholeCake = Math.random() < (WHOLE_CAKE_CHANCE * feverMultiplier);
    // Check if this should be a gold strawberry (if not whole cake)
    const shouldBeGold = !shouldBeWholeCake && Math.random() < (GOLD_STRAWBERRY_CHANCE * feverMultiplier);
    
    setIsGoldStrawberry(shouldBeGold);
    setIsWholeCake(shouldBeWholeCake);
    
    const newStrawberryIndex = Math.floor(Math.random() * CHOICE_COUNT);
    const newItems: string[] = new Array(CHOICE_COUNT).fill('');
    
    if (shouldBeWholeCake) {
      newItems[newStrawberryIndex] = '🎂';
    } else if (shouldBeGold) {
      newItems[newStrawberryIndex] = '🍰';
    } else {
      newItems[newStrawberryIndex] = '🍓';
    }

    const distractors = [...DISTRACTOR_EMOJIS].sort(() => 0.5 - Math.random());
    let distractorCursor = 0;

    for (let i = 0; i < CHOICE_COUNT; i++) {
      if (i !== newStrawberryIndex) {
        const distractor = distractors[distractorCursor++];
        newItems[i] = distractor;
        
        // 現在のディストラクターを記録
        setCurrentDistractor(distractor);
      }
    }
    
    setStrawberryIndex(newStrawberryIndex);
    setItems(newItems);
  }, []);

  // ディストラクターを記録するuseEffect
  useEffect(() => {
    if (currentDistractor) {
      setAllDistractors(prev => [...prev, currentDistractor]);
    }
  }, [currentDistractor]);
  // タイマーを開始する関数
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prevTime => {
        const newTime = prevTime - 1; // 0.1秒ずつ減少
        
        // 時間が0になったらゲーム終了処理
        if (newTime <= 0) {
          if (!gameEndedRef.current) {
            gameEndedRef.current = true;
            setGameEnded(true);
            
            // タイマーを停止
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            // ゲーム終了処理を非同期で実行
            setTimeout(() => {
              const finalScore = scoreRef.current;
              setAllDistractors(currentDistractors => {
                if (Math.random() < MEMORY_GAME_CHANCE && currentDistractors.length > 0) {
                  const firstDistractor = currentDistractors[0];
                  const lastDistractor = currentDistractors[currentDistractors.length - 1];
                  setTimeout(() => {
                    onMemoryGame(finalScore, lastDistractor, firstDistractor);
                  }, 0);
                } else {
                  setTimeout(() => {
                    onGameOver(finalScore);
                  }, 0);
                }
                return currentDistractors;
              });
            }, 0);
          }
          return 0;
        }
        
        return newTime;
      });
    }, 100);
  }, [onGameOver, onMemoryGame]);

  // ゲーム開始時にタイマーを開始
  useEffect(() => {
    generateNewItems();
    startTimer();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewItems, startTimer]);

  const handleChoice = (index: number) => {
    // 重複クリック防止の強化
    if (feedback || isProcessingClick || gameEnded || gameEndedRef.current) return;
    
    setIsProcessingClick(true);

    const isCorrect = index === strawberryIndex;

    if (isCorrect) {
      let points = 1;
      if (isWholeCake) {
        points = WHOLE_CAKE_POINTS;
        // ホールケーキの時間ボーナス（5秒）
        setTimeLeft(prevTime => prevTime + WHOLE_CAKE_TIME_BONUS);
      } else if (isGoldStrawberry) {
        points = GOLD_STRAWBERRY_POINTS;
        // ショートケーキの時間ボーナス（1秒）
        setTimeLeft(prevTime => prevTime + GOLD_STRAWBERRY_TIME_BONUS);
      }
      setScore(prevScore => {
        const newScore = prevScore + points;
        scoreRef.current = newScore;
        return newScore;
      });
      
      // 連続正解カウントを増やす
      setConsecutiveCorrect(prev => {
        const newCount = prev + 1;
        // 連続正解で時間ボーナス（0.5秒 = 5）
        if (newCount >= 2) {
          setTimeLeft(prevTime => prevTime + 5);
        }
        return newCount;
      });
      
      setFeedback({ index, type: 'correct' });
      // ハプティックフィードバック（正解）
      if (hapticsEnabled) {
        if (isWholeCake) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (isGoldStrawberry) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } else {
      // 時間を減らす（ペナルティ）
      setTimeLeft(prevTime => Math.max(0, prevTime - (PENALTY_SECONDS * 10))); // ペナルティも0.1秒単位
      // 連続正解カウントをリセット
      setConsecutiveCorrect(0);
      setFeedback({ index, type: 'incorrect' });
      // ハプティックフィードバック（不正解）
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      if (!gameEndedRef.current) {
        setIsProcessingClick(false);
        generateNewItems();
      }
    }, 300);
  };

  const timeBarWidth = (timeLeft / (INITIAL_TIME * 10)) * 100;
  const displayTime = (timeLeft / 10).toFixed(1); // 0.1秒単位で表示
  const isFeverMode = timeLeft <= 100; // 残り10秒以下でフィーバーモード

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.scoreText}>スコア: {score}</Text>
        <Text style={styles.timeText}>時間: {displayTime}</Text>
      </View>
      <View style={styles.timeBarContainer}>
        <View
          style={[
            styles.timeBar,
            isFeverMode ? styles.timeBarFever : timeLeft <= 100 ? styles.timeBarDanger : styles.timeBarNormal,
            { width: `${timeBarWidth}%` }
          ]}
        />
      </View>
      
      {/* フィーバーモード表示 */}
      {isFeverMode && (
        <View style={styles.feverContainer}>
          <Text style={styles.feverText}>
            🎂✨ ケーキ5倍フィーバー！ ✨🍰
          </Text>
        </View>
      )}
      
      <View style={styles.gameArea}>
        {isWholeCake ? (
          <>
            <Text style={styles.questionText}>
              🎂 ホールケーキはどっち？ 🎂
            </Text>
            <Text style={styles.pointsTextPurple}>
              🎂 5点ゲット！
            </Text>
          </>
        ) : isGoldStrawberry ? (
          <>
            <Text style={styles.questionText}>
              🍰 ケーキはどっち？ 🍰
            </Text>
            <Text style={styles.pointsTextYellow}>
              🍰 3点ゲット！
            </Text>
          </>
        ) : (
          <Text style={styles.questionTextNormal}>いちごはどっち？</Text>
        )}
        <View style={styles.choicesContainer}>
          {items.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleChoice(index)}
              disabled={!!feedback || gameEnded}
              style={[
                styles.choiceButton,
                feedback && feedback.index === index && feedback.type === 'correct' && styles.choiceButtonCorrect,
                feedback && feedback.index !== index && styles.choiceButtonInactive,
                gameEnded && styles.choiceButtonInactive,
              ]}
            >
              <Text style={styles.choiceEmoji}>{item}</Text>
            </TouchableOpacity>
          ))}
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
    color: '#ec4899',
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
  timeBarFever: {
    backgroundColor: '#facc15',
  },
  feverContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  feverText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#facc15',
    fontFamily: MARU_GOTHIC_FONT,
  },
  gameArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  questionText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  questionTextNormal: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#374151',
    marginBottom: 32,
    fontFamily: MARU_GOTHIC_FONT,
  },
  pointsTextPurple: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#9333ea',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  pointsTextYellow: {
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
    backgroundColor: '#fdf2f8',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonCorrect: {
    borderWidth: 4,
    borderColor: '#4ade80',
  },
  choiceButtonInactive: {
    opacity: 0.5,
  },
  choiceEmoji: {
    fontSize: 72,
  },
});

export default GameScreen;