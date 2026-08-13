import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LockKeyhole } from 'lucide-react-native';
import { typography } from '@/theme';

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

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}${locked ? ', locked' : ''}`}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.pressable, style, pressed && !disabled && styles.pressed]}
    >
      <View pointerEvents="none" style={styles.axisLine} />
      <View
        pointerEvents="none"
        style={[
          styles.node,
          { borderColor: modeColor },
          selected && { backgroundColor: modeColor, shadowColor: modeColor },
          locked && !selected && styles.lockedNode,
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.content,
          selected && styles.contentSelected,
          variant === 'release' && selected && styles.releaseSelected,
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, selected && { color: modeColor }, locked && styles.titleLocked]}>{title}</Text>
            {locked ? <LockKeyhole size={12} color="rgba(242,223,168,0.52)" /> : null}
          </View>
          <View style={styles.meta}>
            {badge ? <Text style={[styles.badge, selected && { borderColor: modeColor, color: modeColor }]}>{badge}</Text> : null}
            {icon ? <View style={styles.icon}>{icon}</View> : null}
          </View>
        </View>
        <Text style={[styles.duration, selected && { color: modeColor }]}>{durationHint}</Text>
        {selected ? <Text style={styles.meaning}>{meaning}</Text> : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    minHeight: 68,
    paddingLeft: 32,
    position: 'relative',
  },
  pressed: { opacity: 0.82 },
  axisLine: {
    position: 'absolute',
    left: 10,
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(242,223,168,0.22)',
  },
  node: {
    position: 'absolute',
    top: 20,
    left: 4,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.5,
    backgroundColor: '#080C10',
  },
  lockedNode: { borderColor: 'rgba(242,223,168,0.34)' },
  content: {
    minHeight: 68,
    paddingTop: 15,
    paddingBottom: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(242,223,168,0.1)',
  },
  contentSelected: {
    marginBottom: 3,
    backgroundColor: 'rgba(242,223,168,0.045)',
    borderBottomColor: 'rgba(242,223,168,0.25)',
  },
  releaseSelected: { backgroundColor: 'rgba(200,135,90,0.055)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: {
    color: 'rgba(244,237,216,0.66)',
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 15,
    letterSpacing: 1.15,
  },
  titleLocked: { color: 'rgba(244,237,216,0.45)' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { opacity: 0.78 },
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
    marginTop: 10,
    color: 'rgba(244,237,216,0.71)',
    fontFamily: typography.fontFamily.bodySerifItalic,
    fontSize: 15,
    lineHeight: 20,
  },
});
