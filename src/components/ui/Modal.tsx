import {
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

/**
 * Reusable Modal component with backdrop and close button
 */
export function Modal({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
}: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback
        onPress={closeOnBackdrop ? onClose : undefined}
        accessible={false}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <TouchableWithoutFeedback accessible={false}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View className="bg-white rounded-t-3xl">
                {/* Header */}
                {(title || showCloseButton) && (
                  <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
                    {title ? (
                      <Text className="text-lg font-semibold text-text-primary">
                        {title}
                      </Text>
                    ) : (
                      <View />
                    )}
                    {showCloseButton && (
                      <TouchableOpacity
                        onPress={onClose}
                        className="p-2 -mr-2"
                        accessibilityLabel="Close modal"
                        accessibilityRole="button"
                        style={{ minWidth: 44, minHeight: 44 }}
                      >
                        <Ionicons name="close" size={24} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Content */}
                <View className="p-4">{children}</View>

                {/* Safe area padding for bottom */}
                <View className="h-8" />
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}

export default Modal;
