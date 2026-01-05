import { useState, useEffect, useRef } from 'react';
import { Camera, CameraType, CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { showErrorToast } from '../components/Toast';

interface UseCameraReturn {
  hasPermission: boolean | null;
  isReady: boolean;
  cameraRef: React.RefObject<CameraView>;
  cameraType: CameraType;
  toggleCameraType: () => void;
  takePicture: () => Promise<string | null>;
  requestPermission: () => Promise<boolean>;
}

/**
 * Hook for camera functionality
 * Handles permissions, capture, and image processing
 */
export function useCamera(): UseCameraReturn {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status } = await Camera.getCameraPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);
    
    if (!granted) {
      showErrorToast(
        'Camera Permission Required',
        'Please enable camera access in settings'
      );
    }
    
    return granted;
  };

  const toggleCameraType = () => {
    setCameraType((current) => (current === 'back' ? 'front' : 'back'));
  };

  const takePicture = async (): Promise<string | null> => {
    if (!cameraRef.current || !isReady) {
      showErrorToast('Camera Error', 'Camera is not ready');
      return null;
    }

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: true,
      });

      if (!photo) {
        showErrorToast('Camera Error', 'Failed to capture photo');
        return null;
      }

      // Process image - resize and compress to max 5MB
      const processed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1920 } }], // Max width 1920px
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      return processed.uri;
    } catch (error) {
      console.error('Error taking picture:', error);
      showErrorToast('Camera Error', 'Failed to capture photo');
      return null;
    }
  };

  return {
    hasPermission,
    isReady,
    cameraRef,
    cameraType,
    toggleCameraType,
    takePicture,
    requestPermission,
  };
}

export default useCamera;
