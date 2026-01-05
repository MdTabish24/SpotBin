import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * Camera screen - Primary interface for citizens
 * Opens directly to camera view for zero-friction reporting
 */
export default function CameraScreen() {
  return (
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-1 items-center justify-center">
        {/* Camera preview will be implemented in Task 23 */}
        <View className="w-full h-full bg-gray-900 items-center justify-center">
          <Ionicons name="camera" size={64} color="#6B7280" />
          <Text className="text-gray-400 mt-4 text-lg">
            Camera View
          </Text>
          <Text className="text-gray-500 mt-2 text-sm">
            Tap to capture waste report
          </Text>
        </View>
      </View>
      
      {/* Capture button */}
      <View className="absolute bottom-8 left-0 right-0 items-center">
        <TouchableOpacity
          className="w-20 h-20 rounded-full bg-white items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }} // Accessibility: min touch target
          accessibilityLabel="Capture photo"
          accessibilityRole="button"
        >
          <View className="w-16 h-16 rounded-full bg-primary border-4 border-white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
