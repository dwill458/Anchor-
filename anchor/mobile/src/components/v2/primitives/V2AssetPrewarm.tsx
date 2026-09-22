import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

type Props = {
  /** Bundled artwork the next likely destination will draw on its first frame. */
  sources: ImageSourcePropType[];
  /** Remote artwork to pull into the HTTP cache (Anchor images). */
  remoteUris?: Array<string | null | undefined>;
  /** Wait for the host screen to settle before doing any decode work. */
  delayMs?: number;
};

const MAX_REMOTE_PREFETCH = 12;

function sourceKey(source: ImageSourcePropType): string {
  if (typeof source === 'number') return String(source);
  if (Array.isArray(source)) return source.map(sourceKey).join('|');
  return (source as { uri?: string })?.uri ?? '';
}

/**
 * Decodes the artwork of the screen the user is most likely to open next,
 * while the current screen is idle, then unmounts.
 *
 * Why this exists: on iOS, React Native loads bundled images synchronously
 * through `UIImage imageNamed`, and the bitmap is decoded on the main thread
 * the first time Core Animation commits it. A destination that shows large
 * artwork for the first time therefore pays that decode inside the frames of
 * its push transition. `imageNamed` hands every later consumer the same
 * `UIImage`, so decoding it once here (in a 1pt, visually inert view) moves the
 * cost to an idle moment and the destination's first frame already has it.
 * Android (Fresco) decodes off the UI thread; there this only warms the cache.
 */
function V2AssetPrewarmComponent({ sources, remoteUris, delayMs = 700 }: Props) {
  const key = useMemo(() => sources.map(sourceKey).join(','), [sources]);
  const [phase, setPhase] = useState<'waiting' | 'decoding' | 'done'>('waiting');
  const pending = useRef(0);

  useEffect(() => {
    setPhase('waiting');
    const timer = setTimeout(() => {
      pending.current = sources.length;
      setPhase(sources.length > 0 ? 'decoding' : 'done');
    }, delayMs);
    return () => clearTimeout(timer);
    // `key` stands in for `sources`, whose array identity changes every render.
  }, [key, delayMs]);

  const remoteKey = (remoteUris ?? []).filter(Boolean).join(',');
  useEffect(() => {
    if (!remoteKey) return;
    const timer = setTimeout(() => {
      remoteKey
        .split(',')
        .slice(0, MAX_REMOTE_PREFETCH)
        .forEach((uri) => {
          void Image.prefetch(uri).catch(() => undefined);
        });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [remoteKey, delayMs]);

  if (phase !== 'decoding') return null;

  const settle = () => {
    pending.current -= 1;
    // One more frame so the decoded bitmap is committed before the views go.
    if (pending.current <= 0) requestAnimationFrame(() => setPhase('done'));
  };

  return (
    <View pointerEvents="none" style={styles.host} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {sources.map((source, index) => (
        <Image key={`${sourceKey(source)}-${index}`} source={source} style={styles.pixel} onLoadEnd={settle} fadeDuration={0} />
      ))}
    </View>
  );
}

export const V2AssetPrewarm = memo(V2AssetPrewarmComponent);

const styles = StyleSheet.create({
  // Occluded by the host's opaque content, and near-transparent regardless.
  // Not opacity 0: fully transparent layers can be skipped at commit, which
  // would skip the very decode this component exists to trigger.
  host: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0.011, overflow: 'hidden' },
  pixel: { width: 1, height: 1 },
});
