/**
 * The Form beat's hairline while the request runs. It is a pure function of time so it can never
 * look frozen: it covers ~92% of the bar by the typical (p80) generation time and keeps creeping
 * toward 97% after that. The screen jumps it to 1 on resolve.
 */
const ASYMPTOTE = 0.97;
const AT_P80 = 0.92;

export function estimatedFormProgress(seconds: number, p80Seconds: number): number {
  if (seconds <= 0 || p80Seconds <= 0) return 0;
  // ASYMPTOTE * (1 - exp(-k * p80)) = AT_P80
  const k = -Math.log(1 - AT_P80 / ASYMPTOTE) / p80Seconds;
  return ASYMPTOTE * (1 - Math.exp(-k * seconds));
}
