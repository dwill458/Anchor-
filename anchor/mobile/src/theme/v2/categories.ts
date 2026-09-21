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
