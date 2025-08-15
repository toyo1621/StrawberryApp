import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_TIME, PENALTY_SECONDS, DISTRACTOR_EMOJIS, CHOICE_COUNT, GOLD_STRAWBERRY_CHANCE, GOLD_STRAWBERRY_POINTS, WHOLE_CAKE_CHANCE, WHOLE_CAKE_POINTS, MEMORY_GAME_CHANCE } from '../constants';

interface GameScreenProps {
  onGameOver: (score: number) => void;
  onMemoryGame: (score: number, lastDistractor: string, firstDistractor: string) => void;
}

const GameScreen: React.FC<GameScreenProps> = ({ onGameOver, onMemoryGame }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [items, setItems] = useState<string[]>([]);
  const [strawberryIndex, setStrawberryIndex] = useState(-1);
  const [isGoldStrawberry, setIsGoldStrawberry] = useState(false);
  const [isWholeCake, setIsWholeCake] = useState(false);
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [lastDistractor, setLastDistractor] = useState<string>('');
  const [allDistractors, setAllDistractors] = useState<string[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  const generateNewItems = useCallback(() => {
    setFeedback(null);
    
    // Check if this should be a whole cake (highest priority)
    const shouldBeWholeCake = Math.random() < WHOLE_CAKE_CHANCE;
    // Check if this should be a gold strawberry (if not whole cake)
    const shouldBeGold = !shouldBeWholeCake && Math.random() < GOLD_STRAWBERRY_CHANCE;
    
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
        
        // 全てのディストラクターを記録
        setAllDistractors(prev => [...prev, distractor]);
        // 最後のディストラクターを更新
        setLastDistractor(distractor);
      }
    }
    
    setStrawberryIndex(newStrawberryIndex);
    setItems(newItems);
  }, []);

  useEffect(() => {
    generateNewItems();
  }, [generateNewItems]);
  
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Check if we should trigger memory game
      if (Math.random() < MEMORY_GAME_CHANCE && allDistractors.length > 0) {
        const firstDistractor = allDistractors[0]; // 一番最初のディストラクター
        onMemoryGame(scoreRef.current, lastDistractor, firstDistractor);
      } else {
        onGameOver(scoreRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, onGameOver, onMemoryGame, lastDistractor, allDistractors]);

  const handleChoice = (index: number) => {
    if (feedback) return;

    const isCorrect = index === strawberryIndex;

    if (isCorrect) {
      let points = 1;
      if (isWholeCake) {
        points = WHOLE_CAKE_POINTS;
      } else if (isGoldStrawberry) {
        points = GOLD_STRAWBERRY_POINTS;
      }
      setScore(s => s + points);
      setFeedback({ index, type: 'correct' });
    } else {
      setTimeLeft(t => Math.max(0, t - PENALTY_SECONDS));
      setFeedback({ index, type: 'incorrect' });
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      generateNewItems();
    }, 300);
  };

  const timeBarWidth = (timeLeft / INITIAL_TIME) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full animate-pop-in">
      <div className="flex justify-between items-center mb-4 text-2xl font-bold">
        <div className="text-pink-500">スコア: {score}</div>
        <div className="text-gray-700">時間: {timeLeft}</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-linear ${timeLeft <= 10 ? 'bg-red-500' : 'bg-green-400'}`}
          style={{ width: `${timeBarWidth}%` }}
        ></div>
      </div>
      
      <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[350px]">
        {isWholeCake ? (
          <>
            <p className="text-2xl font-bold text-gray-700 mb-4">
              🎂 ホールケーキはどっち？ 🎂
            </p>
            <p className="text-lg font-bold text-purple-600 mb-4">
              🎂 5点ゲット！
            </p>
          </>
        ) : isGoldStrawberry ? (
          <>
            <p className="text-2xl font-bold text-gray-700 mb-4">
              🍰 ケーキはどっち？ 🍰
            </p>
            <p className="text-lg font-bold text-yellow-600 mb-4">
              🍰 3点ゲット！
            </p>
          </>
        ) : (
          <p className="text-lg font-bold text-yellow-600 mb-4">
            <p className="text-2xl font-bold text-gray-700 mb-4">
              いちごはどっち？
            </p>
          </p>
        )}
        <div className="flex justify-around w-full max-w-sm">
          {items.map((item, index) => (
            <button
              key={index}
              onClick={() => handleChoice(index)}
              disabled={!!feedback}
              className={`w-36 h-36 sm:w-40 sm:h-40 bg-pink-50 rounded-2xl flex items-center justify-center text-7xl sm:text-8xl transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-pink-300
                ${feedback && feedback.index === index && feedback.type === 'correct' ? 'scale-110 ring-4 ring-green-400' : ''}
                ${feedback && feedback.index === index && feedback.type === 'incorrect' ? 'animate-shake' : ''}
                ${feedback && feedback.index !== index ? 'opacity-50' : ''}
              `}
              aria-label={`選択肢 ${index + 1}: ${item}`}
            >
              <span role="img" aria-hidden="true">{item}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameScreen;