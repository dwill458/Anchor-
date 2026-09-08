export type V2Category =
  | 'Desire' | 'Health' | 'Career' | 'Relationships' | 'Creativity' | 'Spirituality'
  | 'Abundance' | 'Family' | 'Learning' | 'Adventure' | 'Focus' | 'Custom';

type CategoryKey = Lowercase<V2Category>;

export const categories: Record<CategoryKey, string> = {
  desire: '#D94F8A', health: '#2FA879', career: '#3157D8', relationships: '#E56F7A',
  creativity: '#F28A2E', spirituality: '#7657D9', abundance: '#B6A32A', family: '#C86B45',
  learning: '#198C9C', adventure: '#2D9FC8', focus: '#62666D', custom: '#E85D32',
};

export function getCategoryColor(category?: string | null): string {
  const key = category?.trim().toLowerCase() as CategoryKey | undefined;
  return key && key in categories ? categories[key] : categories.custom;
}

/** A restrained field behind artwork, not a screen-level ambient background. */
export function getCategoryFieldColor(category?: string | null): string {
  return `${getCategoryColor(category)}1F`;
}

/** For compact labels, selection fills, and quiet supporting emphasis. */
export function getCategorySoftTint(category?: string | null): string {
  return `${getCategoryColor(category)}14`;
}
