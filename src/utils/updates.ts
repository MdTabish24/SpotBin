/**
 * OTA Updates utility for CleanCity
 * Handles checking and applying updates from Expo Update Service
 */

import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

/**
 * Check if updates are available and prompt user to update
 */
export async function checkForUpdates(): Promise<void> {
  // Skip in development
  if (__DEV__) {
    console.log('[Updates] Skipping update check in development mode');
    return;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      console.log('[Updates] Update available, downloading...');
      await fetchAndApplyUpdate();
    } else {
      console.log('[Updates] App is up to date');
    }
  } catch (error) {
    console.error('[Updates] Error checking for updates:', error);
  }
}

/**
 * Fetch and apply update with user confirmation
 */
export async function fetchAndApplyUpdate(): Promise<void> {
  try {
    const result = await Updates.fetchUpdateAsync();
    
    if (result.isNew) {
      Alert.alert(
        'Update Available',
        'A new version of CleanCity is available. Would you like to restart the app to apply the update?',
        [
          {
            text: 'Later',
            style: 'cancel',
          },
          {
            text: 'Restart Now',
            onPress: async () => {
              await Updates.reloadAsync();
            },
          },
        ],
        { cancelable: false }
      );
    }
  } catch (error) {
    console.error('[Updates] Error fetching update:', error);
  }
}

/**
 * Force check and apply update (for critical updates)
 */
export async function forceUpdate(): Promise<void> {
  if (__DEV__) return;

  try {
    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.error('[Updates] Error forcing update:', error);
  }
}

/**
 * Get current update info
 */
export function getUpdateInfo(): {
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
} {
  return {
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
  };
}

/**
 * Check if running in Expo Go (updates not available)
 */
export function isExpoGo(): boolean {
  return !Updates.isEnabled;
}

/**
 * Initialize update checking on app start
 * Call this in your root layout or App component
 */
export async function initializeUpdates(): Promise<void> {
  if (__DEV__ || isExpoGo()) {
    console.log('[Updates] Updates disabled in development/Expo Go');
    return;
  }

  // Check for updates on app start
  await checkForUpdates();

  // Set up periodic update checks (every 30 minutes)
  setInterval(async () => {
    await checkForUpdates();
  }, 30 * 60 * 1000);
}

export default {
  checkForUpdates,
  fetchAndApplyUpdate,
  forceUpdate,
  getUpdateInfo,
  isExpoGo,
  initializeUpdates,
};
