import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { User } from 'lucide-react-native';
import { colors } from '@/theme';

interface SanctuaryHeaderProps {
  reduceMotionEnabled: boolean;
  /** Optional greeting line shown above the SANCTUARY title, e.g. "Good morning, Deon" */
  greeting?: string;
}

export const SanctuaryHeader: React.FC<SanctuaryHeaderProps> = ({ reduceMotionEnabled, greeting }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleOpenProfile = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  return (
    <View style={[styles.container, { paddingRight: Math.max(8, insets.right + 6) }]}>
      <View style={styles.titleBlock}>
        {greeting ? (
          <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
        ) : null}
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.84}
        >
          SANCTUARY
        </Text>
      </View>
      <Pressable
        style={styles.settingsButton}
        onPress={handleOpenProfile}
        accessibilityRole="button"
        accessibilityLabel="Profile"
      >
        <View style={styles.settingsMeasureTarget}>
          <View style={styles.settingsInnerGlow} />
          <View style={styles.settingsInnerRing}>
            <User size={17} color={colors.sanctuary.goldBright} />
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: 22,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flex: 1,
    paddingRight: 8,
  },
  greeting: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 13,
    color: 'rgba(192,192,192,0.45)',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  title: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 26,
    color: colors.bone,
    letterSpacing: 2.6,
    lineHeight: 32,
  },
  settingsButton: {
    width: 44,
    height: 44,
    marginLeft: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(20, 14, 32, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(201,168,76,0.92)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
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
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(201,168,76,0.1)',
  },
  settingsInnerRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
