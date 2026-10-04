import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import {
  Canvas, Circle, Group, ImageShader, LinearGradient, Path, Rect, Shader,
  Skia, useImage, type SkImage,
} from '@shopify/react-native-skia';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import type { AnchorExpression } from '@/constants/v2/creation';
import {
  RELEASE_FIRE_KILL_SWITCH,
  RELEASE_CEREMONY_TIMELINE_MS as T,
  RELEASE_CEREMONY_TIMELINE_REDUCED_MS as R,
} from '@/constants/v2/release';
import {
  createReleaseParticles, flameContact, flameIntensity, frontHeight,
  RELEASE_FLAME_COUNT, releaseSeed, seededUnit, segment,
} from './releaseBurn';
import { createReleaseArtworkImage, validateReleaseArtworkImage } from './releaseArtworkImage';
import { reportReleaseFireFallback, resolveReleaseFire, type ReleaseFireTexture } from './releaseFire';

// The original renderer is captured once. This shader only changes material at
// the cut; it never recolours, reconstructs or distorts the untouched artwork.
export const RELEASE_BURN_SHADER = `
uniform shader artwork;
uniform float height;
uniform float size;
uniform float phase;
uniform float heat;
uniform float alive;
half4 main(float2 xy) {
  half4 original = artwork.eval(xy);
  float relief = 3.2*sin(xy.x*0.071+phase) + 1.4*sin(xy.x*0.23+phase*1.7)
    + (xy.x/size-0.5)*13.0;
  float distance = height + relief - xy.y;
  float keep = smoothstep(-2.5, 0.5, distance) * alive;
  float charred = (1.0-smoothstep(-1.0, 1.0, distance))*keep;
  float seam = (1.0-smoothstep(0.5, 2.0, abs(distance-0.8)))*heat;
  float preheat = (1.0-smoothstep(2.0, 6.0, distance))*(1.0-seam)*heat*0.16;
  half3 rgb = original.rgb;
  rgb = mix(rgb, half3(0.70,0.31,0.12)*original.a, preheat);
  rgb = mix(rgb, half3(0.10,0.07,0.055)*original.a, charred);
  rgb = mix(rgb, half3(1.0,0.59,0.22)*original.a, seam);
  return half4(rgb*keep, original.a*keep);
}`;

// Static paths are transformed on the UI thread; no SVG strings are built per frame.
const TONGUE = 'M -0.42 0 C -0.65 -0.22 -0.21 -0.38 -0.13 -0.58 C -0.23 -0.76 0.11 -0.9 0 -1 C 0.36 -0.74 0.16 -0.56 0.35 -0.35 C 0.53 -0.16 0.42 -0.04 0.42 0 Q 0 0.1 -0.42 0 Z';

function Flame({ index, seed, size, clock }: { index: number; seed: number; size: number; clock: SharedValue<number> }) {
  const phase = seededUnit(seed, 111 + index) * Math.PI * 2;
  const fieldPhase = seededUnit(seed, 13) * Math.PI * 2;
  const slot = (index + 0.4 + seededUnit(seed, 201 + index) * 0.2) / RELEASE_FLAME_COUNT;
  const birth = index === 4 ? T.ignite : index === 2 || index === 6
    ? T.ignite + 160 : T.burnEarly - 80 + seededUnit(seed, 301 + index) * 180;
  const opacity = useDerivedValue(() => {
    const time = clock.value;
    const contact = flameContact(slot, time, size, fieldPhase);
    return contact.visible ? segment(time, birth, birth + 160) * (1 - segment(time, T.burnLate + index * 28, T.emptyPause - 150)) : 0;
  });
  // Static seeded geometry belongs to JS initialization, never a UI callback.
  // Tongue height: ~14px at ignition, 36-45px at peak, then starves with the material.
  const peakHeight = 22 + seededUnit(seed, 401 + index) * 9;
  const transform = useDerivedValue(() => {
    const time = clock.value;
    const contact = flameContact(slot, time, size, fieldPhase);
    const peak = segment(time, T.ignite + 220, T.burnEarly + 380);
    const cooling = 1 - segment(time, T.burnLate + 60, T.emptyPause - 150);
    const flutter = 0.92 + 0.05 * Math.sin(time * 0.014 + phase) + 0.03 * Math.sin(time * 0.025 + phase * 2);
    const height = (14 + peak * peakHeight) * cooling * flutter;
    const width = (6 + peak * 8) * (0.86 + 0.14 * Math.sin(time * 0.009 + phase));
    return [{ translateX: contact.x }, { translateY: contact.y + 0.7 },
      { rotate: Math.sin(time * 0.008 + phase) * 0.16 }, { scaleX: width }, { scaleY: Math.max(0.01, height) }];
  });
  return (
    <Group opacity={opacity} transform={transform}>
      <Path path={TONGUE} color="#9A361D" opacity={0.85} />
      <Group transform={[{ scaleX: 0.78 }, { scaleY: 0.9 }]}>
        <Path path={TONGUE}>
          <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: -1 }} colors={['#FFC16B', '#F08432', '#B74B22']} />
        </Path>
      </Group>
      <Group transform={[{ scaleX: 0.36 }, { scaleY: 0.56 }]}>
        <Path path={TONGUE} color="#FFF1C8" />
      </Group>
    </Group>
  );
}

