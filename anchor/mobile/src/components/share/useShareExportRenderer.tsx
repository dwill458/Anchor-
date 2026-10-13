import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, type ImageSourcePropType } from 'react-native';
import { ShareTemplate } from './ShareTemplate';
import type { ShareExportData, ShareLayoutId } from './shareTypes';
import { captureShareExport, resolveExportRenderSize } from '@/services/anchorExportService';
import { prepareVisionShareAssets, type PreparedVisionShareAssets } from './prepareVisionShareAssets';

/** A slow or failed image must not strand an export; render with what loaded. */
export const EXPORT_ASSET_TIMEOUT_MS = 5000;

type Target = { layout: ShareLayoutId; showMark: boolean; visionBackgroundId?: string | null; key: string;
  data?: ShareExportData; backgroundSource?: ImageSourcePropType };

/** Wait for static assets, failing closed only for Vision board exports. */
export function waitForExportAssets(
  layout: ShareLayoutId,
  isReady: () => boolean,
  subscribe: (resolve: () => void) => () => void,
  timeoutMs = EXPORT_ASSET_TIMEOUT_MS,
) {
  return new Promise<boolean>((resolve, reject) => {
    if (isReady()) {
      resolve(true);
      return;
    }
    let settled = false;
    let unsubscribe: () => void = () => {};
    const settle = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(ready);
    };
    const timer = setTimeout(() => {
      if (layout === 'vision') {
        if (!settled) {
          settled = true;
          unsubscribe();
          reject(new Error('Vision board assets did not finish loading.'));
        }
      } else settle(false);
    }, timeoutMs);
    unsubscribe = subscribe(() => settle(true));
  });
}

const keyOf = (layout: ShareLayoutId, showMark: boolean, visionBackgroundId?: string | null) =>
  `${layout}:${showMark ? 1 : 0}:${layout === 'vision' ? visionBackgroundId || 'canvas' : ''}`;

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
 * `prepare` remains available to other hosts. Share Studio renders on demand;
 * Vision first stages original image bytes locally, then waits for successful
 * decoding of the full composition. Failed assets reject the capture.
 *
 * `exportNode` must be rendered once by the host (it sits off-screen).
 */
export function useShareExportRenderer(data: ShareExportData | null) {
  const nodeRef = useRef<View | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const targetRef = useRef<Target | null>(null);
  const readyKeys = useRef(new Set<string>());
  const failedKeys = useRef(new Map<string, Error>());
  const generation = useRef(0);
  const waiters = useRef(new Map<string, Set<() => void>>());
  const busy = useRef(false);

  const mount = useCallback((layout: ShareLayoutId, showMark: boolean, visionBackgroundId?: string | null, prepared?: PreparedVisionShareAssets) => {
    const key = `${keyOf(layout, showMark, visionBackgroundId)}${prepared ? `:${++generation.current}` : ''}`;
    if (targetRef.current?.key === key) return key;
    readyKeys.current.clear();
    failedKeys.current.clear();
    const next = { layout, showMark, visionBackgroundId, key, data: prepared?.data, backgroundSource: prepared?.backgroundSource };
    targetRef.current = next;
    setTarget(next);
    return key;
  }, []);

  const markReady = useCallback((key: string) => {
    if (targetRef.current?.key !== key || failedKeys.current.has(key)) return;
    readyKeys.current.add(key);
    const pending = waiters.current.get(key);
    waiters.current.delete(key);
    pending?.forEach((resolve) => resolve());
  }, []);
  const markFailed = useCallback((key: string, error: Error) => {
    if (targetRef.current?.key !== key) return;
    failedKeys.current.set(key, error);
    const pending = waiters.current.get(key);
    waiters.current.delete(key);
    pending?.forEach(resolve => resolve());
  }, []);

  /** Resolves once the mounted composition for `key` has its images, or after the timeout. */
  const whenReady = useCallback(
    (key: string, layout: ShareLayoutId) => waitForExportAssets(
      layout,
      () => readyKeys.current.has(key) || failedKeys.current.has(key),
      (resolve) => {
        const list = waiters.current.get(key) ?? new Set<() => void>();
        list.add(resolve);
        waiters.current.set(key, list);
        return () => {
          list.delete(resolve);
          if (list.size === 0) waiters.current.delete(key);
        };
      },
    ).then(ready => {
      const error = failedKeys.current.get(key);
      if (error) throw error;
      return ready;
    }),
    [],
  );

  /** Warm up the export composition for a layout so Save/Share is near-instant. */
  const prepare = useCallback((layout: ShareLayoutId, showMark: boolean, visionBackgroundId?: string | null) => {
    if (!busy.current) mount(layout, showMark, visionBackgroundId);
  }, [mount]);

  /** Unmount the composition (e.g. when Studio closes). */
  const release = useCallback(() => {
    if (busy.current) return;
    readyKeys.current.clear();
    failedKeys.current.clear();
    targetRef.current = null;
    setTarget(null);
  }, []);

  const renderPng = useCallback(
    async (
      layout: ShareLayoutId,
      showMark: boolean,
      options: { keepWarm?: boolean; visionBackgroundId?: string | null } = {},
    ) => {
      if (busy.current) throw new Error('An export is already in progress.');
      busy.current = true;
      let prepared: PreparedVisionShareAssets | undefined;
      try {
        if (layout === 'vision') {
          if (!data) throw new Error('Vision export data is unavailable.');
          prepared = await prepareVisionShareAssets(data, options.visionBackgroundId);
        }
        const key = mount(layout, showMark, options.visionBackgroundId, prepared);
        const wasReady = readyKeys.current.has(key);
        await whenReady(key, layout);
        // Ensure native drawing and image decoding commit before view-shot captures
        await nextFrames(wasReady ? 1 : 2);
        const failure = failedKeys.current.get(key);
        if (failure) throw failure;
        return await captureShareExport(nodeRef);
      } finally {
        busy.current = false;
        if (!options.keepWarm || prepared) {
          readyKeys.current.clear();
          failedKeys.current.clear();
          targetRef.current = null;
          setTarget(null);
        }
        await prepared?.release().catch(() => undefined);
      }
    },
    [data, mount, whenReady],
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
          data={target.data ?? data}
          width={size.width}
          showMark={target.showMark}
          visionBackgroundId={target.visionBackgroundId}
          visionBackgroundSource={target.backgroundSource}
          onAssetsReady={() => markReady(target.key)}
          onAssetsError={error => markFailed(target.key, error)}
        />
      </View>
    ) : null;

  return { renderPng, prepare, release, exportNode, isMounted: target !== null };
}
