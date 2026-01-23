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
        headline: 'Your mind holds images more easily than words.',
        body: 'A symbol can carry your intention without needing analysis. You can return to it in seconds, even when time is short.',
        micro: 'Less thinking. More focus.',
        cta: 'Continue',
        secondaryCta: 'More on this',
        theme: 'psychology',
    },
    {
        id: 'method',
        headline: 'Your words become visual form.',
        body: 'Describe your intention in a few words. Anchor creates a symbol from it. That's the process.',
        micro: 'You provide the meaning. We provide the form.',
        cta: 'Continue',
        theme: 'process',
    },
    {
        id: 'application',
        headline: 'One symbol. Used daily.',
        body: 'You'll see your symbol. Hold the intention it carries. Return to your day.',
        micro: 'Most people return once a day. Whenever feels right.',
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
