/**
 * Anchor App - Profile Screen
 *
 * User profile with stats, settings, and subscription management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import {
  User,
  Settings,
  Crown,
  Flame,
  Target,
  Calendar,
  Trophy,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useToast } from '@/components/ToastProvider';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { ZenBackground } from '@/components/common';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { StatsGrid } from '@/components/profile/StatsGrid';
import { ActiveAnchorsGrid } from '@/components/profile/ActiveAnchorsGrid';
import { ProfileEmptyState } from '@/components/profile/ProfileEmptyState';
import { ProfileErrorState } from '@/components/profile/ProfileErrorState';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const IS_ANDROID = Platform.OS === 'android';

type ProfileNavigationProp = StackNavigationProp<RootStackParamList>;

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color = colors.gold }) => {
  const CardWrapper = IS_ANDROID ? View : BlurView;
  const cardProps = IS_ANDROID ? {} : { intensity: 10, tint: 'dark' as const };

  return (
    <CardWrapper {...cardProps} style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={[styles.statBorder, { backgroundColor: color }]} />
    </CardWrapper>
  );
};

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  subtitle,
  onPress,
  showChevron = true,
  destructive = false,
}) => {
  const ItemWrapper = IS_ANDROID ? View : BlurView;
  const itemProps = IS_ANDROID ? {} : { intensity: 8, tint: 'dark' as const };

  return (
    <TouchableOpacity
      style={styles.menuItemWrapper}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ItemWrapper {...itemProps} style={styles.menuItem}>
        <View style={styles.menuItemLeft}>
          <View style={styles.menuIconContainer}>{icon}</View>
          <View style={styles.menuTextContainer}>
            <Text style={[styles.menuLabel, destructive && styles.menuLabelDestructive]}>
              {label}
            </Text>
            {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        {showChevron && (
          <ChevronRight color={destructive ? colors.error : colors.silver} size={20} />
        )}
      </ItemWrapper>
    </TouchableOpacity>
  );
};

export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const { user, signOut, setHasCompletedOnboarding, profileData, fetchProfile, refreshProfile } = useAuthStore();
  const { developerModeEnabled } = useSettingsStore();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Mock user data - replace with actual API call
  const displayName = user?.displayName || 'Practitioner';
  const email = user?.email || 'user@example.com';
  const subscriptionStatus = user?.subscriptionStatus || 'free';
  const totalAnchors = user?.totalAnchorsCreated || 0;
  const totalActivations = user?.totalActivations || 0;
  const currentStreak = user?.currentStreak || 0;
  const longestStreak = user?.longestStreak || 0;

  // Load profile data on mount
  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      setProfileError(null);
      await fetchProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load profile';
      setProfileError(message);
      console.error('Profile load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setProfileError(null);
      await refreshProfile();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh profile';
      setProfileError(message);
      console.error('Profile refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateAnchor = () => {
    navigation.navigate('CreateAnchor');
  };

  const handleAnchorPress = (anchorId: string) => {
    navigation.navigate('AnchorDetail', { anchorId });
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleSubscription = () => {
    // TODO: Navigate to subscription screen
    toast.info('Subscription management coming soon');
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset Onboarding',
      'This will restart the onboarding flow. The app will reload.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setHasCompletedOnboarding(false);
            toast.success('Onboarding reset! Reloading...');
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            signOut();
            toast.success('Signed out successfully');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ZenBackground />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.gold} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Your Practice</Text>
          </View>

          {/* Private Profile Section (Phase 1) */}
          {isLoading && !profileData ? (
            <View style={styles.loadingContainer}>
              <LoadingSpinner />
            </View>
          ) : profileError && !profileData ? (
            <ProfileErrorState error={profileError} onRetry={loadProfileData} />
          ) : profileData && profileData.stats.totalAnchorsCreated === 0 ? (
            <>
              <ProfileHeader
                displayName={profileData.user.displayName}
                subscriptionStatus={profileData.user.subscriptionStatus}
              />
              <ProfileEmptyState onCreateAnchor={handleCreateAnchor} />
            </>
          ) : profileData ? (
            <>
              <ProfileHeader
                displayName={profileData.user.displayName}
                subscriptionStatus={profileData.user.subscriptionStatus}
              />
              <StatsGrid stats={profileData.stats} />
              <ActiveAnchorsGrid anchors={profileData.activeAnchors} onAnchorPress={handleAnchorPress} />
            </>
          ) : null}

          {/* Divider */}
          {profileData && <View style={styles.sectionDivider} />}

          {/* Account Settings Section */}
          <View style={styles.header}>
            <Text style={styles.title}>Account</Text>
          </View>

          {/* User Info Card */}
          <View style={styles.userCardWrapper}>
            {IS_ANDROID ? (
              <View style={styles.userCard}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={[colors.gold, colors.bronze]}
                    style={styles.avatarGradient}
                  >
                    <User color={colors.navy} size={32} strokeWidth={2} />
                  </LinearGradient>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{displayName}</Text>
                  <Text style={styles.userEmail}>{email}</Text>
                  {subscriptionStatus !== 'free' && (
                    <View style={styles.proBadge}>
                      <Crown color={colors.gold} size={14} />
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userCardBorder} />
              </View>
            ) : (
              <BlurView intensity={12} tint="dark" style={styles.userCard}>
                <View style={styles.avatarContainer}>
                  <LinearGradient
                    colors={[colors.gold, colors.bronze]}
                    style={styles.avatarGradient}
                  >
                    <User color={colors.navy} size={32} strokeWidth={2} />
                  </LinearGradient>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{displayName}</Text>
                  <Text style={styles.userEmail}>{email}</Text>
                  {subscriptionStatus !== 'free' && (
                    <View style={styles.proBadge}>
                      <Crown color={colors.gold} size={14} />
                      <Text style={styles.proBadgeText}>PRO</Text>
                    </View>
                  )}
                </View>
                <View style={styles.userCardBorder} />
              </BlurView>
            )}
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Target color={colors.gold} size={24} />}
              label="Anchors Created"
              value={totalAnchors}
              color={colors.gold}
            />
            <StatCard
              icon={<Flame color="#FF6B6B" size={24} />}
              label="Current Streak"
              value={`${currentStreak} days`}
              color="#FF6B6B"
            />
            <StatCard
              icon={<Calendar color="#4ECDC4" size={24} />}
              label="Total Activations"
              value={totalActivations}
              color="#4ECDC4"
            />
            <StatCard
              icon={<Trophy color="#FFD93D" size={24} />}
              label="Longest Streak"
              value={`${longestStreak} days`}
              color="#FFD93D"
            />
          </View>

          {/* Menu Section */}
          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>Account</Text>

            <MenuItem
              icon={<Settings color={colors.silver} size={20} />}
              label="Settings"
              subtitle="Preferences and app settings"
              onPress={handleSettings}
            />

            {subscriptionStatus === 'free' && (
              <MenuItem
                icon={<Crown color={colors.gold} size={20} />}
                label="Upgrade to Pro"
                subtitle="Unlock all features"
                onPress={handleSubscription}
              />
            )}

            {subscriptionStatus !== 'free' && (
              <MenuItem
                icon={<Crown color={colors.gold} size={20} />}
                label="Manage Subscription"
                subtitle={`${subscriptionStatus.replace('_', ' ').toUpperCase()} Plan`}
                onPress={handleSubscription}
              />
            )}
          </View>

          {/* Dev Tools (conditional) */}
          {__DEV__ && developerModeEnabled && (
            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Developer</Text>
              <MenuItem
                icon={<Settings color={colors.silver} size={20} />}
                label="Reset Onboarding"
                subtitle="Restart the onboarding flow"
                onPress={handleResetOnboarding}
              />
            </View>
          )}

          {/* Sign Out */}
          <View style={styles.menuSection}>
            <MenuItem
              icon={<LogOut color={colors.error} size={20} />}
              label="Sign Out"
              onPress={handleSignOut}
              showChevron={false}
              destructive
            />
          </View>

          {/* Bottom Spacer */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120, // Extra space for tab bar
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  userCardWrapper: {
    marginBottom: spacing.xl,
  },
  userCard: {
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.9)' : 'rgba(26, 26, 29, 0.4)',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginRight: spacing.md,
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.bone,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.silver,
    opacity: 0.8,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    alignSelf: 'flex-start',
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gold,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  userCardBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.gold,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.85)' : 'rgba(26, 26, 29, 0.3)',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.bone,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.silver,
    textAlign: 'center',
    opacity: 0.8,
  },
  statBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  menuSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.silver,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    opacity: 0.6,
  },
  menuItemWrapper: {
    marginBottom: spacing.sm,
  },
  menuItem: {
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: IS_ANDROID ? 'rgba(26, 26, 29, 0.85)' : 'rgba(26, 26, 29, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bone,
    marginBottom: 2,
  },
  menuLabelDestructive: {
    color: colors.error,
  },
  menuSubtitle: {
    fontSize: 13,
    color: colors.silver,
    opacity: 0.7,
  },
  bottomSpacer: {
    height: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: spacing.xl,
  },
});
