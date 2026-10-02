import { useMemo } from 'react';
import { useTypeface } from '@shopify/react-native-skia';

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

/** The five faces the flow paints with, as a ready-to-use font cache (null until all load). */
export function useFlowFonts(): FlowFontCache | null {
  const serif = useTypeface(SERIF_REGULAR);
  const serifItalic = useTypeface(SERIF_ITALIC);
  const sans400 = useTypeface(SANS_REGULAR);
  const sans500 = useTypeface(SANS_MEDIUM);
  const sans600 = useTypeface(SANS_SEMIBOLD);

  return useMemo(() => {
    if (!serif || !serifItalic || !sans400 || !sans500 || !sans600) return null;
    return new FlowFontCache({ serif, serifItalic, sans400, sans500, sans600 });
  }, [serif, serifItalic, sans400, sans500, sans600]);
}
