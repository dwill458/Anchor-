/** Central safe framing is a generation instruction, not face detection. */
export function visionImageFit(sourceAspect: number, displayAspect: number, uploaded = false): 'cover' | 'contain' {
  if (!uploaded || !Number.isFinite(sourceAspect) || sourceAspect <= 0) return 'cover';
  const retained = Math.min(sourceAspect / displayAspect, displayAspect / sourceAspect);
  return retained < 0.65 ? 'contain' : 'cover';
}
