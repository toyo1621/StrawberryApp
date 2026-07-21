import React from 'react';
import MemoryChallengeScreen from './game/MemoryChallengeScreen';

type MemoryGameScreenProps = {
  currentScore: number;
  correctAnswer: string;
  onComplete: (finalScore: number) => void;
  darkMode?: boolean;
};

const MemoryGameScreen: React.FC<MemoryGameScreenProps> = (props) => (
  <MemoryChallengeScreen
    {...props}
    title="記憶チャレンジ"
    prompt="最後に出たいちご以外の果物は？"
    bonusPoints={2}
  />
);

export default MemoryGameScreen;
