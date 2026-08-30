import type { ReflectionPromptType } from '@/types/chart';

export type ReflectionPromptCopy = { heading: string; supporting?: string; structured?: true };

const PROMPTS: Record<ReflectionPromptType, Record<number, ReflectionPromptCopy>> = {
  HOW_DO_YOU_FEEL_NOW: { 1: { heading: 'How do you feel now?' } },
  WHAT_CAME_UP: { 1: { heading: 'Capture anything that came up.' } },
  WHAT_STOOD_OUT: { 1: { heading: 'What stood out most?' } },
  WHAT_FELT_STRONGEST: { 1: { heading: 'What felt strongest?' } },
  COURSE_STATUS: { 1: { heading: 'What feels important about where you are right now?' } },
  WAYPOINT_COMPLETION: { 1: { heading: 'What helped you get here?', supporting: 'What did you learn?', structured: true } },
  FINAL_REFLECTION: { 1: { heading: 'What changed while you followed this course?' } },
};

/** Unknown future versions intentionally use the latest known copy without changing the version sent to the API. */
export function reflectionPrompt(promptType: ReflectionPromptType, promptVersion: number): ReflectionPromptCopy {
  const versions = PROMPTS[promptType];
  return versions[promptVersion] ?? versions[Math.max(...Object.keys(versions).map(Number))];
}

export function promptForPracticeMode(mode: string): ReflectionPromptType {
  switch (mode.toLowerCase()) {
    case 'focus': return 'WHAT_FELT_STRONGEST';
    case 'visualize': return 'WHAT_STOOD_OUT';
    case 'deep_prime':
    case 'deep prime': return 'WHAT_CAME_UP';
    default: return 'HOW_DO_YOU_FEEL_NOW';
  }
}
