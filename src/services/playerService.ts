import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYER_NAME_KEY = 'player_name';

export const savePlayerName = async (name: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(PLAYER_NAME_KEY, name);
  } catch (error) {
    console.error('Failed to save player name:', error);
  }
};

export const loadPlayerName = async (): Promise<string> => {
  try {
    const name = await AsyncStorage.getItem(PLAYER_NAME_KEY);
    return name || '';
  } catch (error) {
    console.error('Failed to load player name:', error);
    return '';
  }
};

