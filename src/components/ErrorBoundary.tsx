import { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-background px-8">
          <View className="w-20 h-20 bg-danger/10 rounded-full items-center justify-center mb-4">
            <Ionicons name="warning" size={40} color="#EF4444" />
          </View>
          <Text className="text-xl font-bold text-text-primary text-center">
            Something went wrong
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            We're sorry, but something unexpected happened. Please try again.
          </Text>
          {__DEV__ && this.state.error && (
            <View className="mt-4 p-4 bg-gray-100 rounded-lg w-full">
              <Text className="text-xs text-danger font-mono">
                {this.state.error.message}
              </Text>
            </View>
          )}
          <TouchableOpacity
            className="mt-6 px-6 py-3 bg-primary rounded-xl"
            onPress={this.handleRetry}
            accessibilityLabel="Try again"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
