import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { reportApi, LeaderboardEntry, UserStats } from '../../src/api/reports';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useDeviceFingerprint } from '../../src/hooks/useDeviceFingerprint';

// Badge configuration
const BADGE_CONFIG: Record<string, { icon: string; color: string }> = {
  'Cleanliness Rookie': { icon: '🌱', color: '#10B981' },
  'Eco Warrior': { icon: '🌿', color: '#059669' },
  'Community Champion': { icon: '🏆', color: '#F59E0B' },
  'Cleanup Legend': { icon: '👑', color: '#8B5CF6' },
};

// Rank medal colors
const RANK_COLORS: Record<number, string> = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver
  3: '#CD7F32', // Bronze
};

/**
 * Leaderboard screen - City-wide and area-wise rankings
 * Shows rank, points, and badge for top contributors
 * Requirements: 4.1, 4.2
 */
export default function LeaderboardScreen() {
  const { fingerprint } = useDeviceFingerprint();
  
  const [scope, setScope] = useState<'city' | 'area'>('city');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data when screen is focused or scope changes
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [scope])
  );

  const fetchData = async () => {
    try {
      const [leaderboardData, statsData] = await Promise.all([
        reportApi.getLeaderboard(scope, 50),
        reportApi.getUserStats(),
      ]);
      
      setLeaderboard(leaderboardData);
      setUserStats(statsData);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleScopeChange = (newScope: 'city' | 'area') => {
    if (newScope !== scope) {
      setScope(newScope);
      setIsLoading(true);
    }
  };

  // Check if entry is current user (by comparing hashed device ID)
  const isCurrentUser = (entry: LeaderboardEntry) => {
    if (!fingerprint) return false;
    // The backend hashes the device ID, so we compare the first 8 chars
    return entry.deviceId.startsWith(fingerprint.slice(0, 8));
  };

  const renderRankBadge = (rank: number) => {
    if (rank <= 3) {
      return (
        <View
          className="w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: RANK_COLORS[rank] }}
        >
          <Text className="text-white font-bold">{rank}</Text>
        </View>
      );
    }
    
    return (
      <View className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
        <Text className="text-text-secondary font-semibold">{rank}</Text>
      </View>
    );
  };

  const renderLeaderboardItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isMe = isCurrentUser(item);
    const badgeConfig = BADGE_CONFIG[item.badge] || BADGE_CONFIG['Cleanliness Rookie'];

    return (
      <View
        className={`flex-row items-center py-4 px-4 ${
          isMe ? 'bg-primary/10 rounded-xl mx-2 my-1' : 'border-b border-gray-100'
        }`}
      >
        {/* Rank */}
        <View className="w-12 items-center">
          {renderRankBadge(item.rank)}
        </View>

        {/* User info */}
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className={`font-semibold ${isMe ? 'text-primary' : 'text-text-primary'}`}>
              {isMe ? 'You' : `User ${item.deviceId.slice(0, 6)}`}
            </Text>
            <Text className="ml-2">{badgeConfig.icon}</Text>
          </View>
          <Text className="text-sm text-text-secondary">
            {item.reportsCount} report{item.reportsCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Points */}
        <View className="items-end">
          <Text className={`text-lg font-bold ${isMe ? 'text-primary' : 'text-text-primary'}`}>
            {item.points.toLocaleString()}
          </Text>
          <Text className="text-xs text-text-secondary">points</Text>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <>
      {/* User's rank card */}
      {userStats && (
        <View className="mx-4 mb-4 bg-primary rounded-2xl p-4">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center">
              <Text className="text-3xl">{userStats.currentBadge.icon}</Text>
            </View>
            
            <View className="flex-1 ml-4">
              <Text className="text-white/80 text-sm">Your Rank</Text>
              <Text className="text-white text-3xl font-bold">
                #{scope === 'city' ? userStats.cityRank : userStats.areaRank || '-'}
              </Text>
            </View>
            
            <View className="items-end">
              <Text className="text-white text-2xl font-bold">
                {userStats.totalPoints.toLocaleString()}
              </Text>
              <Text className="text-white/80 text-sm">points</Text>
            </View>
          </View>
          
          <View className="flex-row mt-4 pt-4 border-t border-white/20">
            <View className="flex-1 items-center">
              <Text className="text-white text-lg font-bold">{userStats.reportsCount}</Text>
              <Text className="text-white/80 text-xs">Reports</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-white text-lg font-bold">{userStats.streakDays}</Text>
              <Text className="text-white/80 text-xs">Day Streak</Text>
            </View>
            <View className="flex-1 items-center">
              <Text className="text-white text-lg font-bold">{userStats.currentBadge.name.split(' ')[0]}</Text>
              <Text className="text-white/80 text-xs">Badge</Text>
            </View>
          </View>
        </View>
      )}

      {/* Top 3 podium */}
      {leaderboard.length >= 3 && (
        <View className="flex-row justify-center items-end mx-4 mb-6 h-40">
          {/* 2nd place */}
          <View className="items-center flex-1">
            <Text className="text-2xl mb-1">{BADGE_CONFIG[leaderboard[1]?.badge]?.icon || '🌱'}</Text>
            <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center mb-2">
              <Text className="text-xl font-bold text-text-secondary">2</Text>
            </View>
            <Text className="text-sm font-medium text-text-primary" numberOfLines={1}>
              {isCurrentUser(leaderboard[1]) ? 'You' : `User ${leaderboard[1]?.deviceId.slice(0, 4)}`}
            </Text>
            <Text className="text-xs text-text-secondary">{leaderboard[1]?.points.toLocaleString()} pts</Text>
            <View className="w-full h-20 bg-gray-200 rounded-t-xl mt-2" />
          </View>

          {/* 1st place */}
          <View className="items-center flex-1 mx-2">
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text className="text-2xl mb-1">{BADGE_CONFIG[leaderboard[0]?.badge]?.icon || '🌱'}</Text>
            <View className="w-20 h-20 rounded-full bg-yellow-100 items-center justify-center mb-2 border-4 border-yellow-400">
              <Text className="text-2xl font-bold text-yellow-600">1</Text>
            </View>
            <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
              {isCurrentUser(leaderboard[0]) ? 'You' : `User ${leaderboard[0]?.deviceId.slice(0, 4)}`}
            </Text>
            <Text className="text-xs text-text-secondary">{leaderboard[0]?.points.toLocaleString()} pts</Text>
            <View className="w-full h-28 bg-yellow-100 rounded-t-xl mt-2" />
          </View>

          {/* 3rd place */}
          <View className="items-center flex-1">
            <Text className="text-2xl mb-1">{BADGE_CONFIG[leaderboard[2]?.badge]?.icon || '🌱'}</Text>
            <View className="w-16 h-16 rounded-full bg-orange-100 items-center justify-center mb-2">
              <Text className="text-xl font-bold text-orange-600">3</Text>
            </View>
            <Text className="text-sm font-medium text-text-primary" numberOfLines={1}>
              {isCurrentUser(leaderboard[2]) ? 'You' : `User ${leaderboard[2]?.deviceId.slice(0, 4)}`}
            </Text>
            <Text className="text-xs text-text-secondary">{leaderboard[2]?.points.toLocaleString()} pts</Text>
            <View className="w-full h-16 bg-orange-100 rounded-t-xl mt-2" />
          </View>
        </View>
      )}

      {/* Section header */}
      <View className="px-4 py-2 bg-gray-50">
        <Text className="text-sm font-semibold text-text-secondary">
          ALL RANKINGS
        </Text>
      </View>
    </>
  );

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 py-4 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold text-text-primary">Leaderboard</Text>
        </View>
        <LoadingSpinner fullScreen message="Loading rankings..." />
      </SafeAreaView>
    );
  }

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
      <View className="flex-row px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl mr-2 ${
            scope === 'city' ? 'bg-primary' : 'bg-gray-100'
          }`}
          onPress={() => handleScopeChange('city')}
          accessibilityLabel="City-wide leaderboard"
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons
              name="globe-outline"
              size={18}
              color={scope === 'city' ? 'white' : '#6B7280'}
            />
            <Text
              className={`ml-2 font-semibold ${
                scope === 'city' ? 'text-white' : 'text-text-secondary'
              }`}
            >
              City-wide
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          className={`flex-1 py-3 rounded-xl ml-2 ${
            scope === 'area' ? 'bg-primary' : 'bg-gray-100'
          }`}
          onPress={() => handleScopeChange('area')}
          accessibilityLabel="Area-wise leaderboard"
          accessibilityRole="button"
          style={{ minHeight: 44 }}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons
              name="location-outline"
              size={18}
              color={scope === 'area' ? 'white' : '#6B7280'}
            />
            <Text
              className={`ml-2 font-semibold ${
                scope === 'area' ? 'text-white' : 'text-text-secondary'
              }`}
            >
              My Area
            </Text>
          </View>
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
          renderItem={renderLeaderboardItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 16 }}
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
