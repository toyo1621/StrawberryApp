import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_TIME, PENALTY_SECONDS, ISLAND_NAMES } from '../constants';
import { Island } from '../types';

interface IslandGameScreenProps {
  onGameOver: (score: number) => void;
}

const IslandGameScreen: React.FC<IslandGameScreenProps> = ({ onGameOver }) => {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME * 10);
  const [islands, setIslands] = useState<Island[]>([]);
  const [correctIslandIndex, setCorrectIslandIndex] = useState(-1);
  const [targetIslandName, setTargetIslandName] = useState('');
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

  const generateNewIslands = useCallback(() => {
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    
    // ランダムに2つの島を選択
    const shuffledIslands = [...ISLAND_NAMES].sort(() => 0.5 - Math.random());
    const selectedIslands = shuffledIslands.slice(0, 2);
    
    // どちらが正解かをランダムに決定
    const correctIndex = Math.floor(Math.random() * 2);
    const targetIsland = selectedIslands[correctIndex];
    
    setIslands(selectedIslands);
    setCorrectIslandIndex(correctIndex);
    setTargetIslandName(targetIsland.name);
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
              setScore(currentScore => {
                onGameOver(currentScore);
                return currentScore;
              });
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
    if (feedback || isProcessingClick || gameEnded || gameEndedRef.current) return;
    
    setIsProcessingClick(true);

    const isCorrect = index === correctIslandIndex;

    if (isCorrect) {
      setScore(prevScore => {
        const newScore = prevScore + 1;
        return newScore;
      });
      setFeedback({ index, type: 'correct' });
    } else {
      setTimeLeft(prevTime => Math.max(0, prevTime - (PENALTY_SECONDS * 10)));
      setFeedback({ index, type: 'incorrect' });
    }
    
    feedbackTimeoutRef.current = setTimeout(() => {
      if (!gameEndedRef.current) {
        setIsProcessingClick(false);
        generateNewIslands();
      }
    }, 300);
  };

  const timeBarWidth = (timeLeft / (INITIAL_TIME * 10)) * 100;
  const displayTime = (timeLeft / 10).toFixed(1);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full animate-pop-in">
      <div className="flex justify-between items-center mb-4 text-2xl font-bold">
        <div className="text-blue-500">スコア: {score}</div>
        <div className="text-gray-700">時間: {displayTime}</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-linear ${
            timeLeft <= 100 ? 'bg-red-500' : 'bg-blue-400'
          }`}
          style={{ width: `${timeBarWidth}%` }}
        ></div>
      </div>
      
      <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[350px]">
        <p className="text-2xl font-bold text-gray-700 mb-8">{targetIslandName}はどっち？</p>
        <div className="flex justify-around w-full max-w-sm">
          {islands.map((island, index) => (
            <button
              key={index}
              onClick={() => handleChoice(index)}
              disabled={!!feedback || gameEnded}
              className={`w-36 h-36 sm:w-40 sm:h-40 bg-blue-50 rounded-2xl flex items-center justify-center transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-300 p-4
                ${feedback && feedback.index === index && feedback.type === 'correct' ? 'scale-110 ring-4 ring-green-400' : ''}
                ${feedback && feedback.index === index && feedback.type === 'incorrect' ? 'animate-shake' : ''}
                ${feedback && feedback.index !== index ? 'opacity-50' : ''}
                ${gameEnded ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label={`選択肢 ${index + 1}: ${island.name}`}
            >
              <img 
                src={`/src/assets/islands/${island.file}`} 
                alt={island.name}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IslandGameScreen;