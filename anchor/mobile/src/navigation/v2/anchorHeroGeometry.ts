import { resolvePracticeSetupMetrics } from '@/components/v2/practice/practiceSetupLayout';
import type { V2PracticeMode } from '@/constants/v2/practice';
import { resolveRestAnchorRect, resolveSheetSnaps } from '@/components/v2/anchors/anchorDetailsSheetLayout';
import { spacing } from '@/theme/v2';
import type { V2Viewport } from '@/theme/v2/responsive';
import type { AnchorWindowRect } from './ProgressiveFocusTransition';

/**
 * Details 2.0 rests with the Anchor as the hero: a ~300dp disc, centred above the
 * sheet. The travelling Anchor from Home lands on this rect; Details measures
 * itself to the same place once it lays out.
 *
 * `paintingHeight` is kept for existing callers. The painted hero band no longer
 * exists, so it reports the vertical room above the resting sheet instead.
 */
export function resolveAnchorDetailsHeroGeometry({
  width, height, topInset,
}: { width: number; height: number; topInset: number; platform?: string }): {
  paintingHeight: number; medallionSize: number; rect: AnchorWindowRect;
} {
  const rect = resolveRestAnchorRect({ width, height, topInset });
  return {
    paintingHeight: resolveSheetSnaps(height, topInset).rest,
    medallionSize: rect.width,
    rect,
  };
}

/*
 * Predicted Anchor rects for the later hops. They only let travel begin before
 * the destination has mounted: every destination measures itself once it lays
 * out and the travelling copy glides onto the measured rect, so these need to
 * be close, not exact.
 */

/** Practice setup (the layer a practice CTA opens): Focus, Deep Focus / Visualize hero, or a Vision-led Visualize. */
export function predictPracticeSetupAnchorRect({
  viewport, topInset, mode, hasVision,
}: { viewport: V2Viewport; topInset: number; mode: V2PracticeMode; hasVision: boolean }): AnchorWindowRect {
  if (mode === 'visualize' && hasVision) {
    // Vision identity row: 44pt mark under the 52pt Vision header, at the band's 20pt gutter.
    return { x: spacing[5], y: topInset + 52 + spacing[3], width: 44, height: 44 };
  }
  const metrics = resolvePracticeSetupMetrics(viewport, mode === 'focus' ? 'focus' : 'hero');
  // Setup header (8 + 44) and body top (4), then the eyebrow line (14) and the artwork frame.
  const header = topInset + spacing[2] + 44 + spacing[1];
  const eyebrow = mode === 'focus'
    ? metrics.heroTop / 2 + 14 + metrics.heroTop
    : spacing[2] + spacing[2] + 14 + spacing[2];
  const frameInset = mode === 'focus' ? (metrics.artworkFrameSize - metrics.artworkSize) / 2 : 0;
  return {
    x: (viewport.width - metrics.artworkSize) / 2,
    y: header + eyebrow + metrics.artworkGap + frameInset,
    width: metrics.artworkSize,
    height: metrics.artworkSize,
  };
}

/** Progress gauge ring (where the Anchor lands inside the 150dp Thread Strength ring). */
export function predictProgressAnchorRect({ topInset }: { topInset: number }): AnchorWindowRect {
  // V2ProgressHero has 22pt horizontal padding; ring is 150dp wide, artwork is 104dp centered inside it.
  const ringX = 22;
  const artSize = 104;
  const x = ringX + (150 - artSize) / 2;
  // Progress header (~44pt), category eyebrow row (~18pt), 2-line intention title (~58pt), ring top inset (~23pt)
  const y = topInset + 44 + 18 + 58 + (150 - artSize) / 2;
  return { x, y, width: artSize, height: artSize };
}

/** The Anchor's focal rect in each active session. */
export function predictSessionAnchorRect({
  width, height, topInset, bottomInset, mode,
}: { width: number; height: number; topInset: number; bottomInset: number; mode: Exclude<V2PracticeMode, 'release'> }): AnchorWindowRect {
  if (mode === 'focus' || mode === 'deep_prime') {
    // Mirrors V2FocusActiveScreen: centred in the field below the intention.
    const geometry = resolveFocusSessionGeometry({ width, height, topInset, bottomInset, mode });
    return {
      x: (width - geometry.anchorSize) / 2,
      y: geometry.centerY - geometry.anchorSize / 2,
      width: geometry.anchorSize,
      height: geometry.anchorSize,
    };
  }
  // The remaining mode is Visualize: the Vision stage's focal point, where
  // its closing Anchor also rests.
  const size = Math.round(Math.min(width * 0.52, 228));
  return { x: (width - size) / 2, y: height * 0.48 - size / 2, width: size, height: size };
}

/** Shared active Focus geometry for the screen and its pre-mount hero target. */
export function resolveFocusSessionGeometry({
  width, height, topInset, bottomInset, mode = 'focus',
}: {
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  mode?: 'focus' | 'deep_prime';
}): {
  anchorSize: number;
  fieldSize: number;
  centerY: number;
} {
  const isLandscape = width > height;
  const isDeep = mode === 'deep_prime';
  if (isLandscape) {
    const safeTop = Math.max(topInset, 28);
    const safeBottom = Math.max(bottomInset, 16);
    // Deep Focus has no "FOCUS" header label, so text headroom is leaner.
    const topReserved = safeTop + (isDeep ? 38 : 54);
    const bottomReserved = safeBottom + (isDeep ? 10 : 16);
    const availableHeight = Math.max(200, height - topReserved - bottomReserved);
    // Deep Focus hero is made larger to fill even more of the screen.
    const sizeRatio = isDeep ? 0.74 : 0.68;
    const anchorSize = Math.round(Math.min(availableHeight * 0.96, height * sizeRatio, 360));
    const fieldSize = anchorSize + Math.min(56, Math.max(40, Math.round(anchorSize * 0.16)));
    // Anchor center is brought down below the top text so text clears notifications and has ample breathing room.
    const centerY = Math.round(topReserved + (height - topReserved - safeBottom) * 0.5);
    return { anchorSize, fieldSize, centerY };
  }
  const usableHeight = Math.max(320, height - topInset - bottomInset);
  const anchorMultiplier = isDeep ? 0.84 : 0.79;
  const heightMultiplier = isDeep ? 0.50 : 0.45;
  const maxSize = isDeep ? 380 : 356;
  const anchorSize = Math.round(Math.min(width * anchorMultiplier, usableHeight * heightMultiplier, maxSize));
  const fieldSize = anchorSize + Math.min(56, Math.max(40, Math.round(anchorSize * 0.16)));
  const centerY = height * 0.52 - Math.round(Math.min(26, Math.max(18, usableHeight * 0.03)));
  return { anchorSize, fieldSize, centerY };
}
