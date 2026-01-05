import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * Profile screen - User stats, points, badge, and rank
 * Shows points breakdown and achievements
 */
export default function ProfileScreen() {
  // Placeholder data - will be replaced with API data
  const stats = {
    totalPoints: 0,
    currentBadge: { name: 'Cleanliness Rookie', icon: '🌱' },
    rank: 0,
    reportsCount: 0,
    streakDays: 0,
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView>
        {/* Header */}
        <View className="px-4 py-4 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold text-text-primary">
            Profile
          </Text>
        </View>

        {/* Badge card */}
        <View className="mx-4 mt-4 bg-primary rounded-2xl p-6 items-center">
          <Text className="text-5xl">{stats.currentBadge.icon}</Text>
          <Text className="text-xl font-bold text-white mt-2">
            {stats.currentBadge.name}
          </Text>
          <Text className="text-4xl font-bold text-white mt-4">
            {stats.totalPoints}
          </Text>
          <Text className="text-white/80">Total Points</Text>
        </View>

        {/* Stats grid */}
        <View className="flex-row mx-4 mt-4">
          <View className="flex-1 bg-white rounded-xl p-4 mr-2 items-center">
            <Ionicons name="document-text" size={24} color="#10B981" />
            <Text className="text-2xl font-bold text-text-primary mt-2">
              {stats.reportsCount}
            </Text>
            <Text className="text-sm text-text-secondary">Reports</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 mx-2 items-center">
            <Ionicons name="trophy" size={24} color="#F59E0B" />
            <Text className="text-2xl font-bold text-text-primary mt-2">
              #{stats.rank || '-'}
            </Text>
            <Text className="text-sm text-text-secondary">Rank</Text>
          </View>
          <View className="flex-1 bg-white rounded-xl p-4 ml-2 items-center">
            <Ionicons name="flame" size={24} color="#EF4444" />
            <Text className="text-2xl font-bold text-text-primary mt-2">
              {stats.streakDays}
            </Text>
            <Text className="text-sm text-text-secondary">Day Streak</Text>
          </View>
        </View>

        {/* Badge progress */}
        <View className="mx-4 mt-4 bg-white rounded-xl p-4">
          <Text className="text-lg font-semibold text-text-primary mb-4">
            Badge Progress
          </Text>
          {[
            { name: 'Cleanliness Rookie', icon: '🌱', requirement: 0 },
            { name: 'Eco Warrior', icon: '🌿', requirement: 50 },
            { name: 'Community Champion', icon: '🏆', requirement: 200 },
            { name: 'Cleanup Legend', icon: '👑', requirement: 500 },
          ].map((badge, index) => (
            <View
              key={badge.name}
              className={`flex-row items-center py-3 ${
                index > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <Text className="text-2xl">{badge.icon}</Text>
              <View className="flex-1 ml-3">
                <Text className="font-medium text-text-primary">
                  {badge.name}
                </Text>
                <Text className="text-sm text-text-secondary">
                  {badge.requirement} points required
                </Text>
              </View>
              {stats.totalPoints >= badge.requirement && (
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              )}
            </View>
          ))}
        </View>

        {/* Spacer */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
