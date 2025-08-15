import React, { useState, useCallback, useEffect } from 'react';
import { GameState, RankingEntry } from './types';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import MemoryGameScreen from './components/MemoryGameScreen';
import GameOverScreen from './components/GameOverScreen';
import { fetchRankings, saveScore } from './services/rankingService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [playerName, setPlayerName] = useState<string>('');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [memoryAnswer, setMemoryAnswer] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ランキングを読み込み
  useEffect(() => {
    const loadRankings = async () => {
      setIsLoading(true);
      try {
        const rankings = await fetchRankings();
        setRanking(rankings);
      } catch (error) {
        console.error('Failed to load rankings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRankings();
  }, []);

  const handleGameStart = useCallback((name: string) => {
    setPlayerName(name);
    setCurrentScore(0);
    setMemoryAnswer('');
    setGameState(GameState.PLAYING);
  }, []);

  const handleMemoryGame = useCallback((score: number, lastDistractor: string) => {
    setCurrentScore(score);
    setMemoryAnswer(lastDistractor);
    setGameState(GameState.MEMORY_GAME);
  }, []);

  const handleGameOver = useCallback(async (score: number) => {
    setCurrentScore(score);
    setGameState(GameState.GAME_OVER);

    // スコアを保存
    if (playerName && score > 0) {
      try {
        await saveScore(playerName, score);
        // ランキングを再読み込み
        const updatedRankings = await fetchRankings();
        setRanking(updatedRankings);
      } catch (error) {
        console.error('Failed to save score:', error);
      }
    }
  }, [playerName]);

  const handleRestart = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const renderScreen = () => {
    switch (gameState) {
      case GameState.PLAYING:
        return <GameScreen onGameOver={handleGameOver} onMemoryGame={handleMemoryGame} />;
      case GameState.MEMORY_GAME:
        return (
          <MemoryGameScreen 
            currentScore={currentScore}
            correctAnswer={memoryAnswer}
            onComplete={handleGameOver}
          />
        );
      case GameState.GAME_OVER:
        return (
          <GameOverScreen 
            ranking={ranking} 
            currentPlayer={{ name: playerName, score: currentScore }} 
            onRestart={handleRestart} 
          />
        );
      case GameState.START:
      default:
        return <StartScreen onStart={handleGameStart} ranking={ranking} isLoading={isLoading} />;
    }
  };

  return (
    <main className="bg-pink-100 min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        {renderScreen()}
      </div>
    </main>
  );
};

export default App;