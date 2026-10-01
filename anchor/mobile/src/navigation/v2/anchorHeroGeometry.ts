import { resolvePracticeSetupMetrics } from '@/components/v2/practice/practiceSetupLayout';
import type { V2PracticeMode } from '@/constants/v2/practice';
import { spacing } from '@/theme/v2';
import type { V2Viewport } from '@/theme/v2/responsive';
import type { AnchorWindowRect } from './ProgressiveFocusTransition';

/** The Details painting and paper disc share one responsive geometry. */
export function resolveAnchorDetailsHeroGeometry({
  width, height, topInset, platform,
}: { width: number; height: number; topInset: number; platform: string }): {
  paintingHeight: number; medallionSize: number; rect: AnchorWindowRect;
} {
  const paintingHeight = Math.max(145, Math.min(175, Math.round(height * 0.18)));
  const medallionSize = Math.max(190, Math.min(220, Math.round(width * 0.52)));
  return {
    paintingHeight,
    medallionSize,
    rect: {
      x: (width - medallionSize) / 2,
      y: paintingHeight - medallionSize * 0.58 + (platform === 'ios' ? topInset : 0),
      width: medallionSize,
      height: medallionSize,
    },
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

/** The Anchor's focal rect in each active session. */
export function predictSessionAnchorRect({
  width, height, topInset, bottomInset, mode,
}: { width: number; height: number; topInset: number; bottomInset: number; mode: Exclude<V2PracticeMode, 'release'> }): AnchorWindowRect {
  if (mode === 'focus' || mode === 'deep_prime') {
    // Mirrors V2FocusActiveScreen: centred in the field below the intention.
    const geometry = resolveFocusSessionGeometry({ width, height, topInset, bottomInset });
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
  width, height, topInset, bottomInset,
}: { width: number; height: number; topInset: number; bottomInset: number }): {
  anchorSize: number;
  fieldSize: number;
  centerY: number;
} {
  const usableHeight = Math.max(320, height - topInset - bottomInset);
  const anchorSize = Math.round(Math.min(width * 0.79, usableHeight * 0.45, 356));
  const fieldSize = anchorSize + Math.min(56, Math.max(40, Math.round(anchorSize * 0.16)));
  const centerY = height * 0.52 - Math.round(Math.min(26, Math.max(18, usableHeight * 0.03)));
  return { anchorSize, fieldSize, centerY };
}
