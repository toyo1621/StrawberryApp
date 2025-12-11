import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import ErrorBoundary from './components/ErrorBoundary';
import { GameState, GameMode, RankingEntry } from './types';
import { fetchRankings } from './services/rankingService';
import StartScreen from './components/StartScreen';

const AppMinimal: React.FC = () => {
  const [ranking, setRanking] = React.useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadRankings = async () => {
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

  const handleStart = (name: string, mode: GameMode) => {
    console.log('Game start:', name, mode);
  };

  const handleShowRules = () => {
    console.log('Show rules');
  };

  const handleShowMyPage = () => {
    console.log('Show my page');
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <Text style={styles.text}>App Minimal - StartScreen追加</Text>
        <StartScreen
          onStart={handleStart}
          ranking={ranking}
          islandRanking={[]}
          flagRanking={[]}
          isLoading={isLoading}
          onShowRules={handleShowRules}
          onShowMyPage={handleShowMyPage}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fce7f3',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 16,
    marginTop: 5,
  },
});

export default AppMinimal;
