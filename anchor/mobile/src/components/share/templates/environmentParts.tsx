import React, { useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { detailsFonts } from '@/components/v2/anchors/anchorDetailsTokens';
import type { EnvironmentGeometry, EnvironmentPalette } from '../environmentLayout';
import type { EditorialInk, ShareEnvironment } from '../shareEnvironments';
import type { ShareExportData } from '../shareTypes';
import { POSTER_INK, shareHeight } from './shared';

let washCounter = 0;

export interface Wash {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
  alpha: number;
}

/**
 * Soft elliptical tonal washes that lift text or the brand off a busy
 * environment. Alpha-only radial falloff, no edges and no boxes: they should
 * be felt, not seen.
 */
export function ShareWashes({ width, washes }: { width: number; washes: Wash[] }) {
  const prefix = useRef(`sw${(washCounter += 1)}`).current;
  const height = shareHeight(width);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        {washes.map((w, i) => (
          <RadialGradient
            key={i}
            id={`${prefix}-${i}`}
            cx={w.cx}
            cy={w.cy}
            fx={w.cx}
            fy={w.cy}
            rx={w.rx}
            ry={w.ry}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={w.color} stopOpacity={w.alpha} />
            <Stop offset="0.55" stopColor={w.color} stopOpacity={w.alpha * 0.6} />
            <Stop offset="1" stopColor={w.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {washes.map((_, i) => (
        <Rect key={i} x={0} y={0} width={width} height={height} fill={`url(#${prefix}-${i})`} />
      ))}
    </Svg>
  );
}

/** The wash behind the intention block. */
export function textWash(geo: EnvironmentGeometry, palette: EnvironmentPalette, alpha = 0.5): Wash {
  return { ...geo.wash, color: palette.wash, alpha };
}

/**
 * A faint pool of colour behind the brand mark so it reads on a busy edge. Its
 * colour is the opposite of the mark's, chosen from the pixels behind it.
 */
export function brandWash(width: number, palette: EnvironmentPalette): Wash {
  const height = shareHeight(width);
  return { cx: width / 2, cy: height * 0.935, rx: width * 0.34, ry: height * 0.07, color: palette.brand.wash, alpha: 0.78 };
}

/**
 * The style environment: a curated full-frame background asset. Never the
 * user's Anchor. An Anchor with no share environment gets a neutral ink ground.
 */
export function EnvironmentGround({ env, width, onLoad }: { env: ShareEnvironment; width: number; onLoad?: () => void }) {
  const height = shareHeight(width);
  if (!env.source) {
    return (
      <>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: POSTER_INK }]} />
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="neutral-ground" cx={width / 2} cy={height * 0.42} fx={width / 2} fy={height * 0.42} rx={width * 0.8} ry={height * 0.5} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#2A2C45" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#2A2C45" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#neutral-ground)" />
        </Svg>
      </>
    );
  }
  return (
    <Image
      source={env.source}
      resizeMode="cover"
      onLoad={onLoad}
      onError={onLoad}
      style={{ position: 'absolute', left: 0, top: 0, width, height }}
    />
  );
}

/**
 * The user's circular Anchor, untouched, with a soft shadow pool behind it for
 * separation. Positioned by centre so it can be scaled around that centre.
 */
export function AnchorWithHalo({
  data,
  diameter,
  cx,
  cy,
  palette,
  onImageLoad,
}: {
  data: ShareExportData;
  diameter: number;
  cx: number;
  cy: number;
  palette: EnvironmentPalette;
  onImageLoad?: () => void;
}) {
  const box = diameter * 1.7;
  const prefix = useRef(`ah${(washCounter += 1)}`).current;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: cx - box / 2, top: cy - box / 2, width: box, height: box, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={prefix} cx={box / 2} cy={box / 2 + diameter * 0.04} fx={box / 2} fy={box / 2 + diameter * 0.04} rx={diameter * 0.78} ry={diameter * 0.78} gradientUnits="userSpaceOnUse">
            <Stop offset="0.6" stopColor={palette.halo} stopOpacity={0.34} />
            <Stop offset="1" stopColor={palette.halo} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={box} height={box} fill={`url(#${prefix})`} />
      </Svg>
      <CircularAnchorRenderer
        svg={data.svg}
        imageUrl={data.imageUrl}
        category={data.category}
        expression={data.expression}
        size={Math.round(diameter)}
        appearance="dark"
        onImageLoad={onImageLoad}
      />
    </View>
  );
}

