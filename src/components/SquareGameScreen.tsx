import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_TIME, PENALTY_SECONDS } from '../constants';

interface SquareGameScreenProps {
  onGameOver: (score: number) => void;
}

const SquareGameScreen: React.FC<SquareGameScreenProps> = ({ onGameOver }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME * 10);
  const [currentNumber, setCurrentNumber] = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [wrongAnswer, setWrongAnswer] = useState(0);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

  const generateNewProblem = useCallback(() => {
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    
    // 1から20までの数字をランダムに選択
    const number = Math.floor(Math.random() * 20) + 1;
    const correct = number * number;
    
    // 間違いの選択肢を生成（正解の±1〜10の範囲）
    let wrong;
    do {
      const offset = Math.floor(Math.random() * 20) + 1; // 1-20の差
      wrong = Math.random() < 0.5 ? correct + offset : Math.max(1, correct - offset);
    } while (wrong === correct);
    
    const correctIdx = Math.floor(Math.random() * 2);
    
    setCurrentNumber(number);
    setCorrectAnswer(correct);
    setWrongAnswer(wrong);
    setCorrectIndex(correctIdx);
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
    generateNewProblem();
    startTimer();
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [generateNewProblem, startTimer]);

  const handleChoice = (index: number) => {
    if (feedback || isProcessingClick || gameEnded || gameEndedRef.current) return;
    
    setIsProcessingClick(true);

    const isCorrect = index === correctIndex;

    if (isCorrect) {
      setScore(prevScore => {
        const newScore = prevScore + 1;
        scoreRef.current = newScore;
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
        generateNewProblem();
      }
    }, 300);
  };

  const timeBarWidth = (timeLeft / (INITIAL_TIME * 10)) * 100;
  const displayTime = (timeLeft / 10).toFixed(1);

  const answers = [correctAnswer, wrongAnswer];
  if (correctIndex === 1) {
    answers.reverse();
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full animate-pop-in">
      <div className="flex justify-between items-center mb-4 text-2xl font-bold">
        <div className="text-purple-500">スコア: {score}</div>
        <div className="text-gray-700">時間: {displayTime}</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-linear ${
            timeLeft <= 100 ? 'bg-red-500' : 'bg-purple-400'
          }`}
          style={{ width: `${timeBarWidth}%` }}
        ></div>
      </div>
      
      <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[350px]">
        <p className="text-3xl font-bold text-gray-700 mb-4">
          {currentNumber}² = ?
        </p>
        <p className="text-lg text-gray-600 mb-8">正しい答えはどっち？</p>
        <div className="flex justify-around w-full max-w-sm">
          {answers.map((answer, index) => (
            <button
              key={index}
              onClick={() => handleChoice(index)}
              disabled={!!feedback || gameEnded}
              className={`w-36 h-36 sm:w-40 sm:h-40 bg-purple-50 rounded-2xl flex items-center justify-center text-4xl font-bold transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-purple-300
                ${feedback && feedback.index === index && feedback.type === 'correct' ? 'scale-110 ring-4 ring-green-400' : ''}
                ${feedback && feedback.index === index && feedback.type === 'incorrect' ? 'animate-shake' : ''}
                ${feedback && feedback.index !== index ? 'opacity-50' : ''}
                ${gameEnded ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label={`選択肢 ${index + 1}: ${answer}`}
            >
              <span>{answer}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SquareGameScreen;