import type { AnchorCategory } from '@/types';

const CATEGORY_KEYWORDS: Record<AnchorCategory, string[]> = {
  desire: [
    'want', 'need', 'wish', 'hope', 'desire', 'crave', 'seek', 'strive',
    'intent', 'longing', 'manifest', 'reach', 'attain', 'get', 'receive',
    'possess', 'have', 'claim', 'demand', 'ask', 'prayer', 'will', 'power',
    'command', 'attract', 'attraction', 'pleasure', 'satisfaction', 'fulfillment',
    'passion', 'aspiration', 'goal', 'target', 'dream', 'ambition',
  ],
  health: [
    'health', 'fit', 'fitness', 'exercise', 'run', 'gym', 'workout', 'sleep',
    'diet', 'eat', 'eating', 'body', 'weight', 'strength', 'energy', 'breath',
    'breathing', 'meditate', 'meditation', 'heal', 'recover', 'recovery',
    'injury', 'pain', 'stress', 'anxiety', 'mind', 'mental', 'calm', 'relax',
    'rest', 'yoga', 'move', 'sport', 'train', 'training', 'athletic', 'stamina',
    'sober', 'clean', 'quit', 'smoking', 'alcohol', 'habit', 'wellness',
    'nutrition', 'hydrate', 'immune', 'doctor', 'therapy', 'healthy',
    'vitality', 'longevity', 'stamina', 'endurance', 'flexible', 'mobility',
    'posture', 'spine', 'muscle', 'bone', 'skin', 'nap',
    'restorative', 'organic', 'whole', 'supplement', 'vitamin', 'mineral',
    'detox', 'cleanse', 'fasting', 'hydration', 'cardio', 'lifting', 'cycle',
    'swim', 'walk', 'hike', 'climb', 'dance', 'active', 'rehab', 'physio',
    'recovery', 'vitality', 'rejuvenate', 'refresh',
  ],
  career: [
    'work', 'job', 'boss', 'promotion', 'business', 'career', 'professional',
    'office', 'deadline', 'meeting', 'project', 'salary', 'leadership',
    'success', 'succeed', 'hustle', 'entrepreneur', 'startup', 'client',
    'team', 'interview', 'hired', 'skill', 'craft', 'launch', 'company',
    'employee', 'manager', 'productive', 'productivity', 'focused', 'deliver',
    'performance', 'presentation', 'task', 'goal', 'achieve', 'ambition',
    'brand', 'network', 'collaborate', 'strategy', 'execute', 'discipline',
    'corporate', 'vocation', 'calling', 'industry', 'market', 'commerce',
    'trade', 'occupation', 'employment', 'worker', 'colleague', 'partner',
    'executive', 'director', 'founder', 'visionary', 'expert', 'specialist',
    'consultant', 'freelance', 'contract', 'agency', 'enterprise', 'operation',
    'revenue', 'profit', 'growth', 'scale', 'impact', 'influence', 'authority',
    'legacy', 'mastery', 'craftsman', 'artisan', 'portfolio', 'resume',
    'curriculum', 'tenure', 'retirement', 'pivot', 'shift', 'income', 'earning',
    'bonus', 'path', 'climb', 'venture', 'ceo', 'workflow', 'system', 'process',
    'efficient', 'optimization', 'professional', 'success', 'accomplish',
    // Public life and leadership are a calling, not a hobby.
    'president', 'presidency', 'elected', 'election', 'campaign', 'candidate',
    'politics', 'political', 'politician', 'senator', 'senate', 'congress',
    'congressman', 'congresswoman', 'governor', 'mayor', 'parliament', 'minister',
    'councillor', 'councilor', 'leader', 'users', 'customers', 'hire',
  ],
  relationships: [
    'relationship', 'friend', 'friends', 'love', 'partner', 'spouse',
    'wife', 'husband', 'date', 'dating', 'social', 'connect', 'people',
    'community', 'bond', 'trust', 'communicate', 'communication', 'listen',
    'listening', 'marriage', 'kids', 'children', 'romantic', 'intimacy',
    'lonely', 'loneliness', 'together', 'support', 'understand', 'compassion',
    'empathy', 'forgive', 'forgiveness', 'kindness', 'connection', 'open',
    'harmony', 'peace', 'resolve', 'conflict', 'vulnerable', 'honesty',
    'sincerity', 'loyalty', 'devotion', 'affection', 'caring', 'nurture',
    // Roles such as mentor, coach, and student are ambiguous on their own.
    // Keep relationship classification driven by the relationship itself,
    // not by the person mentioned in the intention.
    'neighbor', 'tribe',
    'gathering', 'celebration', 'reunion', 'belonging', 'acceptance',
    'inclusion', 'unity', 'solidarity', 'alliance', 'contribution',
    'altruism', 'service', 'helpful', 'kind', 'generous', 'loving', 'warmth',
    'seen', 'heard', 'valued', 'respected', 'admired', 'liked', 'intimate',
  ],
  creativity: [
    'art', 'creativity', 'creative', 'create', 'creation', 'express',
    'expression', 'artistic', 'painting', 'drawing', 'sketch', 'design',
    'music', 'write', 'writing', 'poet', 'poetry', 'story', 'novel',
    'craft', 'craftsman', 'maker', 'build', 'sculpt', 'sculpture', 'photography',
    'dance', 'performance', 'theater', 'acting', 'perform', 'inspiration',
    'inspired', 'imagine', 'imagination', 'innovate', 'innovation', 'unique',
    'original', 'style', 'aesthetic', 'beauty', 'voice', 'authenticity',
    'authentic', 'muse', 'artisan', 'gallery', 'exhibition', 'publish',
    'collaborate', 'project', 'portfolio', 'masterpiece', 'opus', 'canvas',
    'brush', 'palette', 'color', 'vibrant', 'dynamic', 'alive', 'flow',
  ],
  spirituality: [
    'spiritual', 'spirituality', 'meditation', 'meditate', 'mindfulness',
    'mindful', 'sacred', 'sacred', 'consciousness', 'awakening', 'awake',
    'enlightenment', 'enlightened', 'purpose', 'meaning', 'soul', 'spirit',
    'inner', 'awareness', 'presence', 'present', 'moment', 'zen', 'tao',
    'yoga', 'prayer', 'ritual', 'practice', 'wisdom', 'truth', 'authentic',
    'transcend', 'transcendence', 'peace', 'serenity', 'calm', 'balance',
    'harmony', 'flow', 'grace', 'divine', 'cosmic', 'universal', 'infinite',
    'eternal', 'timeless', 'sage', 'philosopher', 'contemplation', 'reflect',
    'reflection', 'introspection', 'chakra', 'energy', 'vibration', 'frequency',
    'mindset', 'perspective', 'philosophy', 'ethics', 'values', 'character',
  ],
  abundance: [
    'money', 'wealth', 'financial', 'afford', 'debt', 'save', 'saving',
    'invest', 'investing', 'investment', 'rich', 'income', 'revenue', 'profit',
    'spend', 'budget', 'bills', 'cash', 'finance', 'abundance', 'prosperity',
    'earn', 'earning', 'dollar', 'fund', 'tax', 'expense', 'retire',
    'retirement', 'asset', 'passive', 'stocks', 'crypto', 'bank', 'loan',
    'mortgage', 'salary', 'raise', 'bonus', 'sell', 'selling', 'purchase',
    'capital', 'equity', 'portfolio', 'dividend', 'interest', 'realestate',
    'property', 'land', 'commerce', 'market', 'trading', 'wallet', 'savings',
    'emergency', 'safe', 'secure', 'freedom', 'liberty', 'legacy', 'estate',
    'inheritance', 'trust', 'charity', 'giving', 'generosity', 'richness',
    'opulence', 'luxury', 'value', 'worth', 'networth', 'growth', 'leverage',
    'prosperity', 'wealthy', 'prosperous', 'aligned', 'flow', 'security',
  ],
  family: [
    'family', 'parents', 'mother', 'father', 'mom', 'dad', 'children',
    'child', 'kid', 'kids', 'sibling', 'brother', 'sister', 'cousin',
    'grandparent', 'grandmother', 'grandfather', 'aunt', 'uncle', 'niece',
    'nephew', 'relative', 'kin', 'kinship', 'home', 'household', 'family',
    'domestic', 'parent', 'child', 'upbringing', 'nurture', 'nurturing',
    'care', 'caring', 'support', 'bonding', 'togetherness', 'belonging',
    'heritage', 'legacy', 'lineage', 'ancestor', 'generational', 'roots',
    'tradition', 'values', 'unity', 'harmony', 'peace', 'foundation',
    'connection', 'bond', 'love', 'affection', 'loyalty', 'devotion',
  ],
  learning: [
    'learn', 'learning', 'study', 'studying', 'education', 'educate',
    'school', 'university', 'college', 'student', 'teacher', 'mentor',
    'coach', 'instruction', 'teach', 'knowledge', 'skill', 'skills',
    'develop', 'development', 'improve', 'growth', 'master', 'mastery',
    'expertise', 'expert', 'discipline', 'practice', 'training', 'train',
    'learn', 'learned', 'course', 'class', 'curriculum', 'subject',
    'topic', 'understanding', 'comprehension', 'intelligence', 'smart',
    'wisdom', 'insight', 'discovery', 'explore', 'exploration', 'curiosity',
    'curious', 'wonder', 'research', 'study', 'academic', 'scholarly',
    'brilliant', 'achievement', 'accomplish', 'proficiency', 'proficient',
    'grade', 'grades', 'exam', 'exams', 'test', 'tests', 'homework', 'gpa',
    'academics', 'scholarship', 'thesis', 'essay', 'quiz',
  ],
  adventure: [
    'adventure', 'travel', 'journey', 'trip', 'explore', 'exploration',
    'discovery', 'discover', 'experience', 'feel', 'moment', 'sensory',
    'event', 'visit', 'witness', 'see', 'hear', 'taste', 'touch', 'alive',
    'world', 'ocean', 'mountain', 'city', 'country', 'nature', 'outdoor',
    'wild', 'wilderness', 'culture', 'music', 'dance', 'performance',
    'memory', 'unforgettable', 'freedom', 'liberty', 'escape', 'break',
    'vacation', 'wanderlust', 'nomad', 'roam', 'roaming', 'expedition',
    'quest', 'exploration', 'quest', 'risk', 'brave', 'courage', 'exciting',
    'thrilling', 'exhilarating', 'adrenaline', 'fun', 'joy', 'delight',
  ],
  custom: [],
};

