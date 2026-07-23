import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { DISTRACTOR_EMOJIS, CHOICE_COUNT, MEMORY_GAME_CHANCE } from '../constants';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD } from '../constants/fonts';
import { describeEmoji, shuffle } from '../domain/game';
import { ANSWER_FEEDBACK_MS, GAMEPLAY_RULES, ticksToSeconds } from '../gameRules';
import { useGameTimer } from '../hooks/useGameTimer';
import { GameMode } from '../types';
import GameFrame from './game/GameFrame';

const RULES = GAMEPLAY_RULES[GameMode.STRAWBERRY];

interface GameScreenProps {
  onGameOver: (score: number) => void;
  onMemoryGame: (score: number, lastDistractor: string, firstDistractor: string) => void;
  hapticsEnabled?: boolean;
  darkMode?: boolean;
  onShowJuice?: (show: boolean) => void;
  onBackToHome?: () => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ onGameOver, onMemoryGame, hapticsEnabled = true, darkMode = false, onShowJuice, onBackToHome }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const consecutiveCorrectRef = useRef(0);
  const [items, setItems] = useState<string[]>([]);
  const [strawberryIndex, setStrawberryIndex] = useState(-1);
  const [isGoldStrawberry, setIsGoldStrawberry] = useState(false);
  const [isWholeCake, setIsWholeCake] = useState(false);
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');
  const [showAttackMessage, setShowAttackMessage] = useState(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const distractorHistoryRef = useRef<string[]>([]);
  const processingClickRef = useRef(false);
  const timeLeftRef = useRef(RULES.initialTimeTicks);

  const handleTimeExpired = useCallback(() => {
    const finalScore = scoreRef.current;
    const distractors = distractorHistoryRef.current;
    if (Math.random() < MEMORY_GAME_CHANCE && distractors.length > 0) {
      onMemoryGame(finalScore, distractors[distractors.length - 1], distractors[0]);
      return;
    }
    onGameOver(finalScore);
  }, [onGameOver, onMemoryGame]);
  const { adjustTime, gameEnded, gameEndedRef, timeLeft } = useGameTimer({
    initialTicks: RULES.initialTimeTicks,
    maximumDurationTicks: RULES.maxSessionTicks,
    onExpire: handleTimeExpired,
  });

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);
  
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
    if (gameEndedRef.current) {
      return;
    }
    
    setFeedback(null);
    setEncouragementMessage(''); // 応援メッセージをリセット
    
    // フィーバーモード判定（残り10秒 = 100 * 0.1秒）
    const isFeverMode = timeLeftRef.current <= RULES.fever.thresholdTicks;
    const feverMultiplier = isFeverMode ? RULES.fever.specialChanceMultiplier : 1;
    
    // Check if this should be a whole cake (highest priority)
    const shouldBeWholeCake = Math.random() < (RULES.wholeCake.chance * feverMultiplier);
    // Check if this should be a gold strawberry (if not whole cake)
    const shouldBeGold = !shouldBeWholeCake && Math.random() < (RULES.shortCake.chance * feverMultiplier);
    
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

    const distractors = shuffle(DISTRACTOR_EMOJIS);
    let distractorCursor = 0;

    for (let i = 0; i < CHOICE_COUNT; i++) {
      if (i !== newStrawberryIndex) {
        const distractor = distractors[distractorCursor++];
        newItems[i] = distractor;
        
        distractorHistoryRef.current.push(distractor);
      }
    }
    
    setStrawberryIndex(newStrawberryIndex);
    setItems(newItems);
  }, [gameEndedRef]);

  useEffect(() => {
    generateNewItems();
    
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      if (attackMessageTimeoutRef.current) {
        clearTimeout(attackMessageTimeoutRef.current);
      }
    };
  }, [generateNewItems]);

  const handleChoice = (index: number) => {
    // 重複クリック防止の強化
    if (feedback || processingClickRef.current || gameEnded || gameEndedRef.current) {return;}
    
    processingClickRef.current = true;

    const isCorrect = index === strawberryIndex;

    if (isCorrect) {
      let points: number = RULES.regularPoints;
      let bonusTicks = 0;
      if (isWholeCake) {
        points = RULES.wholeCake.points;
        bonusTicks += RULES.wholeCake.timeBonusTicks;
      } else if (isGoldStrawberry) {
        points = RULES.shortCake.points;
        bonusTicks += RULES.shortCake.timeBonusTicks;
      }
      setScore(prevScore => {
        const newScore = prevScore + points;
        scoreRef.current = newScore;
        return newScore;
      });
      
      consecutiveCorrectRef.current += 1;
      if (consecutiveCorrectRef.current >= RULES.streak.startsAt) {
        bonusTicks += RULES.streak.timeBonusTicks;
      }
      if (bonusTicks > 0) {
        adjustTime(bonusTicks);
      }
      
      setFeedback({ index, type: 'correct' });
      // 応援メッセージをランダムに選択（フィーバーモード時は「ラストスパート」を含む）
      const isFeverMode = timeLeft <= RULES.fever.thresholdTicks;
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
      adjustTime(-RULES.penaltyTicks);
      consecutiveCorrectRef.current = 0;
      setFeedback({ index, type: 'incorrect' });
      // いちご汁を表示（イライラ要素）
      if (onShowJuice) {
        onShowJuice(true);
      }
      // 攻撃メッセージを表示
      setShowAttackMessage(true);
      // 3秒後にメッセージを非表示にする
      if (attackMessageTimeoutRef.current) {
        clearTimeout(attackMessageTimeoutRef.current);
      }
      attackMessageTimeoutRef.current = setTimeout(() => {
        setShowAttackMessage(false);
      }, 3000);
      // ハプティックフィードバック（不正解）
      if (hapticsEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      if (!gameEndedRef.current) {
        processingClickRef.current = false;
        generateNewItems();
      }
    }, ANSWER_FEEDBACK_MS);
  };

  const isFeverMode = timeLeft <= RULES.fever.thresholdTicks;

  return (
    <GameFrame
      mode={GameMode.STRAWBERRY}
      score={score}
      timeLeft={timeLeft}
      initialTimeTicks={RULES.initialTimeTicks}
      dangerThresholdTicks={RULES.dangerThresholdTicks}
      darkMode={darkMode}
      onBackToHome={onBackToHome}
      specialBarColor={isFeverMode ? '#facc15' : undefined}
    >
      <View style={styles.gameArea}>
        {isWholeCake ? (
          <>
            <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>
              🎂 ホールケーキはどっち？
            </Text>
            <Text style={[styles.pointsTextPurple, darkMode && styles.pointsTextPurpleDark]}>
              🎂 5点ゲット！
            </Text>
          </>
        ) : isGoldStrawberry ? (
          <>
            <Text style={[styles.questionText, darkMode && styles.questionTextDark]}>
              🍰 ケーキはどっち？ 🍰
            </Text>
            <Text style={[styles.pointsTextYellow, darkMode && styles.pointsTextYellowDark]}>
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
              accessibilityRole="button"
              accessibilityLabel={`選択肢${index + 1}、${describeEmoji(item)}`}
              accessibilityState={{ disabled: Boolean(feedback) || gameEnded }}
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
            <Text accessibilityLiveRegion="polite" style={[styles.encouragementText, darkMode && styles.encouragementTextDark]}>
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
      
      {/* 攻撃メッセージ表示（画面下） */}
      {showAttackMessage && (
        <View style={styles.attackMessageContainer}>
          <Text accessibilityLiveRegion="assertive" style={[styles.attackMessageText, darkMode && styles.attackMessageTextDark]}>
            不正解。残り時間が{ticksToSeconds(RULES.penaltyTicks)}秒減りました。
          </Text>
        </View>
      )}
    </GameFrame>
  );
};

const styles = StyleSheet.create({
  questionTextDark: {
    color: '#f9fafb',
  },
  questionTextNormalDark: {
    color: '#f9fafb',
  },
  choiceButtonDark: {
    backgroundColor: '#374151',
  },
  feverTextDark: {
    color: '#fde047',
  },
  feverContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 0,
  },
  feverText: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#854d0e',
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
    color: '#7e22ce',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  pointsTextPurpleDark: {
    color: '#d8b4fe',
  },
  pointsTextYellow: {
    fontSize: 18,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#854d0e',
    marginBottom: 16,
    fontFamily: MARU_GOTHIC_FONT,
  },
  pointsTextYellowDark: {
    color: '#fde047',
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
    borderRadius: 8,
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
  attackMessageContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 0,
  },
  attackMessageText: {
    fontSize: 20,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#ef4444',
    fontFamily: MARU_GOTHIC_FONT,
  },
  attackMessageTextDark: {
    color: '#f87171',
  },
});

export default GameScreen;
