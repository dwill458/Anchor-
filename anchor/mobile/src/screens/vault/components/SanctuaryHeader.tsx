import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { User } from 'lucide-react-native';
import { colors } from '@/theme';
import { withAlpha } from '@/utils/color';

interface SanctuaryHeaderProps {
  reduceMotionEnabled: boolean;
  /** Time-aware greeting, e.g. "Good evening, Deontrez" */
  greeting?: string;
}

// Anchor 1.5 Sanctuary Home: no screen title — just the greeting and the
// profile avatar. See 09 Sanctuary Home.html.
export const SanctuaryHeader: React.FC<SanctuaryHeaderProps> = ({ reduceMotionEnabled, greeting }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleOpenProfile = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingRight: Math.max(20, insets.right + 6) }]}>
      {greeting ? (
        <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
      ) : <View style={styles.greetingSpacer} />}
      <Pressable
        style={styles.settingsButton}
        onPress={handleOpenProfile}
        accessibilityRole="button"
        accessibilityLabel="Profile"
      >
        <View style={styles.settingsMeasureTarget}>
          <View style={styles.settingsInnerGlow} />
          <View style={styles.settingsInnerRing}>
            <User size={17} color={colors.anchor15.giltBright} />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 20,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    flex: 1,
    paddingRight: 8,
    fontFamily: 'EBGaramond-Regular',
    fontSize: 17,
    color: withAlpha(colors.anchor15.bone, 0.68),
  },
  greetingSpacer: {
    flex: 1,
  },
  settingsButton: {
    width: 44,
    height: 44,
    marginLeft: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsMeasureTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  settingsInnerGlow: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: withAlpha(colors.anchor15.gilt, 0.12),
  },
  settingsInnerRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
