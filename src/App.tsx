import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Image, Animated, AccessibilityInfo } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { strawberryJuiceImage } from './assets/images/strawberryJuiceAsset';
import { GameState, GameMode, RankingsByMode } from './types';
import ErrorBoundary from './components/ErrorBoundary';
import StartScreen from './components/StartScreen';
import GameScreen from './components/GameScreen';
import IslandGameScreen from './components/IslandGameScreen';
import FlagGameScreen from './components/FlagGameScreen';
import ColorGameScreen from './components/ColorGameScreen';
import MemoryGameScreen from './components/MemoryGameScreen';
import MemoryGame2Screen from './components/MemoryGame2Screen';
import GameOverScreen from './components/GameOverScreen';
import RulesScreen from './components/RulesScreen';
import MyPageScreen from './components/MyPageScreen';
import PrivacyPolicyScreen from './components/PrivacyPolicyScreen';
import TermsOfServiceScreen from './components/TermsOfServiceScreen';
import SettingsScreen from './components/SettingsScreen';
import {
  deletePlayerRankingData,
  fetchAllRankingsWithStatus,
  fetchRankingsForModeWithStatus,
  saveScoreForMode,
  syncPendingScores,
} from './services/rankingService';
import { clearPlayerName, loadPlayerName } from './services/playerService';
import { clearSettings, DEFAULT_SETTINGS, loadSettings, AppSettings } from './services/settingsService';
import { createEmptyRankings } from './gameConfig';

