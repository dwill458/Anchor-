/**
 * Onboarding Flow Configuration
 * 
 * Defines the copy, structure, and flow for the 5-screen narrative onboarding.
 */

export const ONBOARDING_FLOW = [
    {
        id: 'orientation',
        headline: 'Focus, made visible.\nSo it’s always within reach.',
        body: 'Anchor helps you turn a single intention into a personal symbol you can return to daily.',
        micro: 'No affirmations. No habit tracking. Just clarity.',
        cta: 'Create your first Anchor',
        theme: 'minimal',
    },
    {
        id: 'insight',
        headline: 'Your mind responds faster to images than explanations.',
        body: 'A symbol can hold meaning without needing constant thought. That’s what makes it easy to return to, even on busy days.',
        micro: 'Less effort. More alignment.',
        cta: 'Continue',
        secondaryCta: 'Why this works',
        theme: 'psychology',
    },
    {
        id: 'method',
        headline: 'We remove the noise so only the essence remains.',
        body: 'Anchor distills it, reshapes it, and turns it into a unique visual form you can return to without overthinking it.',
        micro: 'Simple input. Powerful output.',
        cta: 'Continue',
        theme: 'process',
    },
    {
        id: 'application',
        headline: 'One symbol. Used daily.',
        body: 'Your Anchor becomes a visual focus point you can activate in seconds. A reminder of what matters, when it matters.',
        micro: 'Most people return once per day. It takes less than a minute.',
        cta: 'Continue',
        theme: 'ritual',
    },
    {
        id: 'commitment',
        headline: 'Let’s set your first Anchor.',
        body: 'Choose one intention you’re ready to carry forward.\nYou don’t need to perfect it.',
        micro: '',
        cta: 'Begin',
        theme: 'final',
    },
] as const;

export type OnboardingStep = typeof ONBOARDING_FLOW[number];
