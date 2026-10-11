import type { AnchorCategory } from '@/types';

export const CATEGORY_KEYWORDS: Record<AnchorCategory, string[]> = {
  // Desire is the default fallback when no specific category reaches the confidence margin
  // or when top specific categories tie. Goal-framing verbs ("want", "need", "wish", "get",
  // "have", "will") are intentionally excluded so framing never competes with subject words.
  desire: [],
  health: [
    'health', 'healthy', 'healthier', 'healthiest',
    'fit', 'fitter', 'fittest', 'fitness',
    'exercise', 'exercises', 'exercising', 'exercised',
    'run', 'runs', 'running', 'ran', 'runner', 'runners', 'marathon', 'marathons',
    'gym', 'gyms', 'workout', 'workouts',
    'sleep', 'sleeps', 'sleeping', 'slept', 'nap', 'naps', 'napping',
    'rest', 'rests', 'resting', 'rested', 'restful', 'restorative',
    'diet', 'diets', 'dieting', 'eat', 'eats', 'eating', 'ate',
    'nourish', 'nourishes', 'nourishing', 'nourished', 'nutrition', 'nutritious',
    'body', 'bodies', 'weight', 'weights',
    'strength', 'strong', 'stronger', 'strongest', 'strengthen', 'strengthening',
    'energy', 'energized', 'energizing', 'energetic',
    'breath', 'breaths', 'breathe', 'breathes', 'breathing', 'breathed',
    'heal', 'heals', 'healing', 'healed', 'recover', 'recovers', 'recovering', 'recovered', 'recovery',
    'injury', 'injuries', 'injured', 'pain', 'pains', 'painful',
    'stress', 'stresses', 'stressed', 'stressful', 'anxiety', 'anxious',
    'mind', 'minds', 'mental', 'calm', 'calmer', 'calmest', 'calming', 'calmed',
    'relax', 'relaxes', 'relaxing', 'relaxed', 'relaxation',
    'yoga', 'move', 'moves', 'moving', 'moved', 'movement',
    'sport', 'sports', 'train', 'trains', 'training', 'trained', 'athletic', 'athlete', 'athletes',
    'stamina', 'endurance', 'flexible', 'flexibility', 'mobility',
    'sober', 'sobriety', 'clean', 'cleaner', 'quit', 'quits', 'quitting',
    'smoke', 'smokes', 'smoking', 'alcohol', 'drinking', 'habit', 'habits', 'wellness',
    'hydrate', 'hydrates', 'hydrating', 'hydrated', 'hydration',
    'immune', 'immunity', 'doctor', 'doctors', 'therapy', 'therapist', 'therapists',
    'vitality', 'longevity', 'posture', 'spine', 'muscle', 'muscles', 'bone', 'bones', 'skin',
    'organic', 'whole', 'supplement', 'supplements', 'vitamin', 'vitamins', 'mineral', 'minerals',
    'detox', 'cleanse', 'cleansing', 'fasting', 'cardio',
    'lift', 'lifts', 'lifting', 'lifted', 'cycle', 'cycles', 'cycling',
    'swim', 'swims', 'swimming', 'walk', 'walks', 'walking', 'walked',
    'hike', 'hikes', 'hiking', 'hiked', 'climb', 'climbs', 'climbing', 'climbed',
    'active', 'rehab', 'physio', 'rejuvenate', 'rejuvenating', 'refresh', 'refreshed', 'refreshing',
  ],
  career: [
    'work', 'works', 'working', 'worked', 'worker', 'workers', 'workplace',
    'job', 'jobs', 'boss', 'bosses',
    'promote', 'promotes', 'promoted', 'promoting', 'promotion', 'promotions',
    'business', 'businesses', 'career', 'careers', 'professional', 'professionals', 'profession',
    'office', 'offices', 'deadline', 'deadlines', 'meeting', 'meetings', 'project', 'projects',
    'lead', 'leads', 'leading', 'led', 'leader', 'leaders', 'leadership',
    'success', 'succeed', 'succeeds', 'succeeding', 'succeeded', 'successful',
    'hustle', 'hustling', 'entrepreneur', 'entrepreneurs', 'entrepreneurship',
    'startup', 'startups', 'client', 'clients',
    'team', 'teams', 'interview', 'interviews', 'interviewing',
    'hire', 'hires', 'hired', 'hiring',
    'launch', 'launches', 'launching', 'launched', 'company', 'companies',
    'employee', 'employees', 'manage', 'manages', 'managing', 'managed', 'manager', 'managers', 'management',
    'productive', 'productivity', 'focus', 'focused', 'focusing',
    'deliver', 'delivers', 'delivering', 'delivered',
    'presentation', 'presentations', 'presenting', 'task', 'tasks',
    'achieve', 'achieves', 'achieving', 'achieved', 'ambition', 'ambitions', 'ambitious',
    'brand', 'brands', 'branding', 'network', 'networks', 'networking',
    'collaborate', 'collaborates', 'collaborating', 'collaboration',
    'strategy', 'strategies', 'strategic', 'execute', 'executes', 'executing', 'executed', 'execution',
    'corporate', 'vocation', 'calling', 'industry', 'industries',
    'occupation', 'employment', 'colleague', 'colleagues', 'coworker', 'coworkers',
    'executive', 'executives', 'director', 'directors', 'founder', 'founders', 'visionary',
    'specialist', 'specialists', 'consultant', 'consultants', 'consulting',
    'freelance', 'freelancer', 'freelancing', 'contract', 'contracts', 'contractor',
    'agency', 'agencies', 'enterprise', 'operation', 'operations',
    'scale', 'scales', 'scaling', 'scaled', 'impact', 'influence', 'authority',
    'resume', 'resumes', 'tenure', 'pivot', 'pivoting', 'shift',
    'path', 'venture', 'ventures', 'ceo', 'workflow', 'workflows', 'system', 'systems', 'process', 'processes',
    'efficient', 'efficiency', 'optimize', 'optimizing', 'optimization',
    // Public life and leadership are a calling, not a hobby.
    'president', 'presidency', 'elect', 'elects', 'elected', 'election', 'elections',
    'campaign', 'campaigns', 'campaigning', 'candidate', 'candidates',
    'politics', 'political', 'politician', 'politicians',
    'senator', 'senators', 'senate', 'congress', 'congressman', 'congresswoman',
    'governor', 'governors', 'mayor', 'mayors', 'parliament', 'minister', 'ministers',
    'councillor', 'councilor', 'users', 'customer', 'customers',
  ],
  relationships: [
    'relationship', 'relationships', 'friend', 'friends', 'friendship', 'friendships',
    'love', 'loves', 'loving', 'loved', 'partner', 'partners', 'partnership',
    'spouse', 'spouses', 'wife', 'wives', 'husband', 'husbands', 'boyfriend', 'girlfriend', 'fiance', 'fiancee',
    'date', 'dates', 'dating', 'social', 'socialize', 'socializing',
    'connect', 'connects', 'connecting', 'connected', 'connection', 'connections',
    'people', 'community', 'communities', 'bond', 'bonds', 'bonded',
    'trust', 'trusts', 'trusting', 'trusted',
    'communicate', 'communicates', 'communicating', 'communication',
    'listen', 'listens', 'listening', 'listened',
    'marriage', 'marriages', 'married', 'marry', 'romantic', 'romance', 'intimacy', 'intimate',
    'lonely', 'loneliness', 'together', 'support', 'supports', 'supporting', 'supported', 'supportive',
    'compassion', 'compassionate', 'empathy', 'empathetic',
    'forgive', 'forgives', 'forgiving', 'forgiven', 'forgiveness',
    'kindness', 'kind', 'kinder', 'open', 'openness',
    'resolve', 'resolving', 'conflict', 'conflicts', 'vulnerable', 'vulnerability',
    'honest', 'honestly', 'honesty', 'sincere', 'sincerity', 'loyal', 'loyalty',
    'devoted', 'devotion', 'affection', 'affectionate', 'caring',
    // Roles such as mentor, coach, and student are ambiguous on their own.
    // Keep relationship classification driven by the relationship itself,
    // not by the person mentioned in the intention.
    'neighbor', 'neighbors', 'tribe',
    'gathering', 'gatherings', 'celebration', 'celebrations', 'reunion', 'reunions',
    'belong', 'belongs', 'belonging', 'accept', 'accepting', 'acceptance',
    'inclusion', 'inclusive', 'unity', 'solidarity', 'alliance', 'contribution',
    'altruism', 'service', 'helpful', 'generous', 'warmth',
    'seen', 'heard', 'valued', 'respected', 'admired', 'liked',
  ],
  creativity: [
    'art', 'arts', 'artist', 'artists', 'artistic',
    'creativity', 'creative', 'creatively', 'create', 'creates', 'creating', 'created', 'creation', 'creations', 'creator',
    'express', 'expresses', 'expressing', 'expressed', 'expression', 'expressions', 'expressive',
    'paint', 'paints', 'painting', 'paintings', 'painted', 'painter',
    'draw', 'draws', 'drawing', 'drawings', 'drawn',
    'sketch', 'sketches', 'sketching', 'sketched',
    'design', 'designs', 'designing', 'designed', 'designer', 'illustrate', 'illustration', 'illustrations',
    'music', 'musical', 'musician', 'musicians', 'song', 'songs', 'songwriter', 'songwriting',
    'sing', 'sings', 'singing', 'compose', 'composing', 'composition', 'album', 'albums', 'guitar', 'piano',
    'write', 'writes', 'writing', 'written', 'wrote', 'writer', 'writers',
    'poet', 'poetry', 'poem', 'poems', 'story', 'stories', 'storytelling',
    'novel', 'novels', 'novelist', 'book', 'books', 'author', 'screenplay', 'script', 'scripts', 'prose',
    'craft', 'crafts', 'crafting', 'crafted', 'craftsman', 'maker', 'makers',
    'build', 'builds', 'building', 'built',
    'sculpt', 'sculpts', 'sculpting', 'sculpture', 'sculptures', 'sculptor',
    'photo', 'photos', 'photograph', 'photographs', 'photography', 'photographer',
    'film', 'films', 'filmmaking', 'filmmaker', 'cinema',
    'dance', 'dances', 'dancing', 'danced', 'dancer',
    'performance', 'performances', 'theater', 'theatre', 'acting', 'actor', 'actors',
    'perform', 'performs', 'performing', 'performed',
    'inspire', 'inspires', 'inspiring', 'inspired', 'inspiration',
    'imagine', 'imagines', 'imagining', 'imagined', 'imagination', 'imaginative',
    'innovate', 'innovates', 'innovating', 'innovation', 'innovative',
    'unique', 'original', 'originality', 'style', 'styles', 'aesthetic', 'aesthetics',
    'beauty', 'beautiful', 'voice', 'authenticity', 'muse', 'artisan',
    'gallery', 'galleries', 'exhibition', 'exhibitions',
    'publish', 'publishes', 'publishing', 'published',
    'portfolio', 'portfolios', 'masterpiece', 'masterpieces', 'opus',
    'canvas', 'canvases', 'brush', 'brushes', 'palette', 'color', 'colors', 'vibrant', 'dynamic', 'studio',
  ],
  spirituality: [
    'spiritual', 'spirituality', 'spiritually',
    'meditation', 'meditations', 'meditate', 'meditates', 'meditating', 'meditated',
    'mindfulness', 'mindful', 'sacred', 'consciousness', 'conscious',
    'awakening', 'awaken', 'awakens', 'awakened', 'awake', 'enlightenment', 'enlightened',
    'purpose', 'purposeful', 'meaning', 'meaningful', 'soul', 'souls', 'soulful', 'spirit', 'spirits',
    'inner', 'awareness', 'aware', 'presence', 'present', 'zen', 'tao',
    'prayer', 'prayers', 'pray', 'prays', 'praying', 'prayed',
    'ritual', 'rituals', 'authentic', 'transcend', 'transcends', 'transcending', 'transcendence',
    'peace', 'peaceful', 'serenity', 'serene', 'stillness', 'silence',
    'balance', 'balanced', 'balancing', 'harmony', 'harmonious', 'grace',
    'grateful', 'gratitude', 'blessed', 'blessing', 'blessings', 'faith', 'god',
    'divine', 'cosmic', 'universe', 'universal', 'infinite', 'eternal', 'timeless',
    'sage', 'philosopher', 'contemplate', 'contemplating', 'contemplation',
    'reflect', 'reflects', 'reflecting', 'reflected', 'reflection', 'reflections', 'introspection',
    'chakra', 'chakras', 'vibration', 'vibrations', 'frequency', 'frequencies',
    'mindset', 'perspective', 'philosophy', 'ethics', 'character',
    'ground', 'grounded', 'grounding', 'center', 'centered', 'centering', 'surrender', 'surrendering',
  ],
  abundance: [
    'money', 'wealth', 'wealthy', 'wealthier', 'financial', 'financially', 'finance', 'finances',
    'afford', 'affording', 'debt', 'debts', 'save', 'saves', 'saving', 'savings', 'saved',
    'invest', 'invests', 'investing', 'invested', 'investment', 'investments', 'investor', 'investors',
    'rich', 'riches', 'richer', 'richness', 'income', 'incomes', 'revenue', 'revenues',
    'profit', 'profits', 'profitable', 'prosper', 'prospers', 'prospering', 'prosperity', 'prosperous',
    'abundance', 'abundant', 'spend', 'spends', 'spending', 'spent',
    'budget', 'budgets', 'budgeting', 'bill', 'bills', 'cash',
    'earn', 'earns', 'earning', 'earnings', 'earned', 'dollar', 'dollars',
    'fund', 'funds', 'funding', 'funded', 'tax', 'taxes', 'expense', 'expenses',
    'retire', 'retires', 'retiring', 'retired', 'retirement',
    'asset', 'assets', 'passive', 'stock', 'stocks', 'crypto', 'bank', 'banking',
    'loan', 'loans', 'mortgage', 'mortgages', 'salary', 'salaries', 'raise', 'raises', 'bonus', 'bonuses',
    'sell', 'sells', 'selling', 'sold', 'purchase', 'purchases', 'purchasing',
    'capital', 'equity', 'dividend', 'dividends', 'interest', 'realestate',
    'property', 'properties', 'land', 'commerce', 'market', 'markets', 'trading', 'wallet',
    'emergency', 'safe', 'secure', 'security', 'estate', 'inheritance',
    'charity', 'giving', 'generosity', 'opulence', 'opulent', 'luxury', 'luxurious',
    'value', 'worth', 'networth', 'leverage', 'aligned', 'million', 'millionaire', 'affluence', 'affluent', 'fortune',
  ],
  family: [
    'family', 'families', 'parent', 'parents', 'parenting',
    'mother', 'mothers', 'motherhood', 'father', 'fathers', 'fatherhood',
    'mom', 'moms', 'mum', 'dad', 'dads',
    'children', 'child', 'kid', 'kids', 'son', 'sons', 'daughter', 'daughters',
    'baby', 'babies', 'infant', 'toddler', 'pregnant', 'pregnancy',
    'sibling', 'siblings', 'brother', 'brothers', 'sister', 'sisters', 'cousin', 'cousins',
    'grandparent', 'grandparents', 'grandmother', 'grandma', 'grandfather', 'grandpa', 'grandchild', 'grandchildren',
    'aunt', 'aunts', 'uncle', 'uncles', 'niece', 'nieces', 'nephew', 'nephews',
    'relative', 'relatives', 'kin', 'kinship',
    'home', 'homes', 'household', 'households', 'domestic', 'upbringing',
    'nurture', 'nurtures', 'nurturing', 'nurtured', 'bonding', 'togetherness',
    'heritage', 'legacy', 'lineage', 'ancestor', 'ancestors', 'generational', 'generations',
    'roots', 'tradition', 'traditions', 'values', 'foundation',
  ],
  learning: [
    'learn', 'learns', 'learning', 'learned', 'learner',
    'study', 'studies', 'studying', 'studied',
    'education', 'educational', 'educate', 'educating', 'educated',
    'school', 'schools', 'schooling', 'university', 'universities', 'college', 'colleges',
    'student', 'students', 'teacher', 'teachers', 'mentor', 'mentors', 'mentoring', 'mentorship',
    'coach', 'coaches', 'coaching', 'instruction', 'instructor', 'teach', 'teaches', 'teaching', 'taught',
    'knowledge', 'knowledgeable', 'skill', 'skills', 'skilled',
    'develop', 'develops', 'developing', 'developed', 'development',
    'improve', 'improves', 'improving', 'improved', 'improvement', 'growth',
    'master', 'masters', 'mastering', 'mastered', 'mastery', 'expertise', 'expert', 'experts',
    'discipline', 'disciplined', 'practice', 'practices', 'practicing', 'practiced',
    'course', 'courses', 'class', 'classes', 'classroom', 'curriculum', 'subject', 'subjects', 'topic', 'topics',
    'understand', 'understands', 'understanding', 'understood', 'comprehension', 'comprehend',
    'intelligence', 'intelligent', 'smart', 'smarter', 'wisdom', 'wise', 'insight', 'insights',
    'curiosity', 'curious', 'wonder', 'research', 'researching', 'researcher',
    'academic', 'academics', 'scholarly', 'scholar', 'scholars', 'scholarship', 'scholarships',
    'brilliant', 'achievement', 'achievements', 'accomplish', 'accomplishes', 'accomplishing', 'accomplished',
    'proficiency', 'proficient', 'fluent', 'fluently', 'fluency', 'language', 'languages',
    'read', 'reads', 'reading', 'reader', 'degree', 'degrees', 'diploma', 'certificate', 'certification', 'certifications',
    'grade', 'grades', 'exam', 'exams', 'examination', 'test', 'tests', 'testing',
    'homework', 'gpa', 'thesis', 'dissertation', 'essay', 'essays', 'quiz', 'quizzes', 'lecture', 'lectures',
  ],
  adventure: [
    'adventure', 'adventures', 'adventurous', 'adventurer',
    'travel', 'travels', 'traveling', 'travelling', 'traveled', 'travelled', 'traveler', 'traveller',
    'journey', 'journeys', 'trip', 'trips',
    'explore', 'explores', 'exploring', 'explored', 'exploration', 'explorer',
    'discovery', 'discoveries', 'discover', 'discovers', 'discovering', 'discovered',
    'experience', 'experiences', 'experiencing', 'experienced',
    'feel', 'feels', 'feeling', 'moment', 'moments', 'sensory',
    'event', 'events', 'visit', 'visits', 'visiting', 'visited',
    'witness', 'witnessing', 'see', 'sees', 'seeing', 'hear', 'hearing', 'taste', 'tasting', 'touch', 'alive',
    'world', 'ocean', 'oceans', 'sea', 'mountain', 'mountains', 'peak', 'peaks', 'summit',
    'trail', 'trails', 'camp', 'camping', 'backpack', 'backpacking',
    'city', 'cities', 'country', 'countries', 'continent', 'continents',
    'abroad', 'overseas', 'international', 'flight', 'flights', 'passport', 'island', 'islands', 'beach', 'beaches',
    'nature', 'outdoor', 'outdoors', 'wild', 'wilderness', 'culture', 'cultures', 'cultural',
    'memory', 'memories', 'unforgettable', 'freedom', 'liberty', 'escape', 'escaping', 'break',
    'vacation', 'vacations', 'holiday', 'holidays', 'wander', 'wandering', 'wanderlust',
    'nomad', 'nomadic', 'roam', 'roams', 'roaming', 'roamed', 'expedition', 'expeditions', 'quest', 'quests',
    'risk', 'risks', 'brave', 'bravery', 'courage', 'courageous', 'bold', 'boldness', 'daring', 'fearless',
    'exciting', 'excitement', 'thrill', 'thrills', 'thrilling', 'exhilarating', 'adrenaline',
    'fun', 'joy', 'joyful', 'delight', 'safari', 'surf', 'surfing', 'dive', 'diving', 'skydive', 'skydiving', 'sail', 'sailing',
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
    ['land a job', 5],
    ['new job', 5],
    ['dream job', 5],
    ['start a business', 6],
    ['my business', 4],
    ['my company', 4],
    ['my career', 4],
    ['my startup', 4],
    ['my app', 3],
    ['at work', 4],
    ['do work', 4],
    ['work that matters', 5],
    ['lead with', 4],
    ['public speaking', 5],
    ['career change', 5],
    ['business partner', 5],
  ],
  health: [
    ['run a marathon', 6],
    ['run a half marathon', 6],
    ['half marathon', 6],
    ['run a 5k', 6],
    ['run a 10k', 6],
    ['go running', 5],
    ['lose weight', 6],
    ['get fit', 6],
    ['get in shape', 6],
    ['get healthier', 5],
    ['be healthier', 5],
    ['feel healthier', 5],
    ['sleep better', 5],
    ['rest well', 5],
    ['eat healthy', 5],
    ['eat clean', 5],
    ['quit smoking', 6],
    ['quit drinking', 6],
    ['stay sober', 6],
    ['mental health', 6],
    ['work out', 5],
    ['my body', 4],
    ['nervous system', 5],
    ['blood pressure', 5],
  ],
  abundance: [
    ['pay off', 5],
    ['debt free', 6],
    ['out of debt', 6],
    ['save money', 6],
    ['make money', 5],
    ['more money', 5],
    ['about money', 5],
    ['money flows', 6],
    ['financial freedom', 6],
    ['financial independence', 6],
    ['financial security', 6],
    ['financially free', 6],
    ['passive income', 6],
    ['six figures', 6],
    ['seven figures', 6],
    ['net worth', 6],
    ['emergency fund', 6],
    ['credit score', 5],
    ['buy a house', 5],
    ['buy a home', 5],
  ],
  adventure: [
    ['travel to', 5],
    ['travel the world', 6],
    ['see the world', 6],
    ['around the world', 6],
    ['road trip', 6],
    ['solo trip', 6],
    ['solo travel', 6],
    ['move abroad', 5],
    ['live abroad', 5],
    ['climb a mountain', 6],
    ['comfort zone', 5],
    ['bucket list', 5],
    ['national park', 5],
  ],
  creativity: [
    ['write a book', 6],
    ['write my book', 6],
    ['write a novel', 6],
    ['finish my novel', 6],
    ['release an album', 6],
    ['record an album', 6],
    ['make music', 5],
    ['make art', 5],
    ['work of art', 6],
    ['creative block', 6],
    ['writers block', 6],
    ['short film', 5],
  ],
  spirituality: [
    ['inner peace', 6],
    ['find peace', 5],
    ['peace of mind', 5],
    ['be present', 5],
    ['stay present', 5],
    ['present moment', 5],
    ['let go', 4],
    ['letting go', 4],
    ['higher self', 6],
    ['spiritual practice', 6],
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
    ['have a baby', 7],
    ['get pregnant', 7],
    ['be a good parent', 6],
    ['better father', 6],
    ['better mother', 6],
    ['better parent', 6],
    ['better dad', 6],
    ['better mom', 6],
    ['family time', 6],
    ['at home', 5],
    ['home with me', 5],
  ],
  learning: [
    ['learn to', 4],
    ['learn a language', 6],
    ['new language', 6],
    ['speak fluent', 6],
    ['get my degree', 6],
    ['finish my degree', 6],
    ['straight a student', 8],
    ['straight a', 6],
    ['better student', 5],
    ['better mentor', 5],
    ['high grades', 6],
    ['good grades', 6],
    ['top grades', 6],
    ['ace my exams', 6],
    ['pass my exams', 5],
    ['bar exam', 7],
    ['board exam', 7],
    ['medical school', 6],
    ['law school', 6],
    ['grad school', 6],
    ['get into college', 6],
    ['read more', 5],
    ['gpa', 6],
    ['academic achievement', 6],
    ['study for', 3],
    ['do well in school', 5],
    ['academic success', 5],
  ],
  relationships: [
    ['romantic relationship', 7],
    ['healthy relationship', 7],
    ['fall in love', 6],
    ['find love', 6],
    ['life partner', 6],
    ['my partner', 6],
    ['my friends', 6],
    ['make friends', 6],
    ['close friends', 5],
    ['best friend', 5],
    ['people i love', 5],
    ['show up for', 4],
    ['with care', 4],
    ['open my heart', 5],
    ['set boundaries', 4],
    ['better communication', 4],
    ['feel connected', 4],
  ],
};

