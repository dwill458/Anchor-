/** Fixture artwork only for the V2 gallery and renderer tests; no new geometry engine. */
export const V2_SAMPLE_ANCHOR_SVGS = {
  simple: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 12V88M21 50H79M29 29L71 71M71 29L29 71" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>',
  medium: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 11L62 38L90 50L62 62L50 89L38 62L10 50L38 38Z M50 25V75 M25 50H75" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>',
  dense: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 13V87M13 50H87M24 24L76 76M76 24L24 76M31 17L69 83M17 31L83 69M69 17L31 83M83 31L17 69" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
} as const;
