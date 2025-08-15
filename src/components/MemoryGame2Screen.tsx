import React, { useState, useEffect } from 'react';
import { DISTRACTOR_EMOJIS } from '../constants';

interface MemoryGame2ScreenProps {
  currentScore: number;
  correctAnswer: string;
  onComplete: (finalScore: number) => void;
}

const MemoryGame2Screen: React.FC<MemoryGame2ScreenProps> = ({ 
  currentScore, 
  correctAnswer, 
  onComplete 
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [options, setOptions] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    // Generate 4 options including the correct answer
    const wrongOptions = DISTRACTOR_EMOJIS
      .filter(emoji => emoji !== correctAnswer)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const allOptions = [correctAnswer, ...wrongOptions]
      .sort(() => 0.5 - Math.random());
    
    setOptions(allOptions);
  }, [correctAnswer]);

  const handleAnswerSelect = (answer: string) => {
    if (showResult || isCompleted) return;
    
    setSelectedAnswer(answer);
    const correct = answer === correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);
    setIsCompleted(true);

    setTimeout(() => {
      const bonusPoints = correct ? 2 : 0;
      onComplete(currentScore + bonusPoints);
    }, 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 w-full animate-pop-in">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-blue-600 mb-2">🧠 最終記憶チャレンジ！</h2>
        <p className="text-lg text-gray-700 mb-4">
          一番最初に出た、いちごじゃない方の果物は？
        </p>
        <p className="text-sm text-gray-500">
          正解で+2点ボーナス！
        </p>
      </div>

      {!showResult ? (
        <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
          {options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              className="w-24 h-24 bg-blue-50 rounded-xl flex items-center justify-center text-5xl transform transition-all duration-200 hover:scale-105 hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-300"
            >
              <span role="img">{option}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center">
          {isCorrect ? (
            <div className="text-green-600">
              <div className="text-6xl mb-4">🎉</div>
              <p className="text-2xl font-bold mb-2">正解！</p>
              <p className="text-lg">+2点ボーナス獲得！</p>
            </div>
          ) : (
            <div className="text-red-600">
              <div className="text-6xl mb-4">😅</div>
              <p className="text-2xl font-bold mb-2">残念！</p>
              <p className="text-lg">正解は {correctAnswer} でした</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemoryGame2Screen;