function Particle({ particle, fieldPhase, clock }: {
  particle: ReturnType<typeof createReleaseParticles>[number]; fieldPhase: number; clock: SharedValue<number>;
}) {
  const contact = flameContact(particle.slot, particle.birth, particle.surfaceSize, fieldPhase);
  const opacity = useDerivedValue(() => {
    const time = clock.value;
    if (!contact.visible || time < particle.birth || time >= particle.death) return 0;
    const p = (time - particle.birth) / particle.life;
    return segment(p, 0, 0.12) * (1 - segment(p, 0.3, 1))
      * (1 - segment(time, T.emptyPause - 130, T.emptyPause)) * (particle.ash ? 0.55 : 0.8);
  });
  const transform = useDerivedValue(() => {
    const p = Math.max(0, Math.min(1, (clock.value - particle.birth) / particle.life));
    return [{ translateX: contact.x + particle.drift * p + Math.sin(p * 4 + particle.phase) * p * 2 },
      { translateY: contact.y - particle.rise * p }, { rotate: particle.phase + p * (particle.ash ? 2.4 : 0.2) }];
  });
  const color = useDerivedValue(() => clock.value - particle.birth < particle.life * 0.25 ? '#FFE3A0' : clock.value - particle.birth < particle.life * 0.6 ? '#E48539' : '#6D3526');
  return (
    <Group opacity={opacity} transform={transform}>
      {particle.ash ? <Rect x={0} y={0} width={particle.size * 1.8} height={particle.size} color="#635C54" />
        : <Circle cx={0} cy={0} r={particle.size / 2} color={color} />}
    </Group>
  );
}

type Props = {
  anchorId: string; artworkSvg: string; imageUrl?: string | null; expression?: AnchorExpression;
  category?: string | null; size: number; active: boolean; reduceMotion: boolean; clock: SharedValue<number>;
  /** Hold has reached the point where the burn texture should be built (ahead of isolation). */
  prepare?: boolean;
};

type BuiltTexture = { key: string; image: SkImage | null; texture: ReleaseFireTexture };
const PENDING = (key: string): BuiltTexture => ({ key, image: null, texture: 'pending' });

