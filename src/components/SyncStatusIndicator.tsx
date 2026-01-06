import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SyncStatus } from '../hooks/useSyncManager';

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  onSyncPress?: () => void;
}

/**
 * Visual indicator for sync status
 * Shows online/offline state and pending report count
 */
export function SyncStatusIndicator({
  isOnline,
  syncStatus,
  pendingCount,
  onSyncPress,
}: SyncStatusIndicatorProps) {
  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: 'cloud-offline' as const,
        color: '#6B7280', // gray-500
        text: 'Offline',
        bgColor: '#F3F4F6', // gray-100
      };
    }

    switch (syncStatus) {
      case 'syncing':
        return {
          icon: 'cloud-upload' as const,
          color: '#3B82F6', // blue-500
          text: 'Syncing...',
          bgColor: '#EFF6FF', // blue-50
        };
      case 'error':
        return {
          icon: 'cloud-offline' as const,
          color: '#EF4444', // red-500
          text: 'Sync failed',
          bgColor: '#FEF2F2', // red-50
        };
      default:
        if (pendingCount > 0) {
          return {
            icon: 'cloud-upload-outline' as const,
            color: '#F59E0B', // amber-500
            text: `${pendingCount} pending`,
            bgColor: '#FFFBEB', // amber-50
          };
        }
        return {
          icon: 'cloud-done' as const,
          color: '#10B981', // green-500
          text: 'Synced',
          bgColor: '#ECFDF5', // green-50
        };
    }
  };

  const config = getStatusConfig();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: config.bgColor,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
      }}
    >
      {syncStatus === 'syncing' ? (
        <ActivityIndicator size="small" color={config.color} />
      ) : (
        <Ionicons name={config.icon} size={16} color={config.color} />
      )}
      <Text style={{ color: config.color, fontSize: 12, fontWeight: '500' }}>
        {config.text}
      </Text>
    </View>
  );

  if (onSyncPress && (syncStatus === 'error' || pendingCount > 0) && isOnline) {
    return (
      <TouchableOpacity onPress={onSyncPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default SyncStatusIndicator;
