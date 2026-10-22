import { useMemo } from 'react';
import { colors, getCategoryColor, getCategoryTextColor } from '@/theme/v2';
import { onCategoryFill } from '../panel/chartPanelColors';

/**
 * Ask Chart's colours, all derived from the active Anchor's category and tuned for the cream ground. Nothing here is
 * a fixed category colour: a Career, Health or Creativity Anchor re-themes the whole conversation.
 */
export type AskAccent = {
  /** The category colour: send button, ring, thinking glow. */
  fill: string;
  /** Label on the fill (readable on any category colour). */
  onFill: string;
  /** The category hue at AA contrast on cream: small links and eyebrows. */
  text: string;
  /** Pale wash behind the person's own messages and chips. */
  wash: string;
  /** Hairline for chips and the composer. */
  border: string;
};

export function askAccent(category: string | null | undefined): AskAccent {
  const fill = getCategoryColor(category);
  return {
    fill,
    onFill: onCategoryFill(fill),
    text: getCategoryTextColor(category, colors.canvas, colors.text.primary),
    wash: `${fill}2B`,
    border: `${fill}55`,
  };
}

export function useAskAccent(category: string | null | undefined): AskAccent {
  return useMemo(() => askAccent(category), [category]);
}
