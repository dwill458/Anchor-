import { AnchorMotion } from '@/theme/v2';

/** Delay before sibling `order` arrives. The order is clamped so a long list never makes the last row wait. */
export function staggerDelay(order: number, base = 0): number {
  const { step, cap } = AnchorMotion.stagger;
  const slot = Number.isFinite(order) ? Math.min(Math.max(order, 0), cap) : 0;
  return base + slot * step;
}

/** One frame of an arriving element. Under reduced motion nothing travels. */
export function revealFrame(progress: number, rise: number, reduceMotion: boolean): { opacity: number; translateY: number } {
  'worklet';
  return {
    opacity: progress,
    translateY: reduceMotion ? 0 : (1 - progress) * rise,
  };
}
