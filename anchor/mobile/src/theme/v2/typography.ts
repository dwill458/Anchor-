import type { TextStyle } from 'react-native';

const display = 'Inter-Regular';
const displaySemiBold = 'Inter-SemiBold';
const displayBold = 'Inter-SemiBold';
const displayExtraBold = 'Inter-SemiBold';
const body = 'Inter-Regular';
const bodyMedium = 'Inter-SemiBold';
const bodySemiBold = 'Inter-SemiBold';
const bodyBold = 'Inter-SemiBold';

/** V2 type roles using Anchor 2.0 neutral typography. */
export const typography = {
  display,
  displaySemiBold,
  displayBold,
  displayExtraBold,
  body,
  bodyMedium,
  bodySemiBold,
  bodyBold,
  utility: { fontFamily: body },
  utilityMedium: { fontFamily: bodyMedium },
  utilitySemibold: { fontFamily: bodySemiBold },
  utilityBold: { fontFamily: bodyBold },
  displayLarge: { fontFamily: displayBold, fontSize: 42, lineHeight: 50, letterSpacing: -0.8 },
  displayMedium: { fontFamily: displayBold, fontSize: 38, lineHeight: 40, letterSpacing: -1.6 },
  intention: { fontFamily: displayBold, fontSize: 38, lineHeight: 40, letterSpacing: -1.6 },
  headingXL: { fontFamily: displayBold, fontSize: 28, lineHeight: 35, letterSpacing: -0.25 },
  headingLG: { fontFamily: displayBold, fontSize: 23, lineHeight: 28, letterSpacing: -0.7 },
  headingMD: { fontFamily: displayBold, fontSize: 21, lineHeight: 26, letterSpacing: -0.5 },
  headingSM: { fontFamily: bodySemiBold, fontSize: 16, lineHeight: 22 },
  bodyLG: { fontFamily: body, fontSize: 17, lineHeight: 25 },
  bodyMD: { fontFamily: body, fontSize: 15, lineHeight: 22 },
  bodySM: { fontFamily: body, fontSize: 13, lineHeight: 19 },
  labelLG: { fontFamily: bodySemiBold, fontSize: 15, lineHeight: 20 },
  labelMD: { fontFamily: bodySemiBold, fontSize: 13.5, lineHeight: 18, letterSpacing: 0.1 },
  labelSM: { fontFamily: bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.55, textTransform: 'uppercase' },
  caption: { fontFamily: body, fontSize: 12, lineHeight: 16 },
  numericLarge: { fontFamily: displayBold, fontSize: 53, lineHeight: 58, letterSpacing: -2 },
  numericMedium: { fontFamily: bodySemiBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  title: { fontFamily: displayBold, fontSize: 28, lineHeight: 35 },
  bodyText: { fontFamily: body, fontSize: 16, lineHeight: 23 },
} as const satisfies Record<string, string | TextStyle>;
