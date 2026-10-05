/**
 * Locked Chart copy. Deterministic by design: labels and product language are
 * never generated. Principle: never hype, always orient.
 */
export const CHART_COPY = {
  title: 'Chart',
  labels: {
    reinforcing: 'REINFORCING',
    currentWaypoint: 'CURRENT WAYPOINT',
    oneMove: 'ONE MOVE',
    yourDestination: 'YOUR DESTINATION',
    courseLog: 'COURSE LOG',
    suggestedMoves: 'SUGGESTED MOVES',
    yourMoves: 'YOUR MOVES',
    onYourChart: 'ON YOUR CHART',
    yourChart: 'YOUR CHART',
    waypointReached: 'WAYPOINT REACHED',
    next: 'NEXT',
    destinationReached: 'DESTINATION REACHED',
    here: 'HERE',
    there: 'THERE',
    alreadySeen: 'YOU’VE ALREADY SEEN IT.',
    courseBegins: 'YOUR COURSE BEGINS HERE',
  },
  empty: {
    headline: 'Let’s chart the distance between here and there.',
    support: 'I’ll use what you’ve already given Anchor. You only need to fill in what I can’t see.',
    cta: 'Continue',
  },
  creation: {
    headerTitle: 'Create Chart',
    visionHeadline: 'Now let’s map the way there.',
    visionSupport: 'Your Vision shows where this Anchor is going.',
    realQuestion: 'What would make this real?',
    realSupport:
      'Give Anchor something concrete to navigate toward. Think about what would be different in your life if this intention were already taking shape.',
    realLabel: 'Describe what ‘real’ looks like',
    examplePrefix: 'For example: ',
    continue: 'Continue',
    viewVision: 'View Vision',
    destinationLabel: 'YOUR DESTINATION',
    destinationNote: 'I’ll use your Vision to understand where you’re headed.',
    startingLabel: 'SHOW WHERE YOU ARE NOW',
    startingNote: 'Add a photo so I can see where things are now. (Optional)',
    startingPhotoAdded: 'Photo added',
    skip: 'Skip for now',
    describeInstead: 'Describe it instead',
    backToPhoto: 'Add a photo instead',
  },
  generation: {
    headerTitle: 'Creating your Chart',
    headline: 'Reading your Vision…',
    neutralHeadline: 'Mapping the way there.',
    support: 'Finding the meaningful changes between where you are and your destination.',
    /** One per real stage of the request; see ChartGenerationStage. */
    stages: {
      reading: 'Understanding where you’re starting…',
      finding: 'Finding the meaningful steps between them…',
      building: 'Building your course…',
      ready: 'Chart ready',
    },
    longWait: ['Still finding the meaningful changes.', 'Complex destinations can take another moment.'],
  },
  followUp: {
    headline: 'One more thing.',
    support: 'A little more context makes the route fit.',
    placeholder: 'Your answer…',
    eyebrow: 'ONE THING I CAN’T SEE',
    addReference: 'Add another reference (optional)',
    photo: 'Photo',
    place: 'Place',
    document: 'Document',
    takePhoto: 'Take a photo',
    choosePhoto: 'Choose from library',
    placePlaceholder: 'A place that matters here',
    useLocation: 'Use my location',
    currentLocation: 'Current location',
    documentPlaceholder: 'Paste text from a document',
    documentName: 'Pasted text',
    add: 'Add',
    cancel: 'Cancel',
    remove: 'Remove',
    limit: 'You can add up to 4 references.',
    uploadFailed: 'We couldn’t upload that photo. Check your connection and try again.',
  },
  review: {
    headerTitle: 'Your first route',
    headline: 'Here’s the course I’d start with.',
    outline: 'We couldn’t map this one automatically. Here’s a simple outline — rename each waypoint so it fits.',
    evolve: 'This route is a starting point. You can change it as the path becomes clearer.',
    addWaypoint: 'Add waypoint',
    adjust: 'Adjust route',
    confirm: 'Looks right',
    routeLabel: 'YOUR ROUTE',
    destinationLabel: 'DESTINATION',
    oneMoveLabel: 'ONE MOVE',
    oneMoveFor: (waypointTitle: string) => `Something you can do this week toward ${waypointTitle ? `“${waypointTitle}”` : 'your first waypoint'}.`,
    oneMoveHint: 'Your first move',
  },
  revealed: {
    headerTitle: 'Your Chart',
    headline: 'Your route is ready.',
    support: 'A clearer path from here to there.',
    cta: 'Explore your Chart',
  },
  adjust: {
    headerTitle: 'Adjust Route',
    headline: 'What needs to change?',
    support: 'Tell us what isn’t working and we’ll suggest a new route.',
    detailPlaceholder: 'Tell us more…',
    cta: 'Update my route',
    keep: 'Keep route',
    stillRight: 'Still the right route?',
    adjustAhead: 'Adjust what’s ahead',
    protected: 'Waypoints you’ve reached stay as they are.',
    rewriteTitle: 'Rewrite part of your route?',
    rewriteBody: 'This removes a waypoint you’ve already worked on. Your completed moves stay in your history.',
    rewriteConfirm: 'Rewrite it',
    review: 'Here’s the revised route.',
    reviewSupport: 'Keep what fits. Change what doesn’t.',
    apply: 'Use this route',
  },
  reasons: [
    { key: 'TOO_MANY_STEPS', label: 'Too many steps' },
    { key: 'TOO_FEW_STEPS', label: 'Too few steps' },
    { key: 'DIFFERENT_MILESTONES', label: 'Different milestones' },
    { key: 'FURTHER_ALONG', label: 'I’m further along' },
    { key: 'CHANGE_DESTINATION', label: 'Change the destination' },
    { key: 'OTHER', label: 'Other' },
  ] as const,
  active: {
    markComplete: 'Mark complete',
    viewVision: 'View Vision',
    practiceAnchor: 'Practice this anchor',
    practiceNudge: 'Practice before your next move',
    addMove: 'Add a move',
    noMove: 'What’s one thing you can do next?',
    noMoveCta: 'Choose a move',
    openChart: 'Open Chart',
    viewChart: 'View Chart',
    courseLogCta: 'View course log',
    offline: 'Showing your saved Chart. Changes need a connection.',
  },
  waypoint: {
    headerTitle: 'Waypoint',
    markComplete: 'Mark waypoint complete',
    confirmTitle: 'Mark this waypoint reached?',
    confirmBody: 'Your route moves forward to the next waypoint.',
    confirmCta: 'Yes, I’m here',
    notYet: 'Not yet',
    suggest: 'Suggest moves',
    suggestUnavailable: 'Suggestions aren’t available right now. Add your own move.',
    addMove: 'Add a move',
    progress: 'Update progress',
    edit: 'Edit',
    remove: 'Remove waypoint',
  },
  reached: {
    destinationHeadline: 'Destination reached.',
    destinationSupport: 'What you once pictured is now part of your history.',
    viewJourney: 'View your journey',
    release: 'Release Anchor',
  },
  archive: {
    menuItem: 'Archive Chart',
    confirmTitle: 'Archive this Chart?',
    confirmBody: 'This route will be moved to your history. You can create a new route for this Anchor anytime.',
    confirmCta: 'Archive Chart',
    cancel: 'Keep Chart',
    error: 'We couldn’t archive this Chart. Check your connection and try again.',
  },
  delete: {
    menuItem: 'Delete Chart',
    confirmTitle: 'Delete this Chart?',
    confirmBody: 'This will permanently remove this route and its history. This action cannot be undone.',
    confirmCta: 'Delete Chart',
    cancel: 'Cancel',
    error: 'We couldn’t delete this Chart. Check your connection and try again.',
  },
  errors: {
    offline: 'You’re offline. Chart needs a connection for this.',
    load: 'We couldn’t open this Chart.',
    loadSupport: 'Check your connection and try again.',
    disabled: 'Chart isn’t available yet.',
    disabledSupport: 'It will appear here as soon as it is.',
    retry: 'Try again',
    generation: 'We couldn’t finish mapping this route.',
    generationSupport: 'You can try again, or start with a simple outline you shape yourself.',
    manual: 'Start with an outline',
    save: 'Your route wasn’t saved.',
    saveSupport: 'Nothing was lost — try again when you’re connected.',
    adjust: 'We couldn’t revise the route right now. Your route is unchanged.',
    reach: 'We couldn’t mark this waypoint reached. Check your connection — your route hasn’t moved.',
    released: 'This Anchor has been released.',
    releasedSupport: 'Its Chart is preserved in your journey history.',
    missingAnchor: 'This Anchor is no longer available.',
    action: 'That didn’t go through. Try again.',
    rateLimited: 'Too many route requests just now. Try again in a little while.',
  },
} as const;

