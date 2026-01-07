import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Linking,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { workerTaskApi, Task } from '../../src/api/worker';
import { useWorkerAuth } from '../../src/hooks/useWorkerAuth';
import { useLocation, calculateDistance } from '../../src/hooks/useLocation';
import { useOfflineTaskCache } from '../../src/hooks/useOfflineTaskCache';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Button } from '../../src/components/ui/Button';
import { FreeMap } from '../../src/components/ui/FreeMap';
import { showErrorToast, showInfoToast } from '../../src/components/Toast';

type ViewMode = 'map' | 'list';
type FilterStatus = 'all' | 'open' | 'assigned' | 'in_progress';

// Status configuration for colors
const STATUS_CONFIG: Record<string, { color: string; markerColor: string; label: string }> = {
  open: { color: '#EF4444', markerColor: 'red', label: 'Open' },
  assigned: { color: '#F59E0B', markerColor: 'orange', label: 'Assigned' },
  in_progress: { color: '#3B82F6', markerColor: 'blue', label: 'In Progress' },
  verified: { color: '#8B5CF6', markerColor: 'purple', label: 'Verified' },
  resolved: { color: '#10B981', markerColor: 'green', label: 'Resolved' },
};

// Severity configuration
const SEVERITY_CONFIG: Record<string, { color: string; weight: number }> = {
  high: { color: '#EF4444', weight: 3 },
  medium: { color: '#F59E0B', weight: 2 },
  low: { color: '#10B981', weight: 1 },
};

/**
 * Worker tasks screen - Map and list view of assigned tasks
 * Shows tasks sorted by priority (severity + age)
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.2
 */
