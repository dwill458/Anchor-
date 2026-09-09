import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ApertureGrid } from './ApertureGrid';
import { colors, radii } from '@/theme/v2';

export interface GhostVisionCompositionProps {
  compact?: boolean;
  count?: number;
  testID?: string;
}

const GHOST_FILLS = [
  colors.surface,
  colors.grouped,
  '#E5E0D7',
  '#D8D2C8',
  '#CFD7FF',
];

/**
 * Empty/placeholder Vision composition using the locked ApertureGrid geometry.
 * Medium brush density: painterly frame edges & future-fragment placeholders.
 */
export function GhostVisionComposition({
  compact = false,
  count = compact ? 3 : 4,
  testID = 'ghost-vision-composition',
}: GhostVisionCompositionProps) {
  const height = compact ? 116 : 224;
  const gap = compact ? 4 : 6;
  const radius = compact ? radii.md : radii.lg;
  const radiusSmall = compact ? radii.sm : radii.md;
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Vision placeholder aperture grid"
      style={[styles.container, compact ? styles.compactContainer : styles.fullContainer]}
    >
      <ApertureGrid
        items={items}
        height={height}
        gap={gap}
        radius={radius}
        radiusSmall={radiusSmall}
        renderTile={(_, index, isHero, r) => {
          const fill = GHOST_FILLS[index % GHOST_FILLS.length];
          return (
            <View
              key={`ghost-tile-${index}`}
              style={[
                styles.tile,
                {
                  borderRadius: r,
                  backgroundColor: fill,
                  borderColor: colors.border.subtle,
                },
              ]}
            >
              {/* Subtle inner accent lines reflecting painterly dry gouache mark */}
              {isHero && <View style={styles.heroAccent} />}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  fullContainer: {
    paddingHorizontal: 0,
  },
  compactContainer: {
    paddingHorizontal: 0,
  },
  tile: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  heroAccent: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    opacity: 0.6,
  },
});
