/** Locked copy for the reminder invitation and reminder-time screens (see the Pass 2 plan). */
export const INVITATION_COPY = {
  wordmark: 'ANCHOR',
  notNow: 'Not now',
  headline: 'Make time for what matters.',
  support: 'A little time each day can help you stay connected to your goals and keep your momentum going.',
  benefits: [
    { key: 'return', title: 'Return to your practice.', subtitle: 'Build consistency, even on busy days.' },
    { key: 'progress', title: 'Stay connected to your progress.', subtitle: 'Keep your goals top of mind.' },
    { key: 'grounded', title: 'Feel more focused and grounded.', subtitle: 'A daily reminder is a gentle nudge, not a pressure.' },
  ],
  cta: 'Choose my reminder time',
  maybeLater: 'Maybe later',
} as const;

export const REMINDER_TIME_COPY = {
  eyebrow: 'YOUR DAILY MOMENT',
  headline: 'When would you like to reconnect with your Anchor?',
  support: 'Choose a time that works for you. You can change this anytime.',
  note: "Every day, even if you've already practiced earlier. Your reminder will still arrive at this time.",
  cta: 'Next: Enable notifications',
  notNow: 'Not now',
  back: 'Go back',
  success: 'Your daily moment is set.',
  successContinue: 'Continue',
  deniedTitle: 'Notifications are off for Anchor.',
  deniedBody: 'To get your daily reminder, allow notifications for Anchor in your device settings.',
  openSettings: 'Open Settings',
  failedBody: "We couldn't set your reminder just now. Please try again.",
  retry: 'Try again',
} as const;