/**
 * Phrases carry more meaning than isolated words. In particular, a role word
 * like "student" should not outweigh a clear academic intention, and a word
 * like "partner" should only strongly signal relationships when it is used in
 * a relational phrase.
 */
const CATEGORY_PHRASES: Partial<Record<AnchorCategory, Array<[string, number]>>> = {
  // Ambiguous verbs are resolved by what they act on: "run for president" and
  // "run my business" are about a calling, "run a marathon" is about the body.
  career: [
    ['run for', 6],
    ['run my business', 6],
    ['run a business', 6],
    ['run my company', 6],
    ['run a company', 6],
    ['run the company', 6],
    ['for president', 6],
    ['for office', 6],
    ['for mayor', 6],
    ['for congress', 6],
    ['for senate', 6],
    ['get elected', 6],
    ['be elected', 6],
    ['win the election', 6],
    ['public office', 6],
    ['get promoted', 5],
    ['get the job', 5],
    ['land the job', 5],
    ['dream job', 5],
    ['my business', 4],
    ['my company', 4],
    ['my career', 4],
    ['my startup', 4],
    ['my app', 3],
  ],
  health: [
    ['run a marathon', 6],
    ['run a half marathon', 6],
    ['run a 5k', 6],
    ['run a 10k', 6],
    ['go running', 5],
    ['lose weight', 6],
    ['get fit', 6],
    ['get in shape', 6],
    ['sleep better', 5],
    ['eat healthy', 5],
    ['quit smoking', 6],
    ['quit drinking', 6],
    ['stay sober', 6],
  ],
  abundance: [
    ['pay off', 5],
    ['debt free', 6],
    ['financial freedom', 6],
    ['make money', 5],
    ['passive income', 6],
    ['six figures', 6],
    ['seven figures', 6],
    ['net worth', 6],
  ],
  adventure: [
    ['travel to', 5],
    ['travel the world', 6],
    ['see the world', 6],
    ['road trip', 6],
    ['move abroad', 5],
    ['live abroad', 5],
  ],
  creativity: [
    ['write a book', 6],
    ['write my book', 6],
    ['finish my novel', 6],
    ['release an album', 6],
    ['make music', 5],
    ['make art', 5],
  ],
  spirituality: [
    ['inner peace', 6],
    ['find peace', 5],
    ['my faith', 6],
    ['closer to god', 6],
    ['connect with god', 6],
  ],
  family: [
    ['my kids', 6],
    ['my children', 6],
    ['my son', 6],
    ['my daughter', 6],
    ['my parents', 6],
    ['my family', 6],
    ['start a family', 7],
    ['better father', 6],
    ['better mother', 6],
    ['better parent', 6],
    ['better dad', 6],
    ['better mom', 6],
  ],
  learning: [
    ['learn to', 4],
    ['learn a language', 6],
    ['get my degree', 6],
    ['finish my degree', 6],
    ['straight a student', 8],
    ['straight a', 6],
    ['high grades', 6],
    ['good grades', 6],
    ['top grades', 6],
    ['ace my exams', 6],
    ['pass my exams', 5],
    ['gpa', 6],
    ['academic achievement', 6],
    ['study for', 3],
    ['do well in school', 5],
    ['academic success', 5],
  ],
  relationships: [
    ['romantic relationship', 7],
    ['my partner', 6],
    ['my friends', 6],
    ['better communication', 4],
    ['feel connected', 4],
  ],
};

