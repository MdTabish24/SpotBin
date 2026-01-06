import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { reportApi, WasteReport } from '../../src/api/reports';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Modal } from '../../src/components/ui/Modal';
import { Button } from '../../src/components/ui/Button';
import { showErrorToast } from '../../src/components/Toast';

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: string; label: string }> = {
  open: { color: '#EF4444', bgColor: 'bg-red-100', icon: 'time-outline', label: 'Open' },
  assigned: { color: '#F59E0B', bgColor: 'bg-yellow-100', icon: 'person-outline', label: 'Assigned' },
  in_progress: { color: '#3B82F6', bgColor: 'bg-blue-100', icon: 'construct-outline', label: 'In Progress' },
  verified: { color: '#8B5CF6', bgColor: 'bg-purple-100', icon: 'checkmark-circle-outline', label: 'Verified' },
  resolved: { color: '#10B981', bgColor: 'bg-green-100', icon: 'checkmark-done-outline', label: 'Resolved' },
};

// Severity configuration
const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: '#10B981', label: 'Low' },
  medium: { color: '#F59E0B', label: 'Medium' },
  high: { color: '#EF4444', label: 'High' },
};

/**
 * My Reports screen - Shows all reports submitted by this device
 * Displays status, thumbnail, location, and timestamp
 * Requirements: 5.1, 5.2, 5.4
 */
