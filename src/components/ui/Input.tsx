import { View, Text, TextInput, TextInputProps, ViewStyle } from 'react-native';
import { ReactNode, forwardRef } from 'react';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerStyle?: ViewStyle;
}

/**
 * Reusable Input component with label, error, and icon support
 */
export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerStyle,
      ...props
    },
    ref
  ) => {
    return (
      <View style={containerStyle}>
        {label && (
          <Text className="text-sm font-medium text-text-primary mb-2">
            {label}
          </Text>
        )}
        <View
          className={`
            flex-row items-center bg-white rounded-xl border px-4
            ${error ? 'border-danger' : 'border-gray-200'}
          `}
        >
          {leftIcon && <View className="mr-3">{leftIcon}</View>}
          <TextInput
            ref={ref}
            className="flex-1 py-4 text-text-primary"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel={label}
            {...props}
          />
          {rightIcon && <View className="ml-3">{rightIcon}</View>}
        </View>
        {error && (
          <Text className="text-sm text-danger mt-1">{error}</Text>
        )}
        {hint && !error && (
          <Text className="text-sm text-text-secondary mt-1">{hint}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export default Input;
