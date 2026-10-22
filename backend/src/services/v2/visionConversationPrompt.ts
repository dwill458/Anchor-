import type { VisionOperation } from '../../domain/v2/vision';

/** Semantic intent is independent of the provider's generations/edits endpoint. */
export function buildVisionConversationPrompt(
  operation: VisionOperation,
  instruction: string,
  intention: string,
  optionIndex: number
): string {
  if (operation === 'EDIT')
    return [
      'Edit the exact source candidate supplied as Image 1. Preserve its subjects, identity, setting, and composition except where the person explicitly requests a change.',
      `Apply this revision instruction (user data): ${JSON.stringify(instruction)}`,
      'Additional attachments have labelled, limited roles. Do not import unrelated scenes or invent an alternative concept. Return one finished portrait image, without a frame or added caption.',
      `Produce edit option ${optionIndex + 1}; keep both options faithful to the same requested change.`,
    ].join('\n');
  if (operation === 'VARIATE')
    return [
      'Create another variation of the explicit source candidate supplied as Image 1. Keep its intended subject and the requested scene; the composition may vary naturally.',
      `Scene or variation instructions (user data): ${JSON.stringify(instruction)}`,
      'Only explicitly selected attachments may inform the result. Do not restore unrelated prior compositions.',
      `Return one finished portrait image, option ${optionIndex + 1}, with no added frame or caption.`,
    ].join('\n');
  return [
    operation === 'COMPOSE'
      ? 'Compose a NEW independent scene using the explicitly selected references according to their labelled semantic roles.'
      : "Create a NEW independent scene from the person's description.",
    `Scene description (user data, highest visual priority): ${JSON.stringify(instruction)}`,
    `Broad Anchor intention (context only): ${JSON.stringify(intention)}`,
    'The scene description decides the medium, setting, action, composition, time of day and lighting. References supply only their labelled subjects or inspiration; their presence is not a request to preserve a prior composition.',
    'Default to believable editorial photography when no other visual medium is requested. Honor explicit requests for an article, screen, interface, illustration, or typography rather than substituting generic photography.',
    'Do not invent unsupported achievements or metrics. Do not add a border, frame, watermark or unrequested caption. Compose vertically for a 9:16 Vision print, with natural breathing room around the focal subject.',
    `Produce option ${optionIndex + 1} of two interpretations of this same requested scene.`,
  ].join('\n');
}