/**
 * Teaching for "What would make this real?". The question is always the same;
 * the example and the thought-starter hints are chosen from the person's own
 * intention (keyword themes) and fall back to the Anchor's category, so the
 * example resembles what they are actually reaching for. Hints help the person
 * think; they never write into the field.
 */
export type ChartThoughtStarter = 'change' | 'measure' | 'doing';

export const CHART_THOUGHT_STARTERS: readonly { key: ChartThoughtStarter; label: string }[] = [
  { key: 'change', label: 'What would change?' },
  { key: 'measure', label: 'What could you measure?' },
  { key: 'doing', label: 'What would you be doing differently?' },
];

export type ChartRealityGuide = {
  example: string;
  hints: Record<ChartThoughtStarter, string>;
};

type RealityTheme = ChartRealityGuide & { pattern?: RegExp };

const REALITY_THEMES = {
  venture: {
    pattern: /\b(apps?|startup|business|company|product|launch\w*|saas|clients?|customers?|brand|shop|store|founder|entrepreneur\w*|side project|agency|freelanc\w*)\b/i,
    example: 'I’ve launched my app, people are using it consistently, and it earns enough for me to work on it full time.',
    hints: {
      change: 'Picture the week once this is true: what are you building, who is it for, and what has stopped worrying you?',
      measure: 'Numbers help Anchor place waypoints — people using it, paying customers, monthly revenue, hours freed up.',
      doing: 'Where does your time go instead? Serving customers, shipping, hiring — or leaving the job that funds it.',
    },
  },
  writing: {
    pattern: /\b(book|novel|memoir|write|writing|writer|author|publish\w*|manuscript|poetry|poems?|essays?|blog|newsletter)\b/i,
    example: 'The manuscript is finished, an editor has read it, and writing most mornings no longer feels like a fight.',
    hints: {
      change: 'What exists that doesn’t yet — a finished draft, a published piece, readers who come back?',
      measure: 'Words, chapters, pieces published, subscribers — pick whatever would prove it to you.',
      doing: 'When and where do you write once this is real, and what did you stop doing to make room?',
    },
  },
  making: {
    pattern: /\b(music|album|songs?|band|paint\w*|art|artist|film|photograph\w*|design\w*|craft|studio|exhibit\w*|perform\w*|creative)\b/i,
    example: 'I’ve finished a body of work I’m proud of, shared it publicly, and people have responded to it.',
    hints: {
      change: 'What’s finished and out in the world that isn’t today?',
      measure: 'Pieces finished, a release or show date, an audience, commissions — something you could point to.',
      doing: 'How does making fit into an ordinary week once this is true?',
    },
  },
  body: {
    pattern: /\b(run\w*|marathon|fit|fitness|strong\w*|weight|gym|train\w*|body|health\w*|energy|sleep\w*|diet|eat\w*|walk\w*|swim\w*|yoga|sober\w*|drink\w*|smok\w*)\b/i,
    example: 'I move most days without negotiating with myself, I sleep through the night, and I still have energy in the evening.',
    hints: {
      change: 'What would you notice in your body, your energy or your routine?',
      measure: 'Distances, days a week, hours of sleep, a weight you can lift — whatever would show it plainly.',
      doing: 'What does a normal morning or evening look like once this is true?',
    },
  },
  money: {
    pattern: /\b(money|debts?|sav\w*|income|financ\w*|wealth\w*|invest\w*|salary|rich|abundan\w*|mortgage|earn\w*|budget\w*)\b/i,
    example: 'My debt is paid off, I have three months of expenses saved, and money isn’t the first thing I think about each morning.',
    hints: {
      change: 'What would be true about your money that isn’t today — and what would stop weighing on you?',
      measure: 'Amounts make good waypoints: debt remaining, months saved, monthly income.',
      doing: 'What would you do with money once this is real — or stop doing because you don’t have to?',
    },
  },
  work: {
    pattern: /\b(jobs?|career|promot\w*|role|hired|interview\w*|manager|leader\w*|lead|boss|team|profession\w*|work)\b/i,
    example: 'I’m in a role where my work is visible, I lead something I care about, and I’m paid fairly for it.',
    hints: {
      change: 'What’s different about your role, the work itself, or how people see it?',
      measure: 'A title, a salary, a project shipped, offers received — something someone else could confirm.',
      doing: 'What fills your working day once this is true that doesn’t now?',
    },
  },
  connection: {
    pattern: /\b(partner|relationships?|love|marri\w*|husband|wife|friend\w*|connect\w*|dating|lonel\w*|community|family|kids?|children|parent\w*|home)\b/i,
    example: 'We have a standing night together each week, we talk through hard things instead of avoiding them, and home feels at ease.',
    hints: {
      change: 'What would you notice changing between you and the people who matter?',
      measure: 'Time together, conversations had, plans kept — small counts are fine.',
      doing: 'What would an ordinary evening or weekend look like once this is true?',
    },
  },
  family: {
    example: 'Evenings at home are unhurried, we eat together most nights, and the people I live with get my full attention.',
    hints: {
      change: 'What would be different about an ordinary evening or weekend at home?',
      measure: 'Nights together, conversations had, plans kept — small counts are fine.',
      doing: 'What would you be doing with the people at home that you aren’t today?',
    },
  },
  learning: {
    pattern: /\b(learn\w*|language|fluent\w*|study\w*|degree|course|skills?|spanish|french|german|japanese|italian|mandarin|chinese|code|coding|program\w*|certif\w*|exam)\b/i,
    example: 'I can hold a real conversation without rehearsing it, and I practise a little every day because I want to.',
    hints: {
      change: 'What could you do that you can’t yet?',
      measure: 'A level, an exam, a project completed, a streak of practice — proof of capability, not hours logged.',
      doing: 'Where would you be using this skill in real life?',
    },
  },
  calm: {
    pattern: /\b(calm\w*|peace\w*|present|meditat\w*|mindful\w*|anxi\w*|stress\w*|spirit\w*|faith|pray\w*|grounded|gratitude|patien\w*)\b/i,
    example: 'I start most days with ten quiet minutes, I notice stress earlier, and I recover from hard days faster.',
    hints: {
      change: 'How would this show up in an ordinary day — in how you react, rest or pay attention?',
      measure: 'Days practised, minutes of quiet, how quickly you settle after something hard.',
      doing: 'What would you do first thing, or last thing, once this is part of you?',
    },
  },
  focus: {
    pattern: /\b(focus\w*|distract\w*|procrastinat\w*|disciplin\w*|productiv\w*|deep work|phone|screen time|consisten\w*|habits?)\b/i,
    example: 'I protect three focused mornings a week, I finish what I start, and my phone stays out of reach while I work.',
    hints: {
      change: 'What gets finished once this is true that stalls today?',
      measure: 'Focused hours, days protected, projects finished, screen time.',
      doing: 'What does a working morning look like — where are you, and what isn’t in the room?',
    },
  },
  journey: {
    pattern: /\b(travel\w*|trip|abroad|move|moving|relocat\w*|house|apartment|visit\w*|adventure\w*|explor\w*|climb\w*|hike|hiking|sail\w*)\b/i,
    example: 'I’ve chosen where I’m going, the dates are booked, and the savings to get there are already set aside.',
    hints: {
      change: 'What has to be decided, booked or in place before this happens?',
      measure: 'A date, a budget saved, a distance, a list of places — anything with an edge to it.',
      doing: 'Picture yourself there: what are you doing on the first ordinary day?',
    },
  },
  general: {
    example: 'Something someone else could notice — what you have, where you are, or what you’re doing once this is true.',
    hints: {
      change: 'Imagine it’s already taking shape. What’s different about your days, your work, or how you feel?',
      measure: 'Is there a number that would prove it — an amount, a count, a date, a frequency?',
      doing: 'What would you be spending time on that you aren’t today?',
    },
  },
} satisfies Record<string, RealityTheme>;

