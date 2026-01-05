import { View, Text, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * My Reports screen - Shows all reports submitted by this device
 * Displays status, thumbnail, location, and timestamp
 */
export default function ReportsScreen() {
  // Placeholder data - will be replaced with API data
  const reports: any[] = [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-text-primary">
          My Reports
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Track the status of your waste reports
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
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
              <Text>{item.id}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
