import type { ReflectionMood, ReflectionPromptType, ReflectionStructuredContent } from '@/types/chart';
import { promptForPracticeMode } from './reflectionPrompts';

export type PostPracticeReflectionEntry = {
  practiceSessionId: string;
  practiceMode: string;
  anchorId?: string;
  courseId?: string;
  waypointId?: string;
  source: 'POST_PRACTICE';
  promptType: ReflectionPromptType;
  promptVersion: 1;
};

/** Presentation boundary only: Workstream E invokes it after canonical practice completion. */
export function openPostPracticeReflection(input: Omit<PostPracticeReflectionEntry, 'promptType' | 'promptVersion'>): PostPracticeReflectionEntry {
  return { ...input, promptType: promptForPracticeMode(input.practiceMode), promptVersion: 1 };
}

export type WaypointCompletionReflectionDraft = {
  structuredContent?: ReflectionStructuredContent;
  moodAfter?: ReflectionMood;
  promptType: 'WAYPOINT_COMPLETION';
  promptVersion: number;
  idempotencyKey: string;
};

export function createWaypointCompletionReflectionDraft(input: {
  structuredContent?: ReflectionStructuredContent;
  moodAfter?: ReflectionMood;
  idempotencyKey: string;
}): WaypointCompletionReflectionDraft {
  return { ...input, promptType: 'WAYPOINT_COMPLETION', promptVersion: 1 };
}

export const courseCompletionReflection = (courseId: string) => ({
  source: 'COURSE_COMPLETION' as const,
  promptType: 'FINAL_REFLECTION' as const,
  promptVersion: 1,
  courseId,
});
