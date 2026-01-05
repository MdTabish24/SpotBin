import { Stack } from 'expo-router';

/**
 * Worker app stack navigation layout
 * Workers need to login first, then access tasks
 */
export default function WorkerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="task-detail" />
      <Stack.Screen name="verification" />
    </Stack>
  );
}
