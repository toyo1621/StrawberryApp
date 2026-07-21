import React from 'react';
import MemoryChallengeScreen from './game/MemoryChallengeScreen';

type MemoryGame2ScreenProps = {
  currentScore: number;
  correctAnswer: string;
  onComplete: (finalScore: number) => void;
  darkMode?: boolean;
};

const MemoryGame2Screen: React.FC<MemoryGame2ScreenProps> = (props) => (
  <MemoryChallengeScreen
    {...props}
    title="最終記憶チャレンジ"
    prompt="一番最初に出たいちご以外の果物は？"
    bonusPoints={10}
  />
);

export default MemoryGame2Screen;
