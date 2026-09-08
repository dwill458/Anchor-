export type V2PracticeMode = 'Focus' | 'DeepPrime' | 'Visualize' | 'Release';

export const practiceColors = { focus: '#8B5CF6', deepPrime: '#E0A038', visualize: '#3B82C4', release: '#DD5F2C' } as const;

export function getPracticeColor(mode?: string | null): string {
  const normalized = mode?.replace(/[\s_-]/g, '').toLowerCase();
  if (normalized === 'deepprime') return practiceColors.deepPrime;
  if (normalized === 'visualize') return practiceColors.visualize;
  if (normalized === 'release') return practiceColors.release;
  return practiceColors.focus;
}

export function getPracticeSoftTint(mode?: string | null): string {
  return `${getPracticeColor(mode)}18`;
}