export function detectCategoryFromText(intentionText: string): AnchorCategory {
  const normalizedText = intentionText
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalizedText
    .split(/\s+/)
    .filter(Boolean);

  const scores: Record<AnchorCategory, number> = {
    desire: 0,
    health: 0,
    career: 0,
    relationships: 0,
    creativity: 0,
    spirituality: 0,
    abundance: 0,
    family: 0,
    learning: 0,
    adventure: 0,
    custom: 0,
  };

  for (const word of words) {
    const forms = wordForms(word);
    for (const [category, keywords] of Object.entries(KEYWORD_SETS) as [AnchorCategory, Set<string>][]) {
      if (forms.some(form => keywords.has(form))) {
        // "I want", "I will", "I get" frame almost every intention; they are
        // weak evidence of Desire and must never outvote a specific subject.
        scores[category] += category === 'desire' && DESIRE_FRAMING.has(word) ? 0.25 : 1;
      }
    }
  }

  // Apply phrase evidence after word matching so specific intent wins over
  // generic vocabulary. Phrases are normalized too, so "straight-A" and
  // "straight A" are treated identically.
  for (const [category, phrases] of Object.entries(CATEGORY_PHRASES) as [AnchorCategory, Array<[string, number]>][]) {
    for (const [phrase, weight] of phrases) {
      if (` ${normalizedText} `.includes(` ${phrase} `)) {
        scores[category] += weight;
      }
    }
  }

  // Highest score wins. Ties resolve by a fixed priority where specific
  // subjects come before the catch-all Desire, so the result never depends on
  // object key order. No evidence at all falls back to Desire.
  let best: AnchorCategory = 'desire';
  let bestScore = 0;
  for (const category of TIE_BREAK_ORDER) {
    if (scores[category] > bestScore) {
      bestScore = scores[category];
      best = category;
    }
  }

  return best;
}

