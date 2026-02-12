/**
 * Onboarding Flow Configuration
 * 
 * Defines the copy, structure, and flow for the 5-screen narrative onboarding.
 */

export const ONBOARDING_FLOW = [
    {
        id: 'orientation',
        headline: 'Focus, made visible.\nAlways within reach.',
        body: 'Anchor transforms what you want to feel into a symbol you return to each day.',
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
        theme: 'psychology',
    },
    {
        id: 'method',
        headline: 'Your words become visual form.',
        body: 'Describe your intention in a few words. Anchor creates a symbol from it. That\'s the process.',
        micro: 'You provide the meaning. We provide the form.',
        cta: 'Continue',
        theme: 'process',
    },
    {
        id: 'application',
        headline: 'One symbol. Used daily.',
        body: 'You\'ll see your symbol. Hold the intention it carries. Return to your day.',
        micro: 'Most people return once a day. Whenever feels right.',
        cta: 'Continue',
        theme: 'ritual',
    },
    {
        id: 'commitment',
        headline: 'You\'re ready to create your first Anchor.',
        body: 'Choose one intention that matters to you right now.\nYou don\'t need to perfect it.',
        micro: 'Take 60 seconds. Don\'t overthink it.',
        cta: 'Begin',
        theme: 'final',
    },
] as const;

export type OnboardingStep = typeof ONBOARDING_FLOW[number];
