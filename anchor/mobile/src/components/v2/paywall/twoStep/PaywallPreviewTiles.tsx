import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent, type TextProps } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Plus } from 'lucide-react-native';
import { colors } from '@/theme/v2';
import { PaywallAnchorArt, type PaywallAnchorArtModel } from './PaywallAnchorArt';
import { PaywallChartTile } from './PaywallChartTile';
import { PAYWALL_TIMING } from './paywallMotion';

/**
 * Step-1 preview tiles. Decorative: every inner size derives from the tile's
 * own measured width T (never the screen), text ignores system font scaling and
 * never wraps, and each tile is hidden from assistive tech — the row title and
 * description beside it carry the meaning for screen-reader and large-font users.
 */

type TileFrame = { width: number; height: number; W: number };

export type PaywallVisionPreview = { imageUri: string | null; title: string | null };

const VISION_SCRIM = ['rgba(12, 13, 26, 0)', 'rgba(12, 13, 26, 0.82)'] as const;
const VISION_FALLBACK = ['#262840', '#17182A'] as const;

/** T = the tile's measured width; seeded with the layout width so the first frame is already right. */
function useTileWidth(initial: number): [number, (event: LayoutChangeEvent) => void] {
  const [T, setT] = useState(initial);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) setT((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
  }, []);
  return [T, onLayout];
}

/** One line, never scaled by the system font; `fit` shrinks to 80% before it would ever ellipsize. */
function TileText({ style, children, fit, testID }: Pick<TextProps, 'style' | 'children' | 'testID'> & { fit?: boolean }) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.8 : undefined}
      style={style}
      testID={testID}
    >
      {children}
    </Text>
  );
}

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

function eyebrow(T: number) {
  const size = 0.045 * T;
  return { fontFamily: 'Figtree-SemiBold', fontSize: size, lineHeight: size * 1.3, letterSpacing: size * 0.14, color: colors.paywall.textDim };
}

/** The user's Vision photograph with its title, or a calm ink invitation to add one. */
export function PaywallVisionTile({ width, height, vision }: TileFrame & { vision: PaywallVisionPreview | null }) {
  const [T, onLayout] = useTileWidth(width);
  const imageUri = vision?.imageUri ?? null;
  const title = vision?.title?.trim() || 'My Vision';
  const labelSize = 0.075 * T;
  const label = { fontFamily: 'EBGaramond-Regular', fontSize: labelSize, lineHeight: labelSize * 1.2, color: colors.paywall.text };
  return (
    <View
      {...HIDDEN}
      onLayout={onLayout}
      style={[styles.tile, { width, height }]}
      testID={imageUri ? 'v2-paywall-vision-image' : 'v2-paywall-vision-fallback'}
    >
      {imageUri ? (
        <>
          <Image source={{ uri: imageUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={VISION_SCRIM} start={{ x: 0.5, y: 0.3 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        </>
      ) : (
        <LinearGradient colors={VISION_FALLBACK} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <View style={[styles.bottomLeft, { paddingHorizontal: 0.06 * T, paddingBottom: 0.06 * T }]}>
        {imageUri ? (
          <TileText style={eyebrow(T)}>MY VISION</TileText>
        ) : (
          <Plus size={0.12 * T} color={colors.paywall.gold} strokeWidth={1.25} style={{ marginBottom: 0.02 * T, marginLeft: -0.015 * T }} />
        )}
        <TileText fit style={label}>{imageUri ? title : 'Add your Vision'}</TileText>
      </View>
    </View>
  );
}

/** Anchor crop · "Anchor Session" / "5 min · Audio" · a gold play button that breathes every ~3 s. */
export function PaywallPracticeTile({ width, height, art, reduceMotion }: TileFrame & { art: PaywallAnchorArtModel | null; reduceMotion: boolean }) {
  const [T, onLayout] = useTileWidth(width);
  const ring = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(ring);
    ring.value = 0;
    if (reduceMotion) return;
    const { playRingMs, playRingEveryMs } = PAYWALL_TIMING;
    ring.value = withDelay(
      1200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: playRingMs, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: playRingEveryMs - playRingMs }),
        ),
        -1,
      ),
    );
  }, [reduceMotion, ring]);
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value > 0 ? 0.5 * (1 - ring.value) : 0,
    transform: [{ scale: 1 + ring.value * 0.8 }],
  }));
  const play = 0.17 * T;
  const line1 = 0.07 * T;
  const line2 = 0.052 * T;
  return (
    <View
      {...HIDDEN}
      onLayout={onLayout}
      style={[styles.tile, styles.inkTile, styles.row, { width, height, paddingHorizontal: 0.05 * T, gap: 0.04 * T }]}
    >
      <PaywallAnchorArt art={art} size={0.22 * T} />
      <View style={styles.middle}>
        <TileText fit style={{ fontFamily: 'Figtree-SemiBold', fontSize: line1, lineHeight: line1 * 1.3, color: colors.paywall.text }}>
          Anchor Session
        </TileText>
        <TileText style={{ fontFamily: 'Figtree-Regular', fontSize: line2, lineHeight: line2 * 1.35, color: colors.paywall.textDim }}>
          5 min · Audio
        </TileText>
      </View>
      <View style={{ width: play, height: play }}>
        <Animated.View style={[styles.playRing, { borderRadius: play / 2 }, ringStyle]} />
        <View style={[styles.play, { borderRadius: play / 2 }]}>
          <Play size={play * 0.4} color={colors.paywall.gold} fill={colors.paywall.gold} style={{ marginLeft: play * 0.06 }} />
        </View>
      </View>
    </View>
  );
}

