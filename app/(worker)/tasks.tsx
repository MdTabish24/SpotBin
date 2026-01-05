import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * Worker tasks screen - Map and list view of assigned tasks
 * Shows tasks sorted by priority (severity + age)
 */
export default function WorkerTasksScreen() {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress'>('all');
  
  // Placeholder data - will be replaced with API data
  const tasks: any[] = [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-text-primary">
              My Tasks
            </Text>
            <Text className="text-sm text-text-secondary mt-1">
              {tasks.length} tasks assigned
            </Text>
          </View>
          
          {/* View toggle */}
          <View className="flex-row bg-gray-100 rounded-lg p-1">
            <TouchableOpacity
              className={`px-3 py-2 rounded-md ${
                viewMode === 'list' ? 'bg-white shadow-sm' : ''
              }`}
              onPress={() => setViewMode('list')}
              accessibilityLabel="List view"
              accessibilityRole="button"
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
            >
              <Ionicons
                name="map"
                size={20}
                color={viewMode === 'map' ? '#10B981' : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs */}
        <View className="flex-row mt-4">
          {(['all', 'open', 'in_progress'] as const).map((f) => (
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
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'In Progress'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'map' ? (
        <View className="flex-1 items-center justify-center bg-gray-100">
          <Ionicons name="map-outline" size={64} color="#D1D5DB" />
          <Text className="text-text-secondary mt-4">
            Map view will be implemented
          </Text>
        </View>
      ) : tasks.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
          <Text className="text-lg font-semibold text-text-primary mt-4">
            All caught up!
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            No tasks assigned to you right now
          </Text>
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.reportId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-white rounded-xl p-4 mb-3 shadow-sm"
              accessibilityLabel={`Task ${item.reportId}`}
              accessibilityRole="button"
              style={{ minHeight: 44 }}
            >
              <Text>{item.reportId}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
