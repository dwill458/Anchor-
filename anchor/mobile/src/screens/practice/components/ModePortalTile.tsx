import React, { useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
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
const AXIS_X = 16;
const NODE_Y = 20;

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

  const [isRendered, setIsRendered] = useState(selected);
  const [measuredHeight, setMeasuredHeight] = useState(selected ? 52 : 0);
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (selected) {
      setIsRendered(true);
      if (measuredHeight === 0) {
        setMeasuredHeight(52);
      }
      progress.value = withTiming(1, {
        duration: reduceMotion ? 0 : ANIMATION_DURATION,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
    } else {
      progress.value = withTiming(
        0,
        {
          duration: reduceMotion ? 0 : 200,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        },
        (finished) => {
          if (finished) {
            runOnJS(setIsRendered)(false);
          }
        },
      );
    }
  }, [selected, reduceMotion, progress, measuredHeight]);

  const accordionStyle = useAnimatedStyle(() => {
    if (measuredHeight > 0) {
      return {
        height: interpolate(progress.value, [0, 1], [0, measuredHeight]),
        opacity: progress.value,
        overflow: 'hidden',
      };
    }
    return {
      opacity: progress.value,
      overflow: 'hidden',
    };
  });

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
              shadowOpacity: 0.65,
              shadowRadius: 8,
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
            <Text style={[styles.title, selected && { color: modeColor }, locked && styles.titleLocked]}>
              {title}
            </Text>
            {locked ? <LockKeyhole size={12} color="rgba(242,223,168,0.52)" /> : null}
          </View>
          <View style={styles.meta}>
            {badge ? (
              <Text style={[styles.badge, selected && { borderColor: modeColor, color: modeColor }]}>
                {badge}
              </Text>
            ) : null}
            {icon ? <View style={styles.icon}>{icon}</View> : null}
          </View>
        </View>
        <Text style={[styles.duration, selected && { color: modeColor }]}>{durationHint}</Text>

        {isRendered ? (
          <Animated.View style={accordionStyle}>
            <View
              onLayout={(e) => {
                const h = e.nativeEvent.layout.height;
                if (h > 0 && Math.abs(h - measuredHeight) > 1) {
                  setMeasuredHeight(h);
                }
              }}
            >
              <Text style={styles.meaning}>{meaning}</Text>
            </View>
          </Animated.View>
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
  pressed: {
    opacity: 0.82,
  },
  releaseSeparator: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(242,223,168,0.14)',
  },
  axisLine: {
    position: 'absolute',
    left: AXIS_X,
    top: 0,
    bottom: 0,
    width: 1.5,
    marginLeft: -0.75,
    backgroundColor: 'rgba(242,223,168,0.18)',
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
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 0,
    backgroundColor: '#080C10',
  },
  lockedNode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(242,223,168,0.34)',
    backgroundColor: '#080C10',
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
    paddingBottom: 12,
    paddingLeft: 46,
    paddingRight: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(242,223,168,0.1)',
  },
  contentSelected: {
    borderBottomColor: 'rgba(242,223,168,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  title: {
    color: 'rgba(244,237,216,0.66)',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 14,
    letterSpacing: 1.5,
  },
  titleLocked: {
    color: 'rgba(244,237,216,0.45)',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    opacity: 0.78,
  },
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242,223,168,0.35)',
    borderRadius: 999,
    color: 'rgba(242,223,168,0.58)',
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 8,
    letterSpacing: 1.1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  duration: {
    marginTop: 4,
    color: 'rgba(242,223,168,0.42)',
    fontFamily: typography.fontFamily.sans,
    fontSize: 9,
    letterSpacing: 1.25,
  },
  meaning: {
    marginTop: 8,
    color: 'rgba(244,237,216,0.71)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    lineHeight: 20,
  },
});
