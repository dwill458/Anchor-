import type { ViewInstance } from 'react-native';
import type React from 'react';

export type TeachingRect = { x: number; y: number; width: number; height: number };
export function measureTeachingTarget(node: ViewInstance | null): Promise<TeachingRect | null> {
  return new Promise(resolve => {
    const timeout = setTimeout(() => resolve(null), 250);
    if (!node?.measureInWindow) { clearTimeout(timeout); resolve(null); return; }
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timeout);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

export type TeachingScroll = { scrollTo: (options: { y: number; animated: boolean }) => void };
export type TeachingScrollMetrics = { y: number; max: number; viewportTop: number };
export async function scrollToTarget(target: React.RefObject<ViewInstance | null>, scroll: React.RefObject<TeachingScroll | null>, metrics: () => TeachingScrollMetrics, reducedMotion: boolean): Promise<TeachingRect | null> {
  const before = await measureTeachingTarget(target.current);
  if (!before) return null;
  const { y, max, viewportTop } = metrics();
  const next = Math.max(0, Math.min(max, y + before.y - viewportTop - 150));
  if (Math.abs(next - y) > 1 && scroll.current) {
    scroll.current.scrollTo({ y: next, animated: !reducedMotion });
    await new Promise(resolve => setTimeout(resolve, reducedMotion ? 0 : 460));
  }
  return measureTeachingTarget(target.current);
}
