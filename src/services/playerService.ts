import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYER_NAME_KEY = 'player_name';

export const savePlayerName = async (name: string): Promise<void> => {
  await AsyncStorage.setItem(PLAYER_NAME_KEY, name);
};

export const loadPlayerName = async (): Promise<string> => {
  const name = await AsyncStorage.getItem(PLAYER_NAME_KEY);
  return name || '';
};

export const clearPlayerName = async (): Promise<void> => {
  await AsyncStorage.removeItem(PLAYER_NAME_KEY);
};
