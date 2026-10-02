/**
 * Teaching for the Vision description: better description -> better Vision.
 * This is guidance, not a score. It never blocks generation; the only hard
 * rule remains the backend's 12-2000 character validation.
 */
import { resolveAnchorCategory } from '@/utils/categoryDetection';

export const VISION_DESCRIPTION_MIN_CHARS = 12;
export const VISION_DESCRIPTION_MAX_CHARS = 2000;
export const VISION_DETAIL_BUILDING_WORDS = 25;
export const VISION_DETAIL_RICH_WORDS = 50;

export const VISION_DESCRIPTION_PROMPTS = [
  { key: 'where', label: 'Where you are', hint: 'home, a studio, a city, outside' },
  { key: 'doing', label: 'What you’re doing', hint: 'working, training, making, resting' },
  { key: 'see', label: 'What you can see', hint: 'the space, the people, the details' },
  { key: 'different', label: 'What’s different', hint: 'freedom, pace, impact, how it feels' },
] as const;

export function countVisionWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export type VisionDetailLevel = 'empty' | 'short' | 'building' | 'rich';

export function visionDetailLevel(text: string): VisionDetailLevel {
  const words = countVisionWords(text);
  if (words === 0) return 'empty';
  if (words < VISION_DETAIL_BUILDING_WORDS) return 'short';
  if (words < VISION_DETAIL_RICH_WORDS) return 'building';
  return 'rich';
}

/** "23 words · Add a little more detail for stronger images" */
export function visionDetailHint(text: string): string | null {
  const words = countVisionWords(text);
  const level = visionDetailLevel(text);
  if (level === 'empty') return null;
  const count = `${words} ${words === 1 ? 'word' : 'words'}`;
  if (level === 'short') return `${count} · Add a little more detail for stronger images`;
  if (level === 'building') return `${count} · Good · Add what’s different to make it yours`;
  return `${count} · Great detail`;
}

/** What a lived moment of this kind tends to contain; woven around the person's own words, never inserted. */
type Seed = { place: string; doing: string; feel: string; whereHint: string; doingHint: string; feelHint: string };

const seed = (place: string, doing: string, feel: string, whereHint: string, doingHint: string, feelHint: string): Seed =>
  ({ place, doing, feel, whereHint, doingHint, feelHint });

const INTENTION_SEEDS: Array<{ test: RegExp; seed: Seed }> = [
  {
    // Before the fitness rule: "run for office" is not about running.
    test: /\b(president|election|elected|campaign|public office|senate|senator|congress|mayor|governor|parliament|politic\w*|leader|leadership)\b/i,
    seed: seed('standing in front of a packed room', 'speaking without notes while people lean in', 'steady, listened to, and clear about why I’m here',
      'A stage, a hall, a street corner?', 'Speaking, listening, shaking hands?', 'Steady? Humbled? Certain?'),
  },
  {
    test: /\b(owner|own|owns|owning|founder|founded|co-?found\w*|ceo|my (own )?(shop|store|brand|studio|restaurant|salon|label|company|business|agency|firm))\b/i,
    seed: seed('walking through the place I built', 'watching people use and enjoy something that used to exist only in my head', 'proud, a little amazed, and completely at home',
      'The space itself: a storefront, a studio, an office, a floor?', 'Walking the space, greeting people, checking the details you built?', 'Pride? Calm? Disbelief that it’s yours?'),
  },
  {
    test: /\b(users?|customers?|subscribers?|clients?|app|launch|startup|business|revenue|product|company|sales)\b/i,
    seed: seed('at my desk', 'watching the numbers and the messages from people who use what I built', 'focused, grateful, and spending the day on work I chose',
      'Your desk, a studio, a coffee shop, a launch party?', 'Reading messages, checking the numbers, telling someone the news?', 'Relief? Pride? Quiet excitement?'),
  },
  {
    test: /\b(run|running|marathon|race|weight|fit|fitness|strong|strength|gym|train|training|sleep|energy|healthy)\b/i,
    seed: seed('outside in the early light', 'moving without holding back', 'strong, light, and full of energy',
      'A trail, a track, a gym, your own street?', 'Moving, lifting, finishing, resting?', 'Strong? Light? How does your breathing feel?'),
  },
  {
    test: /\b(write|writing|book|novel|paint|painting|music|album|song|art|artist|design|film|photograph)/i,
    seed: seed('in my workspace with the finished work beside me', 'making the next piece because I want to', 'absorbed, proud, and unhurried',
      'A desk, a studio, a stage, a gallery?', 'Making, sharing, signing, listening to people react?', 'Absorbed? Proud? Quietly thrilled?'),
  },
  {
    test: /\b(home|house|apartment|move|moving|city|country|travel|abroad)\b/i,
    seed: seed('inside my own place with light coming through the windows', 'putting my things exactly where I want them', 'settled, quiet, and at home',
      'Which room, which view, which street outside?', 'Unlocking the door, unpacking, opening the windows?', 'Settled? Relieved? Excited?'),
  },
  {
    test: /\b(partner|love|marriage|married|relationship|friends?|family|kids?|children|parent)\b/i,
    seed: seed('with the people I love', 'fully present with them', 'close, unhurried, and safe',
      'Which room or place are you sharing?', 'Talking, laughing, cooking, simply sitting together?', 'Close? Safe? Light?'),
  },
  {
    test: /\b(debt|money|save|saving|savings|income|financial|wealth|salary|earn)\b/i,
    seed: seed('at my kitchen table', 'looking at an account where there’s more than enough', 'free, generous, and calm',
      'Where do you check it: a desk, a phone on the couch, a bank?', 'Checking, paying, giving, choosing what’s next?', 'Relief? Freedom? Calm?'),
  },
  {
    test: /\b(learn|learning|study|degree|exam|language|course|school|skill)\b/i,
    seed: seed('in the middle of a real conversation', 'using what I learned without translating in my head', 'capable and natural',
      'A classroom, a café, a job, another country?', 'Speaking, solving, explaining, being asked for help?', 'Capable? Easy? Proud?'),
  },
];

