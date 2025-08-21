import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INITIAL_TIME, PENALTY_SECONDS, COUNTRIES } from '../constants';
import { Country } from '../types';

interface FlagGameScreenProps {
  onGameOver: (score: number) => void;
}

const FlagGameScreen: React.FC<FlagGameScreenProps> = ({ onGameOver }) => {
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME * 10);
  const [countries, setCountries] = useState<Country[]>([]);
  const [correctCountryIndex, setCorrectCountryIndex] = useState(-1);
  const [targetCountryName, setTargetCountryName] = useState('');
  const [feedback, setFeedback] = useState<{ index: number; type: 'correct' | 'incorrect' } | null>(null);
  const [isProcessingClick, setIsProcessingClick] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameEndedRef = useRef(false);

  const generateNewCountries = useCallback(() => {
    if (gameEndedRef.current) return;
    
    setFeedback(null);
    
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
      setFeedback({ index, type: 'correct' });
    } else {
      setTimeLeft(prevTime => Math.max(0, prevTime - (PENALTY_SECONDS * 10)));
      setFeedback({ index, type: 'incorrect' });
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
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full animate-pop-in">
      <div className="flex justify-between items-center mb-4 text-2xl font-bold">
        <div className="text-green-500">スコア: {score}</div>
        <div className="text-gray-700">時間: {displayTime}</div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-linear ${
            timeLeft <= 100 ? 'bg-red-500' : 'bg-green-400'
          }`}
          style={{ width: `${timeBarWidth}%` }}
        ></div>
      </div>
      
      <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[350px]">
        <p className="text-2xl font-bold text-gray-700 mb-8">{targetCountryName}の国旗はどっち？</p>
        <div className="flex justify-around w-full max-w-sm">
          {countries.map((country, index) => (
            <button
              key={index}
              onClick={() => handleChoice(index)}
              disabled={!!feedback || gameEnded}
              className={`w-36 h-36 sm:w-40 sm:h-40 bg-green-50 rounded-2xl flex items-center justify-center transform transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-green-300 p-4 border-2 border-gray-200
                ${feedback && feedback.index === index && feedback.type === 'correct' ? 'scale-110 ring-4 ring-green-400' : ''}
                ${feedback && feedback.index === index && feedback.type === 'incorrect' ? 'animate-shake' : ''}
                ${feedback && feedback.index !== index ? 'opacity-50' : ''}
                ${gameEnded ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              aria-label={`選択肢 ${index + 1}: ${country.name}`}
            >
              <img 
                src={`https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/${country.code}.svg`}
                alt={`${country.name}の国旗`}
               className="max-w-full max-h-full object-contain rounded-lg"
               style={{ aspectRatio: '4/3', width: 'auto', height: 'auto' }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlagGameScreen;