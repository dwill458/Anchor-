import React, { memo } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

type Glyph = {
  w: number;
  main: string;
  bleed: string;
};

/**
 * Organic hand-drawn marker glyphs for digits 0-9 and %.
 * Built with dual-pass marker strokes (primary stroke + soft bleed stroke)
 * matching the handmade IntentionMark aesthetic.
 */
const GLYPHS: Record<string, Glyph> = {
  '0': {
    w: 15,
    main: 'M 8.5,3.2 C 4.8,3.2 2.6,8.2 2.6,12.8 C 2.6,17.8 4.6,22.2 8.3,22.2 C 12.2,22.2 14.0,17.4 14.0,12.6 C 14.0,7.8 11.8,3.2 8.0,3.2 C 7.2,3.2 6.5,3.6 5.8,4.2',
    bleed: 'M 8.2,3.9 C 5.2,3.9 3.2,8.5 3.2,12.9 C 3.2,17.5 5.0,21.6 8.1,21.6 C 11.6,21.6 13.4,17.1 13.4,12.7 C 13.4,8.1 11.3,3.8 7.8,3.8',
  },
  '1': {
    w: 8,
    main: 'M 3.2,7.2 C 4.2,6.4 5.2,5.2 6.0,3.5 L 5.8,22.0',
    bleed: 'M 3.7,7.6 C 4.5,6.8 5.3,5.7 6.3,3.9 L 6.2,21.6',
  },
  '2': {
    w: 14,
    main: 'M 3.2,7.0 C 3.4,3.8 6.5,2.8 9.5,3.5 C 12.4,4.2 13.2,7.0 11.8,9.8 C 9.8,13.8 4.2,17.8 2.8,21.6 C 4.5,21.8 10.5,21.4 13.5,21.8',
    bleed: 'M 3.7,7.4 C 3.9,4.4 6.8,3.3 9.4,3.9 C 12.0,4.6 12.6,7.2 11.3,9.9 C 9.4,13.7 4.6,17.4 3.4,21.2 C 5.0,21.4 10.3,21.1 13.0,21.4',
  },
  '3': {
    w: 13,
    main: 'M 3.2,6.5 C 4.5,3.4 9.0,2.6 11.2,5.0 C 12.8,6.8 12.2,9.6 9.8,11.2 C 12.6,12.4 13.2,16.2 11.6,19.2 C 9.8,22.4 5.2,22.6 2.8,20.2',
    bleed: 'M 3.8,6.8 C 5.0,3.9 9.1,3.2 10.8,5.4 C 12.2,7.0 11.6,9.7 9.4,11.4 C 12.0,12.7 12.6,16.0 11.1,18.8 C 9.4,21.8 5.6,22.0 3.4,19.8',
  },
  '4': {
    w: 14,
    main: 'M 10.4,3.2 L 2.6,15.2 C 5.8,15.0 11.2,14.8 13.8,15.2 M 10.2,3.4 L 9.8,22.0',
    bleed: 'M 10.7,3.6 L 3.2,15.5 C 6.2,15.3 11.0,15.1 13.3,15.5 M 10.6,3.8 L 10.2,21.6',
  },
  '5': {
    w: 13,
    main: 'M 11.8,3.4 C 9.2,3.2 6.0,3.3 4.2,3.6 L 3.4,11.2 C 4.8,10.2 8.0,9.6 10.8,11.0 C 13.2,12.2 13.6,16.5 11.8,19.6 C 9.8,22.6 5.0,22.5 2.8,20.4',
    bleed: 'M 11.4,3.8 C 9.0,3.6 6.2,3.7 4.6,4.0 L 3.8,11.4 C 5.1,10.6 8.0,10.0 10.4,11.3 C 12.6,12.5 13.0,16.3 11.4,19.2 C 9.5,22.1 5.4,22.0 3.3,20.0',
  },
  '6': {
    w: 14,
    main: 'M 11.2,4.0 C 7.8,5.2 3.8,10.2 2.8,15.2 C 2.0,19.2 5.0,22.2 8.8,22.2 C 12.6,22.2 14.0,18.6 13.6,15.0 C 13.2,11.4 9.6,10.8 6.4,11.8',
    bleed: 'M 10.8,4.4 C 7.6,5.6 4.2,10.3 3.3,15.0 C 2.6,18.7 5.2,21.6 8.6,21.6 C 12.1,21.6 13.4,18.3 13.0,15.0 C 12.6,11.8 9.4,11.2 6.6,12.2',
  },
  '7': {
    w: 13,
    main: 'M 2.6,4.0 C 5.8,3.4 9.8,3.2 12.8,3.6 C 11.4,8.8 8.4,15.2 5.2,22.0',
    bleed: 'M 3.0,4.4 C 6.0,3.8 9.6,3.6 12.4,4.0 C 11.0,9.0 8.1,15.1 5.6,21.6',
  },
  '8': {
    w: 14,
    main: 'M 7.8,12.0 C 5.0,10.5 4.0,7.6 5.4,5.0 C 6.8,2.6 10.4,2.6 11.6,5.2 C 12.6,7.4 11.0,10.4 7.8,12.0 C 4.6,13.6 2.6,16.6 3.4,19.6 C 4.4,22.6 11.0,22.8 12.8,19.4 C 14.0,16.4 11.6,13.6 7.8,12.0 Z',
    bleed: 'M 7.6,12.0 C 5.2,10.7 4.4,8.0 5.6,5.4 C 6.8,3.2 10.1,3.2 11.2,5.5 C 12.1,7.5 10.7,10.3 7.6,12.0 C 4.8,13.6 3.2,16.4 3.9,19.2 C 4.8,22.1 10.6,22.3 12.2,19.2 C 13.4,16.3 11.2,13.7 7.6,12.0 Z',
  },
  '9': {
    w: 14,
    main: 'M 11.4,12.8 C 9.0,14.6 4.8,13.8 3.2,10.8 C 1.6,7.8 3.4,3.4 7.8,3.2 C 11.8,3.0 13.8,6.8 13.4,11.2 C 12.8,16.2 8.6,20.8 4.6,22.4',
    bleed: 'M 11.0,12.6 C 8.8,14.2 5.0,13.4 3.6,10.7 C 2.2,7.9 3.8,3.9 7.8,3.7 C 11.4,3.5 13.2,7.0 12.8,11.2 C 12.3,15.8 8.4,20.3 4.8,21.9',
  },
  '%': {
    w: 18,
    main: 'M 14.8,3.6 C 11.2,9.6 7.2,15.8 3.4,22.2 M 5.8,5.2 C 4.2,4.8 3.0,6.2 3.2,7.8 C 3.4,9.2 5.0,9.8 6.4,8.8 C 7.4,8.0 7.2,6.2 6.0,5.4 M 14.2,16.2 C 12.6,15.8 11.4,17.2 11.6,18.8 C 11.8,20.2 13.4,20.8 14.8,19.8 C 15.8,19.0 15.6,17.2 14.4,16.4',
    bleed: 'M 15.2,4.0 C 11.6,9.9 7.5,16.0 3.8,22.4 M 5.6,5.5 C 4.3,5.1 3.3,6.3 3.5,7.6 C 3.7,8.8 5.0,9.4 6.2,8.5 C 7.0,7.8 6.9,6.4 5.8,5.7 M 14.0,16.5 C 12.7,16.1 11.7,17.3 11.9,18.6 C 12.1,19.8 13.4,20.4 14.6,19.5 C 15.4,18.8 15.3,17.4 14.2,16.7',
  },
};

