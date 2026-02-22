/**
 * Anchor App - Spacing System
 *
 * Standardized spacing scale for consistent layouts.
 * ALWAYS use these values - never arbitrary numbers like 13 or 27.
 *
 * @example
 * marginTop: spacing.md
 * padding: spacing.lg
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
  mantra: {
    screenHorizontal: 22,
    headerTop: 18,
    heroTop: 14,
    dividerTop: 14,
    subtitleTop: 5,
    tabsGap: 8,
    lettersTop: 12,
    contentTop: 14,
    stripVertical: 8,
    stripHorizontal: 14,
    cardVertical: 14,
    cardHorizontal: 16,
    scrollBottom: 130,
    cardGap: 10,
    sectionTop: 6,
    playbackGap: 10,
    waveformGap: 2,
    badgeVertical: 3,
    badgeHorizontal: 8,
    visualizerBottom: 12,
    ctaBottom: 16,
  },
  refineExpression: {
    headerTop: 20,
    heroTop: 12,
    heroTitleBottom: 6,
    lockTop: 10,
    lockGap: 6,
    chipTop: 10,
    chipVertical: 7,
    chipHorizontal: 16,
    chipGap: 7,
    dividerTop: 12,
    tabsTop: 10,
    tabsGap: 6,
    tabVertical: 5,
    tabHorizontal: 12,
    gridTop: 12,
    gridBottom: 130,
    gridGap: 10,
    cardVertical: 14,
    cardHorizontal: 13,
    iconBottom: 9,
    nameBottom: 3,
    categoryBottom: 4,
    recommendedTop: 6,
    recommendedVertical: 2,
    recommendedHorizontal: 7,
    previewTop: 8,
    bottomFadeHeight: 70,
    bottomInsetPadding: 16,
    selectedBottom: 10,
    checkOffset: 10,
  },
} as const;

export type SpacingKey = keyof typeof spacing;
