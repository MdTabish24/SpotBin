import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  accessibilityLabel?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: 'bg-primary', text: 'text-white' },
  secondary: { bg: 'bg-secondary', text: 'text-white' },
  danger: { bg: 'bg-danger', text: 'text-white' },
  outline: { bg: 'bg-transparent', text: 'text-primary', border: 'border border-primary' },
  ghost: { bg: 'bg-transparent', text: 'text-text-primary' },
};

const sizeStyles: Record<ButtonSize, { padding: string; text: string; minHeight: number }> = {
  sm: { padding: 'px-3 py-2', text: 'text-sm', minHeight: 36 },
  md: { padding: 'px-4 py-3', text: 'text-base', minHeight: 44 },
  lg: { padding: 'px-6 py-4', text: 'text-lg', minHeight: 52 },
};

/**
 * Reusable Button component with variants and sizes
 * Follows accessibility guidelines with min 44px touch target
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  accessibilityLabel,
  style,
  textStyle,
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <TouchableOpacity
      className={`
        flex-row items-center justify-center rounded-xl
        ${variantStyle.bg}
        ${variantStyle.border || ''}
        ${sizeStyle.padding}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50' : ''}
      `}
      style={[{ minHeight: sizeStyle.minHeight }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || (typeof children === 'string' ? children : undefined)}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? '#10B981' : '#FFFFFF'}
          size="small"
        />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text
            className={`
              font-semibold
              ${variantStyle.text}
              ${sizeStyle.text}
              ${leftIcon ? 'ml-2' : ''}
              ${rightIcon ? 'mr-2' : ''}
            `}
            style={textStyle}
          >
            {children}
          </Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </TouchableOpacity>
  );
}

export default Button;
