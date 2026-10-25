/**
 * How a Vision generation tells a provider what each attached image is for.
 *
 * Two different things can be attached, and they must not be confused:
 *  - `world`: photographs already in the person's Vision. They establish WHAT THAT WORLD LOOKS LIKE
 *    (the place, the exact objects, wardrobe, light, grade) and are continued, not copied.
 *  - `start`: the person's own photograph of their real world AS IT IS TODAY. The future is shown as this
 *    same place transformed, so its layout, perspective and fixed features are kept and only what the person
 *    described changes.
 *  - `appearance`: who the person is. It informs a visible person's likeness and nothing else.
 */
import type { ImageReference } from './types';

/** World references first (the scene), then who is in it. Order is the numbering the instructions use. */
export function orderVisionReferences(references: ImageReference[] | undefined): ImageReference[] {
  const list = references ?? [];
  return [
    ...list.filter(item => item.role === 'edit_source'),
    ...list.filter(item => item.role === 'start'),
    ...list.filter(item => item.role === 'world'),
    ...list.filter(
      item => item.role !== 'world' && item.role !== 'start' && item.role !== 'edit_source'
    ),
  ];
}

const range = (from: number, to: number) =>
  from === to ? `Image ${from}` : `Images ${from}-${to}`;

/** The instruction block appended to the prompt; `ordered` must be the output of `orderVisionReferences`. */
export function visionReferenceInstructions(
  ordered: ImageReference[],
  operation?: 'CREATE' | 'EDIT' | 'COMPOSE' | 'VARIATE'
): string {
  if (operation) {
    const lines = ordered.map((ref, i) => {
      const title = `Image ${i + 1}`;
      const label = ref.label ? ` User label (data): ${JSON.stringify(ref.label)}.` : '';
      switch (ref.role) {
        case 'edit_source':
          return `${title} is the exact selected source candidate. ${operation === 'EDIT' ? 'Preserve everything except the requested changes.' : 'Preserve the intended subject; allow a new composition.'}`;
        case 'identity':
        case 'appearance':
          return `${title} supplies an explicitly selected person reference. Preserve recognizable likeness when that person appears; do not infer demographic attributes or force a face into the scene.${label}`;
        case 'place':
          return `${title} supplies a selected place. Use its relevant features as the scene requests, without forcing its viewpoint, camera, lighting, or layout onto a new composition.${label}`;
        case 'object':
          return `${title} supplies a selected object. Keep that object's recognizable details; its background and viewpoint are not constraints.${label}`;
        case 'world':
          return `${title} is already part of the person's saved Vision board. Continue recognizable details from it when they are relevant to the described scene, while the scene description controls the setting, action, composition, lighting and camera. Do not force unrelated subjects from this photo into the new scene.${label}`;
        default:
          return `${title} is inspiration for mood, colours, style or lighting only. Do not copy its subjects, geometry or composition unless explicitly requested.${label}`;
      }
    });
    if (operation === 'CREATE' || operation === 'COMPOSE')
      lines.unshift(
        'These attachments are selected inputs for a NEW composition, not an existing scene to preserve.'
      );
    return lines.join('\n');
  }
  const start = ordered.filter(item => item.role === 'start').length;
  const world = ordered.filter(item => item.role === 'world').length;
  const scene = start + world;
  const appearance = ordered.length - scene;
  const lines: string[] = [];
  if (start > 0) {
    lines.push(
      `${range(1, start)} ${start === 1 ? 'is' : 'are'} the person's own photograph of their real world AS IT IS TODAY. ` +
        'The new photograph shows this same place after the change the person describes. Keep its location, layout, architecture, viewpoint and the fixed features and objects the person says stay; ' +
        'change only what the description asks to change, and let the light and feeling follow the description. ' +
        'It must still read as the same real place, not a different one. Do not add text, watermarks or a before/after split.'
    );
  }
  if (world > 0) {
    lines.push(
      `${range(start + 1, scene)} ${world === 1 ? 'is a photograph' : 'are photographs'} the person added to their Vision themselves. ` +
        'Use them ONLY as continuity for specific subjects this scene actually mentions or needs: a particular vehicle, home, object, pet or person, with their exact colours, trim and details (a specific car stays that car). ' +
        'They are NOT the setting for this scene. The scene description alone decides the location, room, environment, action, composition, light and camera; ' +
        'if it names a different place, show that place and leave everything else from these photographs out. ' +
        'Never copy a reference composition, viewpoint, crop or background.'
    );
  }
  if (appearance > 0) {
    lines.push(
      `${range(scene + 1, scene + appearance)} ${appearance === 1 ? 'is' : 'are'} the person's approved appearance reference. Use ${appearance === 1 ? 'it' : 'them'} only when the person is visibly represented; ` +
        'preserve broad likeness without naming or inferring demographic attributes. Do not force a face into the composition. ' +
        'An appearance reference does not describe the world: take the setting only from the scene description and the start photograph.'
    );
  } else {
    lines.push(
      'No appearance reference was supplied. Do not imply an invented protagonist is the user; prefer first-person, identity-neutral, obscured, or environmental composition when a person would otherwise be central.'
    );
  }
  return lines.join('\n');
}
