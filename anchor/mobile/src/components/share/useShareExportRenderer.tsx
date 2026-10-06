import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ShareTemplate } from './ShareTemplate';
import type { ShareExportData, ShareLayoutId } from './shareTypes';
import { captureShareExport, resolveExportRenderSize } from '@/services/anchorExportService';

/** A slow or failed image must not strand an export; render with what loaded. */
export const EXPORT_ASSET_TIMEOUT_MS = 2500;

type Target = { layout: ShareLayoutId; showMark: boolean; key: string };

const keyOf = (layout: ShareLayoutId, showMark: boolean) => `${layout}:${showMark ? 1 : 0}`;

function nextFrames(count: number) {
  return new Promise<void>((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) resolve();
      else requestAnimationFrame(() => step(remaining - 1));
    };
    step(count);
  });
}

/**
 * Renders one dedicated 1080 x 1920 export composition and returns the PNG's
 * file URI. Never a screenshot of the on-screen preview.
 *
 * Speed: `prepare` mounts the export composition ahead of time (Share Studio
 * calls it for the selected layout, debounced), so by the time Save or Share is
 * pressed its images are loaded and laid out and `renderPng` only has to
 * capture. Without a prepared node `renderPng` mounts one and waits for its
 * images. Nothing is mounted until one of them is called.
 *
 * `exportNode` must be rendered once by the host (it sits off-screen).
 */
export function useShareExportRenderer(data: ShareExportData | null) {
  const nodeRef = useRef<View | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const targetRef = useRef<Target | null>(null);
  const readyKeys = useRef(new Set<string>());
  const waiters = useRef(new Map<string, Array<() => void>>());
  const busy = useRef(false);

  const mount = useCallback((layout: ShareLayoutId, showMark: boolean) => {
    const key = keyOf(layout, showMark);
    if (targetRef.current?.key === key) return key;
    readyKeys.current.clear();
    const next = { layout, showMark, key };
    targetRef.current = next;
    setTarget(next);
    return key;
  }, []);

  const markReady = useCallback((key: string) => {
    readyKeys.current.add(key);
    const pending = waiters.current.get(key);
    waiters.current.delete(key);
    pending?.forEach((resolve) => resolve());
  }, []);

  /** Resolves once the mounted composition for `key` has its images, or after the timeout. */
  const whenReady = useCallback(
    (key: string) =>
      new Promise<boolean>((resolve) => {
        if (readyKeys.current.has(key)) {
          resolve(true);
          return;
        }
        const timer = setTimeout(() => resolve(false), EXPORT_ASSET_TIMEOUT_MS);
        const list = waiters.current.get(key) ?? [];
        list.push(() => {
          clearTimeout(timer);
          resolve(false);
        });
        waiters.current.set(key, list);
      }),
    [],
  );

  /** Warm up the export composition for a layout so Save/Share is near-instant. */
  const prepare = useCallback((layout: ShareLayoutId, showMark: boolean) => {
    if (!busy.current) mount(layout, showMark);
  }, [mount]);

  /** Unmount the composition (e.g. when Studio closes). */
  const release = useCallback(() => {
    if (busy.current) return;
    readyKeys.current.clear();
    targetRef.current = null;
    setTarget(null);
  }, []);

  const renderPng = useCallback(
    async (layout: ShareLayoutId, showMark: boolean, options: { keepWarm?: boolean } = {}) => {
      if (busy.current) throw new Error('An export is already in progress.');
      busy.current = true;
      try {
        const key = mount(layout, showMark);
        const wasReady = readyKeys.current.has(key);
        await whenReady(key);
        // A node that was prepared earlier is already laid out; a fresh one needs a frame to paint.
        await nextFrames(wasReady ? 0 : 1);
        return await captureShareExport(nodeRef);
      } finally {
        busy.current = false;
        if (!options.keepWarm) {
          readyKeys.current.clear();
          targetRef.current = null;
          setTarget(null);
        }
      }
    },
    [mount, whenReady],
  );

  // Drop pending timers' targets if the host unmounts.
  useEffect(
    () => () => {
      waiters.current.clear();
    },
    [],
  );

  const size = resolveExportRenderSize();
  const exportNode =
    data && target ? (
      <View
        key={target.key}
        ref={nodeRef}
        collapsable={false}
        pointerEvents="none"
        style={{ position: 'absolute', left: -20000, top: 0, width: size.width, height: size.height }}
      >
        <ShareTemplate
          layout={target.layout}
          data={data}
          width={size.width}
          showMark={target.showMark}
          onAssetsReady={() => markReady(target.key)}
        />
      </View>
    ) : null;

  return { renderPng, prepare, release, exportNode, isMounted: target !== null };
}
