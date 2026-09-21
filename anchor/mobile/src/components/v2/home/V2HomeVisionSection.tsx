import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '@/theme/v2';
import type { HomeVisionState } from '@/adapters/v2/home';

type Props = {
  vision: HomeVisionState;
  expanded?: boolean;
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
function V2HomeVisionSectionComponent({ vision, expanded, onOpenVision, testID }: Props) {
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

      {expanded && heroImage ? (
        <View style={styles.expandedFrame}>
          <Image testID="v2-home-vision-image" source={{ uri: heroImage }} style={styles.expandedImage} resizeMode="cover" accessibilityIgnoresInvertColors />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.imageScrim} />
          <View style={styles.imageCopy}>
            {title || body ? <Text testID={title ? 'v2-home-vision-title' : undefined} numberOfLines={2} style={styles.imageTitle}>{title || body}</Text> : null}
            <View style={styles.imageLink}><Text style={styles.imageLinkText}>Revisit your Vision</Text><ArrowRight color="#FFFFFF" /></View>
          </View>
        </View>
      ) : (
        <View style={styles.compactRow}>
          {heroImage ? <Image testID="v2-home-vision-image" source={{ uri: heroImage }} style={styles.compactImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
          <View style={styles.compactCopy}>
            {title || body ? <Text testID={title ? 'v2-home-vision-title' : undefined} numberOfLines={2} style={styles.title}>{title || body}</Text> : null}
            {title && body ? <Text numberOfLines={2} style={styles.body}>{body}</Text> : null}
            <View style={styles.link}><Text style={styles.linkText}>Revisit your Vision</Text><ArrowRight color={colors.graphite.text.tertiary} /></View>
          </View>
        </View>
      )}
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
  expandedFrame: { marginTop: 12, height: 220, overflow: 'hidden', borderRadius: 5, backgroundColor: colors.graphite.surface },
  expandedImage: { width: '100%', height: '100%' },
  imageScrim: { ...StyleSheet.absoluteFillObject },
  imageCopy: { position: 'absolute', left: 12, right: 12, bottom: 10 },
  imageTitle: { fontFamily: 'EBGaramond-Medium', fontSize: 21, lineHeight: 24, color: '#FFFFFF' },
  imageLink: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 5 },
  imageLinkText: { fontFamily: typography.bodyMedium, fontSize: 12, color: '#FFFFFF' },
  compactRow: { flexDirection: 'row', gap: 14, marginTop: 12, alignItems: 'center' },
  compactImage: { width: 100, height: 84, borderRadius: 5, backgroundColor: colors.graphite.surface },
  compactCopy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'EBGaramond-Regular',
    fontSize: 18,
    lineHeight: 21,
    color: colors.graphite.text.primary,
  },
  body: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.graphite.text.secondary,
    marginTop: 4,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 7,
  },
  linkText: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.graphite.text.secondary,
  },
  pressed: {
    opacity: 0.78,
  },
});

/**
 * Memoised. Switching the Home Anchor re-renders this screen twice - once on
 * selection and again when Today's recommendation settles - and most of these
 * sections do not depend on Today at all. With stable props from V2HomeScreen
 * they now render only when their own data actually changes.
 */
export const V2HomeVisionSection = memo(V2HomeVisionSectionComponent);
