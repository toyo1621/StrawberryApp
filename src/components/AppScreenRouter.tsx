import React, { lazy } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { AppSettings } from '../services/settingsService';
import {
  GameMode,
  GameState,
  IslandRegion,
  type RankingsByMode,
} from '../types';
import { appStyles as styles } from '../App.styles';
import StartScreen from './StartScreen';

const GameScreen = lazy(() => import('./GameScreen'));
const IslandGameScreen = lazy(() => import('./IslandGameScreen'));
const FlagGameScreen = lazy(() => import('./FlagGameScreen'));
const ColorGameScreen = lazy(() => import('./ColorGameScreen'));
const MemoryGameScreen = lazy(() => import('./MemoryGameScreen'));
const MemoryGame2Screen = lazy(() => import('./MemoryGame2Screen'));
const GameOverScreen = lazy(() => import('./GameOverScreen'));
const RulesScreen = lazy(() => import('./RulesScreen'));
const MyPageScreen = lazy(() => import('./MyPageScreen'));
const PrivacyPolicyScreen = lazy(() => import('./PrivacyPolicyScreen'));
const TermsOfServiceScreen = lazy(() => import('./TermsOfServiceScreen'));
const SettingsScreen = lazy(() => import('./SettingsScreen'));

type AppScreenRouterProps = {
  gameState: GameState;
  gameMode: GameMode;
  islandRegion: IslandRegion;
  currentScore: number;
  memoryAnswer: string;
  firstDistractor: string;
  rankingsByMode: RankingsByMode;
  currentResultId: string | null;
  playerName: string;
  error: string | null;
  notice: string | null;
  settings: AppSettings;
  isLoading: boolean;
  isPreparingGame: boolean;
  isSavingScore: boolean;
  onGameStart: (name: string, mode: GameMode, region: IslandRegion) => void;
  onGameOver: (score: number) => void;
  onMemoryGame: (score: number, lastDistractor: string, firstDistractor: string) => void;
  onMemoryGame2: (score: number) => void;
  onShowJuice: (show: boolean) => void;
  onRestart: () => void;
  onPlayAgain: () => void;
  onShowRules: () => void;
  onBackFromRules: () => void;
  onShowMyPage: () => void;
  onBackFromMyPage: () => void;
  onNameChanged: (name: string) => void;
  onShowSettings: () => void;
  onBackFromSettings: () => void;
  onSettingsChanged: (settings: AppSettings) => void;
  onShowPrivacyPolicy: () => void;
  onBackFromPrivacyPolicy: () => void;
  onShowTermsOfService: () => void;
  onBackFromTermsOfService: () => void;
  onDeleteData: () => Promise<number>;
  onDismissError: () => void;
  onDismissNotice: () => void;
};

const SavingOverlay = () => (
  <View style={styles.savingOverlay} accessibilityViewIsModal>
    <View style={styles.savingContainer}>
      <ActivityIndicator accessibilityLabel="スコアを保存中" size="large" color="#be185d" />
      <Text accessibilityLiveRegion="polite" style={styles.savingText}>スコアを保存中...</Text>
    </View>
  </View>
);

export const AppLoadingFallback = ({ darkMode }: { darkMode: boolean }) => (
  <View style={styles.loadingScreen} accessibilityViewIsModal>
    <ActivityIndicator
      accessibilityLabel="画面を読み込み中"
      size="large"
      color={darkMode ? '#f9a8d4' : '#be185d'}
    />
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.loadingText, darkMode && styles.loadingTextDark]}
    >
      画面を読み込み中...
    </Text>
  </View>
);

const AppScreenRouter: React.FC<AppScreenRouterProps> = (props) => {
  const {
    gameState,
    gameMode,
    islandRegion,
    currentScore,
    memoryAnswer,
    firstDistractor,
    rankingsByMode,
    currentResultId,
    playerName,
    error,
    notice,
    settings,
    isLoading,
    isPreparingGame,
    isSavingScore,
  } = props;

  switch (gameState) {
    case GameState.PLAYING:
      return <GameScreen onGameOver={props.onGameOver} onMemoryGame={props.onMemoryGame} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onShowJuice={props.onShowJuice} onBackToHome={props.onRestart} />;
    case GameState.ISLAND_PLAYING:
      return <IslandGameScreen region={islandRegion} onGameOver={props.onGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={props.onRestart} />;
    case GameState.FLAG_PLAYING:
      return <FlagGameScreen onGameOver={props.onGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={props.onRestart} />;
    case GameState.COLOR_PLAYING:
      return <ColorGameScreen onGameOver={props.onGameOver} hapticsEnabled={settings.hapticsEnabled} darkMode={settings.darkMode} onBackToHome={props.onRestart} />;
    case GameState.MEMORY_GAME:
      return <MemoryGameScreen currentScore={currentScore} correctAnswer={memoryAnswer} onComplete={props.onMemoryGame2} darkMode={settings.darkMode} />;
    case GameState.MEMORY_GAME_2:
      return <MemoryGame2Screen currentScore={currentScore} correctAnswer={firstDistractor} onComplete={props.onGameOver} darkMode={settings.darkMode} />;
    case GameState.GAME_OVER:
      return (
        <>
          <GameOverScreen
            ranking={rankingsByMode[gameMode]}
            gameMode={gameMode}
            islandRegion={islandRegion}
            currentPlayer={{ id: currentResultId, name: playerName, score: currentScore }}
            onPlayAgain={props.onPlayAgain}
            onGoHome={props.onRestart}
            error={error}
            onDismissError={props.onDismissError}
            notice={notice}
            onDismissNotice={props.onDismissNotice}
            darkMode={settings.darkMode}
            isPreparingGame={isPreparingGame}
            isSavingScore={isSavingScore}
          />
          {isSavingScore && <SavingOverlay />}
        </>
      );
    case GameState.RULES:
      return <RulesScreen onBack={props.onBackFromRules} darkMode={settings.darkMode} />;
    case GameState.MY_PAGE:
      return (
        <MyPageScreen
          onBack={props.onBackFromMyPage}
          onNameChanged={props.onNameChanged}
          onShowSettings={props.onShowSettings}
          onShowPrivacyPolicy={props.onShowPrivacyPolicy}
          onShowTermsOfService={props.onShowTermsOfService}
          onDeleteData={props.onDeleteData}
          darkMode={settings.darkMode}
        />
      );
    case GameState.SETTINGS:
      return <SettingsScreen onBack={props.onBackFromSettings} onSettingsChanged={props.onSettingsChanged} darkMode={settings.darkMode} />;
    case GameState.PRIVACY_POLICY:
      return <PrivacyPolicyScreen onBack={props.onBackFromPrivacyPolicy} darkMode={settings.darkMode} />;
    case GameState.TERMS_OF_SERVICE:
      return <TermsOfServiceScreen onBack={props.onBackFromTermsOfService} darkMode={settings.darkMode} />;
    case GameState.START:
    default:
      return (
        <>
          <StartScreen
            onStart={props.onGameStart}
            rankings={rankingsByMode}
            isLoading={isLoading}
            onShowRules={props.onShowRules}
            onShowMyPage={props.onShowMyPage}
            savedPlayerName={playerName}
            initialMode={gameMode}
            initialIslandRegion={islandRegion}
            error={error}
            onDismissError={props.onDismissError}
            notice={notice}
            onDismissNotice={props.onDismissNotice}
            darkMode={settings.darkMode}
            isPreparingGame={isPreparingGame}
            onlineRankingsEnabled={settings.onlineRankingsEnabled}
          />
          {isSavingScore && <SavingOverlay />}
        </>
      );
  }
};

export default AppScreenRouter;
