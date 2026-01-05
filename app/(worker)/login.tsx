import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * Worker login screen - OTP-based authentication
 * Phone number input → OTP verification → JWT token
 */
export default function WorkerLoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    // Will be implemented in Task 11
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    // Will be implemented in Task 11
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-center">
        {/* Logo */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 bg-primary rounded-full items-center justify-center">
            <Ionicons name="construct" size={40} color="white" />
          </View>
          <Text className="text-2xl font-bold text-text-primary mt-4">
            CleanCity Worker
          </Text>
          <Text className="text-text-secondary mt-1">
            Login to manage your tasks
          </Text>
        </View>

        {step === 'phone' ? (
          <>
            {/* Phone input */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-text-primary mb-2">
                Phone Number
              </Text>
              <View className="flex-row items-center bg-white rounded-xl border border-gray-200 px-4">
                <Text className="text-text-primary font-medium">+91</Text>
                <TextInput
                  className="flex-1 py-4 px-3 text-text-primary"
                  placeholder="Enter your phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                  accessibilityLabel="Phone number input"
                />
              </View>
            </View>

            {/* Send OTP button */}
            <TouchableOpacity
              className={`py-4 rounded-xl items-center ${
                phone.length === 10 ? 'bg-primary' : 'bg-gray-300'
              }`}
              onPress={handleSendOtp}
              disabled={phone.length !== 10 || loading}
              accessibilityLabel="Send OTP"
              accessibilityRole="button"
              style={{ minHeight: 44 }}
            >
              <Text className="text-white font-semibold text-lg">
                {loading ? 'Sending...' : 'Send OTP'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* OTP input */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-text-primary mb-2">
                Enter OTP
              </Text>
              <Text className="text-sm text-text-secondary mb-4">
                We sent a 6-digit code to +91 {phone}
              </Text>
              <TextInput
                className="bg-white rounded-xl border border-gray-200 px-4 py-4 text-center text-2xl tracking-widest text-text-primary"
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={6}
                accessibilityLabel="OTP input"
              />
            </View>

            {/* Verify button */}
            <TouchableOpacity
              className={`py-4 rounded-xl items-center ${
                otp.length === 6 ? 'bg-primary' : 'bg-gray-300'
              }`}
              onPress={handleVerifyOtp}
              disabled={otp.length !== 6 || loading}
              accessibilityLabel="Verify OTP"
              accessibilityRole="button"
              style={{ minHeight: 44 }}
            >
              <Text className="text-white font-semibold text-lg">
                {loading ? 'Verifying...' : 'Verify & Login'}
              </Text>
            </TouchableOpacity>

            {/* Resend OTP */}
            <TouchableOpacity
              className="mt-4 py-2"
              onPress={() => setStep('phone')}
              accessibilityLabel="Change phone number"
              accessibilityRole="button"
            >
              <Text className="text-center text-primary font-medium">
                Change phone number
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
