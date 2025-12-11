import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DISTRACTOR_EMOJIS } from '../constants';
import { MARU_GOTHIC_FONT, FONT_WEIGHT_BOLD, FONT_WEIGHT_SEMIBOLD } from '../constants/fonts';

interface MemoryGameScreenProps {
  currentScore: number;
  correctAnswer: string;
  onComplete: (finalScore: number) => void;
}

const MemoryGameScreen: React.FC<MemoryGameScreenProps> = ({ 
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🧠 記憶チャレンジ！</Text>
        <Text style={styles.description}>
          最後に出た、いちごじゃない方の果物は？
        </Text>
        <Text style={styles.hint}>
          正解で+2点ボーナス！
        </Text>
      </View>

      {!showResult ? (
        <View style={styles.optionsContainer}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => handleAnswerSelect(option)}
              style={[styles.optionButton, { margin: 8 }]}
            >
              <Text style={styles.optionEmoji}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.resultContainer}>
          {isCorrect ? (
            <View style={styles.resultContent}>
              <Text style={styles.resultEmoji}>🎉</Text>
              <Text style={styles.resultTextCorrect}>正解！</Text>
              <Text style={styles.resultSubTextCorrect}>+2点ボーナス獲得！</Text>
            </View>
          ) : (
            <View style={styles.resultContent}>
              <Text style={styles.resultEmoji}>😅</Text>
              <Text style={styles.resultTextIncorrect}>残念！</Text>
              <Text style={styles.resultSubTextIncorrect}>正解は {correctAnswer} でした</Text>
            </View>
          )}
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: FONT_WEIGHT_BOLD,
    color: '#9333ea',
    marginBottom: 8,
    fontFamily: MARU_GOTHIC_FONT,
  },
  description: {
    fontSize: 18,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: MARU_GOTHIC_FONT,
  },
  hint: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: MARU_GOTHIC_FONT,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 384,
    alignSelf: 'center',
  },
  optionButton: {
    width: 96,
    height: 96,
    backgroundColor: '#faf5ff',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: {
    fontSize: 48,
  },
  resultContainer: {
    alignItems: 'center',
  },
  resultContent: {
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  resultTextCorrect: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    marginBottom: 8,
    color: '#059669',
    fontFamily: MARU_GOTHIC_FONT,
  },
  resultSubTextCorrect: {
    fontSize: 18,
    color: '#059669',
    fontFamily: MARU_GOTHIC_FONT,
  },
  resultTextIncorrect: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT_BOLD,
    marginBottom: 8,
    color: '#dc2626',
    fontFamily: MARU_GOTHIC_FONT,
  },
  resultSubTextIncorrect: {
    fontSize: 18,
    color: '#dc2626',
    fontFamily: MARU_GOTHIC_FONT,
  },
});

export default MemoryGameScreen;