import React, { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import {
  Image,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { strawberryJuiceImage } from './assets/images/strawberryJuiceAsset';
import { GameState, GameMode, IslandRegion } from './types';
import { getLeaderboardEntries } from './domain/rankings';
import ErrorBoundary from './components/ErrorBoundary';
import AppScreenRouter, { AppLoadingFallback } from './components/AppScreenRouter';
import {
  deletePlayerRankingData,
  createRankingGameSession,
  discardPendingRankingScores,
} from './services/rankingService';
import type { RankingGameSession } from './services/rankingService';
import { clearPlayerName } from './services/playerService';
import { clearSettings, DEFAULT_SETTINGS } from './services/settingsService';
import type { AppSettings } from './services/settingsService';
import { createEmptyRankings } from './gameConfig';
import { useAppData } from './hooks/useAppData';
import { useScreenAnnouncement } from './hooks/useScreenAnnouncement';
import { useHardwareBackNavigation } from './hooks/useHardwareBackNavigation';
import { saveGameResult } from './services/gameResultService';
import { appStyles as styles } from './App.styles';

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
  const currentResultIdRef = useRef<string | null>(null);
  const reduceMotionRef = useRef(false);
  useScreenAnnouncement(gameState);

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
    currentResultIdRef.current = null;
    setMemoryAnswer('');
    setFirstDistractor('');
    setError(null);
    setNotice(null);
    const rankingRegion = mode === GameMode.ISLAND ? selectedIslandRegion : IslandRegion.ALL;
    try {
      gameSessionRef.current = settings.onlineRankingsEnabled
        ? await prepareGameSession(mode, rankingRegion)
        : null;
      if (!settings.onlineRankingsEnabled) {
        setNotice('オンラインランキングはオフです。このゲームのスコアは端末だけに保存されます。');
      } else if (!gameSessionRef.current) {
        setNotice('オフラインで開始しました。このゲームのスコアは端末だけに保存されます。');
      }
      enterGame(mode);
    } finally {
      setIsPreparingGame(false);
    }
  }, [enterGame, isPreparingGame, prepareGameSession, setError, setNotice, setPlayerName, settings.onlineRankingsEnabled]);

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

    if (playerName && score > 0) {
      setIsSavingScore(true);
      setError(null);
      try {
        const result = await saveGameResult({
          gameMode,
          islandRegion,
          playerName,
          score,
          durationMs,
          gameSession: gameSessionRef.current,
          onlineRankingsEnabled: settings.onlineRankingsEnabled,
        });
        currentResultIdRef.current = result.entry.id;
        if (result.rankings) {
          setRankingsByMode((current) => ({ ...current, [gameMode]: result.rankings ?? [] }));
        } else {
          setRankingsByMode((current) => ({
            ...current,
            [gameMode]: getLeaderboardEntries([
              ...current[gameMode],
              result.entry,
            ]),
          }));
        }
        setNotice(result.notice);
        setError(result.warning);
      } catch (saveError) {
        console.error('Failed to save score:', saveError);
        setError('スコアを保存できませんでした。端末の空き容量と通信状態を確認してください。');
      } finally {
        gameSessionRef.current = null;
        gameStartedAtRef.current = null;
        gameplayDurationMsRef.current = null;
        setIsSavingScore(false);
      }
    } else {
      if (score === 0) {
        setNotice('0点のためランキングには送信されませんでした。');
      }
      gameSessionRef.current = null;
      gameStartedAtRef.current = null;
      gameplayDurationMsRef.current = null;
    }
  }, [gameMode, islandRegion, playerName, setError, setNotice, setRankingsByMode, settings.onlineRankingsEnabled]);

  const handleRestart = useCallback(() => {
    gameSessionRef.current = null;
    gameStartedAtRef.current = null;
    gameplayDurationMsRef.current = null;
    currentResultIdRef.current = null;
    setGameState(GameState.START);
  }, []);
  const handleHardwareBack = useCallback((destination: GameState) => {
    if (destination === GameState.START) {handleRestart();} else {setGameState(destination);}
  }, [handleRestart]);
  useHardwareBackNavigation(gameState, handleHardwareBack);

  const handlePlayAgain = useCallback(async () => {
    if (isPreparingGame) {return;}
    setIsPreparingGame(true);
    setCurrentScore(0);
    currentResultIdRef.current = null;
    setMemoryAnswer('');
    setFirstDistractor('');
    setError(null);
    setNotice(null);
    const rankingRegion = gameMode === GameMode.ISLAND ? islandRegion : IslandRegion.ALL;
    try {
      gameSessionRef.current = settings.onlineRankingsEnabled
        ? await prepareGameSession(gameMode, rankingRegion)
        : null;
      if (!settings.onlineRankingsEnabled) {
        setNotice('オンラインランキングはオフです。このゲームのスコアは端末だけに保存されます。');
      } else if (!gameSessionRef.current) {
        setNotice('オフラインで開始しました。このゲームのスコアは端末だけに保存されます。');
      }
      enterGame(gameMode);
    } finally {
      setIsPreparingGame(false);
    }
  }, [enterGame, gameMode, islandRegion, isPreparingGame, prepareGameSession, setError, setNotice, settings.onlineRankingsEnabled]);

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
    setGameState(GameState.MY_PAGE);
  }, []);

  const handleShowTermsOfService = useCallback(() => {
    setGameState(GameState.TERMS_OF_SERVICE);
  }, []);

  const handleBackFromTermsOfService = useCallback(() => {
    setGameState(GameState.MY_PAGE);
  }, []);

  const handleShowSettings = useCallback(() => {
    setGameState(GameState.SETTINGS);
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setGameState(GameState.MY_PAGE);
  }, []);

  const handleSettingsChanged = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (!newSettings.onlineRankingsEnabled) {
      gameSessionRef.current = null;
      const discarded = await discardPendingRankingScores();
      if (discarded > 0) {
        setNotice(`${discarded}件の公開送信待ちを解除しました。端末履歴は残ります。`);
      }
    }
  }, [setNotice, setSettings]);

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

  return (
    <ErrorBoundary>
      <SafeAreaView role="main" style={[styles.container, settings.darkMode && styles.containerDark]} edges={['top', 'bottom']}>
        <StatusBar style={settings.darkMode ? "light" : "dark"} />
        <Suspense fallback={<AppLoadingFallback darkMode={settings.darkMode} />}>
          <AppScreenRouter
            gameState={gameState}
            gameMode={gameMode}
            islandRegion={islandRegion}
            currentScore={currentScore}
            memoryAnswer={memoryAnswer}
            firstDistractor={firstDistractor}
            rankingsByMode={rankingsByMode}
            currentResultId={currentResultIdRef.current}
            playerName={playerName}
            error={error}
            notice={notice}
            settings={settings}
            isLoading={isLoading}
            isPreparingGame={isPreparingGame}
            isSavingScore={isSavingScore}
            onGameStart={handleGameStart}
            onGameOver={handleGameOver}
            onMemoryGame={handleMemoryGame}
            onMemoryGame2={handleMemoryGame2}
            onShowJuice={handleShowJuice}
            onRestart={handleRestart}
            onPlayAgain={handlePlayAgain}
            onShowRules={handleShowRules}
            onBackFromRules={handleBackFromRules}
            onShowMyPage={handleShowMyPage}
            onBackFromMyPage={handleBackFromMyPage}
            onNameChanged={handleNameChanged}
            onShowSettings={handleShowSettings}
            onBackFromSettings={handleBackFromSettings}
            onSettingsChanged={handleSettingsChanged}
            onShowPrivacyPolicy={handleShowPrivacyPolicy}
            onBackFromPrivacyPolicy={handleBackFromPrivacyPolicy}
            onShowTermsOfService={handleShowTermsOfService}
            onBackFromTermsOfService={handleBackFromTermsOfService}
            onDeleteData={handleDeleteData}
            onDismissError={() => setError(null)}
            onDismissNotice={() => setNotice(null)}
          />
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
