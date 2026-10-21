export const MAX_COACH_SEQUENCES_PER_SESSION = 1; // easy to raise
let sequences = 0;
let activeScreen: string | null = null;
const recordedScreens = new Set<string>();

export function canStartCoachSequence(screenId: string): boolean {
  return sequences < MAX_COACH_SEQUENCES_PER_SESSION || activeScreen === screenId;
}

export function recordCoachSequence(screenId: string): void {
  activeScreen = screenId;
  if (!recordedScreens.has(screenId)) {
    recordedScreens.add(screenId);
    sequences += 1;
  }
}

export function resetTeachingSession(): void {
  sequences = 0;
  activeScreen = null;
  recordedScreens.clear();
}
