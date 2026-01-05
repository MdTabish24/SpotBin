import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

/**
 * Task detail screen - Shows full task information
 * Includes photo, location, severity, and action buttons
 */
export default function TaskDetailScreen() {
  const { taskId } = useLocalSearchParams();

  // Placeholder data - will be replaced with API data
  const task = {
    reportId: taskId,
    photoUrl: null,
    location: { lat: 19.076, lng: 72.8777 },
    severity: 'medium',
    wasteType: ['Plastic', 'Paper'],
    reportedAt: new Date(),
    distance: 500,
    estimatedTime: 15,
    status: 'assigned',
    description: 'Waste near bus stop',
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-danger';
      case 'medium':
        return 'bg-warning';
      default:
        return 'bg-primary';
    }
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
          Task Details
        </Text>
      </View>

      <ScrollView className="flex-1">
        {/* Photo */}
        <View className="aspect-video bg-gray-200 items-center justify-center">
          {task.photoUrl ? (
            <Image
              source={{ uri: task.photoUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          )}
        </View>

        {/* Info cards */}
        <View className="p-4">
          {/* Severity badge */}
          <View className="flex-row items-center mb-4">
            <View
              className={`px-3 py-1 rounded-full ${getSeverityColor(task.severity)}`}
            >
              <Text className="text-white font-medium capitalize">
                {task.severity} Priority
              </Text>
            </View>
            <Text className="text-text-secondary ml-3">
              {task.distance}m away • ~{task.estimatedTime} min
            </Text>
          </View>

          {/* Description */}
          {task.description && (
            <View className="bg-white rounded-xl p-4 mb-4">
              <Text className="text-sm text-text-secondary mb-1">
                Description
              </Text>
              <Text className="text-text-primary">{task.description}</Text>
            </View>
          )}

          {/* Waste types */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-sm text-text-secondary mb-2">
              Waste Types
            </Text>
            <View className="flex-row flex-wrap">
              {task.wasteType.map((type) => (
                <View
                  key={type}
                  className="bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2"
                >
                  <Text className="text-text-primary">{type}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Location */}
          <View className="bg-white rounded-xl p-4 mb-4">
            <Text className="text-sm text-text-secondary mb-2">Location</Text>
            <View className="flex-row items-center">
              <Ionicons name="location" size={20} color="#10B981" />
              <Text className="text-text-primary ml-2">
                {task.location.lat.toFixed(4)}, {task.location.lng.toFixed(4)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View className="p-4 bg-white border-t border-gray-200">
        <View className="flex-row">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center py-4 bg-secondary rounded-xl mr-2"
            accessibilityLabel="Navigate to location"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Ionicons name="navigate" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center py-4 bg-primary rounded-xl ml-2"
            onPress={() => router.push(`/(worker)/verification?taskId=${taskId}`)}
            accessibilityLabel="Start task"
            accessibilityRole="button"
            style={{ minHeight: 44 }}
          >
            <Ionicons name="play" size={20} color="white" />
            <Text className="text-white font-semibold ml-2">Start Task</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