export interface HandDrawnPercentageProps {
  value: number | string;
  color: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Renders a percentage string (e.g. 74%) with hand-drawn marker-style strokes
 * in the category accent color, echoing the IntentionMark drawing technique.
 */
export const HandDrawnPercentage = memo(function HandDrawnPercentage({
  value,
  color,
  height = 22,
  style,
  testID,
}: HandDrawnPercentageProps) {
  const rawStr = String(value).trim();
  const text = rawStr.endsWith('%') ? rawStr : `${rawStr}%`;
  const chars = text.split('');

  const spacing = 1.6;
  let totalW = 0;
  const layout = chars.map((ch) => {
    const glyph = GLYPHS[ch] || GLYPHS['0'];
    const x = totalW;
    totalW += glyph.w + spacing;
    return { glyph, x };
  });
  if (layout.length > 0) {
    totalW -= spacing;
  }
  const glyphBoxHeight = 26;
  const width = Math.max(1, Math.round((totalW / glyphBoxHeight) * height));

  return (
    <Svg
      testID={testID}
      width={width}
      height={height}
      viewBox={`0 0 ${totalW} ${glyphBoxHeight}`}
      fill="none"
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {layout.map(({ glyph, x }, index) => (
        <G key={index} transform={`translate(${x}, 0)`}>
          <Path
            d={glyph.main}
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.84}
          />
          <Path
            d={glyph.bleed}
            stroke={color}
            strokeWidth={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.36}
          />
        </G>
      ))}
    </Svg>
  );
});
