import React, { useCallback, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SettingsIcon } from '@/components/icons/SettingsIcon';
import { useSettingsReveal } from '@/components/transitions/SettingsRevealProvider';
import { colors, typography } from '@/theme';

interface SanctuaryHeaderProps {
  reduceMotionEnabled: boolean;
}

export const SanctuaryHeader: React.FC<SanctuaryHeaderProps> = ({ reduceMotionEnabled }) => {
  const insets = useSafeAreaInsets();
  const { open } = useSettingsReveal();
  const buttonRef = useRef<View>(null);

  const handleOpenSettings = useCallback(() => {
    const fallback = () => {
      const { width, height } = Dimensions.get('window');
      open(
        {
          cx: width - 42,
          cy: 64,
          size: 40,
        },
        { reduceMotion: reduceMotionEnabled }
      );
    };

    buttonRef.current?.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) {
        fallback();
        return;
      }

      open(
        {
          cx: x + width / 2,
          cy: y + height / 2,
          size: Math.max(width, height),
        },
        { reduceMotion: reduceMotionEnabled }
      );
    });
  }, [open, reduceMotionEnabled]);

  return (
    <View style={[styles.container, { paddingRight: Math.max(8, insets.right + 6) }]}>
      <View style={styles.titleBlock}>
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.84}
        >
          SANCTUARY
        </Text>
        <Text style={styles.subtitle}>Your anchors are active</Text>
      </View>
      <Pressable
        style={styles.settingsButton}
        onPress={handleOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <View ref={buttonRef} style={styles.settingsMeasureTarget}>
          <View style={styles.settingsInnerGlow} />
          <View style={styles.settingsInnerRing}>
            <SettingsIcon size={17} color={colors.sanctuary.goldBright} glow={false} />
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
  title: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 34,
    color: colors.sanctuary.gold,
    letterSpacing: 2,
    lineHeight: 38,
    textShadowColor: 'rgba(201,168,76,0.24)',
    textShadowRadius: 20,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: 'rgba(200,185,155,0.56)',
    letterSpacing: 0.3,
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
