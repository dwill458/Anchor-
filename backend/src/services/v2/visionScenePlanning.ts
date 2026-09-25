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
  /** Distinct narrative purpose within this set. */
  purpose?: string;
  /** Complete manifest repeated on each item so the persisted plan carries its semantic inventory. */
  identifiedConcepts?: string[];
  /** Concrete user-provided concepts this scene represents. */
  covers?: string[];
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

function clipList(value: unknown, maxItems = 8): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value.map(item => clip(item, MAX_FIELD)).filter((item): item is string => Boolean(item));
  return values.length ? [...new Set(values)].slice(0, maxItems) : undefined;
}

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
  hasAppearanceReference?: boolean;
  onboarding?: { motivation?: string; customAnswer?: string; desiredChange: string; lifeChanges: string[] } | null;
}): string {
  const avoid = (input.avoidScenes ?? []).filter(Boolean).slice(0, 24);
  return [
    `You are the director of photography for one person's Vision of their future. Plan ${VISION_SCENE_COUNT} photographs that together feel like a contact sheet from a single real future - the SAME future seen through ${VISION_SCENE_COUNT} different moments.`,
    '',
    'Read the description for what it implies, not only what it literally says. Every photograph must be recognisably part of THIS Vision: someone who reads the description should see at once why each frame belongs. Generic lifestyle moments that could illustrate anyone\'s life (making tea, cooking, a walk in a park) are not allowed unless the description implies them.',
    '',
    'Semantic coverage and diversity contract (CRITICAL - takes priority over all other direction):',
    '- First, identify every meaningful, visually depictable concept explicitly present in the description. Preserve concrete names, quantities, products, milestones, relationships, places, and activities. Return this complete manifest as "identifiedConcepts" on every scene object.',
    '- Represent every identified concept in at least one scene when visually possible. Compound inputs often contain multiple dimensions (e.g. product/business success, external recognition/awards, lifestyle freedom/remote work, and family/life outcome). You MUST distribute the scenes across all of these distinct dimensions. Never collapse the set into several cosmetic variations of the same setting or activity.',
    '- Each scene must have a distinct semantic purpose ("purpose") and name the concept(s) it covers ("covers").',
    '- Later scenes must know what earlier scenes represent: avoid duplicate compositions, environments, activities, and narrative beats.',
    '- Don\'t generate several cosmetic variations of the same idea. Camera-angle changes alone do not make a new semantic scene.',
    '- Do not invent unrelated aspirations just to create variety. If there are fewer distinct concepts than scenes, use grounded, meaningfully different moments of those concepts rather than unrelated lifestyle imagery.',
    '- Preserve concrete details supplied by the user (e.g. specific user counts, dashboard metrics, editorial features, specific places).',
    ...(input.hasAppearanceReference
      ? ['- An approved user appearance reference is supplied. A visible person may appear in natural moments, but do not make the set repeated portraiture.']
      : [
          '- NEVER invent the user\'s physical appearance without a supplied reference image.',
          '- When identity is not known, favor POV (first-person viewpoint), hands, over-the-shoulder, silhouette, environmental scenes, screens/objects, or compositions where identity is not important.',
        ]),
    '',
    'Direction for photographic angles:',
    '- Show the outcome itself, its evidence or moment of recognition.',
    '- Show different described environments, activities or relationships.',
    '- Show consequences of the described future without inventing new goals.',
    '',
    'Rules for the set:',
    '- Every photograph must differ from every other in moment, setting or viewpoint. Never repeat a composition.',
    '- Mix camera distance: at least two "wide", two "medium", two "close" or "detail".',
    '- When the outcome lives on a screen, at most three photographs show that screen, each from a different viewpoint; it is never legible. Otherwise at most one photograph shows a screen.',
    '- At least two photographs contain no face at all (hands only, an empty space, an object, a person from behind).',
    '- Vary light and time of day where the description allows it.',
    '- Stay grounded in the description. Do not invent luxury, specific places, other people, relationships, achievements or wealth the description does not support. When other people are implied, keep them peripheral and unidentifiable.',
    '- Believable documentary/editorial photography only: no fantasy, surrealism, cyberpunk, floating objects, symbols, or advertising gloss.',
    '- For Career intentions: depict the outcome as ALREADY REAL in an authentic professional workplace (corporate office floor, established company workstation, meeting room, industry workspace, leadership setting or workplace arrival). Avoid defaulting to generic WFH laptops, home desks, coffee cups, or empty desk still lifes.',
    '- No readable text, numbers, logos, interface elements or signage in any photograph.',
    ...(avoid.length ? [
      '',
      'This person has already seen the scenes below for this Vision. Plan NEW moments: different settings, different framings, different consequences. Do not rephrase these:',
      ...avoid.map(scene => `- ${scene}`),
    ] : []),
    '',
    `Return only a JSON array of ${VISION_SCENE_COUNT} objects with these string keys:`,
    '"role" (2-5 words naming the moment), "purpose" (distinct semantic purpose, 2-8 words), "identifiedConcepts" (same complete array on every object), "covers" (array of labels from that manifest represented in this scene), "moment", "setting", "framing" (one of wide, medium, close, detail), "composition", "light", "feeling",',
    '"scene" (one or two concrete sentences a photographer could shoot, under 400 characters).',
    'Every photograph will be a tall 9:16 portrait for a phone screen: plan compositions that are naturally vertical (a doorway, a person standing, a table seen from above, a window with floor and ceiling) rather than wide panoramas.',
    '',
    `Anchor intention (data): ${JSON.stringify(input.intention)}`,
    `Category (data): ${JSON.stringify(input.category)}`,
    `Vision description (data): ${JSON.stringify(input.description)}`,
    ...(input.onboarding ? [
      'Earlier onboarding answers are supporting context only. The person\'s explicit Vision description and Anchor intention take priority. Do not invent scenes from onboarding answers that the description does not imply.',
      ...(input.onboarding.motivation ? [`Reason for change (data): ${JSON.stringify(input.onboarding.motivation)}`] : []),
      ...(input.onboarding.customAnswer ? [`Their own words (data): ${JSON.stringify(input.onboarding.customAnswer)}`] : []),
      `Desired outcome (data): ${JSON.stringify(input.onboarding.desiredChange)}`,
      `Life changes (data): ${JSON.stringify(input.onboarding.lifeChanges)}`,
    ] : []),
  ].join('\n');
}

