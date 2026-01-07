import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { reportApi, UserStats, WasteReport } from '../../src/api/reports';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Card, CardBody } from '../../src/components/ui/Card';

// Badge configuration with thresholds
const BADGES = [
  { name: 'Cleanliness Rookie', icon: '🌱', requirement: 0, color: '#10B981' },
  { name: 'Eco Warrior', icon: '🌿', requirement: 50, color: '#059669' },
  { name: 'Community Champion', icon: '🏆', requirement: 200, color: '#F59E0B' },
  { name: 'Cleanup Legend', icon: '👑', requirement: 500, color: '#8B5CF6' },
];

// Points breakdown categories
interface PointsBreakdown {
  verified: number;
  highSeverity: number;
  streak: number;
  pioneer: number;
}

/**
 * Profile screen - User stats, points, badge, and rank
 * Shows points breakdown and achievements
 * Requirements: 3.6
 */
export default function ProfileScreen() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [recentReports, setRecentReports] = useState<WasteReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const [statsData, reportsData] = await Promise.all([
        reportApi.getUserStats(),
        reportApi.getMyReports(),
      ]);
      
      setStats(statsData);
      setRecentReports(reportsData.slice(0, 5)); // Last 5 reports
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Calculate progress to next badge
  const getNextBadge = () => {
    if (!stats) return null;
    
    const currentBadgeIndex = BADGES.findIndex(b => b.name === stats.currentBadge.name);
    if (currentBadgeIndex === BADGES.length - 1) return null; // Already at max
    
    return BADGES[currentBadgeIndex + 1];
  };

  const getProgressToNextBadge = () => {
    if (!stats) return 0;
    
    const nextBadge = getNextBadge();
    if (!nextBadge) return 100;
    
    const currentBadge = BADGES.find(b => b.name === stats.currentBadge.name);
    if (!currentBadge) return 0;
    
    const pointsInCurrentTier = stats.totalPoints - currentBadge.requirement;
    const pointsNeededForNext = nextBadge.requirement - currentBadge.requirement;
    
    return Math.min(100, Math.round((pointsInCurrentTier / pointsNeededForNext) * 100));
  };

  // Calculate estimated points breakdown (simplified)
  const getPointsBreakdown = (): PointsBreakdown => {
    if (!stats) return { verified: 0, highSeverity: 0, streak: 0, pioneer: 0 };
    
    // Estimate based on reports count and total points
    const basePoints = stats.reportsCount * 10;
    const extraPoints = stats.totalPoints - basePoints;
    
    return {
      verified: Math.min(basePoints, stats.totalPoints),
      highSeverity: Math.max(0, Math.floor(extraPoints * 0.3)),
      streak: Math.max(0, Math.floor(extraPoints * 0.4)),
      pioneer: Math.max(0, Math.floor(extraPoints * 0.3)),
    };
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-4 py-4 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold text-text-primary">Profile</Text>
        </View>
        <LoadingSpinner fullScreen message="Loading profile..." />
      </SafeAreaView>
    );
  }

  const nextBadge = getNextBadge();
  const progress = getProgressToNextBadge();
  const breakdown = getPointsBreakdown();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#10B981']}
            tintColor="#10B981"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-4 py-4 bg-white border-b border-gray-200">
          <Text className="text-2xl font-bold text-text-primary">
            Profile
          </Text>
        </View>

        {/* Badge card */}
        <View className="mx-4 mt-4 bg-primary rounded-2xl p-6 items-center">
          <Text className="text-6xl">{stats?.currentBadge.icon || '🌱'}</Text>
          <Text className="text-xl font-bold text-white mt-3">
            {stats?.currentBadge.name || 'Cleanliness Rookie'}
          </Text>
          
          <View className="flex-row items-baseline mt-4">
            <Text className="text-5xl font-bold text-white">
              {stats?.totalPoints.toLocaleString() || 0}
            </Text>
            <Text className="text-white/80 ml-2 text-lg">points</Text>
          </View>

          {/* Progress to next badge */}
          {nextBadge && (
            <View className="w-full mt-6">
              <View className="flex-row justify-between mb-2">
                <Text className="text-white/80 text-sm">
                  Progress to {nextBadge.name}
                </Text>
                <Text className="text-white text-sm font-medium">
                  {progress}%
                </Text>
              </View>
              <View className="h-2 bg-white/20 rounded-full overflow-hidden">
                <View
                  className="h-full bg-white rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </View>
              <Text className="text-white/60 text-xs mt-1 text-center">
                {nextBadge.requirement - (stats?.totalPoints || 0)} points to go
              </Text>
            </View>
          )}
        </View>

        {/* Stats grid */}
        <View className="flex-row mx-4 mt-4">
          <View className="flex-1 bg-white rounded-xl p-4 mr-2 items-center shadow-sm">
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
              <Ionicons name="document-text" size={24} color="#10B981" />
            </View>
            <Text className="text-2xl font-bold text-text-primary mt-2">
              {stats?.reportsCount || 0}
            </Text>
            <Text className="text-sm text-text-secondary">Reports</Text>
          </View>
          
          <View className="flex-1 bg-white rounded-xl p-4 mx-2 items-center shadow-sm">
            <View className="w-12 h-12 rounded-full bg-yellow-100 items-center justify-center">
              <Ionicons name="trophy" size={24} color="#F59E0B" />
            </View>
            <Text className="text-2xl font-bold text-text-primary mt-2">
              #{stats?.cityRank || '-'}
            </Text>
            <Text className="text-sm text-text-secondary">City Rank</Text>
          </View>
          
          <View className="flex-1 bg-white rounded-xl p-4 ml-2 items-center shadow-sm">
            <View className="w-12 h-12 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="flame" size={24} color="#EF4444" />
            </View>
            <Text className="text-2xl font-bold text-text-primary mt-2">
              {stats?.streakDays || 0}
            </Text>
            <Text className="text-sm text-text-secondary">Day Streak</Text>
          </View>
        </View>

        {/* Points breakdown */}
        <Card className="mx-4 mt-4" elevation="sm">
          <CardBody>
            <Text className="text-lg font-semibold text-text-primary mb-4">
              Points Breakdown
            </Text>
            
            <View className="space-y-3">
              <View className="flex-row items-center justify-between py-2">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  </View>
                  <Text className="text-text-primary ml-3">Verified Reports</Text>
                </View>
                <Text className="text-text-primary font-semibold">
                  +{breakdown.verified}
                </Text>
              </View>
              
              <View className="flex-row items-center justify-between py-2 border-t border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-red-100 items-center justify-center">
                    <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  </View>
                  <Text className="text-text-primary ml-3">High Severity Bonus</Text>
                </View>
                <Text className="text-text-primary font-semibold">
                  +{breakdown.highSeverity}
                </Text>
              </View>
              
              <View className="flex-row items-center justify-between py-2 border-t border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center">
                    <Ionicons name="flame" size={18} color="#F59E0B" />
                  </View>
                  <Text className="text-text-primary ml-3">Streak Bonus</Text>
                </View>
                <Text className="text-text-primary font-semibold">
                  +{breakdown.streak}
                </Text>
              </View>
              
              <View className="flex-row items-center justify-between py-2 border-t border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center">
                    <Ionicons name="flag" size={18} color="#8B5CF6" />
                  </View>
                  <Text className="text-text-primary ml-3">Pioneer Bonus</Text>
                </View>
                <Text className="text-text-primary font-semibold">
                  +{breakdown.pioneer}
                </Text>
              </View>
            </View>
          </CardBody>
        </Card>

        {/* Badge progress */}
        <Card className="mx-4 mt-4" elevation="sm">
          <CardBody>
            <Text className="text-lg font-semibold text-text-primary mb-4">
              Badge Progress
            </Text>
            
            {BADGES.map((badge, index) => {
              const isUnlocked = (stats?.totalPoints || 0) >= badge.requirement;
              const isCurrent = badge.name === stats?.currentBadge.name;
              
              return (
                <View
                  key={badge.name}
                  className={`flex-row items-center py-3 ${
                    index > 0 ? 'border-t border-gray-100' : ''
                  }`}
                >
                  <View
                    className={`w-12 h-12 rounded-full items-center justify-center ${
                      isUnlocked ? 'bg-primary/10' : 'bg-gray-100'
                    }`}
                  >
                    <Text className={`text-2xl ${!isUnlocked ? 'opacity-30' : ''}`}>
                      {badge.icon}
                    </Text>
                  </View>
                  
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center">
                      <Text
                        className={`font-medium ${
                          isUnlocked ? 'text-text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {badge.name}
                      </Text>
                      {isCurrent && (
                        <View className="ml-2 px-2 py-0.5 bg-primary rounded-full">
                          <Text className="text-white text-xs font-medium">Current</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-sm text-text-secondary">
                      {badge.requirement} points required
                    </Text>
                  </View>
                  
                  {isUnlocked ? (
                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  ) : (
                    <Ionicons name="lock-closed" size={20} color="#D1D5DB" />
                  )}
                </View>
              );
            })}
          </CardBody>
        </Card>

        {/* Recent activity */}
        {recentReports.length > 0 && (
          <Card className="mx-4 mt-4 mb-8" elevation="sm">
            <CardBody>
              <Text className="text-lg font-semibold text-text-primary mb-4">
                Recent Activity
              </Text>
              
              {recentReports.map((report, index) => (
                <View
                  key={report.id}
                  className={`flex-row items-center py-3 ${
                    index > 0 ? 'border-t border-gray-100' : ''
                  }`}
                >
                  <View className="w-10 h-10 rounded-lg bg-gray-100 items-center justify-center">
                    <Ionicons
                      name={report.status === 'resolved' ? 'checkmark-circle' : 'time'}
                      size={20}
                      color={report.status === 'resolved' ? '#10B981' : '#6B7280'}
                    />
                  </View>
                  
                  <View className="flex-1 ml-3">
                    <Text className="text-text-primary font-medium" numberOfLines={1}>
                      {report.description || `Report #${report.id.slice(0, 8)}`}
                    </Text>
                    <Text className="text-sm text-text-secondary">
                      {new Date(report.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                  
                  {report.pointsAwarded && report.pointsAwarded > 0 && (
                    <Text className="text-primary font-semibold">
                      +{report.pointsAwarded}
                    </Text>
                  )}
                </View>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Spacer for tab bar */}
        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}
