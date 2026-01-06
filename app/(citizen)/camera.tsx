import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useLocation } from '../../src/hooks/useLocation';
import { useDeviceFingerprint } from '../../src/hooks/useDeviceFingerprint';
import { reportApi, GeoLocation } from '../../src/api/reports';
import { Button } from '../../src/components/ui/Button';
import { Modal } from '../../src/components/ui/Modal';
import { showSuccessToast, showErrorToast } from '../../src/components/Toast';
import ENV from '../../src/config/env';

type CaptureState = 'camera' | 'preview' | 'submitting' | 'success';

interface CapturedPhoto {
  uri: string;
  location: GeoLocation;
  timestamp: Date;
}

/**
 * Camera screen - Primary interface for citizens
 * Opens directly to camera view for zero-friction reporting
 * Requirements: 1.1, 1.2, 1.3
 */
export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  
  // Permissions
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // Hooks
  const { getCurrentLocation, hasPermission: locationPermission, requestPermission: requestLocationPermission } = useLocation();
  const { fingerprint, isLoading: fingerprintLoading } = useDeviceFingerprint();
  
  // State
  const [captureState, setCaptureState] = useState<CaptureState>('camera');
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [description, setDescription] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    reportId: string;
    estimatedTime: string;
  } | null>(null);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (!cameraPermission?.granted) {
      await requestCameraPermission();
    }
    if (!locationPermission) {
      await requestLocationPermission();
    }
  };

  const toggleCameraType = () => {
    setCameraType(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // Get current location first
      const location = await getCurrentLocation();
      if (!location) {
        showErrorToast('Location Required', 'Please enable location to submit a report');
        setIsCapturing(false);
        return;
      }

      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
      });

      if (!photo) {
        showErrorToast('Camera Error', 'Failed to capture photo');
        setIsCapturing(false);
        return;
      }

      // Process image - resize and compress to max 5MB
      const processed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1920 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Store captured photo with metadata
      setCapturedPhoto({
        uri: processed.uri,
        location,
        timestamp: new Date(),
      });

      setCaptureState('preview');
    } catch (error) {
      console.error('Capture error:', error);
      showErrorToast('Camera Error', 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setDescription('');
    setCaptureState('camera');
  };

  const handleSubmit = async () => {
    if (!capturedPhoto || !fingerprint) {
      showErrorToast('Error', 'Missing required data');
      return;
    }

    // Validate photo timestamp (within 5 minutes)
    const photoAge = Date.now() - capturedPhoto.timestamp.getTime();
    const maxAge = ENV.REPORT_COOLDOWN_MINUTES * 60 * 1000;
    
    if (photoAge > maxAge) {
      showErrorToast('Photo Expired', 'Please take a new photo');
      handleRetake();
      return;
    }

    setIsSubmitting(true);
    setCaptureState('submitting');

    try {
      const result = await reportApi.createReport({
        photo: capturedPhoto.uri,
        location: capturedPhoto.location,
        timestamp: capturedPhoto.timestamp.toISOString(),
        deviceFingerprint: fingerprint,
        description: description.trim() || undefined,
      });

      setSubmissionResult({
        reportId: result.reportId,
        estimatedTime: result.estimatedCleanupTime,
      });
      
      setCaptureState('success');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Submit error:', error);
      
      // Handle specific error codes
      const errorCode = error.response?.data?.error?.code;
      const errorMessage = error.response?.data?.error?.message;
      
      if (errorCode === 'DAILY_LIMIT_REACHED') {
        showErrorToast('Daily Limit', errorMessage || 'Maximum 10 reports per day');
      } else if (errorCode === 'COOLDOWN_ACTIVE') {
        showErrorToast('Please Wait', errorMessage || 'Wait 5 minutes between reports');
      } else if (errorCode === 'DUPLICATE_REPORT') {
        showErrorToast('Duplicate', errorMessage || 'A similar report exists nearby');
      } else {
        showErrorToast('Submission Failed', 'Please try again');
      }
      
      setCaptureState('preview');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setCapturedPhoto(null);
    setDescription('');
    setSubmissionResult(null);
    setCaptureState('camera');
  };

  const handleViewReports = () => {
    setShowSuccessModal(false);
    router.push('/(citizen)/reports');
  };

  // Permission denied state
  if (cameraPermission && !cameraPermission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8">
        <Ionicons name="camera-outline" size={64} color="#D1D5DB" />
        <Text className="text-xl font-semibold text-text-primary mt-4 text-center">
          Camera Permission Required
        </Text>
        <Text className="text-text-secondary text-center mt-2">
          We need camera access to capture waste reports
        </Text>
        <Button
          variant="primary"
          onPress={requestCameraPermission}
          className="mt-6"
        >
          Grant Permission
        </Button>
      </SafeAreaView>
    );
  }

  // Loading state
  if (!cameraPermission || fingerprintLoading) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-white mt-4">Initializing camera...</Text>
      </SafeAreaView>
    );
  }

  // Preview state
  if (captureState === 'preview' && capturedPhoto) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        {/* Photo preview */}
        <View className="flex-1">
          <Image
            source={{ uri: capturedPhoto.uri }}
            className="flex-1"
            resizeMode="contain"
          />
        </View>

        {/* Description input */}
        <View className="bg-white px-4 py-4">
          <Text className="text-sm text-text-secondary mb-2">
            Add description (optional, max {ENV.MAX_DESCRIPTION_LENGTH} chars)
          </Text>
          <TextInput
            className="bg-gray-100 rounded-xl px-4 py-3 text-text-primary"
            placeholder="e.g., Garbage pile near park"
            value={description}
            onChangeText={(text) => setDescription(text.slice(0, ENV.MAX_DESCRIPTION_LENGTH))}
            maxLength={ENV.MAX_DESCRIPTION_LENGTH}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            accessibilityLabel="Report description"
          />
          <Text className="text-xs text-text-secondary mt-1 text-right">
            {description.length}/{ENV.MAX_DESCRIPTION_LENGTH}
          </Text>

          {/* Location info */}
          <View className="flex-row items-center mt-3">
            <Ionicons name="location" size={16} color="#10B981" />
            <Text className="text-sm text-text-secondary ml-1">
              Location captured (±{Math.round(capturedPhoto.location.accuracy)}m)
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row px-4 py-4 bg-white border-t border-gray-100">
          <Button
            variant="outline"
            onPress={handleRetake}
            className="flex-1 mr-2"
            accessibilityLabel="Retake photo"
          >
            Retake
          </Button>
          <Button
            variant="primary"
            onPress={handleSubmit}
            loading={isSubmitting}
            className="flex-1 ml-2"
            accessibilityLabel="Submit report"
          >
            Submit Report
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // Submitting state
  if (captureState === 'submitting') {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-lg font-semibold text-text-primary mt-4">
          Submitting Report...
        </Text>
        <Text className="text-text-secondary mt-2">
          Please wait while we process your report
        </Text>
      </SafeAreaView>
    );
  }

  // Camera view (default state)
  return (
    <SafeAreaView className="flex-1 bg-black">
      {/* Camera preview */}
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={cameraType}
      >
        {/* Top controls */}
        <View className="flex-row justify-between items-center px-4 pt-4">
          <TouchableOpacity
            onPress={toggleCameraType}
            className="w-12 h-12 rounded-full bg-black/30 items-center justify-center"
            accessibilityLabel="Switch camera"
            accessibilityRole="button"
          >
            <Ionicons name="camera-reverse" size={24} color="white" />
          </TouchableOpacity>
          
          <View className="bg-black/30 px-3 py-1 rounded-full">
            <Text className="text-white text-sm">
              {locationPermission ? '📍 GPS Ready' : '⚠️ No GPS'}
            </Text>
          </View>
        </View>

        {/* Center guide */}
        <View className="flex-1 items-center justify-center">
          <View className="w-64 h-64 border-2 border-white/30 rounded-2xl" />
          <Text className="text-white/70 mt-4 text-center px-8">
            Point camera at waste and tap capture
          </Text>
        </View>

        {/* Bottom controls */}
        <View className="items-center pb-8">
          {/* Capture button */}
          <TouchableOpacity
            onPress={handleCapture}
            disabled={isCapturing}
            className="w-20 h-20 rounded-full bg-white items-center justify-center"
            style={{ minWidth: 44, minHeight: 44 }}
            accessibilityLabel="Capture photo"
            accessibilityRole="button"
          >
            {isCapturing ? (
              <ActivityIndicator size="large" color="#10B981" />
            ) : (
              <View className="w-16 h-16 rounded-full bg-primary border-4 border-white" />
            )}
          </TouchableOpacity>
          
          <Text className="text-white/70 mt-3 text-sm">
            Tap to capture
          </Text>
        </View>
      </CameraView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        onClose={handleSuccessClose}
        title="Report Submitted!"
        closeOnBackdrop={false}
      >
        <View className="items-center py-4">
          <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-4">
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          </View>
          
          <Text className="text-lg font-semibold text-text-primary text-center">
            Thank you for reporting!
          </Text>
          
          <Text className="text-text-secondary text-center mt-2">
            Your report has been submitted successfully.
          </Text>
          
          {submissionResult && (
            <View className="bg-gray-50 rounded-xl p-4 mt-4 w-full">
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary">Report ID</Text>
                <Text className="text-text-primary font-medium">
                  #{submissionResult.reportId.slice(0, 8)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-text-secondary">Est. Cleanup</Text>
                <Text className="text-primary font-medium">
                  {submissionResult.estimatedTime}
                </Text>
              </View>
            </View>
          )}
          
          <Text className="text-sm text-text-secondary text-center mt-4">
            You'll receive a notification when your report is resolved.
          </Text>
        </View>

        <View className="flex-row mt-4">
          <Button
            variant="outline"
            onPress={handleSuccessClose}
            className="flex-1 mr-2"
          >
            Report More
          </Button>
          <Button
            variant="primary"
            onPress={handleViewReports}
            className="flex-1 ml-2"
          >
            View Reports
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
