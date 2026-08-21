import React, { useEffect } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { LockKeyhole } from 'lucide-react-native';
import { typography } from '@/theme';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type PortalVariant = 'focus' | 'visualize' | 'deepPrime' | 'release';

interface ModePortalTileProps {
  variant: PortalVariant;
  title: string;
  meaning: string;
  durationHint: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  badge?: string;
  testID?: string;
  disabled?: boolean;
  selected?: boolean;
  locked?: boolean;
}

const MODE_COLORS: Record<PortalVariant, string> = {
  focus: '#AD99D2',
  visualize: '#78B4D1',
  deepPrime: '#F0CB6A',
  release: '#C8875A',
};

const ANIMATION_DURATION = 240;
const AXIS_X = 26;
const NODE_Y = 22;

/**
 * A selectable practice tool, deliberately separate from its launch CTA. The
 * continuous axis makes the four tools read as one ritual sequence without
 * implying that it is a progress meter.
 */
export const ModePortalTile: React.FC<ModePortalTileProps> = ({
  variant,
  title,
  meaning,
  durationHint,
  icon,
  style,
  onPress,
  badge,
  testID,
  disabled = false,
  selected = false,
  locked = false,
}) => {
  const modeColor = MODE_COLORS[variant];
  const reduceMotion = useReduceMotionEnabled();

  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: reduceMotion ? 0 : ANIMATION_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [selected, reduceMotion, progress]);

  const nodeAnimatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [locked ? 0.8 : 0.65, 1]);
    return {
      transform: [{ scale }],
    };
  });

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${locked ? ', locked' : ''}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pressable,
        variant === 'release' && styles.releasePressable,
        style,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {variant === 'release' && <View pointerEvents="none" style={styles.releaseSeparator} />}
      <View pointerEvents="none" style={styles.axisLine} />
      <View pointerEvents="none" style={styles.nodeContainer}>
        <Animated.View
          style={[
            styles.node,
            selected && {
              backgroundColor: modeColor,
              borderColor: modeColor,
              shadowColor: modeColor,
              shadowOpacity: 0.75,
              shadowRadius: 10,
              elevation: 4,
            },
            locked && !selected && styles.lockedNode,
            !locked && !selected && styles.unselectedNode,
            nodeAnimatedStyle,
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.content,
          selected && styles.contentSelected,
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
            <Text style={[styles.title, selected && styles.titleSelected, locked && styles.titleLocked]}>
              {title}
            </Text>
            {locked || badge ? (
              <View style={styles.proLockRow}>
                {locked ? <LockKeyhole size={11} color="rgba(139,131,155,0.9)" /> : null}
                <Text style={styles.proBadgeText}>{badge ?? 'Pro'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.duration, selected && styles.durationSelected]}>{durationHint}</Text>
        </View>

        {selected ? (
          <View style={styles.meaningWrap}>
            <Text style={styles.meaning}>{meaning}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    position: 'relative',
    width: '100%',
  },
  releasePressable: {
    marginTop: 14,
  },
  pressed: {
    opacity: 0.82,
  },
  releaseSeparator: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(217,179,108,0.12)',
  },
  axisLine: {
    position: 'absolute',
    left: AXIS_X,
    top: 0,
    bottom: 0,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: 'rgba(139,131,155,0.22)',
  },
  nodeContainer: {
    position: 'absolute',
    left: AXIS_X,
    top: NODE_Y,
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 0,
    backgroundColor: '#0F1419',
  },
  lockedNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(139,131,155,0.4)',
    backgroundColor: 'transparent',
  },
  unselectedNode: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 0,
    backgroundColor: 'rgba(139,131,155,0.32)',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 14,
    paddingLeft: AXIS_X + 24,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(217,179,108,0.10)',
  },
  contentSelected: {
    paddingBottom: 16,
    borderBottomColor: 'rgba(217,179,108,0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: 'rgba(244,239,230,0.62)',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  titleSelected: {
    color: '#F4EFE6',
  },
  titleLocked: {
    color: 'rgba(244,239,230,0.45)',
  },
  iconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  proLockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proBadgeText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    color: 'rgba(139,131,155,0.9)',
  },
  duration: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    letterSpacing: 0.2,
    color: '#8B839B',
  },
  durationSelected: {
    color: 'rgba(244,239,230,0.7)',
  },
  meaningWrap: {
    overflow: 'hidden',
  },
  meaning: {
    marginTop: 10,
    color: 'rgba(244,239,230,0.68)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 17,
    lineHeight: 24,
  },
});
