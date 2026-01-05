import { View, Text } from 'react-native';

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  secondary: { bg: 'bg-secondary/10', text: 'text-secondary' },
  success: { bg: 'bg-primary/10', text: 'text-primary' },
  warning: { bg: 'bg-warning/10', text: 'text-warning' },
  danger: { bg: 'bg-danger/10', text: 'text-danger' },
  info: { bg: 'bg-secondary/10', text: 'text-secondary' },
};

const sizeStyles: Record<BadgeSize, { padding: string; text: string }> = {
  sm: { padding: 'px-2 py-0.5', text: 'text-xs' },
  md: { padding: 'px-3 py-1', text: 'text-sm' },
};

/**
 * Badge component for status indicators
 */
export function Badge({ children, variant = 'primary', size = 'md' }: BadgeProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <View className={`rounded-full ${variantStyle.bg} ${sizeStyle.padding}`}>
      <Text className={`font-medium ${variantStyle.text} ${sizeStyle.text}`}>
        {children}
      </Text>
    </View>
  );
}

export default Badge;
