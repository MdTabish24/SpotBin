import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

/**
 * Custom toast configuration for CleanCity
 * Matches the design system colors
 */
export const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#10B981', // primary
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#111827', // text-primary
      }}
      text2Style={{
        fontSize: 13,
        color: '#6B7280', // text-secondary
      }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        borderLeftColor: '#EF4444', // danger
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
      }}
      text2Style={{
        fontSize: 13,
        color: '#6B7280',
      }}
    />
  ),
  info: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: '#3B82F6', // secondary
        backgroundColor: '#FFFFFF',
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
      }}
      text2Style={{
        fontSize: 13,
        color: '#6B7280',
      }}
    />
  ),
};

/**
 * Helper functions for showing toasts
 */
export const showSuccessToast = (title: string, message?: string) => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    visibilityTime: 3000,
  });
};

export const showErrorToast = (title: string, message?: string) => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    visibilityTime: 4000,
  });
};

export const showInfoToast = (title: string, message?: string) => {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message,
    visibilityTime: 3000,
  });
};

export { Toast };
