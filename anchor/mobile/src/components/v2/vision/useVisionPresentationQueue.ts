import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'react-native';

/** Presentation timing for the generation screen. The UI owns this; the network does not. */
export const VISION_REVEAL_TIMING = {
  /** One image entering and becoming the hero. */
  enterMs: 640,
  reducedEnterMs: 360,
  /** A natural pause after an image settles, before the next may enter. */
  dwellMs: 1100,
  reducedDwellMs: 600,
  /** After the last image settles, before moving on to choosing. */
  finalDwellMs: 1300,
  /** A slow image is not allowed to stall the rest of the set. */
  prefetchTimeoutMs: 8000,
} as const;

export interface PresentableCandidate {
  id: string;
  imageUrl: string | null;
  sortOrder: number;
}

export interface PresentedImage {
  id: string;
  imageUrl: string;
}

type Prefetch = (uri: string) => Promise<boolean>;

function defaultPrefetch(uri: string): Promise<boolean> {
  try {
    if (typeof Image.prefetch !== 'function') return Promise.resolve(true);
    // Some environments return nothing rather than a promise; treat that as loaded.
    return Promise.resolve(Image.prefetch(uri)).then(result => result !== false);
  } catch {
    return Promise.resolve(false);
  }
}

function withTimeout(promise: Promise<boolean>, ms: number): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(false); },
    );
  });
}

/** Next image waiting to be presented, in the set's own order. */
export function nextVisionPresentation(
  candidates: PresentableCandidate[],
  handled: ReadonlySet<string>,
): PresentedImage | null {
  const next = candidates
    .filter(candidate => candidate.imageUrl && !handled.has(candidate.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return next ? { id: next.id, imageUrl: next.imageUrl as string } : null;
}

/**
 * Decouples image arrival from image presentation.
 *
 * The network layer (polling) may deliver several images at once, or two
 * within milliseconds. This queue takes them one at a time: the image is
 * decoded into the cache first (so it never appears as an empty frame), then
 * presented, then allowed to settle and dwell before the next one enters.
 *
 * Images that already existed when a job was first seen (resuming, returning
 * to the screen) are shown immediately rather than replayed.
 */
export function useVisionPresentationQueue(
  jobId: string | null | undefined,
  candidates: PresentableCandidate[],
  options: { reduceMotion: boolean; prefetch?: Prefetch },
) {
  const prefetch = options.prefetch ?? defaultPrefetch;
  const [presented, setPresented] = useState<PresentedImage[]>([]);
  const [handled, setHandled] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const seededJob = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);
  const handledRef = useRef<ReadonlySet<string>>(new Set());

  // A new job: show whatever it already has, and start a fresh queue.
  useEffect(() => {
    const id = jobId ?? null;
    if (seededJob.current === id) return;
    seededJob.current = id;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const existing = candidates
      .filter(candidate => candidate.imageUrl)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(candidate => ({ id: candidate.id, imageUrl: candidate.imageUrl as string }));
    setPresented(existing);
    handledRef.current = new Set(existing.map(item => item.id));
    setHandled(handledRef.current);
    setBusy(false);
    existing.forEach(item => { void prefetch(item.imageUrl); });
    // Seeding is keyed to the job only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const next = useMemo(() => nextVisionPresentation(candidates, handled), [candidates, handled]);

  useEffect(() => {
    // `handledRef` is current even in the commit that seeded a new job, when
    // `next` may still describe an image that was just shown without a reveal.
    if (busy || !next || seededJob.current !== (jobId ?? null) || handledRef.current.has(next.id)) return;
    const job = seededJob.current;
    setBusy(true);
    // Not cancelled by this effect re-running (it does, as `busy` flips);
    // only a different job or unmounting abandons the reveal.
    void withTimeout(prefetch(next.imageUrl), VISION_REVEAL_TIMING.prefetchTimeoutMs).then(loaded => {
      if (!mounted.current || seededJob.current !== job) return;
      handledRef.current = new Set(handledRef.current).add(next.id);
      setHandled(handledRef.current);
      if (!loaded) {
        // Never present an image that could not be decoded; it still exists
        // on the server and is offered when choosing.
        setBusy(false);
        return;
      }
      setPresented(prev => [...prev, next]);
      const hold = options.reduceMotion
        ? VISION_REVEAL_TIMING.reducedEnterMs + VISION_REVEAL_TIMING.reducedDwellMs
        : VISION_REVEAL_TIMING.enterMs + VISION_REVEAL_TIMING.dwellMs;
      timers.current.push(setTimeout(() => { if (seededJob.current === job) setBusy(false); }, hold));
    });
    // `busy` gates re-entry; `next` changes only when a new image is waiting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, next?.id, jobId]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; timers.current.forEach(clearTimeout); };
  }, []);

  const waiting = candidates.filter(candidate => candidate.imageUrl && !handled.has(candidate.id)).length;
  return { presented, waiting, idle: !busy && waiting === 0 };
}
