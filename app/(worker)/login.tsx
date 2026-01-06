import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useWorkerAuth } from '../../src/hooks/useWorkerAuth';
import { Button } from '../../src/components/ui/Button';
import { showSuccessToast, showErrorToast } from '../../src/components/Toast';

type LoginStep = 'phone' | 'otp';

/**
 * Worker login screen - OTP-based authentication
 * Phone number input → OTP verification → JWT token stored in expo-secure-store
 * Requirements: 6.1, 6.2
 */
export default function WorkerLoginScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, login, requestOtp } = useWorkerAuth();
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<LoginStep>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpError, setOtpError] = useState('');
  
  const otpInputRef = useRef<TextInput>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace('/(worker)/tasks');
    }
  }, [isAuthenticated, authLoading]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Focus OTP input when step changes
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [step]);

  const formatPhone = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 10);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
  };

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setOtpError('');
    
    // Auto-submit when 6 digits entered
    if (digits.length === 6) {
      Keyboard.dismiss();
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) return;
    
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const result = await requestOtp(`+91${phone}`);
      
      if (result.success) {
        setStep('otp');
        setCountdown(60); // 60 second cooldown
        showSuccessToast('OTP Sent', `Code sent to +91 ${phone}`);
      } else {
        showErrorToast('Failed', result.message);
      }
    } catch (error) {
      showErrorToast('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    
    setIsLoading(true);
    setOtpError('');

    try {
      const success = await login(`+91${phone}`, otp);
      
      if (success) {
        showSuccessToast('Welcome!', 'Login successful');
        router.replace('/(worker)/tasks');
      } else {
        setOtpError('Invalid or expired OTP');
        setOtp('');
      }
    } catch (error) {
      setOtpError('Verification failed. Please try again.');
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setOtp('');
    setOtpError('');

    try {
      const result = await requestOtp(`+91${phone}`);
      
      if (result.success) {
        setCountdown(60);
        showSuccessToast('OTP Resent', 'New code sent to your phone');
      } else {
        showErrorToast('Failed', result.message);
      }
    } catch (error) {
      showErrorToast('Error', 'Failed to resend OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePhone = () => {
    setStep('phone');
    setOtp('');
    setOtpError('');
    setCountdown(0);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-text-secondary mt-4">Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 px-6 justify-center">
          {/* Logo */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 bg-primary rounded-full items-center justify-center shadow-lg">
              <Ionicons name="construct" size={48} color="white" />
            </View>
            <Text className="text-3xl font-bold text-text-primary mt-6">
              CleanCity
            </Text>
            <Text className="text-lg text-text-secondary mt-1">
              Worker Portal
            </Text>
          </View>

          {step === 'phone' ? (
            <>
              {/* Phone input */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  Phone Number
                </Text>
                <View className="flex-row items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <View className="px-4 py-4 bg-gray-50 border-r border-gray-200">
                    <Text className="text-text-primary font-semibold">+91</Text>
                  </View>
                  <TextInput
                    className="flex-1 py-4 px-4 text-text-primary text-lg"
                    placeholder="Enter your phone number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={handlePhoneChange}
                    maxLength={10}
                    accessibilityLabel="Phone number input"
                    editable={!isLoading}
                  />
                  {phone.length === 10 && (
                    <View className="pr-4">
                      <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                    </View>
                  )}
                </View>
                <Text className="text-xs text-text-secondary mt-2">
                  We'll send a 6-digit verification code
                </Text>
              </View>

              {/* Send OTP button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleSendOtp}
                disabled={phone.length !== 10}
                loading={isLoading}
                accessibilityLabel="Send OTP"
              >
                Send OTP
              </Button>
            </>
          ) : (
            <>
              {/* OTP input */}
              <View className="mb-6">
                <Text className="text-sm font-semibold text-text-primary mb-2">
                  Verification Code
                </Text>
                <Text className="text-sm text-text-secondary mb-4">
                  Enter the 6-digit code sent to{' '}
                  <Text className="font-semibold text-text-primary">+91 {phone}</Text>
                </Text>
                
                <TextInput
                  ref={otpInputRef}
                  className={`bg-white rounded-xl border px-4 py-4 text-center text-3xl tracking-[0.5em] text-text-primary font-bold ${
                    otpError ? 'border-danger' : 'border-gray-200'
                  }`}
                  placeholder="------"
                  placeholderTextColor="#D1D5DB"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={handleOtpChange}
                  maxLength={6}
                  accessibilityLabel="OTP input"
                  editable={!isLoading}
                />
                
                {otpError && (
                  <View className="flex-row items-center mt-2">
                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                    <Text className="text-danger text-sm ml-1">{otpError}</Text>
                  </View>
                )}
              </View>

              {/* Verify button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleVerifyOtp}
                disabled={otp.length !== 6}
                loading={isLoading}
                accessibilityLabel="Verify OTP"
              >
                Verify & Login
              </Button>

              {/* Resend OTP */}
              <View className="flex-row justify-center mt-6">
                {countdown > 0 ? (
                  <Text className="text-text-secondary">
                    Resend code in{' '}
                    <Text className="font-semibold text-primary">{countdown}s</Text>
                  </Text>
                ) : (
                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={isLoading}
                    accessibilityLabel="Resend OTP"
                    accessibilityRole="button"
                    style={{ minHeight: 44 }}
                    className="py-2"
                  >
                    <Text className="text-primary font-semibold">
                      Resend OTP
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Change phone number */}
              <TouchableOpacity
                onPress={handleChangePhone}
                disabled={isLoading}
                accessibilityLabel="Change phone number"
                accessibilityRole="button"
                style={{ minHeight: 44 }}
                className="mt-4 py-2"
              >
                <Text className="text-center text-text-secondary">
                  Wrong number?{' '}
                  <Text className="text-primary font-semibold">Change</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Footer */}
        <View className="px-6 pb-6">
          <Text className="text-xs text-text-secondary text-center">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
