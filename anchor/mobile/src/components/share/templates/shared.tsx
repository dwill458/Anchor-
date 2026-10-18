import React, { useCallback, useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { detailsFonts, detailsPalette } from '@/components/v2/anchors/anchorDetailsTokens';
import { SHARE_ASPECT, type ShareExportData } from '../shareTypes';

/** The poster's own near-black. Deliberately not the app's navy: an export is a picture, not a screen. */
export const POSTER_INK = '#0B0C16';
export const POSTER_CREAM = detailsPalette.cream;

export function shareHeight(width: number) {
  return width * SHARE_ASPECT;
}

/**
 * Counts the images a template depends on and calls `onReady` once all of them
 * have loaded or failed. A failed image still counts: the export proceeds with
 * whatever the template falls back to rather than hanging.
 */
export function useAssetGate(expected: number, onReady?: () => void) {
  const loaded = useRef(0);
  const fired = useRef(false);
  const callback = useRef(onReady);
  callback.current = onReady;

  const fire = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    callback.current?.();
  }, []);

  useEffect(() => {
    if (expected === 0) fire();
  }, [expected, fire]);

  return useCallback(() => {
    loaded.current += 1;
    if (loaded.current >= expected) fire();
  }, [expected, fire]);
}

export function ShareCanvas({ width, background, children }: { width: number; background: string; children: React.ReactNode }) {
  return (
    <View
      collapsable={false}
      style={{ width, height: shareHeight(width), backgroundColor: background, overflow: 'hidden' }}
    >
      {children}
    </View>
  );
}

/** The user's Anchor, rendered by the same component every other surface uses. */
export function ShareAnchorDisc({
  data,
  diameter,
  top,
  width,
  ring,
  onImageLoad,
}: {
  data: ShareExportData;
  diameter: number;
  top: number;
  width: number;
  /** Hairline cream ring that lifts the disc off a photographic or textured field. */
  ring?: boolean;
  onImageLoad?: () => void;
}) {
  const style: ViewStyle = { position: 'absolute', left: (width - diameter) / 2, top };
  return (
    <View style={style} pointerEvents="none">
      <CircularAnchorRenderer
        svg={data.svg}
        imageUrl={data.imageUrl}
        category={data.category}
        expression={data.expression}
        size={Math.round(diameter)}
        appearance="dark"
        onImageLoad={onImageLoad}
      />
      {ring ? (
        <View
          style={{
            ...StyleSheet.absoluteFill,
            borderRadius: diameter / 2,
            borderWidth: Math.max(1, diameter * 0.006),
            borderColor: 'rgba(244,237,224,.5)',
          }}
        />
      ) : null}
    </View>
  );
}

/** Small glyph + ANCHOR, near the bottom edge. Never a sentence, never large. */
export function ShareBrandMark({ width, ground = 'dark', logoTone, glow }: { width: number; ground?: 'dark' | 'light'; logoTone?: 'light' | 'dark'; glow?: string }) {
  const s = width / 1080;
  const glyphHeight = 50 * s;
  const useDarkLogo = logoTone ? logoTone === 'dark' : ground === 'light';
  const ink = useDarkLogo ? detailsPalette.ink : POSTER_CREAM;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: shareHeight(width) * 0.04, alignItems: 'center' }}
    >
      <Image
        source={useDarkLogo ? require('@/assets/home/anchor-brand-mark.png') : require('@/assets/home/anchor-brand-mark-light.png')}
        style={{ width: glyphHeight * (134 / 174), height: glyphHeight, opacity: 0.85 }}
        resizeMode="contain"
      />
      <Text
        style={{
          marginTop: 12 * s,
          fontFamily: detailsFonts.uiStrong,
          fontSize: 22 * s,
          letterSpacing: 9 * s,
          color: ink,
          opacity: 0.85,
          paddingLeft: 9 * s,
          ...(glow ? { textShadowColor: glow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 * s } : null),
        }}
      >
        ANCHOR
      </Text>
    </View>
  );
}

/** Intention size steps down with length so a long intention keeps its poster proportions. */
export function intentionFontSize(text: string, width: number, steps: Array<[number, number]>) {
  const s = width / 1080;
  const length = text.trim().length;
  const hit = steps.find(([max]) => length <= max) ?? steps[steps.length - 1];
  return hit[1] * s;
}

export function ShareIntention({
  text,
  width,
  top,
  fontSize,
  uppercase,
  letterSpacing = 0,
  shadow,
  maxLines = 4,
}: {
  text: string;
  width: number;
  top: number;
  fontSize: number;
  uppercase?: boolean;
  letterSpacing?: number;
  shadow?: boolean;
  maxLines?: number;
}) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: width * 0.08, width: width * 0.84, top }}>
      <Text
        numberOfLines={maxLines}
        style={{
          fontFamily: detailsFonts.serif,
          fontSize,
          lineHeight: fontSize * (uppercase ? 1.08 : 1.2),
          letterSpacing,
          textAlign: 'center',
          color: POSTER_CREAM,
          ...(shadow
            ? { textShadowColor: 'rgba(8,9,16,.55)', textShadowOffset: { width: 0, height: fontSize * 0.04 }, textShadowRadius: fontSize * 0.2 }
            : null),
        }}
      >
        {uppercase ? text.toLocaleUpperCase() : text}
      </Text>
    </View>
  );
}

/** Small-caps line: "ABUNDANCE" or "ABUNDANCE · BUILDING". Real data only. */
export function ShareMetaLine({ parts, width, top }: { parts: Array<string | null | undefined>; width: number; top: number }) {
  const s = width / 1080;
  const line = parts.filter(Boolean).join('  ·  ').toLocaleUpperCase();
  if (!line) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top, alignItems: 'center' }}>
      <Text
        style={{
          fontFamily: detailsFonts.uiStrong,
          fontSize: 24 * s,
          letterSpacing: 7 * s,
          paddingLeft: 7 * s,
          color: POSTER_CREAM,
          opacity: 0.7,
        }}
      >
        {line}
      </Text>
    </View>
  );
}

/** Top-to-bottom tonal wash. Alpha stops only, so the image under it stays the image. */
export function ShareScrim({ colors, locations }: { colors: [string, string, ...string[]]; locations?: [number, number, ...number[]] }) {
  return <LinearGradient pointerEvents="none" colors={colors} locations={locations} style={StyleSheet.absoluteFill} />;
}