/**
 * Validates planner output. Returns null when it is not a usable plan so the
 * caller can raise a retryable error rather than render a broken set.
 */
export function parseVisionScenePlan(text: string | undefined | null): VisionScenePlanItem[] | null {
  let parsed: unknown;
  const rawCleaned = (text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try { parsed = JSON.parse(rawCleaned); } catch { return null; }
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
      purpose: clip(item.purpose, MAX_FIELD),
      identifiedConcepts: clipList(item.identifiedConcepts),
      covers: clipList(item.covers),
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
  if (plan.some(item => !item.purpose || !item.identifiedConcepts?.length || !item.covers?.length)) return null;
  const purposes = plan.map(item => item.purpose!.toLowerCase());
  if (new Set(purposes).size !== purposes.length) return null;
  const manifest = plan[0].identifiedConcepts!;
  const normalizedManifest = new Set(manifest.map(concept => concept.toLowerCase()));
  // Ensure all scene objects share the same set of identified concepts (order-independent)
  if (plan.some(item => {
    const itemConcepts = item.identifiedConcepts?.map(v => v.toLowerCase()) ?? [];
    return itemConcepts.length !== normalizedManifest.size || itemConcepts.some(c => !normalizedManifest.has(c));
  })) {
    return null;
  }
  const covered = new Set(plan.flatMap(item => item.covers!.map(concept => concept.toLowerCase())));
  if (manifest.some(concept => !covered.has(concept.toLowerCase())) || plan.some(item => item.covers!.some(concept => !normalizedManifest.has(concept.toLowerCase())))) return null;
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
  /** The complete plan gives each image prompt context about earlier/later beats. */
  plannedScenes?: VisionScenePlanItem[];
  hasAppearanceReference?: boolean;
}): string {
  const { scene } = input;
  return [
    'Create one photograph for a personal Vision - a believable glimpse of this person\'s real future.',
    `Scene to photograph (highest priority): ${JSON.stringify(scene.scene)}`,
    ...(scene.purpose ? [`Distinct semantic purpose: ${JSON.stringify(scene.purpose)}`] : []),
    ...(scene.covers?.length ? [`Concept represented in this frame: ${JSON.stringify(scene.covers)}`] : []),
    ...(scene.moment ? [`Moment: ${JSON.stringify(scene.moment)}`] : []),
    ...(scene.setting ? [`Setting: ${JSON.stringify(scene.setting)}`] : []),
    ...(scene.composition ? [`Composition: ${JSON.stringify(scene.composition)}`] : []),
    ...(scene.light ? [`Light: ${JSON.stringify(scene.light)}`] : []),
    ...(scene.feeling ? [`Emotional texture: ${JSON.stringify(scene.feeling)}`] : []),
    LENS_BY_FRAMING[scene.framing ?? ''] ?? 'Natural candid framing.',
    VISION_PORTRAIT_COMPOSITION,
    'Focus exclusively on depicting this specific moment and setting. Do NOT combine with or introduce other unrelated activities, settings, or aspirations into this photograph.',
    `Anchor intention (high-level background context): ${JSON.stringify(input.intention)}.`,
    `Category context: ${JSON.stringify(input.category)}. Never replace a concrete described environment with a generic category setting.`,
    ...(input.hasAppearanceReference
      ? ['A user-approved appearance reference is supplied separately. It may inform the person when they naturally appear, but do not force their face into every frame.']
      : ['No appearance reference exists. Never invent a visible protagonist. Strictly prefer first-person POV, over-the-shoulder, partial-body, hands only when useful, or identity-neutral environmental composition.']),
    ...(input.category === 'career' ? ['Career Art Direction: Depict the outcome inside an authentic professional workplace (established office building, corporate floor, workplace workstation, meeting setting, or leadership environment). Avoid generic home-office laptops, coffee cups, or generic WFH imagery.'] : []),
    'Style: documentary / editorial photography, natural available light, realistic muted colour, soft natural contrast, fine grain, small real-world imperfections, believable lived-in spaces. Cinematic composition without movie-poster styling.',
    'Screens, if present at all, are incidental, out of focus and unreadable. No readable text, numbers, words, typography, signs, labels, logos, watermarks or interface elements anywhere.',
    'Avoid: corporate stock-photo look, glossy advertising, HDR, oversaturation, neon, cyberpunk, fantasy, surrealism, mystical symbols, floating objects, generic luxury, posed smiling at camera, duplicated people.',
  ].join('\n');
}
