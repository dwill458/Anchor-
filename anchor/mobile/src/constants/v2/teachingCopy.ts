export const TEACHING_COPY = {
  common: { next: 'Next', gotIt: 'Got it', step: '{n} of {total}', dismiss: 'Dismiss tip' },
  replay: { title: 'Replay app tips', helper: 'Show the quick tips again on every screen.', confirmation: 'App tips reset.' },
  dev: { replay: 'Replay teaching', reset: 'Reset teaching' },
  beats: {
    'home.today': { title: 'Start here each day.', body: 'Today suggests one meaningful action to help you move forward with your Anchor.' },
    'home.glow': { title: 'This glow is your Thread Strength', body: "It's faint on day one. Every day you practice this anchor it grows brighter. Miss a day and it fades slowly, but never back to zero." },
    'home.progress': { title: 'Your progress lives here', body: "Tap to open your Thread Strength, your week and your history. Once you add a Vision, you'll get here by tapping Thread Strength under your anchor." },
    'home.anchor': { title: 'Tap your anchor', body: 'Its page is where you add a Vision and a Chart.' },
    'home.vision': { title: 'Keep your future in sight.', body: "Your Vision gives the future you're working toward a picture. Return to it whenever you need to remember where you're headed." },
    'home.chart': { title: 'Turn your vision into movement.', body: "Your Chart breaks a big goal into smaller milestones. See where you are, what's next, and how far you've come." },
    'home.thread': { title: 'Progress moved here', body: "Your Vision took the Progress section's spot on Home. Tap Thread Strength any time to see your full progress." },
    'home.create': { title: 'Make another anchor', body: 'Tap + to start a new one. Each anchor gets its own Home, and you swipe between them here.' },
    'home.swipe': { title: 'Swipe between your anchors', body: 'Each anchor has its own Home: its own Today, Vision, Chart and progress. All Anchors shows every one.' },
    'details.vision': { title: 'Vision and Chart start here', body: "Start with a Vision: a picture of where you're headed. Chart is right below it." },
    'details.chart': { title: 'Now give it a path', body: 'Chart breaks the goal into waypoints and the next move you can make.' },
    'practice.today': { title: "Today's practice is picked for you.", body: 'A few minutes to return to your intention. Everything below is yours to choose.' },
    'practice.switch': { title: 'Switch anchors here.', body: 'Tap to practice a different anchor.' },
    'progress.thread': { title: 'This is your Thread Strength.', body: "It grows when you practice and fades slowly when you don't. The glow behind your anchor shows it. The five stages show how established your thread has become." },
    'progress.week': { title: 'Your week at a glance.', body: "Each filled dot is a day you practiced. One grace day a week covers a single missed day, so one slip doesn't break your rhythm." },
    'progress.rhythm': { title: 'Your rhythm is your record.', body: 'Practices, minutes and Moves by week, month or year. Moves are the real-world steps you take from your Chart.' },
    'progress.route': { title: 'Your route, at a glance.', body: 'A small view of your Chart. Open it to see your next waypoint.' },
    'vision.first': { title: '', body: 'Images make the future feel real. Add another and choose which one leads.' },
    'vision.second': { title: 'Choose the image that leads.', body: "Drag photos into any spot. The one in the top spot leads, and it's the image Home shows." },
  },
} as const;

export type BeatId = keyof typeof TEACHING_COPY.beats;
export const TEACHING_BEAT_IDS = Object.keys(TEACHING_COPY.beats) as BeatId[];

// DEFERRED: Un-retired 'home.progress', 'home.thread', 'details.vision', and 'details.chart' so Getting started Show me and follow-through beats can present them.
/** Retained for Replay and the future guidance migration; never offered by eligibility. */
export const RETIRED_TEACHING_BEAT_IDS: readonly BeatId[] = [
  'home.vision', 'home.chart',
  'practice.today', 'progress.week', 'progress.rhythm', 'progress.route',
];
