import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { createSeededRandom } from './visionMaterialRandom';
import { VISION_PAPER, VISION_PAPER_TEXTURE } from './visionMaterialTokens';

/** The texture is drawn in a fixed unit square and stretched to fit, so it never repeats as a visible tile. */
const UNIT = 1000;

/**
 * Builds the grain, fibre and mottle geometry for one seed. Pure and deterministic: the
 * same seed always yields the same strings.
 */
export function buildPaperTexture(seed: number): { grain: string; fibres: string; mottle: string } {
  const next = createSeededRandom(seed);
  let grain = '';
  for (let i = 0; i < VISION_PAPER_TEXTURE.grainCount; i++) {
    const x = (next() * UNIT).toFixed(1);
    const y = (next() * UNIT).toFixed(1);
    const length = (0.4 + next() * 1.4).toFixed(2);
    grain += `M${x} ${y}h${length}`;
  }
  // Fibre flecks: short, nearly straight strokes at random angles, none longer than the texture's fibre limit.
  let fibres = '';
  for (let i = 0; i < VISION_PAPER_TEXTURE.fibreCount; i++) {
    const x = next() * UNIT;
    const y = next() * UNIT;
    const angle = next() * Math.PI;
    const length = VISION_PAPER_TEXTURE.fibreMaxLength * (0.25 + next() * 0.75);
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    fibres += `M${x.toFixed(1)} ${y.toFixed(1)}l${dx.toFixed(1)} ${dy.toFixed(1)}`;
  }
  // Mottling: small, filled blotches of slightly deeper cream. Each blotch is a closed circle, drawn as two arcs.
  let mottle = '';
  const radiusSpan = VISION_PAPER_TEXTURE.mottleMaxRadius - VISION_PAPER_TEXTURE.mottleMinRadius;
  for (let i = 0; i < VISION_PAPER_TEXTURE.mottleCount; i++) {
    const cx = next() * UNIT;
    const cy = next() * UNIT;
    const r = VISION_PAPER_TEXTURE.mottleMinRadius + next() * radiusSpan;
    const d = (2 * r).toFixed(1);
    const rr = r.toFixed(1);
    mottle += `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${rr} ${rr} 0 1 0 ${d} 0a${rr} ${rr} 0 1 0 -${d} 0`;
  }
  return { grain, fibres, mottle };
}

export type VisionPaperGrainProps = {
  style?: StyleProp<ViewStyle>;
  /** Same seed as the paper it sits on gives the same grain. */
  seed?: number;
  /** Speck width in texture units (1000 across the sheet). Defaults to the paper's own grain. */
  grainStrokeWidth?: number;
  testID?: string;
};

/**
 * The paper's static grain and fibres drawn as a transparent overlay, for surfaces that already have
 * their own colour (a note, a print). Non-interactive, no animation.
 */
export const VisionPaperGrain = memo(function VisionPaperGrain({ style, seed = 1, grainStrokeWidth = VISION_PAPER_TEXTURE.grainStrokeWidth, testID }: VisionPaperGrainProps) {
  const texture = useMemo(() => buildPaperTexture(seed), [seed]);
  return (
    <Svg testID={testID} pointerEvents="none" accessible={false} importantForAccessibility="no" width="100%" height="100%"
      viewBox={`0 0 ${UNIT} ${UNIT}`} preserveAspectRatio="none" style={[StyleSheet.absoluteFill, style]}>
      <Path d={texture.grain} fill="none" stroke={VISION_PAPER.grain} strokeWidth={grainStrokeWidth}
        strokeLinecap="round" opacity={VISION_PAPER_TEXTURE.grainOpacity} />
      <Path d={texture.fibres} fill="none" stroke={VISION_PAPER.fibre} strokeWidth={VISION_PAPER_TEXTURE.fibreStrokeWidth}
        strokeLinecap="round" opacity={VISION_PAPER_TEXTURE.fibreOpacity} />
    </Svg>
  );
});

export type VisionPaperSurfaceProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Chooses the grain, fibre and mottle layout. Same seed, same paper. */
  seed?: number;
  testID?: string;
};

/**
 * Archival paper background: a warm base with fine grain, faint fibres and low-contrast
 * mottling, plus a soft warm vignette toward the edges. All drawn once as static SVG.
 * No blur, filter, animation or per-render randomness.
 */
export const VisionPaperSurface = memo(function VisionPaperSurface({ style, children, seed = 1, testID }: VisionPaperSurfaceProps) {
  const texture = useMemo(() => buildPaperTexture(seed), [seed]);
  const vignetteId = `vision-paper-vignette-${Math.trunc(seed)}`;
  return (
    <View testID={testID} style={[styles.base, style]}>
      <Svg pointerEvents="none" accessible={false} importantForAccessibility="no" width="100%" height="100%"
        viewBox={`0 0 ${UNIT} ${UNIT}`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={vignetteId} cx="50%" cy="50%" rx="72%" ry="72%" fx="50%" fy="50%">
            <Stop offset="0.55" stopColor={VISION_PAPER.edge} stopOpacity={0} />
            <Stop offset="1" stopColor={VISION_PAPER.edge} stopOpacity={VISION_PAPER_TEXTURE.vignetteOpacity} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={UNIT} height={UNIT} fill={`url(#${vignetteId})`} />
        <Path d={texture.mottle} fill={VISION_PAPER.mottle} stroke="none" opacity={VISION_PAPER_TEXTURE.mottleOpacity} />
        <Path d={texture.grain} fill="none" stroke={VISION_PAPER.grain} strokeWidth={VISION_PAPER_TEXTURE.grainStrokeWidth}
          strokeLinecap="round" opacity={VISION_PAPER_TEXTURE.grainOpacity} />
        <Path d={texture.fibres} fill="none" stroke={VISION_PAPER.fibre} strokeWidth={VISION_PAPER_TEXTURE.fibreStrokeWidth}
          strokeLinecap="round" opacity={VISION_PAPER_TEXTURE.fibreOpacity} />
      </Svg>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  base: { backgroundColor: VISION_PAPER.base, overflow: 'hidden' },
});
