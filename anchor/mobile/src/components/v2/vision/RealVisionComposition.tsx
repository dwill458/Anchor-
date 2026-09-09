import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApertureGrid } from './ApertureGrid';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { colors, getCategoryColor, getCategorySoftTint, radii, typography } from '@/theme/v2';

export interface RealVisionCompositionProps {
  tiles: V2VisionTile[];
  featuredTileId?: string;
  height?: number;
  gap?: number;
  radius?: number;
  radiusSmall?: number;
  category?: string | null;
  onTilePress?: (tile: V2VisionTile) => void;
  testID?: string;
}

/**
 * Renders an active Vision's real collage images inside the locked ApertureGrid.
 * Medium brush density: painterly frame edges & category wash accent.
 */
export function RealVisionComposition({
  tiles,
  featuredTileId,
  height = 250,
  gap = 6,
  radius = radii.lg,
  radiusSmall = radii.md,
  category,
  onTilePress,
  testID = 'real-vision-composition',
}: RealVisionCompositionProps) {
  // Put featured tile first if specified
  const orderedTiles = React.useMemo(() => {
    if (!featuredTileId) return tiles;
    const hero = tiles.find((t) => t.id === featuredTileId);
    if (!hero) return tiles;
    const rest = tiles.filter((t) => t.id !== featuredTileId);
    return [hero, ...rest];
  }, [tiles, featuredTileId]);

  const categoryColor = getCategoryColor(category);
  const tint = getCategorySoftTint(category);

  return (
    <View testID={testID} style={styles.wrapper}>
      {/* Restrained atmospheric wash behind the composition */}
      <View
        aria-hidden={true}
        style={[
          styles.atmosphericWash,
          {
            backgroundColor: tint,
            borderRadius: radius + 4,
          },
        ]}
      />

      <ApertureGrid
        items={orderedTiles}
        height={height}
        gap={gap}
        radius={radius}
        radiusSmall={radiusSmall}
        renderTile={(tile, index, isHero, r) => {
          const content = (
            <View
              style={[
                styles.tileFrame,
                {
                  borderRadius: r,
                  borderColor: isHero ? `${categoryColor}40` : colors.border.subtle,
                },
              ]}
            >
              {tile.imageUrl ? (
                <Image
                  source={{ uri: tile.imageUrl }}
                  style={styles.image}
                  resizeMode="cover"
                  accessibilityLabel={tile.prompt || `Vision scene ${index + 1}`}
                />
              ) : (
                <View style={[styles.placeholderTile, { backgroundColor: colors.grouped }]}>
                  <Text numberOfLines={3} style={styles.promptFallback}>
                    {tile.prompt || `Scene ${index + 1}`}
                  </Text>
                </View>
              )}

              {/* Category mark on the hero tile */}
              {isHero && (
                <View
                  style={[
                    styles.heroCategoryMark,
                    { backgroundColor: categoryColor },
                  ]}
                />
              )}
            </View>
          );

          if (onTilePress) {
            return (
              <Pressable
                key={tile.id}
                onPress={() => onTilePress(tile)}
                accessibilityRole="button"
                accessibilityLabel={tile.prompt || `Vision tile ${index + 1}`}
                style={styles.pressable}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View key={tile.id} style={styles.pressable}>
              {content}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    position: 'relative',
  },
  atmosphericWash: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    opacity: 0.5,
  },
  pressable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  tileFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderTile: {
    flex: 1,
    width: '100%',
    height: '100%',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptFallback: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  heroCategoryMark: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 14,
    height: 3,
    borderRadius: 2,
  },
});
