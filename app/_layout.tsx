import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { toastConfig } from '../src/components/Toast';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { initializeUpdates } from '../src/utils/updates';
import '../global.css';

// Initialize i18n
import '../src/i18n';

/**
 * Root layout for the CleanCity app
 * Provides global providers and navigation structure
 */
export default function RootLayout() {
  // Initialize OTA updates on app start
  useEffect(() => {
    initializeUpdates();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(citizen)" />
            <Stack.Screen name="(worker)" />
          </Stack>
          <StatusBar style="auto" />
          <Toast config={toastConfig} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