const CATEGORY_SEEDS: Record<string, Seed> = {
  career: seed('on the floor where my team works', 'leading the work I earned the right to lead', 'capable, respected, and certain',
    'The office, the site, the meeting room, the view?', 'Leading, deciding, presenting, building?', 'Respected? Certain? Calm?'),
  health: seed('moving my body in the morning', 'treating food, sleep and movement as steady habits', 'strong, rested, and trusting myself',
    'Where does your body feel best?', 'Moving, resting, cooking, stretching?', 'Strong? Rested? Steady?'),
  relationships: seed('across from someone I love', 'talking easily with nothing left unsaid', 'safe and close',
    'Where are the two of you?', 'Talking, listening, laughing, sharing silence?', 'Safe? Seen? Close?'),
  creativity: seed('in my own creative space', 'making something that feels like mine', 'absorbed and free',
    'A desk, a studio, a stage?', 'Making, finishing, sharing?', 'Absorbed? Free? Proud?'),
  spirituality: seed('in the quiet before the day begins', 'letting my mind settle', 'still, patient, and at home in myself',
    'A room, a path, a place of stillness?', 'Sitting, breathing, walking, listening?', 'Still? Patient? Held?'),
  abundance: seed('looking at my life with nothing missing', 'making choices from enough rather than fear', 'free and generous',
    'Where does this abundance show up?', 'Choosing, giving, saying yes, saying no?', 'Free? Generous? Calm?'),
  family: seed('in the middle of an ordinary full evening at home', 'sharing a meal with everyone at the table', 'relaxed and grateful',
    'Which room, which table, which window?', 'Cooking, talking, laughing, listening?', 'Relaxed? Grateful? Home?'),
  learning: seed('using the skill I set out to learn', 'doing it without thinking about it', 'capable and curious',
    'Where does the skill show up?', 'Practising, teaching, solving something real?', 'Capable? Curious? Proud?'),
  adventure: seed('in a place I’ve never been', 'taking it in with no rush', 'capable and wide open',
    'Which place, which light, which season?', 'Walking, climbing, arriving, looking around?', 'Awake? Capable? Free?'),
  focus: seed('sitting down to the one thing that matters', 'staying with it until it’s done', 'clear and steady',
    'The room, the desk, the quiet around you?', 'Working, finishing, switching nothing off?', 'Clear? Steady? Unhurried?'),
  desire: seed('inside the moment it became real', 'looking at what I wanted, now part of my day', 'quietly certain that this is mine',
    'Where does this happen: a room, a place, a screen?', 'Looking, holding, telling someone, simply being there?', 'Certain? Amazed? Calm?'),
  custom: seed('somewhere specific on the day this is true', 'noticing what’s no longer missing', 'settled and certain',
    'Which room, which light, which place?', 'What are your hands doing?', 'What’s different in you?'),
};

function seedFor(intention?: string | null, category?: string | null): Seed {
  const matched = INTENTION_SEEDS.find(rule => rule.test.test(intention ?? ''));
  if (matched) return matched.seed;
  return CATEGORY_SEEDS[resolveAnchorCategory(category)] ?? CATEGORY_SEEDS.custom;
}

/** The person's own words as a sentence: no trailing punctuation, capitalised. */
function intentionSentence(intention?: string | null): string {
  const clean = (intention ?? '').replace(/\s+/g, ' ').trim().replace(/[.!?…]+$/, '');
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : '';
}

function shortIntention(intention?: string | null, max = 56): string {
  const clean = intentionSentence(intention);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

/**
 * A worked example written around this Anchor's own intention. The seed (keyword
 * rules over the intention, then the category) only supplies a plausible setting;
 * the intention itself is quoted, so the example always concerns what the person
 * actually wrote. It is placeholder guidance, never text inserted into the
 * description.
 */
export function visionDescriptionExample(intention?: string | null, category?: string | null): string {
  const picked = seedFor(intention, category);
  const lead = intentionSentence(intention);
  const opening = lead ? `It’s real now: ${lead}. ` : '';
  return `${opening}I’m ${picked.place}, ${picked.doing}…`;
}

export type VisionCueKey = 'where' | 'doing' | 'feel';

/**
 * The question a helper chip asks. Tapping a chip shows this and nothing more:
 * the person writes the answer, so the description is never edited for them.
 */
export function visionCueGuidance(key: VisionCueKey, intention?: string | null, category?: string | null): { question: string; hint: string } {
  const picked = seedFor(intention, category);
  const short = shortIntention(intention);
  const subject = short ? `“${short}”` : 'this';
  if (key === 'where') return { question: `Where are you when ${subject} is already true?`, hint: picked.whereHint };
  if (key === 'doing') return { question: 'What are you doing in the moment you realize it?', hint: picked.doingHint };
  return { question: `What do you notice, and how does it feel to have ${subject}?`, hint: picked.feelHint };
}
