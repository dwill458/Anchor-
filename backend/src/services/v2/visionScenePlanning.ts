/**
 * Vision scene planning: the step between a person's description and the
 * image model. The planner interprets the description into a shot list of
 * genuinely different moments; each image prompt is then assembled from one
 * planned shot. Sending the raw description eight times produced eight
 * near-identical frames (the same person at the same screen).
 *
 * Pure functions only - the provider call lives in GeminiImageService.
 */

export const VISION_SCENE_COUNT = 8;

/**
 * Vision assets are portrait-first. Visualize fills a phone screen, so the
 * canonical image is composed tall; Home and Anchor Details derive their
 * wider crops from its centre band.
 */
export const VISION_IMAGE_ASPECT_RATIO = '9:16';
/** Stored size of the canonical portrait asset (never upscaled past the provider output). */
export const VISION_IMAGE_WIDTH = 1080;
export const VISION_IMAGE_HEIGHT = 1920;

/** Composition rules that keep one tall original useful at every crop. */
export const VISION_PORTRAIT_COMPOSITION = [
  'Format: a tall 9:16 portrait photograph, composed for a full-screen phone. Do not letterbox, add borders, or make a split/diptych frame.',
  'Keep the main subject (person, hands or key object) inside the central safe area: horizontally within the middle 70%, vertically between 30% and 70% of the height, so a wide centre crop still contains it.',
  'Never place faces, hands or the key object near an edge. Let the top and bottom of the frame hold environment (ceiling, sky, floor, table surface) that can be cropped away without losing the moment.',
  'Include enough surrounding space that the scene reads at small sizes.',
].join(' ');

/**
 * One planned shot. `role` and `scene` are the persisted contract (the job's
 * `plan` column and each candidate's `prompt`); the direction fields are
 * optional so plans saved before this change still replay on retry.
 */
export interface VisionScenePlanItem {
  role: string;
  scene: string;
  moment?: string;
  setting?: string;
  framing?: string;
  composition?: string;
  light?: string;
  feeling?: string;
}

/** Camera distances the plan must mix, so a set never collapses to one framing. */
export const VISION_FRAMINGS = ['wide', 'medium', 'close', 'detail'] as const;

const MAX_ROLE = 80;
const MAX_SCENE = 500;
const MAX_FIELD = 160;

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function buildVisionScenePlannerPrompt(input: {
  intention: string;
  category: string;
  description: string;
  /** Scenes from earlier sets of the same Vision, to be deliberately avoided. */
  avoidScenes?: string[];
}): string {
  const avoid = (input.avoidScenes ?? []).filter(Boolean).slice(0, 24);
  return [
    `You are the director of photography for one person's Vision of their future. Plan ${VISION_SCENE_COUNT} photographs that together feel like a contact sheet from a single real future - the SAME future seen through ${VISION_SCENE_COUNT} different moments.`,
    '',
    'Read the description for what it implies, not only what it literally says. Every photograph must be recognisably part of THIS Vision: someone who reads the description should see at once why each frame belongs. Generic lifestyle moments that could illustrate anyone\'s life (making tea, cooking, a walk in a park) are not allowed unless the description implies them.',
    '',
    'Cover the Vision from three angles:',
    '- 2-3 frames of the outcome itself: the moment it arrives or is noticed, and a close tactile detail of it (hands, objects, materials).',
    '- 2-3 frames of the work, space or people around the outcome: where it happens and what surrounds it.',
    '- 2-3 frames of its consequence: how the person\'s day, pace, freedom or feeling is different because it is real - a quiet human or emotional beat, or a transitional moment (arriving, beginning, stepping away).',
    '',
    'Rules for the set:',
    `- Every photograph must differ from every other in moment, setting or viewpoint. Never repeat a composition.`,
    `- Mix camera distance: at least two "wide", two "medium", two "close" or "detail".`,
    '- When the outcome lives on a screen, at most three photographs show that screen, each from a different viewpoint; it is never legible. Otherwise at most one photograph shows a screen.',
    '- At least two photographs contain no face at all (hands only, an empty space, an object, a person from behind).',
    '- Vary light and time of day where the description allows it.',
    '- Stay grounded in the description. Do not invent luxury, specific places, other people, relationships, achievements or wealth the description does not support. When other people are implied, keep them peripheral and unidentifiable.',
    '- Believable documentary/editorial photography only: no fantasy, surrealism, cyberpunk, floating objects, symbols, or advertising gloss.',
    '- No readable text, numbers, logos, interface elements or signage in any photograph.',
    ...(avoid.length ? [
      '',
      'This person has already seen the scenes below for this Vision. Plan NEW moments: different settings, different framings, different consequences. Do not rephrase these:',
      ...avoid.map(scene => `- ${scene}`),
    ] : []),
    '',
    `Return only a JSON array of ${VISION_SCENE_COUNT} objects with these string keys:`,
    '"role" (2-5 words naming the moment), "moment", "setting", "framing" (one of wide, medium, close, detail), "composition", "light", "feeling",',
    '"scene" (one or two concrete sentences a photographer could shoot, under 400 characters).',
    'Every photograph will be a tall 9:16 portrait for a phone screen: plan compositions that are naturally vertical (a doorway, a person standing, a table seen from above, a window with floor and ceiling) rather than wide panoramas.',
    '',
    `Anchor intention (data): ${JSON.stringify(input.intention)}`,
    `Category (data): ${JSON.stringify(input.category)}`,
    `Vision description (data): ${JSON.stringify(input.description)}`,
  ].join('\n');
}

