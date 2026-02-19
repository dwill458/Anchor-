import type { AnchorCategory } from '@/types';

const CATEGORY_KEYWORDS: Record<AnchorCategory, string[]> = {
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
    'curriculum', 'tenure', 'retirement', 'redundancy', 'pivot', 'shift',
    'income', 'earning', 'bonus', 'career', 'path', 'climb', 'corporate',
    'startup', 'venture', 'founder', 'ceo', 'manager', 'lead', 'leadership',
    'productivity', 'workflow', 'system', 'process', 'efficient', 'optimization',
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
    'posture', 'spine', 'muscle', 'bone', 'skin', 'sleep', 'dream', 'nap',
    'restorative', 'organic', 'whole', 'supplement', 'vitamin', 'mineral',
    'detox', 'cleanse', 'fasting', 'hydration', 'cardio', 'lifting', 'cycle',
    'swim', 'walk', 'hike', 'climb', 'dance', 'active', 'rehab', 'physio',
    'mindfulness', 'peace', 'quiet', 'serenity', 'balance', 'equilibrium',
  ],
  wealth: [
    'money', 'wealth', 'financial', 'afford', 'debt', 'save', 'saving',
    'invest', 'investing', 'investment', 'rich', 'income', 'revenue', 'profit',
    'spend', 'budget', 'bills', 'cash', 'finance', 'abundance', 'prosperity',
    'earn', 'earning', 'dollar', 'fund', 'tax', 'expense', 'retire',
    'retirement', 'asset', 'passive', 'stocks', 'crypto', 'bank', 'loan',
    'mortgage', 'salary', 'raise', 'bonus', 'sell', 'selling', 'purchase',
    'capital', 'equity', 'portfolio', 'dividend', 'interest', 'realestate',
    'property', 'land', 'commerce', 'market', 'trading', 'crypto', 'bitcoin',
    'ethereum', 'wallet', 'savings', 'emergency', 'safe', 'secure', 'freedom',
    'liberty', 'legacy', 'estate', 'inheritance', 'trust', 'donor', 'charity',
    'giving', 'generosity', 'richness', 'opulence', 'luxury', 'quality',
    'value', 'worth', 'networth', 'growth', 'compounding', 'leverage', 'smart',
    'abundance', 'prosperity', 'richness', 'luxury', 'freedom', 'independence',
    'security', 'safety', 'future', 'legacy', 'estate', 'inheritance',
    'millionaire', 'billionaire', 'wealthy', 'prosperous', 'aligned', 'flow',
  ],
  relationships: [
    'relationship', 'family', 'friend', 'friends', 'love', 'partner',
    'spouse', 'wife', 'husband', 'date', 'dating', 'social', 'connect',
    'people', 'community', 'bond', 'trust', 'communicate', 'communication',
    'listen', 'listening', 'marriage', 'kids', 'children', 'parents',
    'sibling', 'brother', 'sister', 'romantic', 'intimacy', 'lonely',
    'loneliness', 'together', 'support', 'understand', 'compassion',
    'empathy', 'forgive', 'forgiveness', 'kindness', 'connection', 'open',
    'harmony', 'peace', 'resolve', 'conflict', 'vulnerable', 'honesty',
    'sincerity', 'loyalty', 'devotion', 'affection', 'caring', 'nurture',
    'mentor', 'guide', 'coach', 'student', 'peer', 'colleague', 'neighbor',
    'stranger', 'crowd', 'tribe', 'gathering', 'festival', 'celebration',
    'wedding', 'reunion', 'belonging', 'acceptance', 'inclusion', 'unity',
    'solidarity', 'partnership', 'alliance', 'network', 'contribution',
    'altruism', 'service', 'helpful', 'kind', 'generous', 'loving', 'warmth',
    'belong', 'seen', 'heard', 'valued', 'respected', 'admired', 'liked',
  ],
  personal_growth: [
    'grow', 'growth', 'better', 'improve', 'improving', 'become', 'learn',
    'learning', 'develop', 'development', 'change', 'transform',
    'transformation', 'discipline', 'mindset', 'self', 'confidence',
    'confident', 'courage', 'courageous', 'fear', 'overcome', 'potential',
    'purpose', 'dream', 'vision', 'mindful', 'mindfulness', 'awareness',
    'reflect', 'reflection', 'journey', 'soul', 'spirit', 'spiritual',
    'practice', 'wisdom', 'truth', 'honest', 'authenticity', 'authentic',
    'presence', 'present', 'accept', 'acceptance', 'grateful', 'gratitude',
    'patient', 'patience', 'resilience', 'resilient', 'strong', 'stronger',
    'evolve', 'awakening', 'enlightenment', 'curiosity', 'wonder', 'magic',
    'creativity', 'art', 'expression', 'voice', 'identity', 'motive',
    'intention', 'focus', 'clarity', 'purity', 'zen', 'tao', 'stoic',
    'philosophy', 'ethics', 'values', 'character', 'integrity', 'honor',
    'dignity', 'respect', 'humility', 'ego', 'transcend', 'meditate',
    'prayer', 'ritual', 'sacred', 'infinite', 'eternal', 'now', 'flow',
  ],
  desire: [
    'want', 'need', 'wish', 'hope', 'desire', 'crave', 'seek', 'strive',
    'intent', 'longing', 'manifest', 'reach', 'attain', 'get', 'receive',
    'possess', 'have', 'claim', 'demand', 'ask', 'prayer', 'will', 'power',
    'command', 'attract', 'attraction', 'pleasure', 'satisfaction', 'fulfillment',
  ],
  experience: [
    'experience', 'travel', 'feel', 'adventure', 'journey', 'moment',
    'sensory', 'trip', 'event', 'visit', 'exploration', 'discovery',
    'witness', 'see', 'hear', 'taste', 'touch', 'alive', 'world',
    'ocean', 'mountain', 'city', 'country', 'nature', 'outdoor', 'wild',
    'culture', 'art', 'music', 'dance', 'performance', 'memory',
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
    career: 0,
    health: 0,
    wealth: 0,
    relationships: 0,
    personal_growth: 0,
    desire: 0,
    experience: 0,
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
