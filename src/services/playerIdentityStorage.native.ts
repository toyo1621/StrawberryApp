import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  createMigratingPlayerIdentityStorage,
  type PlayerIdentityStorage,
} from './playerIdentityStorageCore';

const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  keychainService: 'strawberry-player-identity',
};

const secureStorage: PlayerIdentityStorage = {
  getItem: (key) => SecureStore.getItemAsync(key, secureStoreOptions),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, secureStoreOptions),
  removeItem: (key) => SecureStore.deleteItemAsync(key, secureStoreOptions),
};

const legacyStorage: PlayerIdentityStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export default createMigratingPlayerIdentityStorage(secureStorage, legacyStorage);
