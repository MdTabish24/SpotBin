import { View, Text, ViewStyle } from 'react-native';
import { ReactNode } from 'react';

type CardElevation = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  elevation?: CardElevation;
  className?: string;
  style?: ViewStyle;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: ReactNode;
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

const elevationStyles: Record<CardElevation, string> = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

/**
 * Card container component
 */
export function Card({
  children,
  elevation = 'sm',
  className = '',
  style,
}: CardProps) {
  return (
    <View
      className={`bg-white rounded-xl ${elevationStyles[elevation]} ${className}`}
      style={style}
    >
      {children}
    </View>
  );
}

/**
 * Card header with title and optional subtitle
 */
export function CardHeader({ title, subtitle, rightElement }: CardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
      <View className="flex-1">
        <Text className="text-lg font-semibold text-text-primary">{title}</Text>
        {subtitle && (
          <Text className="text-sm text-text-secondary mt-0.5">{subtitle}</Text>
        )}
      </View>
      {rightElement && <View>{rightElement}</View>}
    </View>
  );
}

/**
 * Card body content area
 */
export function CardBody({ children, className = '' }: CardBodyProps) {
  return <View className={`p-4 ${className}`}>{children}</View>;
}

/**
 * Card footer for actions
 */
export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <View className={`px-4 py-3 border-t border-gray-100 ${className}`}>
      {children}
    </View>
  );
}

export default Card;
