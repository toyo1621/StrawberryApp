import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlayerIdentityStorage } from './playerIdentityStorageCore';

const playerIdentityStorage: PlayerIdentityStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export default playerIdentityStorage;