export default function WorkerTasksScreen() {
  const router = useRouter();
  
  const { worker, isAuthenticated, isLoading: authLoading, logout } = useWorkerAuth();
  const { location, getCurrentLocation, watchLocation, stopWatching } = useLocation();
  const { cachedTasks, isOnline, isSyncing, cacheTasks } = useOfflineTaskCache();
  
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/(worker)/login');
    }
  }, [isAuthenticated, authLoading]);

  // Start location watching when in map view
  useEffect(() => {
    if (viewMode === 'map') {
      watchLocation();
    } else {
      stopWatching();
    }
    
    return () => stopWatching();
  }, [viewMode]);

  // Fetch tasks when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchTasks();
        getCurrentLocation();
      }
    }, [isAuthenticated, filter])
  );

  const fetchTasks = async () => {
    // If offline, use cached tasks
    if (!isOnline) {
      showInfoToast('Offline Mode', 'Showing cached tasks');
      setTasks(cachedTasks);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await workerTaskApi.getTasks(filter === 'all' ? undefined : filter);
      
      // Sort by priority (severity weight + age in hours)
      const sortedTasks = data.sort((a, b) => {
        const aWeight = SEVERITY_CONFIG[a.severity]?.weight || 1;
        const bWeight = SEVERITY_CONFIG[b.severity]?.weight || 1;
        const aAge = (Date.now() - new Date(a.reportedAt).getTime()) / 3600000;
        const bAge = (Date.now() - new Date(b.reportedAt).getTime()) / 3600000;
        
        const aPriority = aWeight * 10 + aAge;
        const bPriority = bWeight * 10 + bAge;
        
        return bPriority - aPriority; // Higher priority first
      });
      
      // Calculate distance from current location
      if (location) {
        sortedTasks.forEach(task => {
          task.distance = calculateDistance(
            location.lat,
            location.lng,
            task.location.lat,
            task.location.lng
          );
        });
      }
      
      setTasks(sortedTasks);
      
      // Cache tasks for offline use (Requirement 7.5)
      await cacheTasks(sortedTasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      
      // Fall back to cached tasks on error
      if (cachedTasks.length > 0) {
        showInfoToast('Using Cached Data', 'Could not fetch latest tasks');
        setTasks(cachedTasks);
      } else {
        showErrorToast('Error', 'Failed to load tasks');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTasks();
  };

  const handleTaskPress = (task: Task) => {
    router.push(`/(worker)/task-detail?taskId=${task.reportId}`);
  };

  const handleNavigate = (task: Task) => {
    const { lat, lng } = task.location;
    const scheme = Platform.select({ ios: 'maps:', android: 'geo:' });
    const url = Platform.select({
      ios: `${scheme}?daddr=${lat},${lng}`,
      android: `${scheme}${lat},${lng}?q=${lat},${lng}`,
    });
    
    if (url) {
      Linking.openURL(url);
    }
  };

  const handleMarkerPress = (task: Task) => {
    setSelectedTask(task);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(worker)/login');
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
    return `${diffDays}d ago`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getMarkerColor = (status: string): string => {
    return STATUS_CONFIG[status]?.markerColor || 'red';
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const renderTaskItem = ({ item }: { item: Task }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const severityConfig = SEVERITY_CONFIG[item.severity];

    return (
      <TouchableOpacity
        onPress={() => handleTaskPress(item)}
        className="bg-white rounded-xl mb-3 overflow-hidden shadow-sm"
        accessibilityLabel={`Task ${item.reportId.slice(0, 8)}`}
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
            {/* Status and severity badges */}
            <View className="flex-row items-center mb-1">
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${statusConfig?.color}20` }}
              >
                <Text style={{ color: statusConfig?.color }} className="text-xs font-medium">
                  {statusConfig?.label}
                </Text>
              </View>
              <View
                className="ml-2 px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${severityConfig?.color}20` }}
              >
                <Text style={{ color: severityConfig?.color }} className="text-xs font-medium capitalize">
                  {item.severity}
                </Text>
              </View>
            </View>

            {/* Description */}
            <Text className="text-text-primary font-medium" numberOfLines={1}>
              {item.description || `Report #${item.reportId.slice(0, 8)}`}
            </Text>

            {/* Distance and time */}
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-1">
                {item.distance ? formatDistance(item.distance) : '--'} away
              </Text>
              <Text className="text-xs text-text-secondary mx-2">•</Text>
              <Ionicons name="time-outline" size={12} color="#6B7280" />
              <Text className="text-xs text-text-secondary ml-1">
                {formatTimeAgo(item.reportedAt)}
              </Text>
            </View>

            {/* Waste types */}
            <View className="flex-row flex-wrap mt-1">
              {item.wasteTypes?.slice(0, 2).map((type, index) => (
                <Text key={index} className="text-xs text-text-secondary mr-2">
                  #{type}
                </Text>
              ))}
            </View>
          </View>

          {/* Navigate button */}
          <TouchableOpacity
            onPress={() => handleNavigate(item)}
            className="justify-center px-3"
            accessibilityLabel="Navigate to task"
            accessibilityRole="button"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <Ionicons name="navigate" size={24} color="#10B981" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (authLoading || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner fullScreen message="Loading tasks..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        {/* Offline indicator */}
        {!isOnline && (
          <View className="bg-warning/20 rounded-lg px-3 py-2 mb-3 flex-row items-center">
            <Ionicons name="cloud-offline" size={16} color="#F59E0B" />
            <Text className="text-warning text-sm ml-2">
              Offline - Showing cached tasks
            </Text>
          </View>
        )}
        
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-text-primary">
              My Tasks
            </Text>
            <Text className="text-sm text-text-secondary mt-1">
              {worker?.name || 'Worker'} • {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </Text>
          </View>
          
          <View className="flex-row items-center">
            {/* View toggle */}
            <View className="flex-row bg-gray-100 rounded-lg p-1 mr-2">
              <TouchableOpacity
                className={`px-3 py-2 rounded-md ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : ''
                }`}
                onPress={() => setViewMode('list')}
                accessibilityLabel="List view"
                accessibilityRole="button"
                style={{ minWidth: 44, minHeight: 36 }}
              >
                <Ionicons
                  name="list"
                  size={20}
                  color={viewMode === 'list' ? '#10B981' : '#6B7280'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                className={`px-3 py-2 rounded-md ${
                  viewMode === 'map' ? 'bg-white shadow-sm' : ''
                }`}
                onPress={() => setViewMode('map')}
                accessibilityLabel="Map view"
                accessibilityRole="button"
                style={{ minWidth: 44, minHeight: 36 }}
              >
                <Ionicons
                  name="map"
                  size={20}
                  color={viewMode === 'map' ? '#10B981' : '#6B7280'}
                />
              </TouchableOpacity>
            </View>

            {/* Logout button */}
            <TouchableOpacity
              onPress={handleLogout}
              className="p-2"
              accessibilityLabel="Logout"
              accessibilityRole="button"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <Ionicons name="log-out-outline" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs */}
        <View className="flex-row mt-4">
          {(['all', 'open', 'assigned', 'in_progress'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              className={`px-4 py-2 rounded-full mr-2 ${
                filter === f ? 'bg-primary' : 'bg-gray-100'
              }`}
              onPress={() => setFilter(f)}
              accessibilityLabel={`Filter ${f}`}
              accessibilityRole="button"
              style={{ minHeight: 44 }}
            >
              <Text
                className={`font-medium ${
                  filter === f ? 'text-white' : 'text-text-secondary'
                }`}
              >
                {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'map' ? (
        <View className="flex-1">
          {/* FREE OpenStreetMap */}
          <FreeMap
            center={{
              lat: location?.lat || 19.076,
              lng: location?.lng || 72.8777,
            }}
            zoom={13}
            markers={filteredTasks.map(task => ({
              id: task.reportId,
              lat: task.location.lat,
              lng: task.location.lng,
              color: STATUS_CONFIG[task.status]?.color || '#EF4444',
              title: `#${task.reportId.slice(0, 8)}`,
              description: `${STATUS_CONFIG[task.status]?.label} - ${task.severity}`,
            }))}
            onMarkerPress={(marker) => {
              const task = filteredTasks.find(t => t.reportId === marker.id);
              if (task) setSelectedTask(task);
            }}
            showUserLocation={true}
            userLocation={location}
            style={{ flex: 1 }}
          />

          {/* Selected task card */}
          {selectedTask && (
            <View className="absolute bottom-4 left-4 right-4">
              <View className="bg-white rounded-xl shadow-lg overflow-hidden">
                <View className="flex-row">
                  <Image
                    source={{ uri: selectedTask.photoUrl }}
                    className="w-24 h-24"
                    resizeMode="cover"
                  />
                  <View className="flex-1 p-3">
                    <View className="flex-row items-center mb-1">
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${STATUS_CONFIG[selectedTask.status]?.color}20` }}
                      >
                        <Text
                          style={{ color: STATUS_CONFIG[selectedTask.status]?.color }}
                          className="text-xs font-medium"
                        >
                          {STATUS_CONFIG[selectedTask.status]?.label}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-text-primary font-medium" numberOfLines={1}>
                      {selectedTask.description || `Report #${selectedTask.reportId.slice(0, 8)}`}
                    </Text>
                    <Text className="text-xs text-text-secondary mt-1">
                      {selectedTask.distance ? formatDistance(selectedTask.distance) : '--'} away
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedTask(null)}
                    className="p-2"
                    accessibilityLabel="Close"
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <View className="flex-row border-t border-gray-100">
                  <TouchableOpacity
                    onPress={() => handleNavigate(selectedTask)}
                    className="flex-1 flex-row items-center justify-center py-3"
                    accessibilityLabel="Navigate"
                    style={{ minHeight: 44 }}
                  >
                    <Ionicons name="navigate" size={18} color="#10B981" />
                    <Text className="text-primary font-medium ml-2">Navigate</Text>
                  </TouchableOpacity>
                  <View className="w-px bg-gray-100" />
                  <TouchableOpacity
                    onPress={() => handleTaskPress(selectedTask)}
                    className="flex-1 flex-row items-center justify-center py-3"
                    accessibilityLabel="View details"
                    style={{ minHeight: 44 }}
                  >
                    <Ionicons name="eye" size={18} color="#3B82F6" />
                    <Text className="text-blue-500 font-medium ml-2">Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Legend */}
          <View className="absolute top-4 right-4 bg-white rounded-lg p-2 shadow-sm">
            <Text className="text-xs font-semibold text-text-secondary mb-1">Status</Text>
            {Object.entries(STATUS_CONFIG).slice(0, 3).map(([key, config]) => (
              <View key={key} className="flex-row items-center mt-1">
                <View
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: config.color }}
                />
                <Text className="text-xs text-text-secondary">{config.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : filteredTasks.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
          <Text className="text-lg font-semibold text-text-primary mt-4">
            All caught up!
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            No tasks assigned to you right now
          </Text>
          <Button
            variant="outline"
            onPress={handleRefresh}
            className="mt-6"
          >
            Refresh
          </Button>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.reportId}
          renderItem={renderTaskItem}
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
    </SafeAreaView>
  );
}
