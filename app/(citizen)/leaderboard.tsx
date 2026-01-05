import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

/**
 * Leaderboard screen - City-wide and area-wise rankings
 * Shows rank, points, and badge for top contributors
 */
export default function LeaderboardScreen() {
  const [scope, setScope] = useState<'city' | 'area'>('city');
  
  // Placeholder data - will be replaced with API data
  const leaderboard: any[] = [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-text-primary">
          Leaderboard
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Top contributors in your community
        </Text>
      </View>

      {/* Scope toggle */}
      <View className="flex-row px-4 py-3 bg-white">
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg mr-2 ${
            scope === 'city' ? 'bg-primary' : 'bg-gray-100'
          }`}
          onPress={() => setScope('city')}
          accessibilityLabel="City-wide leaderboard"
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <Text
            className={`text-center font-semibold ${
              scope === 'city' ? 'text-white' : 'text-text-secondary'
            }`}
          >
            City-wide
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-2 rounded-lg ml-2 ${
            scope === 'area' ? 'bg-primary' : 'bg-gray-100'
          }`}
          onPress={() => setScope('area')}
          accessibilityLabel="Area-wise leaderboard"
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <Text
            className={`text-center font-semibold ${
              scope === 'area' ? 'text-white' : 'text-text-secondary'
            }`}
          >
            My Area
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leaderboard list */}
      {leaderboard.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="trophy-outline" size={64} color="#D1D5DB" />
          <Text className="text-lg font-semibold text-text-primary mt-4">
            No rankings yet
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            Be the first to report waste and earn points!
          </Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.deviceId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item, index }) => (
            <View className="bg-white rounded-xl p-4 mb-3 shadow-sm flex-row items-center">
              <Text className="text-lg font-bold text-text-primary w-8">
                {index + 1}
              </Text>
              <View className="flex-1 ml-3">
                <Text className="font-semibold text-text-primary">
                  {item.deviceId}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {item.reportsCount} reports
                </Text>
              </View>
              <Text className="text-lg font-bold text-primary">
                {item.points} pts
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
