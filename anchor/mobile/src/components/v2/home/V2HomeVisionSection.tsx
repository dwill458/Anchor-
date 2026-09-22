import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography } from '@/theme/v2';
import { resolveVisionHeroImage, type HomeVisionState } from '@/adapters/v2/home';
import { v2Haptics } from '@/hooks/v2';

type Props = {
  vision: HomeVisionState;
  categoryColor?: string;
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
 *
 * When a Vision does exist, it renders as one large photographic doorway
 * rather than a small card: the real cover image at near-full content width,
 * a dark bottom gradient, the actual Vision statement overlaid near the
 * bottom, and a single CTA whose wording and header both depend on the real
 * seen-today state — never a client-fabricated one. The entire frame is one
 * tap target into that Anchor's Vision.
 */
function V2HomeVisionSectionComponent({ vision, categoryColor, onOpenVision, testID }: Props) {
  if (vision.state !== 'ready') return null;

  const heroImage = resolveVisionHeroImage(vision);
  const body = vision.previewText?.trim();
  const title = vision.title?.trim();
  const statement = title || body;

  // Nothing persisted worth showing: stay silent rather than render a shell.
  if (!heroImage && !statement) return null;

  const seenToday = Boolean(vision.seenToday);
  const ctaText = seenToday ? 'Revisit Vision' : 'Enter Vision';

  const handlePress = () => {
    if (!onOpenVision) return;
    v2Haptics.selection();
    onOpenVision();
  };

  return (
    <View style={styles.container}>
      <View style={styles.kickerRow}>
        <Text style={styles.kicker}>YOUR VISION</Text>
        {seenToday ? <Text testID="v2-home-vision-seen" style={styles.seen}>Seen today  ✓</Text> : null}
      </View>

      {heroImage ? (
        <Pressable
          testID={testID ?? 'v2-home-vision'}
          accessibilityRole="button"
          accessibilityLabel={seenToday ? 'Revisit your Vision' : 'Enter your Vision'}
          onPress={handlePress}
          disabled={!onOpenVision}
          style={({ pressed }) => [styles.frame, pressed && onOpenVision ? styles.framePressed : null]}
        >
          <Image testID="v2-home-vision-image" source={{ uri: heroImage }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />

          {/* A very restrained category grade, not a colour wash: ~10% influence, never covering skin/photo detail. */}
          {categoryColor ? <View pointerEvents="none" style={[styles.tint, { backgroundColor: categoryColor }]} /> : null}

          <LinearGradient pointerEvents="none" colors={['transparent', 'transparent', 'rgba(11, 15, 19, 0.92)']} locations={[0, 0.42, 1]} style={styles.scrim} />

          <View style={styles.copy}>
            {statement ? (
              <Text testID={title ? 'v2-home-vision-title' : 'v2-home-vision-statement'} numberOfLines={3} style={styles.statement}>
                {statement}
              </Text>
            ) : null}
            <View style={styles.link}>
              <Text style={styles.linkText}>{ctaText}</Text>
              <ArrowRight color="#FFFFFF" />
            </View>
          </View>
        </Pressable>
      ) : (
        // No cover image persisted yet — real Vision text still renders, but
        // nothing here fabricates a photograph to fill the frame.
        <Pressable
          testID={testID ?? 'v2-home-vision'}
          accessibilityRole="button"
          accessibilityLabel={seenToday ? 'Revisit your Vision' : 'Enter your Vision'}
          onPress={handlePress}
          disabled={!onOpenVision}
          style={({ pressed }) => [styles.textOnlyFrame, pressed && onOpenVision ? styles.pressed : null]}
        >
          {statement ? (
            <Text testID={title ? 'v2-home-vision-title' : 'v2-home-vision-statement'} numberOfLines={3} style={styles.textOnlyStatement}>
              {statement}
            </Text>
          ) : null}
          <View style={styles.link}>
            <Text style={styles.linkTextDark}>{ctaText}</Text>
            <ArrowRight color={colors.graphite.text.secondary} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Tighter than Today's other dividers on purpose: Today flows into Vision
  // rather than floating apart from it as an unrelated module.
  container: {
    marginTop: 20,
    paddingTop: 14,
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
  // Photographic and immersive: near-full content width, bounded height so a
  // large phone never stretches it absurdly tall, restrained radius. Wider
  // and shorter than a first pass at this (~1.05, portrait-ish) — a cinematic
  // window rather than a poster/feed image, roughly a 15-20% shorter card.
  frame: {
    marginTop: 14,
    width: '100%',
    aspectRatio: 1.3,
    minHeight: 215,
    maxHeight: 300,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.graphite.surface,
  },
  framePressed: {
    transform: [{ scale: 0.988 }],
  },
  image: { ...StyleSheet.absoluteFillObject },
  tint: { ...StyleSheet.absoluteFillObject, opacity: 0.1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  copy: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
  },
  statement: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 25,
    lineHeight: 29,
    color: '#FFFFFF',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 12,
  },
  linkText: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
  linkTextDark: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.2,
    color: colors.graphite.text.secondary,
  },
  textOnlyFrame: {
    marginTop: 14,
  },
  textOnlyStatement: {
    fontFamily: 'EBGaramond-Medium',
    fontSize: 21,
    lineHeight: 25,
    color: colors.graphite.text.primary,
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
