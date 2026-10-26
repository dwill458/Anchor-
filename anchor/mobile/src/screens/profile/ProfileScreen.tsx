import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SettingsHeader, SettingsRow } from '@/components/settings/SettingsPrimitives';
import { T, settingsTypography } from '@/components/settings/settingsTheme';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEV_MOCK_IDENTITY } from '@/utils/devMockIdentity';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';

// DEFERRED: import { SettingsScreen } from '@/screens/settings';
// DEFERRED: The old Profile route rendered Settings directly; Home now opens this Profile entry first.
// return <SettingsScreen />;
export const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const name = useProfileStore((state) => state.name);
  const photo = useProfileStore((state) => state.photo);
  const authDisplayName = useAuthStore((state) => state.user?.displayName ?? null);
  const signedInProfilePictureUrl = useAuthStore((state) => state.user?.profilePictureUrl ?? null);
  const devMockIdentity = useSettingsStore((state) => state.devMockIdentity);
  const mockIdentity = __DEV__ && devMockIdentity;
  const profilePictureUrl = mockIdentity ? DEV_MOCK_IDENTITY.profilePictureUrl : signedInProfilePictureUrl;
  const displayName = mockIdentity ? DEV_MOCK_IDENTITY.displayName : name || authDisplayName || 'Your profile';
  const avatar = photo || profilePictureUrl;

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.getParent()?.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <SettingsHeader title="Profile" onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel="Profile photo" />
          ) : (
            <View style={styles.avatarFallback} accessibilityLabel="Profile photo">
              <Text style={styles.initial}>{displayName.trim().charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.name}>{displayName}</Text>
        </View>
        <SettingsRow
          label="Settings"
          desc="Manage your account and app preferences."
          onPress={() => navigation.navigate('Settings')}
          testID="profile-settings-row"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: T.bg },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  identity: { alignItems: 'center', paddingVertical: 32 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: settingsTypography.displaySemiBold, fontSize: 28, color: T.ink },
  name: { fontFamily: settingsTypography.displaySemiBold, fontSize: 20, color: T.ink, marginTop: 12 },
});