/** One persistent real Anchor through confirmation, isolation and material consumption. */
export const V2ReleaseArtwork = memo(function V2ReleaseArtwork({ anchorId, artworkSvg, imageUrl, expression, category, size, active, reduceMotion, clock, prepare = false }: Props) {
  const seed = useMemo(() => releaseSeed(anchorId), [anchorId]);
  const fieldPhase = useMemo(() => seededUnit(seed, 13) * Math.PI * 2, [seed]);
  const particles = useMemo(() => createReleaseParticles(seed, size), [seed, size]);
  const effect = useMemo(() => {
    if (RELEASE_FIRE_KILL_SWITCH || Platform.OS === 'web') return null;
    try { return Skia.RuntimeEffect.Make(RELEASE_BURN_SHADER); } catch { return null; }
  }, []);
  const hasImageUrl = typeof imageUrl === 'string' && imageUrl.length > 0;
  // The finished image is decoded inside Skia from the same URL the native renderer shows.
  const decoded = useImage(hasImageUrl ? imageUrl : null);
  const sourceKey = `${artworkSvg}|${imageUrl ?? ''}|${expression ?? ''}|${category ?? ''}|${size}`;
  const [built, setBuilt] = useState<BuiltTexture>(() => PENDING(sourceKey));
  const current = built.key === sourceKey ? built : PENDING(sourceKey);

  // Build the texture while the hold is still running so it is ready by isolation. The disc is
  // drawn in Skia (never a native-view snapshot, which is blank on Android) and validated before use.
  useEffect(() => {
    if (!(prepare || active) || reduceMotion || !effect || current.texture !== 'pending') return undefined;
    if (hasImageUrl && !decoded && !active) return undefined;
    const timer = setTimeout(() => {
      const image = createReleaseArtworkImage({ svg: artworkSvg, category, expression, size, pixelRatio: Math.min(PixelRatio.get(), 3),
        hairline: Math.max(StyleSheet.hairlineWidth, 0.5), image: decoded, hasImageUrl });
      const valid = validateReleaseArtworkImage(image);
      setBuilt({ key: sourceKey, image: valid ? image : null, texture: valid ? 'valid' : 'blank' });
    }, 0);
    return () => clearTimeout(timer);
  }, [prepare, active, reduceMotion, effect, current.texture, hasImageUrl, decoded, artworkSvg, category, expression, size, sourceKey]);

  const decision = resolveReleaseFire({ reduceMotion, effectAvailable: Boolean(effect), texture: current.texture });
  const reported = useRef(false);
  useEffect(() => {
    if (!active || reported.current || !decision.fallback) return;
    reported.current = true;
    reportReleaseFireFallback(decision.fallback);
  }, [active, decision.fallback]);

  const captured = current.image;
  const burnAvailable = decision.enabled && Boolean(captured && effect);
  // Native art stays until the Skia layer is ready, then both swap on the same isolation frame.
  const nativeStyle = useAnimatedStyle(() => ({ opacity: !active ? 1 : burnAvailable ? 0
    : reduceMotion ? 1 - segment(clock.value, R.fade, R.emptyPause)
      : 1 - segment(clock.value, T.ignite, T.emptyPause) }));
  const canvasStyle = useAnimatedStyle(() => ({ opacity: active && burnAvailable && clock.value < T.emptyPause ? 1 : 0 }));
  const uniforms = useDerivedValue(() => ({
    height: frontHeight(clock.value, size), size, phase: fieldPhase,
    heat: clock.value < T.ignite ? 0 : Math.max(0.2, flameIntensity(clock.value)),
    alive: clock.value < T.emptyPause - 80 ? 1 : 0,
  }));

  return (
    <View style={{ width: size, height: size }} testID="v2-release-artwork">
      <Animated.View style={nativeStyle}>
        <CircularAnchorRenderer svg={artworkSvg} imageUrl={imageUrl} expression={expression} category={category}
          size={size} appearance="paper" accessibilityLabel="Anchor artwork" />
      </Animated.View>
      {burnAvailable && captured && effect ? (
        <Animated.View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, canvasStyle]} testID="v2-release-fire">
          <Canvas style={{ width: size, height: size }} pointerEvents="none">
            <Rect x={0} y={0} width={size} height={size}>
              <Shader source={effect} uniforms={uniforms}>
                <ImageShader image={captured} fit="fill" rect={{ x: 0, y: 0, width: size, height: size }} />
              </Shader>
            </Rect>
            {Array.from({ length: RELEASE_FLAME_COUNT }, (_, index) => <Flame key={index} index={index} seed={seed} size={size} clock={clock} />)}
            {particles.map((particle, i) => <Particle key={i} particle={particle} fieldPhase={fieldPhase} clock={clock} />)}
          </Canvas>
        </Animated.View>
      ) : null}
    </View>
  );
});
