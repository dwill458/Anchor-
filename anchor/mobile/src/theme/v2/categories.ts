export type V2Category =
  | 'Desire' | 'Health' | 'Career' | 'Relationships' | 'Creativity' | 'Spirituality'
  | 'Abundance' | 'Family' | 'Learning' | 'Adventure' | 'Focus' | 'Custom';

type CategoryKey = Lowercase<V2Category>;

export const categories: Record<CategoryKey, string> = {
  desire: '#A64F68', health: '#66856A', career: '#A87932', relationships: '#B96563',
  creativity: '#88769B', spirituality: '#43566E', abundance: '#B09555', family: '#A9634B',
  learning: '#5F9DA2', adventure: '#B96A3D', focus: '#68645F', custom: '#8A8175',
};

export function getCategoryColor(category?: string | null): string {
  const key = category?.trim().toLowerCase() as CategoryKey | undefined;
  return key && key in categories ? categories[key] : categories.custom;
}

/** A restrained field behind artwork, not a screen-level ambient background. */
export function getCategoryFieldColor(category?: string | null): string {
  return `${getCategoryColor(category)}1F`;
}

export function getCategoryPalette(category?: string | null) {
  const base = getCategoryColor(category);
  return {
    base,
    wash: `${base}1C`,
    soft: `${base}14`,
    light: `${base}38`,
    deep: `${base}E6`,
  };
}export function getCategorySoftTint(category?: string | null): string {
  return `${getCategoryColor(category)}14`;
}


function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '').slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Category color for small text on a light surface. Returns the category token
 * unchanged when it already meets WCAG AA (4.5:1); otherwise mixes it toward
 * `ink` in small steps, staying in the same hue family.
 */
export function getCategoryTextColor(category: string | null | undefined, background: string, ink: string): string {
  const base = getCategoryColor(category);
  if (contrast(base, background) >= 4.5) return base;
  const [br, bg, bb] = channels(base);
  const [ir, ig, ib] = channels(ink);
  for (let t = 0.1; t <= 1; t += 0.1) {
    const mix = [br + (ir - br) * t, bg + (ig - bg) * t, bb + (ib - bb) * t]
      .map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const candidate = `#${mix}`;
    if (contrast(candidate, background) >= 4.5) return candidate;
  }
  return ink;
}
