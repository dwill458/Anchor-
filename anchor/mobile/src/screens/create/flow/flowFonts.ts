import { useEffect, useMemo, useState } from 'react';
import { FontSlant, FontWeight, FontWidth, Skia, useTypeface } from '@shopify/react-native-skia';

import { FlowFontCache } from './skiaPainter';

/**
 * DECISION D8: the spec called Figtree "not installed", but this tree already depends on
 * @expo-google-fonts/figtree and loads it in App.tsx, and the prototype is set in it. The flow
 * therefore uses Figtree for sans and EB Garamond for serif. No font package was added.
 * Skia reads the .ttf files directly, so no extra registration is needed.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const SERIF_REGULAR = require('@expo-google-fonts/eb-garamond/400Regular/EBGaramond_400Regular.ttf');
const SERIF_ITALIC = require('@expo-google-fonts/eb-garamond/400Regular_Italic/EBGaramond_400Regular_Italic.ttf');
const SANS_REGULAR = require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf');
const SANS_MEDIUM = require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf');
const SANS_SEMIBOLD = require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf');
/* eslint-enable @typescript-eslint/no-var-requires */

const TYPEFACE_TIMEOUT_MS = 1500;

function makeSystemFallback(): FlowFontCache {
  const manager = Skia.FontMgr.System();
  const face = (family: string, weight: FontWeight, slant = FontSlant.Upright) =>
    manager.matchFamilyStyle(family, { weight, width: FontWidth.Normal, slant });

  return new FlowFontCache({
    serif: face('serif', FontWeight.Normal),
    serifItalic: face('serif', FontWeight.Normal, FontSlant.Italic),
    sans400: face('sans-serif', FontWeight.Normal),
    sans500: face('sans-serif', FontWeight.Medium),
    sans600: face('sans-serif', FontWeight.SemiBold),
  });
}

/** Load the art-directed faces, but don't leave the creation canvas blank if an OTA font stalls. */
export function useFlowFonts(): FlowFontCache | null {
  const [fallbackReady, setFallbackReady] = useState(false);
  const serif = useTypeface(SERIF_REGULAR);
  const serifItalic = useTypeface(SERIF_ITALIC);
  const sans400 = useTypeface(SANS_REGULAR);
  // Keep the creation canvas renderable if Skia cannot resolve the Medium asset.
  // Once it loads, Fast Refresh/state updates replace this with the intended face.
  const sans500 = useTypeface(SANS_MEDIUM) ?? sans400;
  const sans600 = useTypeface(SANS_SEMIBOLD);

  useEffect(() => {
    if (serif && serifItalic && sans400 && sans500 && sans600) return undefined;
    const timer = setTimeout(() => setFallbackReady(true), TYPEFACE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [sans400, sans500, sans600, serif, serifItalic]);

  const fallback = useMemo(() => (fallbackReady ? makeSystemFallback() : null), [fallbackReady]);

  return useMemo(() => {
    if (!serif || !serifItalic || !sans400 || !sans500 || !sans600) return fallback;
    return new FlowFontCache({ serif, serifItalic, sans400, sans500, sans600 });
  }, [fallback, serif, serifItalic, sans400, sans500, sans600]);
}
