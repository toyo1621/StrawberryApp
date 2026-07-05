import { registerRootComponent } from 'expo';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

// App.tsx全体を復元
registerRootComponent(() => (
  <SafeAreaProvider>
    <App />
  </SafeAreaProvider>
));