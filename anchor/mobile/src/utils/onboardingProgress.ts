export function getOnboardingProgressPercent(currentStep: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;

  const completedSteps = Math.min(Math.max(currentStep + 1, 0), totalSteps);
  return Math.round((completedSteps / totalSteps) * 100);
}
