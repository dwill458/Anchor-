import React from 'react';
import { StyleSheet, View } from 'react-native';

export interface ApertureGridProps<T> {
  items: T[];
  height?: number;
  gap?: number;
  radius?: number;
  radiusSmall?: number;
  renderTile: (item: T, index: number, isHero: boolean, radius: number) => React.ReactNode;
  testID?: string;
}

/**
 * Locked ApertureGrid layout from "Vision - Handmade Loop.html":
 * Hero tile + 2-tile vertical stack + bottom horizontal strip of (n - 3) tiles.
 * Same geometry at every stage of completeness (3, 4, or 5 tiles).
 */
export function ApertureGrid<T>({
  items,
  height = 250,
  gap = 6,
  radius = 16,
  radiusSmall = 12,
  renderTile,
  testID = 'v2-aperture-grid',
}: ApertureGridProps<T>) {
  const n = items.length;
  const bottomCount = Math.max(0, n - 3);
  const stripH = bottomCount > 0 ? Math.round(height * 0.32) : 0;
  const mainH = height - stripH - (bottomCount > 0 ? gap : 0);
  const mainItems = items.slice(0, 3);
  const bottomItems = items.slice(3);

  return (
    <View testID={testID} style={[styles.container, { height, gap }]}>
      <View style={[styles.mainSection, { height: mainH, gap }]}>
        {/* Left hero tile: takes 1.6 fraction of width */}
        <View style={styles.heroColumn}>
          {mainItems[0] !== undefined &&
            renderTile(mainItems[0], 0, true, radius)}
        </View>

        {/* Right 2-tile column: takes 1 fraction of width */}
        <View style={[styles.stackColumn, { gap }]}>
          {mainItems[1] !== undefined && (
            <View style={styles.stackTile}>
              {renderTile(mainItems[1], 1, false, radiusSmall)}
            </View>
          )}
          {mainItems[2] !== undefined && (
            <View style={styles.stackTile}>
              {renderTile(mainItems[2], 2, false, radiusSmall)}
            </View>
          )}
        </View>
      </View>

      {/* Bottom strip for tiles beyond the first 3 */}
      {bottomCount > 0 && (
        <View style={[styles.bottomStrip, { height: stripH, gap }]}>
          {bottomItems.map((item, i) => (
            <View key={`bottom-${i}`} style={styles.bottomTile}>
              {renderTile(item, i + 3, false, radiusSmall)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  mainSection: {
    width: '100%',
    flexDirection: 'row',
  },
  heroColumn: {
    flex: 1.6,
    height: '100%',
  },
  stackColumn: {
    flex: 1,
    height: '100%',
    flexDirection: 'column',
  },
  stackTile: {
    flex: 1,
    width: '100%',
  },
  bottomStrip: {
    width: '100%',
    flexDirection: 'row',
  },
  bottomTile: {
    flex: 1,
    height: '100%',
  },
});
