import React, { Suspense, lazy, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  Image,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { strawberryJuiceImage } from './assets/images/strawberryJuiceAsset';
import { GameState, GameMode, IslandRegion } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import StartScreen from './components/StartScreen';
import {
  deletePlayerRankingData,
  createRankingGameSession,
  fetchRankingsForModeWithStatus,
  saveScoreForMode,
} from './services/rankingService';
import type { RankingGameSession } from './services/rankingService';
import { clearPlayerName } from './services/playerService';
import { clearSettings, DEFAULT_SETTINGS } from './services/settingsService';
import type { AppSettings } from './services/settingsService';
import { createEmptyRankings } from './gameConfig';
import { useAppData } from './hooks/useAppData';
import { appStyles as styles } from './App.styles';

const GameScreen = lazy(() => import('./components/GameScreen'));
const IslandGameScreen = lazy(() => import('./components/IslandGameScreen'));
const FlagGameScreen = lazy(() => import('./components/FlagGameScreen'));
const ColorGameScreen = lazy(() => import('./components/ColorGameScreen'));
const MemoryGameScreen = lazy(() => import('./components/MemoryGameScreen'));
const MemoryGame2Screen = lazy(() => import('./components/MemoryGame2Screen'));
const GameOverScreen = lazy(() => import('./components/GameOverScreen'));
const RulesScreen = lazy(() => import('./components/RulesScreen'));
const MyPageScreen = lazy(() => import('./components/MyPageScreen'));
const PrivacyPolicyScreen = lazy(() => import('./components/PrivacyPolicyScreen'));
const TermsOfServiceScreen = lazy(() => import('./components/TermsOfServiceScreen'));
const SettingsScreen = lazy(() => import('./components/SettingsScreen'));

const App: React.FC = () => {
  const {
    playerName,
    setPlayerName,
    rankingsByMode,
    setRankingsByMode,
    isLoading,
    error,
    setError,
    notice,
    setNotice,
    settings,
    setSettings,
  } = useAppData();
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STRAWBERRY);
  const [islandRegion, setIslandRegion] = useState<IslandRegion>(IslandRegion.ALL);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [memoryAnswer, setMemoryAnswer] = useState<string>('');
  const [firstDistractor, setFirstDistractor] = useState<string>('');
  const [isSavingScore, setIsSavingScore] = useState<boolean>(false);
  const [isPreparingGame, setIsPreparingGame] = useState<boolean>(false);
  const [showStrawberryJuice, setShowStrawberryJuice] = useState(false);
  const juiceScale = useRef(new Animated.Value(0)).current;
  const juiceOpacity = useRef(new Animated.Value(0)).current;
  const gameStartedAtRef = useRef<number | null>(null);
  const gameplayDurationMsRef = useRef<number | null>(null);
  const gameSessionRef = useRef<RankingGameSession | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
    });
    return () => subscription.remove();
  }, []);

  const enterGame = useCallback((mode: GameMode) => {
    gameStartedAtRef.current = Date.now();
    gameplayDurationMsRef.current = null;
    if (mode === GameMode.STRAWBERRY) {
      setGameState(GameState.PLAYING);
    } else if (mode === GameMode.ISLAND) {
      setGameState(GameState.ISLAND_PLAYING);
    } else if (mode === GameMode.COLOR) {
      setGameState(GameState.COLOR_PLAYING);
    } else {
      setGameState(GameState.FLAG_PLAYING);
    }
  }, []);

  const prepareGameSession = useCallback(async (mode: GameMode, selectedIslandRegion: IslandRegion) => {
    try {
      return await createRankingGameSession(mode, selectedIslandRegion);
    } catch (sessionError) {
      console.warn('Starting an offline-only game after session creation failed.', sessionError);
      return null;
    }
  }, []);

  const handleGameStart = useCallback(async (name: string, mode: GameMode, selectedIslandRegion: IslandRegion) => {
    if (isPreparingGame) {return;}
    setIsPreparingGame(true);
    setPlayerName(name);
    setGameMode(mode);
    setIslandRegion(selectedIslandRegion);
    setCurrentScore(0);
    setMemoryAnswer('');
    setFirstDistractor('');
    const rankingRegion = mode === GameMode.ISLAND ? selectedIslandRegion : IslandRegion.ALL;
    try {
      gameSessionRef.current = await prepareGameSession(mode, rankingRegion);
      if (!gameSessionRef.current) {
        setNotice('オフラインで開始しました。このゲームのスコアは端末だけに保存されます。');
      }
      enterGame(mode);
    } finally {
      setIsPreparingGame(false);
    }
  }, [enterGame, isPreparingGame, prepareGameSession, setNotice, setPlayerName]);

  const handleMemoryGame = useCallback((score: number, lastDistractor: string, firstDistractor: string) => {
    gameplayDurationMsRef.current = Math.max(
      1_000,
      Date.now() - (gameStartedAtRef.current ?? Date.now()),
    );
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
    const durationMs = gameplayDurationMsRef.current ?? Math.max(
      1_000,
      Date.now() - (gameStartedAtRef.current ?? Date.now()),
    );

    // スコアを保存（モードに応じて）
    if (playerName && score > 0) {
      setIsSavingScore(true);
      setError(null);
      try {
        const rankingRegion = gameMode === GameMode.ISLAND ? islandRegion : IslandRegion.ALL;
        const result = await saveScoreForMode(gameMode, playerName, score, {
          durationMs,
          islandRegion: rankingRegion,
          gameSession: gameSessionRef.current,
        });
        const updatedRankings = await fetchRankingsForModeWithStatus(
          gameMode,
          undefined,
          rankingRegion,
        );
        setRankingsByMode((current) => ({ ...current, [gameMode]: updatedRankings.entries }));
        if (result.queuedForSync) {
          setNotice('通信できなかったため端末に保存しました。次回オンライン時に自動で同期します。');
        } else if (!result.verifiedForRanking) {
          setNotice('オフラインで開始したため、スコアは端末履歴だけに保存しました。');
        }
        if (updatedRankings.stale) {
          setNotice('通信できないため端末に保存したランキングを表示しています。');
        }
        if (result.droppedPendingScores > 0) {
          setError('端末の保存待ち上限を超えたため、最も古いスコアを送信待ちから除外しました。');
        }
      } catch (error) {
        console.error('Failed to save score:', error);
        setError('スコアの保存に失敗しました。ランキングは更新されませんでした。');
      } finally {
        gameSessionRef.current = null;
        gameStartedAtRef.current = null;
        gameplayDurationMsRef.current = null;
        setIsSavingScore(false);
      }
    } else {
      gameSessionRef.current = null;
      gameStartedAtRef.current = null;
      gameplayDurationMsRef.current = null;
    }
  }, [gameMode, islandRegion, playerName, setError, setNotice, setRankingsByMode]);

  const handleRestart = useCallback(() => {
    gameSessionRef.current = null;
    gameStartedAtRef.current = null;
    gameplayDurationMsRef.current = null;
    setGameState(GameState.START);
  }, []);

  const handlePlayAgain = useCallback(async () => {
    if (isPreparingGame) {return;}
    setIsPreparingGame(true);
    setCurrentScore(0);
    setMemoryAnswer('');
    setFirstDistractor('');
    const rankingRegion = gameMode === GameMode.ISLAND ? islandRegion : IslandRegion.ALL;
    try {
      gameSessionRef.current = await prepareGameSession(gameMode, rankingRegion);
      if (!gameSessionRef.current) {
        setNotice('オフラインで開始しました。このゲームのスコアは端末だけに保存されます。');
      }
      enterGame(gameMode);
    } finally {
      setIsPreparingGame(false);
    }
  }, [enterGame, gameMode, islandRegion, isPreparingGame, prepareGameSession, setNotice]);

  const handleShowRules = useCallback(() => {
    setGameState(GameState.RULES);
  }, []);

  const handleBackFromRules = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handleShowMyPage = useCallback(() => {
    setGameState(GameState.MY_PAGE);
  }, []);

  const handleBackFromMyPage = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handleShowPrivacyPolicy = useCallback(() => {
    setGameState(GameState.PRIVACY_POLICY);
  }, []);

  const handleBackFromPrivacyPolicy = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handleShowTermsOfService = useCallback(() => {
    setGameState(GameState.TERMS_OF_SERVICE);
  }, []);

  const handleBackFromTermsOfService = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handleShowSettings = useCallback(() => {
    setGameState(GameState.SETTINGS);
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handleSettingsChanged = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
  }, [setSettings]);

  const handleNameChanged = useCallback((name: string) => {
    setPlayerName(name);
  }, [setPlayerName]);

  const handleDeleteData = useCallback(async () => {
    const deleted = await deletePlayerRankingData();
    await Promise.all([clearPlayerName(), clearSettings()]);
    setPlayerName('');
    setSettings({ ...DEFAULT_SETTINGS });
    setRankingsByMode(createEmptyRankings());
    setError(null);
    setNotice(`${deleted}件の公開スコアと、この端末に保存したデータを削除しました。`);
    setGameState(GameState.START);
    return deleted;
  }, [setError, setNotice, setPlayerName, setRankingsByMode, setSettings]);

  const handleShowJuice = useCallback((show: boolean) => {
    setShowStrawberryJuice(show);
    if (show) {
      if (reduceMotionRef.current) {
        juiceScale.setValue(1);
        juiceOpacity.setValue(0.35);
        setTimeout(() => setShowStrawberryJuice(false), 250);
        return;
      }
      juiceScale.setValue(0);
      juiceOpacity.setValue(1);
      Animated.parallel([
        Animated.spring(juiceScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(juiceOpacity, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]).start((finished) => {
        if (finished) {
          setShowStrawberryJuice(false);
          juiceScale.setValue(0);
          juiceOpacity.setValue(0);
        }
      });
    }
  }, [juiceScale, juiceOpacity]);

  const renderScreen = () => {
    switch (gameState) {
      case GameState.PLAYING:
        return <GameScreen onGameOver={handleGameOver} onMemoryGame={handleMemoryGame} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onShowJuice={handleShowJuice} onBackToHome={handleRestart} />;
      case GameState.ISLAND_PLAYING:
        return <IslandGameScreen region={islandRegion} onGameOver={handleGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={handleRestart} />;
      case GameState.FLAG_PLAYING:
        return <FlagGameScreen onGameOver={handleGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={handleRestart} />;
      case GameState.COLOR_PLAYING:
        return <ColorGameScreen onGameOver={handleGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={handleRestart} />;
      case GameState.MEMORY_GAME:
        return (
          <MemoryGameScreen 
            currentScore={currentScore}
            correctAnswer={memoryAnswer}
            onComplete={handleMemoryGame2}
            darkMode={settings.darkMode}
          />
        );
      case GameState.MEMORY_GAME_2:
        return (
          <MemoryGame2Screen 
            currentScore={currentScore}
            correctAnswer={firstDistractor}
            onComplete={handleGameOver}
            darkMode={settings.darkMode}
          />
        );
      case GameState.GAME_OVER:
        return (
          <>
          <GameOverScreen 
            ranking={rankingsByMode[gameMode]}
            gameMode={gameMode}
            islandRegion={islandRegion}
            currentPlayer={{ name: playerName, score: currentScore }} 
            onPlayAgain={handlePlayAgain}
            onGoHome={handleRestart}
            error={error}
            onDismissError={() => setError(null)}
            darkMode={settings.darkMode}
            isPreparingGame={isPreparingGame}
            />
            {isSavingScore && (
              <View style={styles.savingOverlay}>
                <View style={styles.savingContainer}>
                  <ActivityIndicator accessibilityLabel="スコアを保存中" size="large" color="#be185d" />
                  <Text accessibilityLiveRegion="polite" style={styles.savingText}>スコアを保存中...</Text>
                </View>
              </View>
            )}
          </>
        );
      case GameState.START:
      default:
        return (
          <>
            <StartScreen 
              onStart={handleGameStart} 
              rankings={rankingsByMode}
              isLoading={isLoading} 
              onShowRules={handleShowRules} 
              onShowMyPage={handleShowMyPage}
              savedPlayerName={playerName}
              initialMode={gameMode}
              initialIslandRegion={islandRegion}
              error={error}
              onDismissError={() => setError(null)}
              notice={notice}
              onDismissNotice={() => setNotice(null)}
              darkMode={settings.darkMode}
              isPreparingGame={isPreparingGame}
            />
            {isSavingScore && (
              <View style={styles.savingOverlay}>
                <View style={styles.savingContainer}>
                  <ActivityIndicator accessibilityLabel="スコアを保存中" size="large" color="#be185d" />
                  <Text accessibilityLiveRegion="polite" style={styles.savingText}>スコアを保存中...</Text>
                </View>
              </View>
            )}
          </>
        );
      case GameState.RULES:
        return <RulesScreen onBack={handleBackFromRules} darkMode={settings.darkMode} />;
      case GameState.MY_PAGE:
        return (
          <MyPageScreen 
            onBack={handleBackFromMyPage} 
            onNameChanged={handleNameChanged}
            onShowSettings={handleShowSettings}
            onShowPrivacyPolicy={handleShowPrivacyPolicy}
            onShowTermsOfService={handleShowTermsOfService}
            onDeleteData={handleDeleteData}
            darkMode={settings.darkMode}
          />
        );
      case GameState.SETTINGS:
        return <SettingsScreen onBack={handleBackFromSettings} onSettingsChanged={handleSettingsChanged} darkMode={settings.darkMode} />;
      case GameState.PRIVACY_POLICY:
        return <PrivacyPolicyScreen onBack={handleBackFromPrivacyPolicy} darkMode={settings.darkMode} />;
      case GameState.TERMS_OF_SERVICE:
        return <TermsOfServiceScreen onBack={handleBackFromTermsOfService} darkMode={settings.darkMode} />;
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView role="main" style={[styles.container, settings.darkMode && styles.containerDark]} edges={['top', 'bottom']}>
        <StatusBar style={settings.darkMode ? "light" : "dark"} />
        <Suspense fallback={(
          <View style={styles.loadingScreen}>
            <ActivityIndicator
              accessibilityLabel="画面を読み込み中"
              size="large"
              color={settings.darkMode ? '#f9a8d4' : '#be185d'}
            />
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.loadingText, settings.darkMode && styles.loadingTextDark]}
            >
              画面を読み込み中...
            </Text>
          </View>
        )}>
          {renderScreen()}
        </Suspense>
        {/* いちご汁オーバーレイ（画面全体に表示） */}
        {showStrawberryJuice && (
          <Animated.View 
            style={[
              styles.juiceOverlay,
              {
                opacity: juiceOpacity,
                transform: [{ scale: juiceScale }],
              }
            ]}
          >
            <Image
              source={strawberryJuiceImage}
              style={styles.juiceImage}
              resizeMode="cover"
              accessible={false}
            />
          </Animated.View>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
};

export default App;
