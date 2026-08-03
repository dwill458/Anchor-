import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sparkle, Sparkles } from 'lucide-react-native';
import { colors, typography } from '@/theme';

export type DestinationMarkerProps = {
  destinationText: string | null;
  x: number;
  y: number;
  mapWidth: number;
  mapHeight: number;
  completed: boolean;
  reducedMotion: boolean;
  testID?: string;
};

const DestinationMarkerComponent: React.FC<DestinationMarkerProps> = ({
  destinationText,
  x,
  y,
  mapWidth,
  mapHeight,
  completed,
  testID,
}) => {
  const leftPct = `${(x / mapWidth) * 100}%` as const;
  const topPct = `${(y / mapHeight) * 100}%` as const;
  const size = completed ? 44 : 28;

  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[styles.wrapper, { left: leftPct, top: topPct, transform: [{ translateX: -60 }, { translateY: -(size + 20) }] }]}
    >
      <View style={[styles.glyph, completed && styles.glyphCompleted, { width: size, height: size, borderRadius: size / 2 }]}>
        {completed ? (
          <Sparkles size={size * 0.5} color={colors.gold} strokeWidth={1.75} />
        ) : (
          <Sparkle size={size * 0.55} color={colors.text.tertiary} strokeWidth={1.5} />
        )}
      </View>
      {destinationText ? (
        <Text style={[styles.label, completed && styles.labelCompleted]} numberOfLines={2}>
          {destinationText}
        </Text>
      ) : null}
    </View>
  );
};

function propsEqual(prev: DestinationMarkerProps, next: DestinationMarkerProps): boolean {
  return (
    prev.destinationText === next.destinationText &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.mapWidth === next.mapWidth &&
    prev.mapHeight === next.mapHeight &&
    prev.completed === next.completed &&
    prev.reducedMotion === next.reducedMotion
  );
}

export const DestinationMarker = memo(DestinationMarkerComponent, propsEqual);

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', width: 120, alignItems: 'center' },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  glyphCompleted: {
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(212,175,55,0.12)',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  label: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 6,
  },
  labelCompleted: {
    color: colors.text.primary,
    fontFamily: typography.fonts.headingSemiBold,
    fontSize: 13,
  },
});
