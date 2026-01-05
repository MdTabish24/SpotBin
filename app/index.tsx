import { Redirect } from 'expo-router';

/**
 * Entry point - redirects to citizen camera view by default
 * Citizens don't need to login, they go straight to camera
 */
export default function Index() {
  // Default to citizen app (camera view)
  return <Redirect href="/(citizen)/camera" />;
}
