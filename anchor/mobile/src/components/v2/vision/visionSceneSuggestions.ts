/**
 * Contextual shortcuts for the Add Image composer, derived from the person's own goal.
 * A shortcut only fills the description field; it never generates and is never required.
 * When the goal does not clearly point at a theme there are no shortcuts: a generic
 * list would put the same four moments on every Vision.
 */
const THEMES: ReadonlyArray<{ test: RegExp; suggestions: readonly string[] }> = [
  { test: /\b(home|house|apartment|condo|cabin|dream (home|house)|mortgage|backyard|pool)\b/i,
    suggestions: ['Inside my home', 'Getting the keys', 'Family moments', 'Backyard at night'] },
  { test: /\b(run|running|marathon|race|5k|10k|half marathon|triathlon)\b/i,
    suggestions: ['Training at dawn', 'Crossing the finish line', 'Recovering after', 'With my running crew'] },
  { test: /\b(gym|fit|fitness|strong|strength|weight|lift|lifting|train|training|health|healthy)\b/i,
    suggestions: ['A workout I love', 'Meal prep Sunday', 'Feeling strong', 'Rest and recovery'] },
  { test: /\b(business|startup|founder|company|launch|customers?|clients?|revenue|shop|store|brand|agency)\b/i,
    suggestions: ['My workspace', 'Launch day', 'My team together', 'A quiet win'] },
  { test: /\b(book|novel|write|writing|author|album|song|music|paint|painting|art|film|studio)\b/i,
    suggestions: ['Where I make it', 'Finished work in hand', 'Sharing it with people', 'A quiet morning of work'] },
  { test: /\b(travel|abroad|trip|world|country|countries|passport|move to)\b/i,
    suggestions: ['Arriving somewhere new', 'A local morning', 'Dinner with new friends', 'The view I came for'] },
  { test: /\b(debt|savings?|save|money|invest\w*|financial|wealth|retire\w*|freedom)\b/i,
    suggestions: ['The day it is done', 'A calm morning', 'Sharing the news', 'What it makes possible'] },
  { test: /\b(wedding|marry|married|partner|relationship|family|kids?|children|baby|parent\w*)\b/i,
    suggestions: ['An ordinary evening together', 'A celebration', 'Morning at home', 'A moment with the kids'] },
  { test: /\b(teach\w*|teacher|school|student|study|degree|graduat\w*|university|college|learn\w*)\b/i,
    suggestions: ['In the classroom', 'Graduation day', 'Studying somewhere quiet', 'Celebrating with family'] },
  { test: /\b(career|promotion|job|office|lead|leader|leadership|manager|ceo)\b/i,
    suggestions: ['My first day', 'Leading the room', 'After a great meeting', 'Walking out proud'] },
];

export const VISION_SCENE_SUGGESTION_MAX = 4;

/** Up to four shortcuts for this goal, minus any the person has already typed. Empty when the goal gives no clear theme. */
export function visionSceneSuggestions(goal: string, currentText = ''): string[] {
  const text = goal.trim();
  if (!text) return [];
  const theme = THEMES.find(item => item.test.test(text));
  if (!theme) return [];
  const typed = currentText.trim().toLowerCase();
  return theme.suggestions.filter(item => !typed.includes(item.toLowerCase())).slice(0, VISION_SCENE_SUGGESTION_MAX);
}

/** Putting a shortcut into the field: replaces an empty field, otherwise it is added on a new line, never overwriting the person's words. */
export function applySceneSuggestion(current: string, suggestion: string): string {
  const text = current.trim();
  return text ? `${text}\n${suggestion}` : suggestion;
}
