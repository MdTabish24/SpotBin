import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * Verification screen - Before/After photo capture flow
 * Worker must be within 50m of report location
 */
export default function VerificationScreen() {
  const { taskId } = useLocalSearchParams();
  const [step, setStep] = useState<'before' | 'after' | 'complete'>('before');
  const [beforePhoto, setBeforePhoto] = useState<string | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<string | null>(null);

  const handleCaptureBefore = () => {
    // Will be implemented in Task 24.5
    setBeforePhoto('placeholder');
    setStep('after');
  };

  const handleCaptureAfter = () => {
    // Will be implemented in Task 24.5
    setAfterPhoto('placeholder');
    setStep('complete');
  };

  const handleSubmit = () => {
    // Will be implemented in Task 13
    router.replace('/(worker)/tasks');
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2"
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-text-primary ml-2">
          Verification
        </Text>
      </View>

      {/* Progress indicator */}
      <View className="flex-row px-4 py-4 bg-white">
        <View className="flex-1 items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              step === 'before' ? 'bg-primary' : beforePhoto ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            {beforePhoto ? (
              <Ionicons name="checkmark" size={20} color="white" />
            ) : (
              <Text className={step === 'before' ? 'text-white font-bold' : 'text-gray-500'}>
                1
              </Text>
            )}
          </View>
          <Text className="text-xs text-text-secondary mt-1">Before</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <View className="h-0.5 w-full bg-gray-200" />
        </View>
        <View className="flex-1 items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              step === 'after' ? 'bg-primary' : afterPhoto ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            {afterPhoto ? (
              <Ionicons name="checkmark" size={20} color="white" />
            ) : (
              <Text className={step === 'after' ? 'text-white font-bold' : 'text-gray-500'}>
                2
              </Text>
            )}
          </View>
          <Text className="text-xs text-text-secondary mt-1">After</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <View className="h-0.5 w-full bg-gray-200" />
        </View>
        <View className="flex-1 items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              step === 'complete' ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <Ionicons
              name="checkmark-done"
              size={20}
              color={step === 'complete' ? 'white' : '#9CA3AF'}
            />
          </View>
          <Text className="text-xs text-text-secondary mt-1">Submit</Text>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        {step === 'before' && (
          <>
            <View className="w-24 h-24 bg-warning/20 rounded-full items-center justify-center mb-6">
              <Ionicons name="camera" size={48} color="#F59E0B" />
            </View>
            <Text className="text-xl font-bold text-text-primary text-center">
              Capture Before Photo
            </Text>
            <Text className="text-text-secondary text-center mt-2">
              Take a photo of the waste before cleanup
            </Text>
            <Text className="text-sm text-danger text-center mt-4">
              You must be within 50m of the location
            </Text>
          </>
        )}

        {step === 'after' && (
          <>
            <View className="w-24 h-24 bg-primary/20 rounded-full items-center justify-center mb-6">
              <Ionicons name="camera" size={48} color="#10B981" />
            </View>
            <Text className="text-xl font-bold text-text-primary text-center">
              Capture After Photo
            </Text>
            <Text className="text-text-secondary text-center mt-2">
              Take a photo after completing the cleanup
            </Text>
            <Text className="text-sm text-text-secondary text-center mt-4">
              Minimum 2 minutes must pass since before photo
            </Text>
          </>
        )}

        {step === 'complete' && (
          <>
            <View className="w-24 h-24 bg-primary/20 rounded-full items-center justify-center mb-6">
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text className="text-xl font-bold text-text-primary text-center">
              Ready to Submit
            </Text>
            <Text className="text-text-secondary text-center mt-2">
              Your verification will be sent for admin approval
            </Text>
          </>
        )}
      </View>

      {/* Action button */}
      <View className="p-4 bg-white border-t border-gray-200">
        {step === 'before' && (
          <TouchableOpacity
            className="py-4 bg-warning rounded-xl items-center"
            onPress={handleCaptureBefore}
            accessibilityLabel="Capture before photo"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Text className="text-white font-semibold text-lg">
              Capture Before Photo
            </Text>
          </TouchableOpacity>
        )}

        {step === 'after' && (
          <TouchableOpacity
            className="py-4 bg-primary rounded-xl items-center"
            onPress={handleCaptureAfter}
            accessibilityLabel="Capture after photo"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Text className="text-white font-semibold text-lg">
              Capture After Photo
            </Text>
          </TouchableOpacity>
        )}

        {step === 'complete' && (
          <TouchableOpacity
            className="py-4 bg-primary rounded-xl items-center"
            onPress={handleSubmit}
            accessibilityLabel="Submit verification"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Text className="text-white font-semibold text-lg">
              Submit for Approval
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