const KEYWORD_SETS = Object.fromEntries(
  (Object.entries(CATEGORY_KEYWORDS) as [AnchorCategory, string[]][]).map(([category, keywords]) => [category, new Set(keywords)]),
) as Record<AnchorCategory, Set<string>>;

const DESIRE_FRAMING = new Set(['want', 'need', 'wish', 'hope', 'get', 'have', 'will', 'reach', 'receive', 'ask', 'goal', 'target']);

const TIE_BREAK_ORDER: AnchorCategory[] = [
  'career', 'health', 'abundance', 'relationships', 'family', 'learning',
  'creativity', 'spirituality', 'adventure', 'desire',
];

/** The word plus its obvious inflections: "elections" → "election", "running" → "run". */
function wordForms(word: string): string[] {
  const forms = [word];
  if (word.length > 4 && word.endsWith('ies')) forms.push(`${word.slice(0, -3)}y`);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) forms.push(word.slice(0, -1));
  if (word.length > 5 && word.endsWith('ing')) {
    const stem = word.slice(0, -3);
    forms.push(stem, `${stem}e`);
    if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2]) forms.push(stem.slice(0, -1));
  }
  if (word.length > 4 && word.endsWith('ed')) forms.push(word.slice(0, -2), word.slice(0, -1));
  return forms;
}

const ANCHOR_CATEGORIES: readonly AnchorCategory[] = [
  'desire', 'health', 'career', 'relationships', 'creativity', 'spirituality',
  'abundance', 'family', 'learning', 'adventure', 'custom',
];

/** Older builds and imports stored a few other spellings; they mean these. */
const CATEGORY_ALIASES: Record<string, AnchorCategory> = {
  healing: 'health', wellness: 'health', fitness: 'health',
  work: 'career', business: 'career', professional: 'career',
  love: 'relationships', relationship: 'relationships', romance: 'relationships',
  creative: 'creativity', art: 'creativity',
  spiritual: 'spirituality', faith: 'spirituality',
  wealth: 'abundance', money: 'abundance', finance: 'abundance', financial: 'abundance',
  education: 'learning', growth: 'learning', study: 'learning',
  travel: 'adventure',
  personal: 'custom', other: 'custom',
};

export function isAnchorCategory(value: unknown): value is AnchorCategory {
  return typeof value === 'string' && (ANCHOR_CATEGORIES as readonly string[]).includes(value);
}

/**
 * The single reading of a persisted Anchor category. Surfaces (Vision art,
 * accents, labels) consume this; they never re-classify the intention text.
 * Unknown values resolve to Custom rather than to an accidental guess.
 */
export function resolveAnchorCategory(value: unknown): AnchorCategory {
  if (typeof value !== 'string') return 'custom';
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, '_');
  if (isAnchorCategory(key)) return key;
  const head = key.split('_')[0];
  return CATEGORY_ALIASES[key] ?? (isAnchorCategory(head) ? head : CATEGORY_ALIASES[head]) ?? 'custom';
}
