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

const INTENTION_EXAMPLES: Array<{ test: RegExp; example: string }> = [
  {
    // Before the fitness rule: "run for office" is not about running.
    test: /\b(president|election|elected|campaign|public office|senate|senator|congress|mayor|governor|parliament|politic\w*|leader|leadership)\b/i,
    example: 'I walk onto a small stage in a packed community hall and the room goes quiet. I speak without notes, people are nodding, and afterwards a line forms of people who want to help.',
  },
  {
    test: /\b(users?|customers?|subscribers?|clients?|app|launch|startup|business|revenue|product|company|sales)\b/i,
    example: 'I open my laptop in my home office and see the number I’ve been working toward. Messages from people using what I built are coming in, and I’m spending the whole day on work I chose.',
  },
  {
    test: /\b(run|running|marathon|race|weight|fit|fitness|strong|strength|gym|train|training|sleep|energy|healthy)\b/i,
    example: 'I wake before my alarm feeling rested, lace up my shoes and run the loop by the river without stopping. My body feels strong and I still have energy for everything after.',
  },
  {
    test: /\b(write|writing|book|novel|paint|painting|music|album|song|art|artist|design|film|photograph)/i,
    example: 'I sit at my desk in the morning light with the finished draft beside me. I’m starting the next piece because I want to, and people are reading what I made.',
  },
  {
    test: /\b(home|house|apartment|move|moving|city|country|travel|abroad)\b/i,
    example: 'I unlock the door to my own place and the light comes in through big windows. My things are where I want them, it’s quiet, and I finally feel settled here.',
  },
  {
    test: /\b(partner|love|marriage|married|relationship|friends?|family|kids?|children|parent)\b/i,
    example: 'We’re around the kitchen table on a slow Sunday morning, laughing about something small. I’m present, unhurried, and there’s nowhere else I’d rather be.',
  },
  {
    test: /\b(debt|money|save|saving|savings|income|financial|wealth|salary|earn)\b/i,
    example: 'I check my account on a Friday morning and there’s more than enough. The bills are paid, I’m choosing what comes next, and money isn’t on my mind.',
  },
  {
    test: /\b(learn|learning|study|degree|exam|language|course|school|skill)\b/i,
    example: 'I’m in a café, speaking easily with the person beside me in the language I studied. I understand the jokes, I don’t translate in my head, and it feels natural.',
  },
];

const CATEGORY_EXAMPLES: Record<string, string> = {
  career: 'I walk through the glass doors of the office building onto the floor where my team works. The leadership meeting is set, my workstation overlooks the city skyline, and the position I worked for is finally mine.',
  health: 'I wake up rested, move my body before breakfast and feel strong doing it. Food, sleep and energy are steady, and I trust myself to keep going.',
  relationships: 'I’m sitting across from someone I love, fully present. We talk easily, nothing is left unsaid, and I feel safe and close.',
  creativity: 'I’m in my own studio space with the finished work in front of me. I make something every day, and it feels like mine.',
  spirituality: 'I start the morning in quiet, before the phone. My mind is still, I move through the day with patience, and I come back to myself easily.',
  abundance: 'I open my finances without a knot in my stomach. There’s enough, I’m generous without worry, and my choices feel free.',
  family: 'The house is full on an ordinary evening. Everyone’s talking over dinner, I’m relaxed, and home feels like the calmest place I know.',
  learning: 'I can do the thing I set out to learn without thinking about it. People ask me for help with it, and I enjoy explaining.',
  adventure: 'I step out of a small station in a place I’ve never been, with one bag and no rush. I have time, I feel capable, and the day is open.',
  focus: 'I sit down to one important thing and stay with it until it’s done. The phone is away, the room is quiet and my attention is steady.',
  desire: 'It’s an ordinary Tuesday morning and I’m standing in my kitchen with coffee, already living it. I can see it in the room around me, and the thing I used to want is simply part of my day.',
  custom: 'I’m standing somewhere specific on the day this is true: I can name the room, the light and what I’m holding. What I notice most is what’s no longer missing.',
};

/**
 * A worked example chosen for this Anchor. Keyword rules read the intention
 * first (so "ten thousand users" gets a product example rather than a generic
 * career one); the category is the fallback. Always an example, never text
 * that is inserted into the person's description.
 */
export function visionDescriptionExample(intention?: string | null, category?: string | null): string {
  const text = intention ?? '';
  const matched = INTENTION_EXAMPLES.find(rule => rule.test.test(text));
  if (matched) return matched.example;
  return CATEGORY_EXAMPLES[resolveAnchorCategory(category)] ?? CATEGORY_EXAMPLES.custom;
}
