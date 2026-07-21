import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYER_TOKEN_KEY = 'player_private_token_v1';
const PLAYER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createPlayerToken = async (): Promise<string> => {
  const nativeRandomUuid = globalThis.crypto?.randomUUID?.();
  if (nativeRandomUuid) {
    return nativeRandomUuid;
  }

  const Crypto = await import('expo-crypto');
  return Crypto.randomUUID();
};

export const getStoredPlayerToken = async (): Promise<string | null> => {
  const stored = await AsyncStorage.getItem(PLAYER_TOKEN_KEY);
  return stored && PLAYER_TOKEN_PATTERN.test(stored) ? stored : null;
};

export const getPlayerToken = async (): Promise<string> => {
  const stored = await getStoredPlayerToken();
  if (stored) {
    return stored;
  }

  const token = await createPlayerToken();
  await AsyncStorage.setItem(PLAYER_TOKEN_KEY, token);
  return token;
};

export const clearPlayerIdentity = async (): Promise<void> => {
  await AsyncStorage.removeItem(PLAYER_TOKEN_KEY);
};
