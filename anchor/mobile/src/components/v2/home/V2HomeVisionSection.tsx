import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/theme/v2';
import type { HomeVisionState } from '@/adapters/v2/home';

type Props = {
  vision: HomeVisionState;
  onOpenVision?: () => void;
  testID?: string;
};

function ArrowRight({ color }: { color: string }) {
  return (
    <Svg width={17} height={11} viewBox="0 0 17 11" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M0.8 5.5H15.4M10.9 1L15.4 5.5L10.9 10" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Vision on Home is strictly conditional.
 *
 * When the active Anchor has no Vision — or while the association is still
 * resolving, or if the read failed — this renders NOTHING: no "Create your
 * Vision" placeholder, no empty frame, no stock image, no reserved height. The
 * next section closes the gap. Only persisted Vision assets and copy render.
 */
export function V2HomeVisionSection({ vision, onOpenVision, testID }: Props) {
  if (vision.state !== 'ready') return null;

  const tiles = vision.tiles ?? [];
  const featured = tiles.find((tile) => tile.id === vision.featuredTileId) ?? tiles.find((tile) => tile.imageUrl) ?? tiles[0];
  const heroImage = featured?.imageUrl?.trim() || null;
  const body = vision.previewText?.trim();
  const title = vision.title?.trim();

  // Nothing persisted worth showing: stay silent rather than render a shell.
  if (!heroImage && !body && !title) return null;

  return (
    <Pressable
      testID={testID ?? 'v2-home-vision'}
      accessibilityRole="button"
      accessibilityLabel="View Vision"
      onPress={onOpenVision}
      disabled={!onOpenVision}
      style={({ pressed }) => [styles.container, pressed && onOpenVision ? styles.pressed : null]}
    >
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>VISION</Text>
        {vision.seenToday ? <Text style={styles.seen}>Seen today</Text> : null}
      </View>

      {heroImage ? (
        <Image testID="v2-home-vision-image" source={{ uri: heroImage }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : null}

      {title ? (
        <Text testID="v2-home-vision-title" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text numberOfLines={2} style={styles.body}>
          {body}
        </Text>
      ) : null}

      <View style={styles.link}>
        <Text style={styles.linkText}>View Vision</Text>
        <ArrowRight color={colors.graphite.text.tertiary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.graphite.hairline,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: typography.bodyBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: colors.graphite.text.tertiary,
  },
  seen: {
    fontFamily: typography.bodyMedium,
    fontSize: 11,
    color: colors.graphite.text.secondary,
  },
  image: {
    width: '100%',
    height: 168,
    borderRadius: 4,
    marginTop: 14,
    backgroundColor: colors.graphite.surface,
  },
  title: {
    fontFamily: typography.displayBold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: colors.graphite.text.primary,
    marginTop: 14,
  },
  body: {
    fontFamily: typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.graphite.text.secondary,
    marginTop: 6,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  linkText: {
    fontFamily: typography.bodyMedium,
    fontSize: 13.5,
    color: colors.graphite.text.secondary,
  },
  pressed: {
    opacity: 0.78,
  },
});
