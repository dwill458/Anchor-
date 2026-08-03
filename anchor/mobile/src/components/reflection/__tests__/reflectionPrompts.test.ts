import { openPostPracticeReflection, createWaypointCompletionReflectionDraft } from '../reflectionFlowBoundaries';
import { promptForPracticeMode, reflectionPrompt } from '../reflectionPrompts';

describe('reflection prompt map', () => {
  it('falls back to the current known wording for future prompt versions', () => {
    expect(reflectionPrompt('COURSE_STATUS', 999).heading).toBe('What feels important about where you are right now?');
  });

  it.each([
    ['focus', 'WHAT_FELT_STRONGEST'],
    ['visualize', 'WHAT_STOOD_OUT'],
    ['deep_prime', 'WHAT_CAME_UP'],
  ] as const)('maps %s practice to its one reflection prompt', (mode, prompt) => {
    expect(promptForPracticeMode(mode)).toBe(prompt);
  });

  it('creates a waypoint completion boundary payload without calling a Reflection route', () => {
    expect(createWaypointCompletionReflectionDraft({ idempotencyKey: 'stable-key' })).toEqual({
      idempotencyKey: 'stable-key', promptType: 'WAYPOINT_COMPLETION', promptVersion: 1,
    });
  });

  it('keeps post-practice presentation as a boundary object for Workstream E', () => {
    expect(openPostPracticeReflection({ practiceSessionId: 'session-1', practiceMode: 'visualize', source: 'POST_PRACTICE' })).toMatchObject({
      promptType: 'WHAT_STOOD_OUT', promptVersion: 1,
    });
  });
});