const prefetchStrawberryJuiceImage = () => {
  try {
    const assetSource = Image.resolveAssetSource?.(strawberryJuiceImage);

    if (!assetSource?.uri) {
      return;
    }

    Image.prefetch(assetSource.uri).catch(() => undefined);
  } catch (error) {
    console.warn('Failed to preload the strawberry effect image.', error);
  }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STRAWBERRY);
  const [playerName, setPlayerName] = useState<string>('');
  const [rankingsByMode, setRankingsByMode] = useState<RankingsByMode>(createEmptyRankings);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [memoryAnswer, setMemoryAnswer] = useState<string>('');
  const [firstDistractor, setFirstDistractor] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSavingScore, setIsSavingScore] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
    hapticsEnabled: true,
  });
  const [showStrawberryJuice, setShowStrawberryJuice] = useState(false);
  const juiceScale = useRef(new Animated.Value(0)).current;
  const juiceOpacity = useRef(new Animated.Value(0)).current;
  const gameStartedAtRef = useRef<number | null>(null);
  const gameplayDurationMsRef = useRef<number | null>(null);
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

  // ランキングとプレイヤー名、設定を読み込み
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // いちご汁画像をプリロード
        prefetchStrawberryJuiceImage();

        const [rankingsResult, nameResult, settingsResult, syncResult] = await Promise.allSettled([
          fetchAllRankingsWithStatus(),
          loadPlayerName(),
          loadSettings(),
          syncPendingScores(),
        ]);
        const errors: string[] = [];
        const notices: string[] = [];

        let rankingState = rankingsResult.status === 'fulfilled'
          ? rankingsResult.value
          : { rankings: createEmptyRankings(), staleModes: [], failedModes: [...Object.values(GameMode)] };
        if (rankingsResult.status === 'rejected') {
          console.error('Failed to load rankings:', rankingsResult.reason);
          errors.push('ランキングを読み込めませんでした。オフラインでプレイできます。');
        }

        if (nameResult.status === 'fulfilled') {
          setPlayerName(nameResult.value);
        } else {
          console.error('Failed to load the player name:', nameResult.reason);
          errors.push('保存済みのプレイヤー名を読み込めませんでした。');
        }

        if (settingsResult.status === 'fulfilled') {
          setSettings(settingsResult.value);
        } else {
          console.error('Failed to load settings:', settingsResult.reason);
          errors.push('設定を読み込めなかったため初期設定を使用します。');
        }

        if (syncResult.status === 'fulfilled') {
          if (syncResult.value.synced > 0) {
            notices.push(`${syncResult.value.synced}件のオフラインスコアをランキングへ同期しました。`);
            try {
              rankingState = await fetchAllRankingsWithStatus();
            } catch (refreshError) {
              console.error('Failed to refresh rankings after sync:', refreshError);
              errors.push('同期後のランキング更新に失敗しました。');
            }
          }
          if (syncResult.value.discarded > 0) {
            errors.push(`${syncResult.value.discarded}件の保存待ちスコアは無効だったため送信できませんでした。`);
          }
        } else {
          console.error('Failed to sync pending scores:', syncResult.reason);
          errors.push('保存待ちスコアを同期できませんでした。次回起動時に再試行します。');
        }

        setRankingsByMode(rankingState.rankings);
        if (rankingState.staleModes.length > 0) {
          notices.push('通信できないモードは端末に保存したランキングを表示しています。');
        }
        if (rankingState.failedModes.length > 0) {
          errors.push('一部モードのランキングを読み込めませんでした。ゲームはプレイできます。');
        }
        setNotice(notices.length > 0 ? notices.join('\n') : null);
        setError(errors.length > 0 ? errors.join('\n') : null);
      } catch (error) {
        console.error('Failed to load data:', error);
        setError('ランキングの読み込みに失敗しました。オフラインでプレイできます。');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleGameStart = useCallback((name: string, mode: GameMode) => {
    setPlayerName(name);
    setGameMode(mode);
    setCurrentScore(0);
    setMemoryAnswer('');
    setFirstDistractor('');
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
        const result = await saveScoreForMode(gameMode, playerName, score, { durationMs });
        const updatedRankings = await fetchRankingsForModeWithStatus(gameMode);
        setRankingsByMode((current) => ({ ...current, [gameMode]: updatedRankings.entries }));
        if (result.queuedForSync) {
          setNotice('通信できなかったため端末に保存しました。次回オンライン時に自動で同期します。');
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
        gameStartedAtRef.current = null;
        gameplayDurationMsRef.current = null;
        setIsSavingScore(false);
      }
    } else {
      gameStartedAtRef.current = null;
      gameplayDurationMsRef.current = null;
    }
  }, [playerName, gameMode]);

  const handleRestart = useCallback(() => {
    gameStartedAtRef.current = null;
    gameplayDurationMsRef.current = null;
    setGameState(GameState.START);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setCurrentScore(0);
    setMemoryAnswer('');
    setFirstDistractor('');
    gameStartedAtRef.current = Date.now();
    gameplayDurationMsRef.current = null;
    if (gameMode === GameMode.STRAWBERRY) {
      setGameState(GameState.PLAYING);
    } else if (gameMode === GameMode.ISLAND) {
      setGameState(GameState.ISLAND_PLAYING);
    } else if (gameMode === GameMode.COLOR) {
      setGameState(GameState.COLOR_PLAYING);
    } else {
      setGameState(GameState.FLAG_PLAYING);
    }
  }, [gameMode]);

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
  }, []);

  const handleNameChanged = useCallback((name: string) => {
    setPlayerName(name);
  }, []);

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
  }, []);

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
        return <IslandGameScreen onGameOver={handleGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={handleRestart} />;
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
            currentPlayer={{ name: playerName, score: currentScore }} 
            onPlayAgain={handlePlayAgain}
            onGoHome={handleRestart}
            error={error}
            onDismissError={() => setError(null)}
            darkMode={settings.darkMode}
            />
            {isSavingScore && (
              <View style={styles.savingOverlay}>
                <View style={styles.savingContainer}>
                  <ActivityIndicator size="large" color="#be185d" />
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
              error={error}
              onDismissError={() => setError(null)}
              notice={notice}
              onDismissNotice={() => setNotice(null)}
              darkMode={settings.darkMode}
            />
            {isSavingScore && (
              <View style={styles.savingOverlay}>
                <View style={styles.savingContainer}>
                  <ActivityIndicator size="large" color="#be185d" />
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
        {renderScreen()}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fce7f3', // bg-pink-100
  },
  containerDark: {
    backgroundColor: '#1f2937', // dark gray
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  savingContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  savingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  juiceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: 'none',
    width: '100%',
    height: '100%',
  },
  juiceImage: {
    width: '100%',
    height: '100%',
  },
});

export default App;
