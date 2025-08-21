import React, { useState, useCallback, useEffect } from 'react';
import { GameState, RankingEntry, GameMode } from './types';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import IslandGameScreen from './components/IslandGameScreen';
import FlagGameScreen from './components/FlagGameScreen';
import SquareGameScreen from './components/SquareGameScreen';
import CubeGameScreen from './components/CubeGameScreen';
import MemoryGameScreen from './components/MemoryGameScreen';
import MemoryGame2Screen from './components/MemoryGame2Screen';
import GameOverScreen from './components/GameOverScreen';
import RulesScreen from './components/RulesScreen';
import { fetchRankings, saveScore, fetchIslandRankings, saveIslandScore, fetchFlagRankings, saveFlagScore, fetchSquareRankings, saveSquareScore, fetchCubeRankings, saveCubeScore } from './services/rankingService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STRAWBERRY);
  const [playerName, setPlayerName] = useState<string>('');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [islandRanking, setIslandRanking] = useState<RankingEntry[]>([]);
  const [flagRanking, setFlagRanking] = useState<RankingEntry[]>([]);
  const [squareRanking, setSquareRanking] = useState<RankingEntry[]>([]);
  const [cubeRanking, setCubeRanking] = useState<RankingEntry[]>([]);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [memoryAnswer, setMemoryAnswer] = useState<string>('');
  const [firstDistractor, setFirstDistractor] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ランキングを読み込み（両方のモード）
  useEffect(() => {
    const loadRankings = async () => {
      setIsLoading(true);
      try {
        const [strawberryRankings, islandRankings, flagRankings, squareRankings, cubeRankings] = await Promise.all([
          fetchRankings(),
          fetchIslandRankings(),
          fetchFlagRankings(),
          fetchSquareRankings(),
          fetchCubeRankings()
        ]);
        setRanking(strawberryRankings);
        setIslandRanking(islandRankings);
        setFlagRanking(flagRankings);
        setSquareRanking(squareRankings);
        setCubeRanking(cubeRankings);
      } catch (error) {
        console.error('Failed to load rankings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRankings();
  }, []);

  const handleGameStart = useCallback((name: string, mode: GameMode) => {
    setPlayerName(name);
    setGameMode(mode);
    setCurrentScore(0);
    setMemoryAnswer('');
    setFirstDistractor('');
    if (mode === GameMode.STRAWBERRY) {
      setGameState(GameState.PLAYING);
    } else if (mode === GameMode.ISLAND) {
      setGameState(GameState.ISLAND_PLAYING);
    } else if (mode === GameMode.FLAG) {
      setGameState(GameState.FLAG_PLAYING);
    } else if (mode === GameMode.SQUARE) {
      setGameState(GameState.SQUARE_PLAYING);
    } else {
      setGameState(GameState.CUBE_PLAYING);
    }
  }, []);

  const handleMemoryGame = useCallback((score: number, lastDistractor: string, firstDistractor: string) => {
    setCurrentScore(score);
    setMemoryAnswer(lastDistractor);
    setFirstDistractor(firstDistractor);
    setGameState(GameState.MEMORY_GAME);
  }, []);

  const handleMemoryGame2 = useCallback((score: number) => {
    setCurrentScore(score);
    setGameState(GameState.MEMORY_GAME_2);
  }, []);

  const handleGameOver = useCallback(async (score: number) => {
    setCurrentScore(score);
    setGameState(GameState.GAME_OVER);

    // スコアを保存（モードに応じて）
    if (playerName && score > 0) {
      try {
        if (gameMode === GameMode.STRAWBERRY) {
          await saveScore(playerName, score);
          const updatedRankings = await fetchRankings();
          setRanking(updatedRankings);
        } else if (gameMode === GameMode.ISLAND) {
          await saveIslandScore(playerName, score);
          const updatedIslandRankings = await fetchIslandRankings();
          setIslandRanking(updatedIslandRankings);
        } else if (gameMode === GameMode.FLAG) {
          await saveFlagScore(playerName, score);
          const updatedFlagRankings = await fetchFlagRankings();
          setFlagRanking(updatedFlagRankings);
        } else if (gameMode === GameMode.SQUARE) {
          await saveSquareScore(playerName, score);
          const updatedSquareRankings = await fetchSquareRankings();
          setSquareRanking(updatedSquareRankings);
        } else {
          await saveCubeScore(playerName, score);
          const updatedCubeRankings = await fetchCubeRankings();
          setCubeRanking(updatedCubeRankings);
        }
      } catch (error) {
        console.error('Failed to save score:', error);
      }
    }
  }, [playerName, gameMode]);

  const handleRestart = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handleShowRules = useCallback(() => {
    setGameState(GameState.RULES);
  }, []);

  const handleBackFromRules = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const renderScreen = () => {
    switch (gameState) {
      case GameState.PLAYING:
        return <GameScreen onGameOver={handleGameOver} onMemoryGame={handleMemoryGame} />;
      case GameState.ISLAND_PLAYING:
        return <IslandGameScreen onGameOver={handleGameOver} />;
      case GameState.FLAG_PLAYING:
        return <FlagGameScreen onGameOver={handleGameOver} />;
      case GameState.SQUARE_PLAYING:
        return <SquareGameScreen onGameOver={handleGameOver} />;
      case GameState.CUBE_PLAYING:
        return <CubeGameScreen onGameOver={handleGameOver} />;
      case GameState.MEMORY_GAME:
        return (
          <MemoryGameScreen 
            currentScore={currentScore}
            correctAnswer={memoryAnswer}
            onComplete={handleMemoryGame2}
          />
        );
      case GameState.MEMORY_GAME_2:
        return (
          <MemoryGame2Screen 
            currentScore={currentScore}
            correctAnswer={firstDistractor}
            onComplete={handleGameOver}
          />
        );
      case GameState.GAME_OVER:
        return (
          <GameOverScreen 
            ranking={
              gameMode === GameMode.STRAWBERRY ? ranking : 
              gameMode === GameMode.ISLAND ? islandRanking : 
              gameMode === GameMode.FLAG ? flagRanking :
              gameMode === GameMode.SQUARE ? squareRanking :
              cubeRanking
            }
            gameMode={gameMode}
            currentPlayer={{ name: playerName, score: currentScore }} 
            onRestart={handleRestart} 
          />
        );
      case GameState.START:
      default:
        return <StartScreen onStart={handleGameStart} ranking={ranking} islandRanking={islandRanking} flagRanking={flagRanking} squareRanking={squareRanking} cubeRanking={cubeRanking} isLoading={isLoading} onShowRules={handleShowRules} />;
      case GameState.RULES:
        return <RulesScreen onBack={handleBackFromRules} />;
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