export const KEYWORD_SETS = Object.fromEntries(
  (Object.entries(CATEGORY_KEYWORDS) as [AnchorCategory, string[]][]).map(([category, keywords]) => [
    category,
    new Set(keywords),
  ]),
) as Record<AnchorCategory, Set<string>>;

const SPECIFIC_CATEGORIES: readonly AnchorCategory[] = [
  'career',
  'health',
  'abundance',
  'relationships',
  'family',
  'learning',
  'creativity',
  'spirituality',
  'adventure',
];

export function scoreCategoryFromText(intentionText: string): Record<AnchorCategory, number> {
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

  if (!intentionText || typeof intentionText !== 'string') {
    return scores;
  }

  const normalizedText = intentionText
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedText) {
    return scores;
  }

  const words = normalizedText.split(/\s+/).filter(Boolean);

  for (const word of words) {
    for (const category of SPECIFIC_CATEGORIES) {
      if (KEYWORD_SETS[category].has(word)) {
        scores[category] += 1;
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

  return scores;
}

export function detectCategoryFromText(intentionText: string): AnchorCategory {
  if (!intentionText || typeof intentionText !== 'string') {
    return 'desire';
  }

  const scores = scoreCategoryFromText(intentionText);

  const ranked = SPECIFIC_CATEGORIES.map((category) => [category, scores[category]] as const).sort(
    (a, b) => b[1] - a[1],
  );

  const [topCategory, topScore] = ranked[0];
  const [, runnerUpScore] = ranked[1];

  // Confidence margin rule: the winning category must EITHER have a top score >= 2
  // OR beat the runner-up by >= 2. If neither holds, fall back to 'desire'.
  const meetsConfidenceMargin = topScore >= 2 || topScore - runnerUpScore >= 2;
  if (!meetsConfidenceMargin) {
    return 'desire';
  }

  // Honest tie-breaking: if the top two scores are equal after the margin rule,
  // return 'desire' rather than breaking ties by an arbitrary category order.
  if (topScore === runnerUpScore) {
    return 'desire';
  }

  return topCategory;
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
