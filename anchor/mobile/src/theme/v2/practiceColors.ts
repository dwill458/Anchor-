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

export type PracticeCardTheme = {
  accent: string;
  surface: string;
  border: string;
  actionCircleBg: string;
  labelColor: string;
  badgeBg: string;
  heroBadgeBg: string;
};

export const practiceCardThemes: Record<'focus' | 'deep_prime' | 'visualize' | 'release', PracticeCardTheme> = {
  focus: {
    accent: practiceColors.focus,
    surface: '#FAF8FE',
    border: 'rgba(139, 92, 246, 0.18)',
    actionCircleBg: 'rgba(139, 92, 246, 0.10)',
    labelColor: '#7C3AED',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    heroBadgeBg: '#4C1D95',
  },
  deep_prime: {
    accent: practiceColors.deepPrime,
    surface: '#FDFBF4',
    border: 'rgba(224, 160, 56, 0.20)',
    actionCircleBg: 'rgba(224, 160, 56, 0.12)',
    labelColor: '#B45309',
    badgeBg: 'rgba(224, 160, 56, 0.14)',
    heroBadgeBg: '#78350F',
  },
  visualize: {
    accent: practiceColors.visualize,
    surface: '#F5F9FD',
    border: 'rgba(59, 130, 196, 0.20)',
    actionCircleBg: 'rgba(59, 130, 196, 0.12)',
    labelColor: '#2563EB',
    badgeBg: 'rgba(59, 130, 196, 0.14)',
    heroBadgeBg: '#1E3A8A',
  },
  release: {
    accent: practiceColors.release,
    surface: '#FDF8F4',
    border: 'rgba(221, 95, 44, 0.20)',
    actionCircleBg: 'rgba(221, 95, 44, 0.12)',
    labelColor: '#C2410C',
    badgeBg: 'rgba(221, 95, 44, 0.14)',
    heroBadgeBg: '#9A3412',
  },
};

export function getPracticeCardTheme(mode?: string | null): PracticeCardTheme {
  const normalized = mode?.replace(/[\s_-]/g, '').toLowerCase();
  if (normalized === 'deepprime') return practiceCardThemes.deep_prime;
  if (normalized === 'visualize') return practiceCardThemes.visualize;
  if (normalized === 'release') return practiceCardThemes.release;
  return practiceCardThemes.focus;
}
