import { OnboardingContextSchema } from '../OnboardingContextService';
import { buildVisionScenePlannerPrompt } from '../visionScenePlanning';
import { buildPlanningUserMessage } from '../../chart/chartPlanPrompt';

const onboarding = {
  focusCategory: 'career',
  desiredChange: 'More freedom',
  lifeChanges: ['What I do every day', 'Where I spend my time'],
  primaryNeed: 'Staying consistent',
};

describe('onboarding context for Vision and Chart', () => {
  it('accepts actual selections and rejects unrecognized answer values', () => {
    expect(OnboardingContextSchema.safeParse(onboarding).success).toBe(true);
    expect(OnboardingContextSchema.safeParse({ ...onboarding, lifeChanges: ['A fabricated change'] }).success).toBe(false);
  });

  it('passes onboarding to Vision as supporting context behind the explicit description', () => {
    const prompt = buildVisionScenePlannerPrompt({
      intention: 'I create more time with my family',
      category: 'family',
      description: 'We share dinner together on weeknights.',
      onboarding,
    });
    expect(prompt).toContain('More freedom');
    expect(prompt).toContain('We share dinner together on weeknights.');
    expect(prompt).toContain('description and Anchor intention take priority');
  });

  it('passes onboarding to Chart without replacing destination or current reality', () => {
    const prompt = buildPlanningUserMessage({
      intention: 'I create more time with my family',
      category: 'family',
      onboarding,
      startingContext: 'I currently work late four nights a week.',
      vision: null,
      followUp: null,
      adjustment: null,
    }, { allowFollowUp: true });
    expect(prompt).toContain('More freedom');
    expect(prompt).toContain('I currently work late four nights a week.');
    expect(prompt).toContain('never substitute the onboarding wish');
  });

  it('accepts and forwards current motivation and outcome without a category selection', () => {
    const current = {
      motivation: 'I want more room to create',
      desiredChange: 'I finish a personal project and share it.',
      lifeChanges: ['What I do every day'],
      primaryNeed: 'Staying consistent',
      customAnswer: 'Making time for music',
    };
    expect(OnboardingContextSchema.safeParse(current).success).toBe(true);
    const visionPrompt = buildVisionScenePlannerPrompt({
      intention: 'I make time for music',
      category: 'creativity',
      description: 'I share a finished collection of songs.',
      onboarding: current,
    });
    expect(visionPrompt).toContain('I want more room to create');
    expect(visionPrompt).toContain('I finish a personal project and share it.');
    const chartPrompt = buildPlanningUserMessage({
      intention: 'I make time for music',
      category: 'creativity',
      onboarding: current,
      startingContext: null,
      vision: null,
      followUp: null,
      adjustment: null,
    }, { allowFollowUp: true });
    expect(chartPrompt).toContain('I want more room to create');
    expect(chartPrompt).toContain('I finish a personal project and share it.');
  });
});