type LineTreatment = {
  color?: string;
  opacity?: number;
  /** Vertical offset, px at the rendered width. */
  dy?: number;
  shadowColor?: string;
  shadowRadius?: number;
};

/** The intention as explicit lines: the line breaks are decided by layout, not by the device. */
export function IntentionLines({ geo, palette, treatment }: { geo: EnvironmentGeometry; palette: EnvironmentPalette; treatment?: LineTreatment }) {
  const { text } = geo;
  const alignItems = text.align === 'left' ? 'flex-start' : text.align === 'right' ? 'flex-end' : 'center';
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: text.left, top: text.top + (treatment?.dy ?? 0), width: text.width, alignItems, opacity: treatment?.opacity ?? 1 }}
    >
      {text.layout.lines.map((line, i) => (
        <Text
          key={i}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          allowFontScaling={false}
          style={{
            width: text.width,
            fontFamily: detailsFonts.serif,
            fontSize: text.fontSize,
            lineHeight: text.lineHeight,
            letterSpacing: text.letterSpacing,
            textAlign: text.align,
            color: treatment?.color ?? palette.text,
            textShadowColor: treatment?.shadowColor ?? palette.wash,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: treatment?.shadowRadius ?? text.fontSize * 0.18,
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const hexAlpha = (hex: string, alpha: number) => hex + Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');

/**
 * Editorial intention, printed into the surface rather than set on top of it:
 * a warm ink that lets the ground show through, a soft bleed, a faint pressed
 * highlight on paper-like grounds, and a worn-ink speckle tinted to the paper
 * colour so the letters carry the texture of the material. Quiet by design.
 */
export function EditorialIntention({ geo, palette, ink, width }: { geo: EnvironmentGeometry; palette: EnvironmentPalette; ink: EditorialInk; width: number }) {
  const { text } = geo;
  const s = width / 1080;
  const pad = text.fontSize * 0.12;
  const bleedRadius = Math.max(0.8, text.fontSize * (0.008 + 0.016 * ink.bleed));
  return (
    <>
      {ink.impression ? (
        <IntentionLines
          geo={geo}
          palette={palette}
          treatment={{ color: hexAlpha(palette.highlight, 0.4), dy: Math.max(1, 1.8 * s * (text.fontSize / 80)), shadowColor: 'transparent', shadowRadius: 0 }}
        />
      ) : null}
      <IntentionLines
        geo={geo}
        palette={palette}
        treatment={{
          color: palette.ink,
          opacity: palette.inkOpacity,
          shadowColor: hexAlpha(palette.ink, 0.28 + 0.4 * ink.bleed),
          shadowRadius: bleedRadius,
        }}
      />
      {ink.wear > 0 ? (
        <Image
          source={require('@/assets/share-environments/ink-wear.png')}
          resizeMode="stretch"
          tintColor={palette.paper}
          style={{
            position: 'absolute',
            left: text.left - pad,
            top: text.top - pad,
            width: text.width + pad * 2,
            height: text.height + pad * 2,
            opacity: Math.min(1, ink.wear * 0.95),
          }}
        />
      ) : null}
    </>
  );
}

/** CATEGORY · STATE, real data only, small and quiet. */
export function MetaLine({ geo, palette, width, color }: { geo: EnvironmentGeometry; palette: EnvironmentPalette; width: number; color?: string }) {
  const s = width / 1080;
  const line = geo.meta.parts.join('  ·  ').toLocaleUpperCase();
  if (!line) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: geo.meta.top, alignItems: 'center' }}>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: detailsFonts.uiStrong,
          fontSize: 25 * s,
          letterSpacing: 7 * s,
          paddingLeft: 7 * s,
          color: color ?? palette.meta,
          textShadowColor: palette.wash,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 6 * s,
        }}
      >
        {line}
      </Text>
    </View>
  );
}
