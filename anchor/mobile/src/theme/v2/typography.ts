import type { TextStyle } from 'react-native';

const display = 'BricolageGrotesque-Regular';
const displaySemiBold = 'BricolageGrotesque-SemiBold';
const body = 'Figtree-Regular';
const bodyMedium = 'Figtree-Medium';

/** V2-only type roles. Bricolage creates hierarchy; Figtree carries the interface. */
export const typography = {
  display, displaySemiBold, body, bodyMedium,
  displayLarge: { fontFamily: displaySemiBold, fontSize: 42, lineHeight: 50, letterSpacing: -0.8 },
  displayMedium: { fontFamily: displaySemiBold, fontSize: 34, lineHeight: 41, letterSpacing: -0.5 },
  headingXL: { fontFamily: displaySemiBold, fontSize: 28, lineHeight: 35, letterSpacing: -0.25 },
  headingLG: { fontFamily: displaySemiBold, fontSize: 23, lineHeight: 29 },
  headingMD: { fontFamily: displaySemiBold, fontSize: 19, lineHeight: 25 },
  headingSM: { fontFamily: bodyMedium, fontSize: 16, lineHeight: 22 },
  bodyLG: { fontFamily: body, fontSize: 17, lineHeight: 25 },
  bodyMD: { fontFamily: body, fontSize: 15, lineHeight: 22 },
  bodySM: { fontFamily: body, fontSize: 13, lineHeight: 19 },
  labelLG: { fontFamily: bodyMedium, fontSize: 15, lineHeight: 20 },
  labelMD: { fontFamily: bodyMedium, fontSize: 13, lineHeight: 17, letterSpacing: 0.1 },
  labelSM: { fontFamily: bodyMedium, fontSize: 11, lineHeight: 14, letterSpacing: 0.55, textTransform: 'uppercase' },
  caption: { fontFamily: body, fontSize: 12, lineHeight: 16 },
  numericLarge: { fontFamily: displaySemiBold, fontSize: 38, lineHeight: 44, letterSpacing: -0.6 },
  numericMedium: { fontFamily: bodyMedium, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  title: { fontFamily: displaySemiBold, fontSize: 28, lineHeight: 35 },
  bodyText: { fontFamily: body, fontSize: 16, lineHeight: 23 },
} as const satisfies Record<string, string | TextStyle>;
