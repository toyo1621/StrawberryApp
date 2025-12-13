import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { strawberryJuiceImage } from './assets/images/strawberryJuiceAsset';
import { GameState, RankingEntry, GameMode } from './types';
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
import { fetchRankings, saveScore, fetchIslandRankings, saveIslandScore, fetchFlagRankings, saveFlagScore, fetchColorRankings, saveColorScore } from './services/rankingService';
import { loadPlayerName } from './services/playerService';
import { loadSettings, AppSettings } from './services/settingsService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.STRAWBERRY);
  const [playerName, setPlayerName] = useState<string>('');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [islandRanking, setIslandRanking] = useState<RankingEntry[]>([]);
  const [flagRanking, setFlagRanking] = useState<RankingEntry[]>([]);
  const [colorRanking, setColorRanking] = useState<RankingEntry[]>([]);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [memoryAnswer, setMemoryAnswer] = useState<string>('');
  const [firstDistractor, setFirstDistractor] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingScore, setIsSavingScore] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: false,
    hapticsEnabled: true,
  });
  const [showStrawberryJuice, setShowStrawberryJuice] = useState(false);
  const juiceScale = useRef(new Animated.Value(0)).current;
  const juiceOpacity = useRef(new Animated.Value(0)).current;

  // ランキングとプレイヤー名、設定を読み込み
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // いちご汁画像がバンドルされていることを確認
        console.log('Strawberry juice image loaded:', strawberryJuiceImage);

        // いちご汁画像をプリロード（Webではスキップ）
        if (Platform.OS !== 'web') {
          try {
            const imageSource = Image.resolveAssetSource(strawberryJuiceImage);
            if (imageSource?.uri) {
              Image.prefetch(imageSource.uri)
                .then(() => {
                  console.log('いちご汁画像のプリロード完了');
                })
                .catch((error) => {
                  console.error('いちご汁画像のプリロードエラー:', error);
                });
            }
          } catch (error) {
            console.error('いちご汁画像の解決エラー:', error);
          }
        }

        // loadPlayerNameとloadSettingsを一時的にコメントアウト
        const [strawberryRankings, islandRankings, flagRankings, colorRankings, savedName, appSettings] = await Promise.all([
          fetchRankings(),
          fetchIslandRankings(),
          fetchFlagRankings(),
          fetchColorRankings(),
          loadPlayerName(),
          loadSettings()
        ]);
        setRanking(strawberryRankings);
        setIslandRanking(islandRankings);
        setFlagRanking(flagRankings);
        setColorRanking(colorRankings);
        if (savedName) {
          setPlayerName(savedName);
        }
        setSettings(appSettings);
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
      setIsSavingScore(true);
      setError(null);
      try {
        if (gameMode === GameMode.STRAWBERRY) {
          await saveScore(playerName, score);
          const updatedRankings = await fetchRankings();
          setRanking(updatedRankings);
        } else if (gameMode === GameMode.ISLAND) {
          await saveIslandScore(playerName, score);
          const updatedIslandRankings = await fetchIslandRankings();
          setIslandRanking(updatedIslandRankings);
        } else if (gameMode === GameMode.COLOR) {
          await saveColorScore(playerName, score);
          const updatedColorRankings = await fetchColorRankings();
          setColorRanking(updatedColorRankings);
        } else {
          await saveFlagScore(playerName, score);
          const updatedFlagRankings = await fetchFlagRankings();
          setFlagRanking(updatedFlagRankings);
        }
      } catch (error) {
        console.error('Failed to save score:', error);
        setError('スコアの保存に失敗しました。ランキングは更新されませんでした。');
      } finally {
        setIsSavingScore(false);
      }
    }
  }, [playerName, gameMode]);

  const handleRestart = useCallback(() => {
    setGameState(GameState.START);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setCurrentScore(0);
    setMemoryAnswer('');
    setFirstDistractor('');
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

  const handleShowJuice = useCallback((show: boolean) => {
    setShowStrawberryJuice(show);
    if (show) {
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
          <>
          <GameOverScreen 
            ranking={
              gameMode === GameMode.STRAWBERRY ? ranking : 
              gameMode === GameMode.ISLAND ? islandRanking : 
              gameMode === GameMode.COLOR ? colorRanking :
              flagRanking
            }
            gameMode={gameMode}
            currentPlayer={{ name: playerName, score: currentScore }} 
            onPlayAgain={handlePlayAgain}
            onGoHome={handleRestart}
            error={error}
            onDismissError={() => setError(null)}
            />
            {isSavingScore && (
              <View style={styles.savingOverlay}>
                <View style={styles.savingContainer}>
                  <ActivityIndicator size="large" color="#ec4899" />
                  <Text style={styles.savingText}>スコアを保存中...</Text>
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
              ranking={ranking} 
              islandRanking={islandRanking} 
              flagRanking={flagRanking}
              colorRanking={colorRanking}
              isLoading={isLoading} 
              onShowRules={handleShowRules} 
              onShowMyPage={handleShowMyPage}
              savedPlayerName={playerName}
              error={error}
              onDismissError={() => setError(null)}
              darkMode={settings.darkMode}
            />
            {isSavingScore && (
              <View style={styles.savingOverlay}>
                <View style={styles.savingContainer}>
                  <ActivityIndicator size="large" color="#ec4899" />
                  <Text style={styles.savingText}>スコアを保存中...</Text>
                </View>
              </View>
            )}
          </>
        );
      case GameState.RULES:
        return <RulesScreen onBack={handleBackFromRules} />;
      case GameState.MY_PAGE:
        return (
          <MyPageScreen 
            onBack={handleBackFromMyPage} 
            onNameChanged={handleNameChanged}
            onShowSettings={handleShowSettings}
            onShowPrivacyPolicy={handleShowPrivacyPolicy}
            onShowTermsOfService={handleShowTermsOfService}
          />
        );
      case GameState.SETTINGS:
        return <SettingsScreen onBack={handleBackFromSettings} onSettingsChanged={handleSettingsChanged} darkMode={settings.darkMode} />;
      case GameState.PRIVACY_POLICY:
        return <PrivacyPolicyScreen onBack={handleBackFromPrivacyPolicy} />;
      case GameState.TERMS_OF_SERVICE:
        return <TermsOfServiceScreen onBack={handleBackFromTermsOfService} />;
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={[styles.container, settings.darkMode && styles.containerDark]} edges={['top', 'bottom']}>
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
              onError={(error) => {
                console.error('画像の読み込みエラー:', error);
              }}
              onLoad={() => {
                console.log('画像読み込み成功');
              }}
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
    borderRadius: 16,
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