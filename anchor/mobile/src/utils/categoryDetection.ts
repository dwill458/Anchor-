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
    'posture', 'spine', 'muscle', 'bone', 'skin', 'dream', 'nap',
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
    'mentor', 'guide', 'coach', 'student', 'peer', 'neighbor', 'tribe',
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

export function detectCategoryFromText(intentionText: string): AnchorCategory {
  const words = intentionText
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
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
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [AnchorCategory, string[]][]) {
      if (keywords.includes(word)) {
        scores[category] += 1;
      }
    }
  }

  // Find the highest scoring category (excluding 'custom' which has no keywords)
  let best: AnchorCategory = 'desire'; // Fallback to 'desire' as requested
  let bestScore = 0;
  for (const [category, score] of Object.entries(scores) as [AnchorCategory, number][]) {
    if (category !== 'custom' && score > bestScore) {
      bestScore = score;
      best = category as AnchorCategory;
    }
  }

  return best;
}
