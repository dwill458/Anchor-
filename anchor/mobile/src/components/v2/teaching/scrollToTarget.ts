import type { ViewInstance } from 'react-native';
import type React from 'react';
import type { SharedValue } from 'react-native-reanimated';

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

export function waitForScrollSettle(scrollY: Pick<SharedValue<number>, 'value'>): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    let rafId = 0;
    let stableFrames = 0;
    let lastY = scrollY.value;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, 2000);
    const step = () => {
      if (settled) return;
      const currentY = scrollY.value;
      if (Math.abs(currentY - lastY) <= 0.5) {
        stableFrames += 1;
        if (stableFrames >= 4) {
          finish();
          return;
        }
      } else {
        stableFrames = 0;
      }
      lastY = currentY;
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
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
    // DEFERRED: Fixed 460 ms timeout replaced by waitForScrollSettle so elastic/sheet scroll finishes before measureInWindow.
    if (reducedMotion) {
      await new Promise(resolve => setTimeout(resolve, 0));
    } else {
      await waitForScrollSettle({
        get value() {
          return metrics().y;
        },
      });
    }
  }
  return measureTeachingTarget(target.current);
}
