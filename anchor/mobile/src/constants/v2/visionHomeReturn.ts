/**
 * The first Vision image returns the person to Home (celebration layer, scene V1). Later images stay on the board.
 * Times are the approved prototype's, kept in one place so device tuning never touches the scene's logic.
 */
export const VISION_HOME_RETURN = {
  /** Vision screen: from the board showing the pinned print to leaving for Home (pin drop, stillness, "Sit with it now"). */
  sitDwellMs: 3400,
  /** The same beat under Reduce Motion: nothing moves, so it is reading time only. */
  reducedSitDwellMs: 2200,
  /** Home: nominal length of the scene from the moment Home is settled (prototype 6850 to 9800). Over 2.5s, so skippable. */
  totalMs: 2950,
  /** Home: the print settles into its place (prototype 6850 to 7850). */
  printMs: 1000,
  /** Home: the "Your Vision" label (prototype 7350 to 7850), after the print has begun. */
  labelDelayMs: 500,
  labelMs: 500,
  /** Home: the soft tick and the Light haptic (prototype 7400). */
  tickMs: 550,
  /** Home: the page eases back to the top (prototype 8500 to 9300). */
  scrollBackMs: 1650,
  /** Reduce Motion: a short crossfade, then a held beat, then the same end state. Not skippable. */
  reducedFadeMs: 180,
  reducedTotalMs: 1200,
  /** Longest Home waits for the new image to be readable before it gives up and simply shows the section. */
  giveUpMs: 4000,
  /** Margin after the nominal end before the scene is released. */
  releaseMarginMs: 60,
} as const;

/** The optional `V2DevelopmentHome` route param that asks Home to play the return. */
export type VisionReturnParams = { anchorId: string; nonce: number };

export const visionHomeReturnCelebrationId = (nonce: number): string => `vision-home-return:${nonce}`;
