import type { GeneratedVariation } from '@/types';

/** The two Gemini variations are presented as Form I and Form II. */
export const FORM_LABELS = ['Form I', 'Form II'] as const;
export const MAX_FORMS = 2;
const MAX_INLINE_PREVIEW_BYTES = 700_000;

export interface GeneratedForm {
  id: string;
  /** Always a usable image URI (https or a data URI). */
  uri: string;
  /** Large inline base64 goes through the temp store, never through navigation params. */
  isHeavyInline: boolean;
  variationId?: string;
  optionId?: string;
  creationSessionId?: string;
  reusedFromPool: boolean;
}

/** The same normalisation the variation picker performs, so the saved image is identical. */
export function normalizeGeneratedForms(variations: Array<string | GeneratedVariation>): GeneratedForm[] {
  return variations.slice(0, MAX_FORMS).map((variation, index) => {
    let uri = '';
    if (typeof variation === 'string') {
      uri = variation;
    } else if (variation && typeof variation === 'object' && 'imageUrl' in variation) {
      uri = String((variation as { imageUrl?: unknown }).imageUrl ?? '');
    }

    if (uri && !uri.startsWith('http') && !uri.startsWith('data:image')) {
      uri = `data:image/png;base64,${uri}`;
    }

    const base64Length = uri.startsWith('data:image') ? uri.split(',')[1]?.length ?? 0 : 0;

    return {
      id: `variation_${index}`,
      uri,
      isHeavyInline: base64Length > MAX_INLINE_PREVIEW_BYTES,
      variationId:
        variation && typeof variation === 'object' && 'variationId' in variation
          ? String((variation as { variationId?: unknown }).variationId ?? '') || undefined
          : undefined,
      optionId: typeof variation === 'object' ? variation.optionId : undefined,
      creationSessionId: typeof variation === 'object' ? variation.creationSessionId : undefined,
      reusedFromPool:
        variation && typeof variation === 'object' && 'reusedFromPool' in variation
          ? Boolean((variation as { reusedFromPool?: unknown }).reusedFromPool)
          : false,
    };
  });
}
