import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme/v2';
import { progressTokens } from '@/components/v2/progress/progressTokens';
import { ART_SIZE, motifPrimitives, type ArtPrimitive, type ArtRole } from '@/milestones/artGeometry';
import { getMilestoneSpec } from '@/milestones/registry';
import { getMasterAsset } from '@/milestones/masterAssets';
import { MasterEmblem } from './MasterEmblem';
import type { SharedValue } from 'react-native-reanimated';

export interface MilestoneArtworkProps {
  definitionId: string;
  /** Locked artwork is an outline in muted ink: no fill, no glow, never mistakable for earned. */
  state: 'earned' | 'locked';
  size: number;
  /** The Anchor's category colour. Only strength artwork uses it. */
  categoryColor?: string;
  testID?: string;
  animated?: boolean;
  progress?: SharedValue<number>;
  reducedMotion?: boolean;
}

const PLATE_RADIUS = 18;
const LOCKED_INK = colors.text.disabled;

interface Palette {
  plate: string;
  plateEdge: string;
  roles: Record<ArtRole, string>;
}

function paletteFor(family: 'strength' | 'other', state: 'earned' | 'locked', categoryColor: string): Palette {
  if (state === 'locked') {
    return {
      plate: colors.grouped,
      plateEdge: colors.border.default,
      roles: { accent: LOCKED_INK, ink: LOCKED_INK, gold: LOCKED_INK, muted: LOCKED_INK },
    };
  }
  if (family === 'strength') {
    return {
      plate: colors.ink.base,
      plateEdge: progressTokens.heroHairline,
      roles: { accent: categoryColor, ink: colors.cream, gold: progressTokens.gold, muted: progressTokens.heroMuted },
    };
  }
  return {
    plate: colors.frame,
    plateEdge: colors.border.default,
    roles: { accent: progressTokens.gold, ink: colors.ink.base, gold: progressTokens.gold, muted: colors.text.secondary },
  };
}

function renderPrimitive(prim: ArtPrimitive, index: number, palette: Palette, locked: boolean) {
  const color = palette.roles[prim.role];
  // Locked artwork never fills: it is drawn as a dashed outline of the same shape.
  const filled = prim.fill && !locked;
  const dash = locked ? '3 3' : prim.dash;
  const common = {
    stroke: filled ? undefined : color,
    strokeWidth: filled ? undefined : (prim.width ?? 2),
    strokeDasharray: filled ? undefined : dash,
    fill: filled ? color : 'none',
    opacity: locked ? 0.7 : prim.opacity,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return prim.kind === 'circle' ? (
    <Circle key={index} cx={prim.cx} cy={prim.cy} r={prim.r} {...common} />
  ) : (
    <Path key={index} d={prim.d} {...common} />
  );
}

/**
 * Milestone artwork composed from SVG primitives (no flattened images), so one component serves
 * the collection thumbnail, the celebration, and the detail hero in earned and locked states.
 * Unknown definitions get a clearly marked development fallback, never unrelated artwork.
 */
export const MilestoneArtwork: React.FC<MilestoneArtworkProps> = React.memo(
  ({ definitionId, state, size, categoryColor = progressTokens.gold, testID = 'milestone-artwork', animated, progress, reducedMotion }) => {
    const spec = getMilestoneSpec(definitionId);
    const locked = state === 'locked';
    const palette = paletteFor(spec?.family === 'strength' ? 'strength' : 'other', state, categoryColor);
    const primitives = React.useMemo(
      () => (spec ? motifPrimitives(spec.art.motif, spec.art.tier) : []),
      [spec],
    );
    const glow = Boolean(spec && spec.family === 'strength' && !locked);

    return (
      <View
        style={{ width: size, height: size }}
        accessible
        accessibilityLabel={`${spec?.title ?? 'Milestone'} artwork, ${locked ? 'locked' : 'earned'}`}
        testID={`${testID}-${locked ? 'locked' : 'earned'}`}
      >
        {getMasterAsset(definitionId) ? <MasterEmblem milestoneId={definitionId} state={animated && !locked ? 'revealing' : state} size={size} animated={animated} progress={progress} reducedMotion={reducedMotion} /> : <Svg width={size} height={size} viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}>
          <Defs>
            <RadialGradient id="msGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={categoryColor} stopOpacity={0.42} />
              <Stop offset="100%" stopColor={categoryColor} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={1} y={1} width={118} height={118} rx={PLATE_RADIUS} fill={palette.plate} stroke={palette.plateEdge} strokeWidth={1.2} />
          {glow ? <Circle cx={60} cy={60} r={52} fill="url(#msGlow)" /> : null}
          {spec ? (
            primitives.map((prim, index) => renderPrimitive(prim, index, palette, locked))
          ) : (
            <FallbackMark locked={locked} color={LOCKED_INK} />
          )}
        </Svg>}
        {!spec ? <View style={styles.fallbackFlag} testID={`${testID}-fallback`} /> : null}
      </View>
    );
  },
);
MilestoneArtwork.displayName = 'MilestoneArtwork';

/** Development fallback: a plain dashed medallion. It claims nothing about the milestone it stands in for. */
const FallbackMark: React.FC<{ locked: boolean; color: string }> = ({ color }) => (
  <>
    <Circle cx={60} cy={60} r={30} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 4" />
    <Circle cx={60} cy={60} r={4} fill={color} />
  </>
);

const styles = StyleSheet.create({
  // Zero-size marker so tests and QA can tell a fallback from real artwork.
  fallbackFlag: { position: 'absolute', width: 0, height: 0 },
});
