import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { INITIAL_TIME, PENALTY_SECONDS, DISTRACTOR_EMOJIS, CHOICE_COUNT, GOLD_STRAWBERRY_CHANCE, GOLD_STRAWBERRY_POINTS, GOLD_STRAWBERRY_TIME_BONUS, WHOLE_CAKE_CHANCE, WHOLE_CAKE_POINTS, WHOLE_CAKE_TIME_BONUS, MEMORY_GAME_CHANCE } from '../constants';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface GameScreenProps {
  onGameOver: (score: number) => void;
  onMemoryGame: (score: number, lastDistractor: string, firstDistractor: string) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onShowJuice?: (show: boolean) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ onGameOver, onMemoryGame, hapticsEnabled = true, darkMode = false, onShowJuice }) => {
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
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');
  // タイマー用のref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);
  
  // 応援の言葉リスト（通常時）
  const encouragementMessages = [
    'いいねー',
    'ナイストロベリー',
    'いちごつめ！',
    'いいよー',
    '熟してる！',
    '美味しい！',
    '一期一会',
    '3150',
    'いちごは野菜らしい',
    'バラ科だよ',
    'ヘタから行く派？',
  ];
  
  // 応援の言葉リスト（フィーバーモード時）
  const feverEncouragementMessages = [
    'いいねー',
    'ナイストロベリー',
    'いちごつめ！',
    'いいよー',
    '熟してる！',
    '美味しい！',
    '一期一会',
    '3150',
    'いちごは野菜らしい',
    'バラ科だよ',
    'ヘタから行く派？',
    'ラストスパート',
  ];

  const generateNewItems = useCallback(() => {
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    // フィーバーモード判定（残り10秒 = 100 * 0.1秒）
    const isFeverMode = timeLeft <= 100;
    const feverMultiplier = isFeverMode ? 10 : 1;
    
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
      // 応援メッセージをランダムに選択（フィーバーモード時は「ラストスパート」を含む）
      const isFeverMode = timeLeft <= 100;
      const messages = isFeverMode ? feverEncouragementMessages : encouragementMessages;
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      setEncouragementMessage(randomMessage);
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
      // いちご汁を表示（イライラ要素）
      if (onShowJuice) {
        console.log('いちご汁を表示');
        onShowJuice(true);
      }
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
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <View style={styles.header}>
        <Text style={[styles.scoreText, darkMode && styles.scoreTextDark]}>スコア: {score}</Text>
        <Text style={[styles.timeText, darkMode && styles.timeTextDark]}>時間: {displayTime}</Text>
      </View>
      <View style={[styles.timeBarContainer, darkMode && styles.timeBarContainerDark]}>
        <View
          style={[
            styles.timeBar,
            isFeverMode ? styles.timeBarFever : timeLeft <= 100 ? styles.timeBarDanger : styles.timeBarNormal,
            { width: `${timeBarWidth}%` }
          ]}
        />
      </View>
      
      <View style={styles.gameArea}>
        {isWholeCake ? (
          <>
            <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>
              🎂 ホールケーキはどっち？
            </Text>
            <Text style={styles.pointsTextPurple}>
              🎂 5点ゲット！
            </Text>
          </>
        ) : isGoldStrawberry ? (
          <>
            <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>
              🍰 ケーキはどっち？ 🍰
            </Text>
            <Text style={styles.pointsTextYellow}>
              🍰 3点ゲット！
            </Text>
          </>
        ) : (
          <Text style={[styles.questionTextNormal, darkMode && styles.questionTextNormalDark]}>いちごはどっち？</Text>
        )}
        <View style={styles.choicesContainer}>
          {items.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleChoice(index)}
              disabled={!!feedback || gameEnded}
              style={[
                styles.choiceButton,
                darkMode && styles.choiceButtonDark,
                feedback && feedback.index === index && feedback.type === 'correct' && styles.choiceButtonCorrect,
                feedback && feedback.index !== index && styles.choiceButtonInactive,
                gameEnded && styles.choiceButtonInactive,
              ]}
            >
              <Text style={styles.choiceEmoji}>{item}</Text>
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
      
      {/* フィーバーモード表示（画面下） */}
      {isFeverMode && (
        <View style={styles.feverContainer}>
          <Text style={[styles.feverText, darkMode && styles.feverTextDark]}>
            ✨ 特別アイテム出現率10倍
          </Text>
        </View>
      )}
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
    position: 'relative',
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
  feverTextDark: {
    color: '#fbbf24',
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
    marginTop: 16,
    marginBottom: 0,
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
  encouragementContainer: {
    alignItems: 'center',
    marginTop: 16,
    height: 32, // 固定の高さを設定
    justifyContent: 'center',
  },
  encouragementText: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ec4899',
    fontFamily: MARU_GOTHIC_FONT,
  },
  encouragementTextDark: {
    color: '#f9a8d4',
  },
  encouragementPlaceholder: {
    height: 20, // テキストと同じ高さのプレースホルダー
  },
});

export default GameScreen;