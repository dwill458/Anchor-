export type GettingStartedStepId = 'practice' | 'progress' | 'anchor' | 'vision' | 'chart' | 'another';

export function formatGettingStartedPracticeDesc(durationSeconds?: number): string {
  const seconds = typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : 60;
  const label = seconds < 60
    ? `${Math.max(1, Math.round(seconds))} sec`
    : `${Math.max(1, Math.round(seconds / 60))} min`;
  return `Tap Today above · ${label}`;
}

export function formatGettingStartedProgressDesc(hasVision: boolean): string {
  return hasVision
    ? 'Tap Thread Strength under your anchor'
    : 'Your Thread Strength, your week and your history';
}

export const GETTING_STARTED_COPY = {
  header: {
    eyebrow: 'Getting started',
    title: 'Get to know Anchor',
    doneTitle: 'Every part of Anchor is in play.',
    doneSub: 'Bring this card back any time from Settings → Replay app tips.',
  },
  actions: {
    showMe: 'Show me',
    afterPractice: 'After practice',
    hide: 'Hide',
    close: 'Close',
  },
  toast: 'Bring it back in Settings → Replay app tips',
  chip: {
    tapAnchor: 'Tap your anchor',
  },
  steps: {
    practice: {
      title: 'Finish your first practice',
      defaultDesc: 'Tap Today above · 1 min',
    },
    progress: {
      title: 'See your progress',
      beforeVisionDesc: 'Your Thread Strength, your week and your history',
      afterVisionDesc: 'Tap Thread Strength under your anchor',
    },
    anchor: {
      title: 'Open your anchor',
      desc: 'Tap the circle at the top of Home',
    },
    vision: {
      title: 'Add a Vision',
      desc: "On your anchor's page. Gives your future a picture.",
    },
    chart: {
      title: 'Build a Chart',
      desc: "On your anchor's page. Waypoints and your next move.",
    },
    another: {
      title: 'Make another anchor',
      desc: 'Tap + at the top of Home when another goal calls.',
    },
  },
} as const;
