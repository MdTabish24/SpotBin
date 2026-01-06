import { View, Text, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, CameraType } from 'expo-camera';

import { useCamera } from '../../src/hooks/useCamera';
import { useLocation, calculateDistance } from '../../src/hooks/useLocation';
import { workerTaskApi, Task } from '../../src/api/worker';
import { showErrorToast, showSuccessToast, showInfoToast } from '../../src/components/Toast';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';

// Constants for validation (Requirements: 8.1, 8.6, 8.7)
const MAX_DISTANCE_METERS = 50; // Worker must be within 50m of report location
const MIN_TIME_BETWEEN_PHOTOS_MS = 2 * 60 * 1000; // 2 minutes minimum
const MAX_TIME_BETWEEN_PHOTOS_MS = 4 * 60 * 60 * 1000; // 4 hours maximum

type VerificationStep = 'loading' | 'proximity_check' | 'before' | 'waiting' | 'after' | 'submitting' | 'complete';

interface PhotoData {
  uri: string;
  timestamp: Date;
  location: { lat: number; lng: number; accuracy: number };
}

/**
 * Verification screen - Before/After photo capture flow
 * Worker must be within 50m of report location
 * Requirements: 8.1, 8.2, 8.4, 8.6, 8.7
 */
export default function VerificationScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  
  const { hasPermission, cameraRef, takePicture, requestPermission } = useCamera();
  const { location, getCurrentLocation, hasPermission: locationPermission, requestPermission: requestLocationPermission } = useLocation();
  
  const [step, setStep] = useState<VerificationStep>('loading');
  const [task, setTask] = useState<Task | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<PhotoData | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<PhotoData | null>(null);
  const [distanceToTask, setDistanceToTask] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [captureTarget, setCaptureTarget] = useState<'before' | 'after'>('before');
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Load task details on mount
  useEffect(() => {
    loadTask();
    checkPermissions();
  }, [taskId]);

  // Update distance when location changes
  useEffect(() => {
    if (location && task) {
      const distance = calculateDistance(
        location.lat,
        location.lng,
        task.location.lat,
        task.location.lng
      );
      setDistanceToTask(distance);
    }
  }, [location, task]);

  // Timer for waiting period between photos
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (step === 'waiting' && beforePhoto) {
      interval = setInterval(() => {
        const elapsed = Date.now() - beforePhoto.timestamp.getTime();
        const remaining = Math.max(0, MIN_TIME_BETWEEN_PHOTOS_MS - elapsed);
        setTimeRemaining(remaining);
        
        if (remaining === 0) {
          setStep('after');
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [step, beforePhoto]);

  const checkPermissions = async () => {
    if (!hasPermission) {
      await requestPermission();
    }
    if (!locationPermission) {
      await requestLocationPermission();
    }
    await getCurrentLocation();
  };

  const loadTask = async () => {
    if (!taskId) {
      showErrorToast('Error', 'No task ID provided');
      router.back();
      return;
    }

    try {
      const taskData = await workerTaskApi.getTaskById(taskId);
      setTask(taskData);
      
      // Check if task already has verification in progress
      if (taskData.status === 'in_progress') {
        // Task already started, go to after photo step
        setStep('after');
      } else {
        setStep('proximity_check');
      }
    } catch (error) {
      console.error('Failed to load task:', error);
      showErrorToast('Error', 'Failed to load task details');
      router.back();
    }
  };

  const validateProximity = (): boolean => {
    if (!location || !task) {
      showErrorToast('Error', 'Location not available');
      return false;
    }

    const distance = calculateDistance(
      location.lat,
      location.lng,
      task.location.lat,
      task.location.lng
    );

    if (distance > MAX_DISTANCE_METERS) {
      showErrorToast(
        'Too Far',
        `You must be within ${MAX_DISTANCE_METERS}m of the location. Current distance: ${Math.round(distance)}m`
      );
      return false;
    }

    return true;
  };

  const handleStartVerification = async () => {
    await getCurrentLocation();
    
    if (!validateProximity()) {
      return;
    }
    
    setStep('before');
  };

  const handleCaptureBefore = () => {
    if (!validateProximity()) {
      return;
    }
    
    setCaptureTarget('before');
    setShowCamera(true);
  };

  const handleCaptureAfter = () => {
    if (!validateProximity()) {
      return;
    }

    // Check minimum time constraint
    if (beforePhoto) {
      const elapsed = Date.now() - beforePhoto.timestamp.getTime();
      if (elapsed < MIN_TIME_BETWEEN_PHOTOS_MS) {
        const remaining = Math.ceil((MIN_TIME_BETWEEN_PHOTOS_MS - elapsed) / 1000);
        showInfoToast('Please Wait', `${remaining} seconds remaining before you can take the after photo`);
        return;
      }
    }
    
    setCaptureTarget('after');
    setShowCamera(true);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isCapturing || !cameraReady) return;

    setIsCapturing(true);
    
    try {
      await getCurrentLocation();
      
      if (!validateProximity()) {
        setIsCapturing(false);
        return;
      }

      const photo = await takePicture();
      
      if (!photo || !location) {
        showErrorToast('Error', 'Failed to capture photo');
        setIsCapturing(false);
        return;
      }

      const photoData: PhotoData = {
        uri: photo.uri,
        timestamp: new Date(),
        location: {
          lat: location.lat,
          lng: location.lng,
          accuracy: location.accuracy,
        },
      };

      if (captureTarget === 'before') {
        setBeforePhoto(photoData);
        setShowCamera(false);
        
        // Submit before photo to API
        try {
          await workerTaskApi.startTask(taskId!, photoData.location, photoData.uri);
          showSuccessToast('Success', 'Before photo captured. Task started!');
          setStep('waiting');
        } catch (error: any) {
          console.error('Failed to start task:', error);
          showErrorToast('Error', error.response?.data?.error?.message || 'Failed to start task');
          setBeforePhoto(null);
        }
      } else {
        // Check timing constraints for after photo
        if (beforePhoto) {
          const elapsed = Date.now() - beforePhoto.timestamp.getTime();
          
          if (elapsed < MIN_TIME_BETWEEN_PHOTOS_MS) {
            showErrorToast('Too Soon', 'Minimum 2 minutes must pass between photos');
            setIsCapturing(false);
            return;
          }
          
          if (elapsed > MAX_TIME_BETWEEN_PHOTOS_MS) {
            showErrorToast('Too Late', 'Maximum 4 hours exceeded. Please restart the task.');
            setIsCapturing(false);
            router.back();
            return;
          }
        }

        setAfterPhoto(photoData);
        setShowCamera(false);
        setStep('complete');
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      showErrorToast('Error', 'Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleSubmit = async () => {
    if (!afterPhoto || !task) {
      showErrorToast('Error', 'Missing required data');
      return;
    }

    setStep('submitting');

    try {
      await workerTaskApi.completeTask(taskId!, afterPhoto.location, afterPhoto.uri);
      
      showSuccessToast('Success', 'Verification submitted for admin approval!');
      
      // Navigate back to tasks
      setTimeout(() => {
        router.replace('/(worker)/tasks');
      }, 1500);
    } catch (error: any) {
      console.error('Failed to submit verification:', error);
      showErrorToast('Error', error.response?.data?.error?.message || 'Failed to submit verification');
      setStep('complete');
    }
  };

  const formatTimeRemaining = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Camera view
  if (showCamera) {
    return (
      <SafeAreaView className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 pt-4">
            <TouchableOpacity
              onPress={() => setShowCamera(false)}
              className="p-2 bg-black/50 rounded-full"
              accessibilityLabel="Close camera"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
            <View className="bg-black/50 px-3 py-1 rounded-full">
              <Text className="text-white font-medium">
                {captureTarget === 'before' ? 'Before Photo' : 'After Photo'}
              </Text>
            </View>
            <View style={{ width: 44 }} />
          </View>

          {/* Distance indicator */}
          <View className="absolute top-20 left-0 right-0 items-center">
            <View className={`px-4 py-2 rounded-full ${
              distanceToTask && distanceToTask <= MAX_DISTANCE_METERS 
                ? 'bg-primary/80' 
                : 'bg-danger/80'
            }`}>
              <Text className="text-white font-medium">
                {distanceToTask ? `${Math.round(distanceToTask)}m from location` : 'Getting location...'}
              </Text>
            </View>
          </View>

          {/* Capture button */}
          <View className="absolute bottom-8 left-0 right-0 items-center">
            <TouchableOpacity
              onPress={handleTakePhoto}
              disabled={isCapturing || !cameraReady}
              className={`w-20 h-20 rounded-full border-4 border-white items-center justify-center ${
                isCapturing ? 'bg-gray-500' : captureTarget === 'before' ? 'bg-warning' : 'bg-primary'
              }`}
              accessibilityLabel="Take photo"
              accessibilityRole="button"
            >
              {isCapturing ? (
                <ActivityIndicator color="white" />
              ) : (
                <Ionicons name="camera" size={32} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  // Loading state
  if (step === 'loading') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner fullScreen message="Loading task..." />
      </SafeAreaView>
    );
  }

  // Submitting state
  if (step === 'submitting') {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner fullScreen message="Submitting verification..." />
      </SafeAreaView>
    );
  }

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
      <View className="flex-row items-center px-8 py-6 bg-white">
        <View className="flex-1 items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              step !== 'proximity_check' ? 'bg-primary' : 'bg-gray-200'
            }`}
          >
            <Ionicons
              name="location"
              size={20}
              color={step !== 'proximity_check' ? 'white' : '#9CA3AF'}
            />
          </View>
          <Text className="text-xs text-text-secondary mt-1">Location</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <View className="h-0.5 w-full bg-gray-200" />
        </View>
        <View className="flex-1 items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              beforePhoto ? 'bg-primary' : step === 'before' ? 'bg-warning' : 'bg-gray-200'
            }`}
          >
            <Ionicons
              name="camera"
              size={20}
              color={beforePhoto || step === 'before' ? 'white' : '#9CA3AF'}
            />
          </View>
          <Text className="text-xs text-text-secondary mt-1">Before</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <View className="h-0.5 w-full bg-gray-200" />
        </View>
        <View className="flex-1 items-center">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center ${
              afterPhoto ? 'bg-primary' : step === 'after' ? 'bg-warning' : 'bg-gray-200'
            }`}
          >
            <Ionicons
              name="camera"
              size={20}
              color={afterPhoto || step === 'after' ? 'white' : '#9CA3AF'}
            />
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

      {/* Distance card */}
      <View className="mx-4 mt-4 p-4 bg-white rounded-xl">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons name="location" size={24} color="#10B981" />
            <Text className="text-text-primary font-medium ml-2">
              Distance to Location
            </Text>
          </View>
          <View className={`px-3 py-1 rounded-full ${
            distanceToTask && distanceToTask <= MAX_DISTANCE_METERS 
              ? 'bg-primary/20' 
              : 'bg-danger/20'
          }`}>
            <Text className={`font-semibold ${
              distanceToTask && distanceToTask <= MAX_DISTANCE_METERS 
                ? 'text-primary' 
                : 'text-danger'
            }`}>
              {distanceToTask ? `${Math.round(distanceToTask)}m` : '--'}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-text-secondary mt-2">
          Must be within {MAX_DISTANCE_METERS}m to capture photos
        </Text>
      </View>

      {/* Photo previews */}
      {(beforePhoto || afterPhoto) && (
        <View className="mx-4 mt-4 flex-row">
          {beforePhoto && (
            <View className="flex-1 mr-2">
              <Text className="text-sm text-text-secondary mb-2">Before</Text>
              <Image
                source={{ uri: beforePhoto.uri }}
                className="w-full aspect-square rounded-xl"
                resizeMode="cover"
              />
            </View>
          )}
          {afterPhoto && (
            <View className="flex-1 ml-2">
              <Text className="text-sm text-text-secondary mb-2">After</Text>
              <Image
                source={{ uri: afterPhoto.uri }}
                className="w-full aspect-square rounded-xl"
                resizeMode="cover"
              />
            </View>
          )}
        </View>
      )}

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        {step === 'proximity_check' && (
          <>
            <View className="w-24 h-24 bg-secondary/20 rounded-full items-center justify-center mb-6">
              <Ionicons name="navigate" size={48} color="#3B82F6" />
            </View>
            <Text className="text-xl font-bold text-text-primary text-center">
              Verify Your Location
            </Text>
            <Text className="text-text-secondary text-center mt-2">
              Make sure you're at the waste location before starting
            </Text>
            <Text className="text-sm text-danger text-center mt-4">
              You must be within {MAX_DISTANCE_METERS}m of the location
            </Text>
          </>
        )}

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
          </>
        )}

        {step === 'waiting' && (
          <>
            <View className="w-24 h-24 bg-secondary/20 rounded-full items-center justify-center mb-6">
              <Ionicons name="time" size={48} color="#3B82F6" />
            </View>
            <Text className="text-xl font-bold text-text-primary text-center">
              Complete the Cleanup
            </Text>
            <Text className="text-text-secondary text-center mt-2">
              Clean up the waste, then take the after photo
            </Text>
            <View className="mt-6 bg-secondary/20 px-6 py-3 rounded-full">
              <Text className="text-secondary font-bold text-lg">
                {formatTimeRemaining(timeRemaining)} remaining
              </Text>
            </View>
            <Text className="text-xs text-text-secondary text-center mt-2">
              Minimum 2 minutes must pass before after photo
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
        {step === 'proximity_check' && (
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              distanceToTask && distanceToTask <= MAX_DISTANCE_METERS 
                ? 'bg-primary' 
                : 'bg-gray-300'
            }`}
            onPress={handleStartVerification}
            disabled={!distanceToTask || distanceToTask > MAX_DISTANCE_METERS}
            accessibilityLabel="Start verification"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Text className={`font-semibold text-lg ${
              distanceToTask && distanceToTask <= MAX_DISTANCE_METERS 
                ? 'text-white' 
                : 'text-gray-500'
            }`}>
              {distanceToTask && distanceToTask <= MAX_DISTANCE_METERS 
                ? 'Start Verification' 
                : `Move closer (${distanceToTask ? Math.round(distanceToTask) : '--'}m away)`}
            </Text>
          </TouchableOpacity>
        )}

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

        {step === 'waiting' && (
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              timeRemaining === 0 ? 'bg-primary' : 'bg-gray-300'
            }`}
            onPress={handleCaptureAfter}
            disabled={timeRemaining > 0}
            accessibilityLabel="Capture after photo"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Text className={`font-semibold text-lg ${
              timeRemaining === 0 ? 'text-white' : 'text-gray-500'
            }`}>
              {timeRemaining === 0 ? 'Capture After Photo' : `Wait ${formatTimeRemaining(timeRemaining)}`}
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
