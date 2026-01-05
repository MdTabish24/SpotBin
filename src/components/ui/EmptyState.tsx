import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  children?: ReactNode;
}

/**
 * Empty state component for lists and screens with no data
 */
export function EmptyState({
  icon = 'document-text-outline',
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
        <Ionicons name={icon} size={40} color="#9CA3AF" />
      </View>
      <Text className="text-lg font-semibold text-text-primary text-center">
        {title}
      </Text>
      {description && (
        <Text className="text-sm text-text-secondary text-center mt-2">
          {description}
        </Text>
      )}
      {action && (
        <View className="mt-6">
          <Button variant="primary" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      )}
      {children}
    </View>
  );
}

export default EmptyState;