/**
 * Validates planner output. Returns null when it is not a usable plan so the
 * caller can raise a retryable error rather than render a broken set.
 */
export function parseVisionScenePlan(text: string | undefined | null): VisionScenePlanItem[] | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text ?? ''); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length !== VISION_SCENE_COUNT) return null;
  const plan: VisionScenePlanItem[] = [];
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const role = clip(item.role, MAX_ROLE);
    const scene = clip(item.scene, MAX_SCENE);
    if (!role || !scene) return null;
    const framing = clip(item.framing, 20)?.toLowerCase();
    plan.push({
      role,
      scene,
      moment: clip(item.moment, MAX_FIELD),
      setting: clip(item.setting, MAX_FIELD),
      framing: framing && (VISION_FRAMINGS as readonly string[]).includes(framing) ? framing : undefined,
      composition: clip(item.composition, MAX_FIELD),
      light: clip(item.light, MAX_FIELD),
      feeling: clip(item.feeling, MAX_FIELD),
    });
  }
  // Byte-identical scenes are a planner failure, not variety.
  if (new Set(plan.map(item => item.scene.toLowerCase())).size !== plan.length) return null;
  return plan;
}

/** True for a plan persisted on a job, in either the old or the new shape. */
export function isStoredVisionScenePlan(value: unknown): value is VisionScenePlanItem[] {
  return Array.isArray(value) && value.length === VISION_SCENE_COUNT && value.every(
    item => item && typeof item === 'object' && typeof (item as { role?: unknown }).role === 'string' &&
      typeof (item as { scene?: unknown }).scene === 'string',
  );
}

const LENS_BY_FRAMING: Record<string, string> = {
  wide: 'Wide environmental frame, 28-35mm, the person (if any) small within the space.',
  medium: 'Medium candid frame, 35-50mm, as if a friend quietly took it.',
  close: 'Close frame, 50mm, shallow depth of field, intimate but unposed.',
  detail: 'Detail frame, 50-85mm macro-like close-up of hands or objects, background falls away.',
};

export function buildVisionImagePrompt(input: {
  intention: string;
  category: string;
  description: string;
  scene: VisionScenePlanItem;
}): string {
  const { scene } = input;
  return [
    'Create one photograph for a personal Vision - a believable glimpse of this person\'s real future.',
    `Scene to photograph: ${JSON.stringify(scene.scene)}`,
    ...(scene.moment ? [`Moment: ${JSON.stringify(scene.moment)}`] : []),
    ...(scene.setting ? [`Setting: ${JSON.stringify(scene.setting)}`] : []),
    ...(scene.composition ? [`Composition: ${JSON.stringify(scene.composition)}`] : []),
    ...(scene.light ? [`Light: ${JSON.stringify(scene.light)}`] : []),
    ...(scene.feeling ? [`Emotional texture: ${JSON.stringify(scene.feeling)}`] : []),
    LENS_BY_FRAMING[scene.framing ?? ''] ?? 'Natural candid framing.',
    VISION_PORTRAIT_COMPOSITION,
    `Context only (never render as text) - Vision description: ${JSON.stringify(input.description)}; Anchor intention: ${JSON.stringify(input.intention)}; category: ${JSON.stringify(input.category)}.`,
    'Style: documentary / editorial photography, natural available light, realistic muted colour, soft natural contrast, fine grain, small real-world imperfections, believable lived-in spaces. Cinematic composition without movie-poster styling.',
    'Screens, if present at all, are incidental, out of focus and unreadable. No readable text, numbers, words, typography, signs, labels, logos, watermarks or interface elements anywhere.',
    'Avoid: corporate stock-photo look, glossy advertising, HDR, oversaturation, neon, cyberpunk, fantasy, surrealism, mystical symbols, floating objects, generic luxury, posed smiling at camera, duplicated people.',
  ].join('\n');
}
