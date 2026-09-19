/**
 * Anchor 2.0 Settings Design Tokens
 *
 * Grounded editorial theme matching Anchor 2.0 design language:
 * Warm neutral canvas (#F4F1E9), paper surface (#FBF9F4), deep ink (#171717),
 * muted secondary (#6C6861), hairline borders (#D8D2C8), and Figtree / Bricolage Grotesque typography.
 */

export const settingsTheme = {
  bg: '#F4F1E9',
  surface: '#FBF9F4',
  surface2: '#ECE8DF',
  ink: '#171717',
  ink2: '#6C6861',
  ink3: '#969088',
  line: '#D8D2C8',
  danger: '#B4552F',
  devGreen: '#2D5A3D',
  devGreenBg: '#EAF3EC',
  devGreenBorder: '#B2D6BC',
} as const;

export const T = settingsTheme;

export const settingsColors = {
  background: settingsTheme.bg,
  canvas: settingsTheme.bg,
  surface: settingsTheme.surface,
  grouped: settingsTheme.surface2,
  text: {
    primary: settingsTheme.ink,
    secondary: settingsTheme.ink2,
    disabled: settingsTheme.ink3,
    tertiary: settingsTheme.ink3,
    inverse: settingsTheme.surface,
  },
  border: {
    default: settingsTheme.line,
    subtle: '#E5E0D7',
    strong: '#BDB6AB',
  },
  semantic: {
    success: '#287D57',
    warning: '#9A6818',
    error: settingsTheme.danger,
    info: '#3157D8',
  },
  accent: {
    gold: '#D4A373',
    goldBg: '#F9F5EC',
    goldBorder: '#DDC9A3',
    goldInk: '#8C682A',
  },
} as const;

export const practiceSettingsTheme = {
  focus: {
    tint: '#F4EDF8',
    border: '#C8A9D9',
    borderSelected: '#7E4F9E',
    ink: '#532D6E',
    accent: '#8E5EA8',
  },
  deepPrime: {
    tint: '#FAF4E8',
    border: '#E2B866',
    borderSelected: '#A26B10',
    ink: '#784C08',
    accent: '#B47D1E',
  },
  visualize: {
    tint: '#EDF3F8',
    border: '#A2BDD7',
    borderSelected: '#33689A',
    ink: '#23496D',
    accent: '#3C76A6',
  },
} as const;

export const settingsTypography = {
  display: 'BricolageGrotesque-Regular',
  displaySemiBold: 'BricolageGrotesque-SemiBold',
  displayBold: 'BricolageGrotesque-Bold',
  displayExtraBold: 'BricolageGrotesque-ExtraBold',
  body: 'Figtree-Regular',
  bodyMedium: 'Figtree-Medium',
  bodySemiBold: 'Figtree-SemiBold',
  bodyBold: 'Figtree-Bold',
} as const;