export default function ReportsScreen() {
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WasteReport | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch reports when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [])
  );

  const fetchReports = async () => {
    try {
      const data = await reportApi.getMyReports();
      setReports(data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      // Don't show error toast on initial load - might just be no reports yet
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchReports();
  };

  const handleReportPress = (report: WasteReport) => {
    setSelectedReport(report);
    setShowDetailModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  const renderReportItem = ({ item }: { item: WasteReport }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.open;
    const severityConfig = item.severity ? SEVERITY_CONFIG[item.severity] : null;

    return (
      <TouchableOpacity
        onPress={() => handleReportPress(item)}
        className="bg-white rounded-xl mb-3 overflow-hidden shadow-sm"
        accessibilityLabel={`Report ${item.id.slice(0, 8)}, status ${statusConfig.label}`}
        accessibilityRole="button"
        style={{ minHeight: 44 }}
      >
        <View className="flex-row">
          {/* Thumbnail */}
          <Image
            source={{ uri: item.photoUrl }}
            className="w-24 h-24"
            resizeMode="cover"
          />

          {/* Content */}
          <View className="flex-1 p-3">
            {/* Status badge */}
            <View className="flex-row items-center mb-1">
              <View className={`flex-row items-center px-2 py-1 rounded-full ${statusConfig.bgColor}`}>
                <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                <Text style={{ color: statusConfig.color }} className="text-xs font-medium ml-1">
                  {statusConfig.label}
                </Text>
              </View>
              
              {severityConfig && (
                <View className="ml-2 px-2 py-1 rounded-full bg-gray-100">
                  <Text style={{ color: severityConfig.color }} className="text-xs font-medium">
                    {severityConfig.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Description or ID */}
            <Text className="text-text-primary font-medium" numberOfLines={1}>
              {item.description || `Report #${item.id.slice(0, 8)}`}
            </Text>

            {/* Location and time */}
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-1" numberOfLines={1}>
                {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}
              </Text>
            </View>

            <View className="flex-row items-center mt-1">
              <Ionicons name="time-outline" size={12} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-1">
                {formatTimeAgo(item.createdAt)}
              </Text>
              
              {item.pointsAwarded && item.pointsAwarded > 0 && (
                <View className="flex-row items-center ml-3">
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text className="text-xs text-yellow-600 ml-1">
                    +{item.pointsAwarded} pts
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Arrow */}
          <View className="justify-center pr-3">
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner fullScreen message="Loading reports..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-text-primary">
          My Reports
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          {reports.length > 0
            ? `${reports.length} report${reports.length !== 1 ? 's' : ''} submitted`
            : 'Track the status of your waste reports'}
        </Text>
      </View>

      {/* Reports list */}
      {reports.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="document-text-outline" size={64} color="#D1D5DB" />
          <Text className="text-lg font-semibold text-text-primary mt-4">
            No reports yet
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            Start by capturing a photo of waste in your area
          </Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#10B981']}
              tintColor="#10B981"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Report Detail Modal */}
      <Modal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Report Details"
      >
        {selectedReport && (
          <View>
            {/* Main photo */}
            <Image
              source={{ uri: selectedReport.photoUrl }}
              className="w-full h-48 rounded-xl"
              resizeMode="cover"
            />

            {/* Status */}
            <View className="flex-row items-center mt-4">
              <View className={`flex-row items-center px-3 py-1.5 rounded-full ${STATUS_CONFIG[selectedReport.status]?.bgColor}`}>
                <Ionicons
                  name={STATUS_CONFIG[selectedReport.status]?.icon as any}
                  size={16}
                  color={STATUS_CONFIG[selectedReport.status]?.color}
                />
                <Text
                  style={{ color: STATUS_CONFIG[selectedReport.status]?.color }}
                  className="font-semibold ml-1"
                >
                  {STATUS_CONFIG[selectedReport.status]?.label}
                </Text>
              </View>
              
              {selectedReport.severity && (
                <View className="ml-2 px-3 py-1.5 rounded-full bg-gray-100">
                  <Text
                    style={{ color: SEVERITY_CONFIG[selectedReport.severity]?.color }}
                    className="font-semibold"
                  >
                    {SEVERITY_CONFIG[selectedReport.severity]?.label} Severity
                  </Text>
                </View>
              )}
            </View>

            {/* Description */}
            {selectedReport.description && (
              <View className="mt-4">
                <Text className="text-sm text-text-secondary">Description</Text>
                <Text className="text-text-primary mt-1">{selectedReport.description}</Text>
              </View>
            )}

            {/* Details */}
            <View className="mt-4 bg-gray-50 rounded-xl p-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary">Report ID</Text>
                <Text className="text-text-primary font-medium">
                  #{selectedReport.id.slice(0, 8)}
                </Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary">Submitted</Text>
                <Text className="text-text-primary">
                  {formatDate(selectedReport.createdAt)}
                </Text>
              </View>
              
              <View className="flex-row justify-between mb-2">
                <Text className="text-text-secondary">Location</Text>
                <Text className="text-text-primary">
                  {selectedReport.location.lat.toFixed(4)}, {selectedReport.location.lng.toFixed(4)}
                </Text>
              </View>
              
              {selectedReport.pointsAwarded && selectedReport.pointsAwarded > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-text-secondary">Points Earned</Text>
                  <Text className="text-primary font-semibold">
                    +{selectedReport.pointsAwarded} pts
                  </Text>
                </View>
              )}
            </View>

            {/* Before/After photos for resolved reports */}
            {selectedReport.status === 'resolved' && (
              <View className="mt-4">
                <Text className="text-sm text-text-secondary mb-2">Before & After</Text>
                <View className="flex-row">
                  {selectedReport.beforePhotoUrl && (
                    <View className="flex-1 mr-2">
                      <Image
                        source={{ uri: selectedReport.beforePhotoUrl }}
                        className="w-full h-32 rounded-xl"
                        resizeMode="cover"
                      />
                      <Text className="text-xs text-text-secondary text-center mt-1">Before</Text>
                    </View>
                  )}
                  {selectedReport.afterPhotoUrl && (
                    <View className="flex-1 ml-2">
                      <Image
                        source={{ uri: selectedReport.afterPhotoUrl }}
                        className="w-full h-32 rounded-xl"
                        resizeMode="cover"
                      />
                      <Text className="text-xs text-text-secondary text-center mt-1">After</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Resolution info */}
            {selectedReport.resolvedAt && (
              <View className="mt-4 bg-green-50 rounded-xl p-4">
                <View className="flex-row items-center">
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text className="text-green-700 font-medium ml-2">
                    Resolved on {formatDate(selectedReport.resolvedAt)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}
