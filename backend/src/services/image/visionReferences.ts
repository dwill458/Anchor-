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
    ...list.filter(item => item.role === 'start'),
    ...list.filter(item => item.role === 'world'),
    ...list.filter(item => item.role !== 'world' && item.role !== 'start'),
  ];
}

const range = (from: number, to: number) => (from === to ? `Image ${from}` : `Images ${from}-${to}`);

/** The instruction block appended to the prompt; `ordered` must be the output of `orderVisionReferences`. */
export function visionReferenceInstructions(ordered: ImageReference[]): string {
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
        'It must still read as the same real place, not a different one. Do not add text, watermarks or a before/after split.',
    );
  }
  if (world > 0) {
    lines.push(
      `${range(start + 1, scene)} ${world === 1 ? 'is a photograph' : 'are photographs'} ALREADY in this person's Vision: the established world of their future. ` +
        'This new photograph is another moment from the SAME life, taken in the same world. Keep what those photographs establish whenever it is relevant to this moment: ' +
        'the exact vehicle, objects and their colours, trim and details; the place, architecture and surroundings; wardrobe; time of day, light and colour grade; the mood. ' +
        'Do not swap an established object for a different one (a specific car stays that car). ' +
        'Do not copy a reference composition, viewpoint or crop: show a clearly different moment, as a new photograph from the same place and life. ' +
        'Where this moment asks for something the references do not show, invent it so that it fits their world.',
    );
  }
  if (appearance > 0) {
    lines.push(
      `${range(scene + 1, scene + appearance)} ${appearance === 1 ? 'is' : 'are'} the person's approved appearance reference. Use ${appearance === 1 ? 'it' : 'them'} only when the person is visibly represented; ` +
        'preserve broad likeness without naming or inferring demographic attributes. Do not force a face into the composition. ' +
        'An appearance reference does not describe the world: take the world only from the Vision and start photographs.',
    );
  } else {
    lines.push(
      'No appearance reference was supplied. Do not imply an invented protagonist is the user; prefer first-person, identity-neutral, obscured, or environmental composition when a person would otherwise be central.',
    );
  }
  return lines.join('\n');
}
