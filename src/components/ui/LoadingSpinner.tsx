import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

/**
 * Loading spinner component with optional message
 */
export function LoadingSpinner({
  size = 'large',
  color = '#10B981',
  message,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const content = (
    <>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text className="text-text-secondary mt-3 text-center">{message}</Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        {content}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-8">{content}</View>
  );
}

export default LoadingSpinner;
