import { useEffect, useState } from 'react';
import { Image } from 'react-native';

export const CEREMONY = {
  stageFadeMs: 400, printMoveMs: 650, frameMarchMs: 14000,
  wordLightMaxMs: 160, wordLightTotalMs: 2600, sheenLoopMs: 2400,
  revealInkMs: 1600, revealBlurMs: 3400, revealScaleFrom: 1.06,
  choiceExitRotateDeg: 8, captionStripPts: 62,
  sealHoldMs: 1600, sealHoldLaterMs: 900, sealDecayMs: 350, stampMs: 400, rippleMs: 800, pressMs: 500,
  sealedMinHoldMs: 200, boardRiseMs: 450, pinDropMs: 550, pinDelayMs: 350,
} as const;

export function ceremonyDuration(ms: number, reduceMotion: boolean): number {
  return reduceMotion ? Math.min(ms, 180) : ms;
}

/** A timeout bounds prefetch, but the print also waits for its Image.onLoad.
 * A timed-out or failed download can never reveal an empty image window. */
export function useDevelopReveal(uri?: string, active = true, delayMs = 0) {
  const [readyUri, setReadyUri] = useState<string | null>(null);
  useEffect(() => {
    if (!uri || !active) return;
    let cancelled = false;
    let cap: ReturnType<typeof setTimeout>;
    let delay: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>(resolve => { cap = setTimeout(resolve, 3000); });
    // Only a remote URL needs warming; a bundled picture or a local file is already on the device.
    const prefetch = !/^https?:/.test(uri) || typeof Image.prefetch !== 'function'
      ? Promise.resolve() : Promise.resolve(Image.prefetch(uri)).catch(() => undefined);
    void Promise.race([prefetch, timeout]).then(() => {
      clearTimeout(cap);
      if (cancelled) return;
      delay = setTimeout(() => { if (!cancelled) setReadyUri(uri); }, delayMs);
    });
    return () => { cancelled = true; clearTimeout(cap); if (delay) clearTimeout(delay); };
  }, [uri, active, delayMs]);
  return Boolean(uri && readyUri === uri && active);
}