/** The "My path" route preview, unchanged except its eyebrow, which is now sized from T. */
export function PaywallChartPreviewTile({ width, height, reduceMotion }: TileFrame & { reduceMotion: boolean }) {
  const [T, onLayout] = useTileWidth(width);
  return (
    <View {...HIDDEN} onLayout={onLayout} style={[styles.tile, styles.inkTile, { width, height, padding: 0.06 * T }]}>
      <PaywallChartTile width={width} height={height} reduceMotion={reduceMotion} />
      <TileText style={eyebrow(T)}>MY PATH</TileText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.paywall.hairlineStrong },
  inkTile: { backgroundColor: colors.paywall.inkRaised },
  row: { flexDirection: 'row', alignItems: 'center' },
  middle: { flex: 1, minWidth: 0 },
  bottomLeft: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'flex-start' },
  play: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: colors.paywall.gold, alignItems: 'center', justifyContent: 'center' },
  playRing: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: colors.paywall.gold },
});

// DEFERRED: previous tiles, sized from screen width W with system font scaling on, so their text
// DEFERRED: clipped and wrapped at large font sizes and on narrow phones. Kept for reference.
// DEFERRED: import React, { useEffect } from 'react';
// DEFERRED: import { Image, StyleSheet, Text, View } from 'react-native';
// DEFERRED: import Animated, {
// DEFERRED:   Easing,
// DEFERRED:   cancelAnimation,
// DEFERRED:   useAnimatedStyle,
// DEFERRED:   useSharedValue,
// DEFERRED:   withDelay,
// DEFERRED:   withRepeat,
// DEFERRED:   withSequence,
// DEFERRED:   withTiming,
// DEFERRED: } from 'react-native-reanimated';
// DEFERRED: import { LinearGradient } from 'expo-linear-gradient';
// DEFERRED: import { ChevronRight, Play } from 'lucide-react-native';
// DEFERRED: import { colors } from '@/theme/v2';
// DEFERRED: import { PaywallAnchorArt, type PaywallAnchorArtModel } from './PaywallAnchorArt';
// DEFERRED: import { PAYWALL_TIMING } from './paywallMotion';
// DEFERRED: import { paywallType } from './paywallType';
// DEFERRED:
// DEFERRED: type TileFrame = { width: number; height: number; W: number };
// DEFERRED:
// DEFERRED: export type PaywallVisionPreview = { imageUri: string | null; title: string | null };
// DEFERRED:
// DEFERRED: const VISION_SCRIM = ['rgba(12, 13, 26, 0)', 'rgba(12, 13, 26, 0.78)'] as const;
// DEFERRED: const VISION_FALLBACK = ['#2B2D44', '#1B1C2F'] as const;
// DEFERRED:
// DEFERRED: /** The user's Vision photograph with its title, or a calm neutral invitation. */
// DEFERRED: export function PaywallVisionTile({ width, height, W, vision }: TileFrame & { vision: PaywallVisionPreview | null }) {
// DEFERRED:   const imageUri = vision?.imageUri ?? null;
// DEFERRED:   const title = vision?.title?.trim() || null;
// DEFERRED:   return (
// DEFERRED:     <View style={[styles.tile, { width, height }]} testID={imageUri ? 'v2-paywall-vision-image' : 'v2-paywall-vision-fallback'}>
// DEFERRED:       {imageUri ? (
// DEFERRED:         <Image source={{ uri: imageUri }} resizeMode="cover" style={StyleSheet.absoluteFill} />
// DEFERRED:       ) : (
// DEFERRED:         <LinearGradient colors={VISION_FALLBACK} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
// DEFERRED:       )}
// DEFERRED:       <LinearGradient colors={VISION_SCRIM} start={{ x: 0.5, y: 0.25 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
// DEFERRED:       <View style={[styles.visionCopy, { padding: W * 0.035 }]}>
// DEFERRED:         <View style={styles.flex}>
// DEFERRED:           <Text style={paywallType.eyebrow(W)}>MY VISION</Text>
// DEFERRED:           <Text numberOfLines={1} style={paywallType.tileTitle(W)}>{imageUri && title ? title : imageUri ? 'My Vision' : 'Add your Vision'}</Text>
// DEFERRED:         </View>
// DEFERRED:         <View style={[styles.glyph, { width: W * 0.07, height: W * 0.07, borderRadius: W * 0.035 }]}>
// DEFERRED:           <ChevronRight size={W * 0.04} color={colors.paywall.text} strokeWidth={1.6} />
// DEFERRED:         </View>
// DEFERRED:       </View>
// DEFERRED:     </View>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED:
// DEFERRED: /** Small crop of the user's Anchor beside a decorative play glyph that breathes every ~3 s. */
// DEFERRED: export function PaywallPracticeTile({ width, height, W, art, reduceMotion }: TileFrame & { art: PaywallAnchorArtModel | null; reduceMotion: boolean }) {
// DEFERRED:   const ring = useSharedValue(0);
// DEFERRED:   useEffect(() => {
// DEFERRED:     cancelAnimation(ring);
// DEFERRED:     ring.value = 0;
// DEFERRED:     if (reduceMotion) return;
// DEFERRED:     const { playRingMs, playRingEveryMs } = PAYWALL_TIMING;
// DEFERRED:     ring.value = withDelay(
// DEFERRED:       1200,
// DEFERRED:       withRepeat(
// DEFERRED:         withSequence(
// DEFERRED:           withTiming(1, { duration: playRingMs, easing: Easing.out(Easing.quad) }),
// DEFERRED:           withTiming(0, { duration: 0 }),
// DEFERRED:           withTiming(0, { duration: playRingEveryMs - playRingMs }),
// DEFERRED:         ),
// DEFERRED:         -1,
// DEFERRED:       ),
// DEFERRED:     );
// DEFERRED:   }, [reduceMotion, ring]);
// DEFERRED:   const ringStyle = useAnimatedStyle(() => ({
// DEFERRED:     opacity: ring.value > 0 ? 0.5 * (1 - ring.value) : 0,
// DEFERRED:     transform: [{ scale: 1 + ring.value * 0.8 }],
// DEFERRED:   }));
// DEFERRED:   const artSize = height * 0.72;
// DEFERRED:   const glyph = W * 0.085;
// DEFERRED:   return (
// DEFERRED:     <View style={[styles.tile, styles.inkTile, styles.row, { width, height, paddingHorizontal: W * 0.03, gap: W * 0.03 }]}>
// DEFERRED:       <PaywallAnchorArt art={art} size={artSize} />
// DEFERRED:       <View style={styles.flex}>
// DEFERRED:         <Text style={paywallType.eyebrow(W)}>PRACTICE</Text>
// DEFERRED:         <Text numberOfLines={1} style={paywallType.tileBody(W)}>Anchor Session</Text>
// DEFERRED:         <Text numberOfLines={1} style={paywallType.tileMeta(W)}>5 min · Audio</Text>
// DEFERRED:       </View>
// DEFERRED:       <View style={{ width: glyph, height: glyph }}>
// DEFERRED:         <Animated.View style={[styles.playRing, { borderRadius: glyph / 2 }, ringStyle]} />
// DEFERRED:         <View style={[styles.play, { borderRadius: glyph / 2 }]}>
// DEFERRED:           <Play size={glyph * 0.38} color={colors.paywall.text} fill={colors.paywall.text} />
// DEFERRED:         </View>
// DEFERRED:       </View>
// DEFERRED:     </View>
// DEFERRED:   );
// DEFERRED: }
// DEFERRED:
// DEFERRED: const styles = StyleSheet.create({
// DEFERRED:   tile: { borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.paywall.hairlineStrong },
// DEFERRED:   inkTile: { backgroundColor: colors.paywall.inkRaised },
// DEFERRED:   row: { flexDirection: 'row', alignItems: 'center' },
// DEFERRED:   flex: { flex: 1, minWidth: 0 },
// DEFERRED:   visionCopy: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
// DEFERRED:   glyph: { borderWidth: 1, borderColor: colors.paywall.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
// DEFERRED:   play: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: colors.paywall.textDim, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
// DEFERRED:   playRing: { ...StyleSheet.absoluteFill, borderWidth: 1, borderColor: colors.paywall.text },
// DEFERRED: });