export type ChartRealityTheme = keyof typeof REALITY_THEMES;

/** Category → theme when the intention's own words don't point anywhere. */
const CATEGORY_THEME: Record<string, ChartRealityTheme> = {
  career: 'work',
  abundance: 'money',
  health: 'body',
  creativity: 'making',
  relationships: 'connection',
  family: 'family',
  learning: 'learning',
  spirituality: 'calm',
  focus: 'focus',
  adventure: 'journey',
  desire: 'general',
  custom: 'general',
};

/** Order matters: more specific themes are checked before broad ones ("work", "home"). */
const THEME_ORDER: ChartRealityTheme[] = [
  'venture',
  'writing',
  'money',
  'learning',
  'body',
  'making',
  'focus',
  'calm',
  'journey',
  'connection',
  'work',
];

/** Categories that carry no theme of their own; the intention's words may then decide. */
const OPEN_CATEGORIES = new Set(['', 'desire', 'custom']);

/**
 * The Anchor's category decides the example, the same way it decides the placeholder on onboarding's
 * intention page. Keyword themes only refine an open category (Something else), so a Career chart never
 * borrows a relationships example because its wording happens to contain "home" or "team".
 */
export function chartRealityTheme(intention?: string | null, category?: string | null): ChartRealityTheme {
  const key = category?.trim().toLowerCase() ?? '';
  if (!OPEN_CATEGORIES.has(key) && CATEGORY_THEME[key]) return CATEGORY_THEME[key];
  const text = intention ?? '';
  const matched = THEME_ORDER.find((theme) => {
    const entry: RealityTheme = REALITY_THEMES[theme];
    return entry.pattern?.test(text) ?? false;
  });
  return matched ?? CATEGORY_THEME[key] ?? 'general';
}

export function chartRealityGuide(intention?: string | null, category?: string | null): ChartRealityGuide {
  const theme = REALITY_THEMES[chartRealityTheme(intention, category)];
  return { example: theme.example, hints: theme.hints };
}

export function reviewSupportCopy(count: number): string {
  return `We found ${count} meaningful waypoint${count === 1 ? '' : 's'} for this destination. Keep what fits. Change what doesn’t.`;
}
