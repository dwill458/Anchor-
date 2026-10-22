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

/**
 * Ink-first dark surface for a practice card body. The hue belongs to the
 * practice, but the surface stays charcoal/ink so the cream canvas keeps its
 * role as the page and the grid reads as a cinematic library beneath it.
 */
export type PracticeDarkSurface = {
  /** Solid body fill. */
  surface: string;
  /** Hairline that separates the card from the cream canvas. */
  border: string;
  /** Three-stop ramp (transparent -> mid -> solid `surface`) used to dissolve
   *  the bottom of the artwork into the body so there is no hard cut. */
  fade: readonly [string, string, string];
  /** Uppercase practice label on the dark body. */
  label: string;
  /** Directional arrow glyph on the dark body. */
  arrow: string;
  /** Translucent disc behind the arrow. */
  actionBg: string;
};

export type PracticeCardTheme = {
  accent: string;
  surface: string;
  border: string;
  actionCircleBg: string;
  labelColor: string;
  badgeBg: string;
  heroBadgeBg: string;
  /** Dark cinematic body used by the practice-library grid cards, and by the
   *  large-format Today hero which is the same surface at hero scale. */
  dark: PracticeDarkSurface;
  /** Label colour for the accent-filled CTA. Amber is too light to carry the
   *  cream label, so the readable pairing is stated per practice rather than
   *  assumed from the button variant. */
  ctaText: string;
};

/** Warm off-white type ramp shared by every dark practice body. */
export const practiceDarkText = {
  /** Title - strongest element on the dark body. */
  title: '#F2EEE4',
  /** Duration / availability - present, never competing with the title. */
  meta: 'rgba(242, 238, 228, 0.62)',
  /** Description - readable but the quietest line in the group. */
  body: 'rgba(242, 238, 228, 0.55)',
} as const;

export const practiceCardThemes: Record<'focus' | 'deep_prime' | 'visualize' | 'release', PracticeCardTheme> = {
  focus: {
    accent: practiceColors.focus,
    surface: '#FAF8FE',
    border: 'rgba(139, 92, 246, 0.18)',
    actionCircleBg: 'rgba(139, 92, 246, 0.10)',
    labelColor: '#7C3AED',
    badgeBg: 'rgba(139, 92, 246, 0.12)',
    heroBadgeBg: '#4C1D95',
    dark: {
      surface: '#191320',
      border: 'rgba(167, 139, 250, 0.16)',
      fade: ['rgba(25, 19, 32, 0)', 'rgba(25, 19, 32, 0.68)', '#191320'],
      label: '#B79CF7',
      arrow: '#C4B0FA',
      actionBg: 'rgba(167, 139, 250, 0.14)',
    },
    ctaText: '#FBF9F4',
  },
  deep_prime: {
    accent: practiceColors.deepPrime,
    surface: '#FDFBF4',
    border: 'rgba(224, 160, 56, 0.20)',
    actionCircleBg: 'rgba(224, 160, 56, 0.12)',
    labelColor: '#B45309',
    badgeBg: 'rgba(224, 160, 56, 0.14)',
    heroBadgeBg: '#78350F',
    dark: {
      surface: '#1E1710',
      border: 'rgba(224, 160, 56, 0.18)',
      fade: ['rgba(30, 23, 16, 0)', 'rgba(30, 23, 16, 0.68)', '#1E1710'],
      label: '#E3B264',
      arrow: '#EFC079',
      actionBg: 'rgba(224, 160, 56, 0.15)',
    },
    ctaText: '#1A1206',
  },
  visualize: {
    accent: practiceColors.visualize,
    surface: '#F5F9FD',
    border: 'rgba(59, 130, 196, 0.20)',
    actionCircleBg: 'rgba(59, 130, 196, 0.12)',
    labelColor: '#2563EB',
    badgeBg: 'rgba(59, 130, 196, 0.14)',
    heroBadgeBg: '#1E3A8A',
    dark: {
      surface: '#111A26',
      border: 'rgba(123, 176, 229, 0.17)',
      fade: ['rgba(17, 26, 38, 0)', 'rgba(17, 26, 38, 0.68)', '#111A26'],
      label: '#7FB3E3',
      arrow: '#93C2EE',
      actionBg: 'rgba(123, 176, 229, 0.14)',
    },
    ctaText: '#FBF9F4',
  },
  release: {
    accent: practiceColors.release,
    surface: '#FDF8F4',
    border: 'rgba(221, 95, 44, 0.20)',
    actionCircleBg: 'rgba(221, 95, 44, 0.12)',
    labelColor: '#C2410C',
    badgeBg: 'rgba(221, 95, 44, 0.14)',
    heroBadgeBg: '#9A3412',
    dark: {
      surface: '#22140F',
      border: 'rgba(233, 124, 80, 0.18)',
      fade: ['rgba(34, 20, 15, 0)', 'rgba(34, 20, 15, 0.68)', '#22140F'],
      label: '#EC8A5E',
      arrow: '#F29A70',
      actionBg: 'rgba(233, 124, 80, 0.15)',
    },
    ctaText: '#FBF9F4',
  },
};

export function getPracticeCardTheme(mode?: string | null): PracticeCardTheme {
  const normalized = mode?.replace(/[\s_-]/g, '').toLowerCase();
  if (normalized === 'deepprime') return practiceCardThemes.deep_prime;
  if (normalized === 'visualize') return practiceCardThemes.visualize;
  if (normalized === 'release') return practiceCardThemes.release;
  return practiceCardThemes.focus;
}
