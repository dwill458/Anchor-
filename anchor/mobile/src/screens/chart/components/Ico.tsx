/**
 * Chart icon set — a 1:1 react-native-svg port of the prototype's `Ico`.
 * Every path is the prototype's, on the same 24×24 viewBox.
 */
import React from 'react';
import { Circle, Path, Rect, Svg } from 'react-native-svg';
import { C } from '../chartTokens';

export type IcoName =
  | 'compass'
  | 'home'
  | 'bolt'
  | 'eye'
  | 'depth'
  | 'check'
  | 'plus'
  | 'star'
  | 'dots'
  | 'chev'
  | 'chevD'
  | 'close'
  | 'bell'
  | 'route'
  | 'anchor'
  | 'edit'
  | 'archive'
  | 'sparkle'
  | 'flag';

interface IcoProps {
  k: IcoName;
  /** Rendered size in points (prototype `s`). */
  s?: number;
  /** Stroke/fill colour (prototype `c`). */
  c?: string;
  /** Stroke width (prototype `w`). */
  w?: number;
}

export const Ico: React.FC<IcoProps> = ({ k, s = 16, c = C.gold, w = 1.5 }) => {
  const p = { width: s, height: s, viewBox: '0 0 24 24' } as const;

  switch (k) {
    case 'compass':
      return (
        <Svg {...p}>
          <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={w} fill="none" />
          <Path
            d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1z"
            stroke={c}
            strokeWidth={w}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'home':
      return (
        <Svg {...p}>
          <Path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5z"
            stroke={c}
            strokeWidth={w}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'bolt':
      return (
        <Svg {...p}>
          <Path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill={c} />
        </Svg>
      );
    case 'eye':
      return (
        <Svg {...p}>
          <Path
            d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"
            stroke={c}
            strokeWidth={w}
            fill="none"
          />
          <Circle cx="12" cy="12" r="3.2" stroke={c} strokeWidth={w} fill="none" />
        </Svg>
      );
    case 'depth':
      return (
        <Svg {...p}>
          <Circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth={w * 0.9} fill="none" />
          <Circle cx="12" cy="12" r="4.6" stroke={c} strokeWidth={w * 0.9} fill="none" />
          <Circle cx="12" cy="12" r="1.3" fill={c} />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...p}>
          <Path
            d="M5 12.5 10 17.5 19 7"
            stroke={c}
            strokeWidth={w + 0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'plus':
      return (
        <Svg {...p}>
          <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'star':
      return (
        <Svg {...p}>
          <Path
            d="M12 3.2 13.9 9.4 20.2 11.3 13.9 13.2 12 19.4 10.1 13.2 3.8 11.3 10.1 9.4 12 3.2z"
            fill={c}
          />
        </Svg>
      );
    case 'dots':
      return (
        <Svg {...p}>
          <Circle cx="5" cy="12" r="1.6" fill={c} />
          <Circle cx="12" cy="12" r="1.6" fill={c} />
          <Circle cx="19" cy="12" r="1.6" fill={c} />
        </Svg>
      );
    case 'chev':
      return (
        <Svg {...p}>
          <Path
            d="M9 5l7 7-7 7"
            stroke={c}
            strokeWidth={w + 0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'chevD':
      return (
        <Svg {...p}>
          <Path
            d="M5 9l7 7 7-7"
            stroke={c}
            strokeWidth={w + 0.3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    case 'close':
      return (
        <Svg {...p}>
          <Path d="M6 6l12 12M18 6L6 18" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'bell':
      return (
        <Svg {...p}>
          <Path
            d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z"
            stroke={c}
            strokeWidth={w}
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M10.2 19a2 2 0 0 0 3.6 0" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'route':
      return (
        <Svg {...p}>
          <Circle cx="6" cy="18" r="2.6" stroke={c} strokeWidth={w} fill="none" />
          <Circle cx="18" cy="6" r="2.6" stroke={c} strokeWidth={w} fill="none" />
          <Path
            d="M8.4 16.2C11 13.5 9 10 12 8.4"
            stroke={c}
            strokeWidth={w}
            strokeLinecap="round"
            strokeDasharray="2.4 2.6"
            fill="none"
          />
        </Svg>
      );
    case 'anchor':
      return (
        <Svg {...p}>
          <Circle cx="12" cy="5" r="2.2" stroke={c} strokeWidth={w} fill="none" />
          <Path
            d="M12 7.2V20M7.5 10.5h9M4 14.5c0 4 3.8 5.8 8 5.8s8-1.8 8-5.8"
            stroke={c}
            strokeWidth={w}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      );
    case 'edit':
      return (
        <Svg {...p}>
          <Path d="M4 20h4L19 9l-4-4L4 16v4z" stroke={c} strokeWidth={w} strokeLinejoin="round" fill="none" />
        </Svg>
      );
    case 'archive':
      return (
        <Svg {...p}>
          <Rect x="3.5" y="4.5" width="17" height="4" rx="1" stroke={c} strokeWidth={w} fill="none" />
          <Path
            d="M5.5 8.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5"
            stroke={c}
            strokeWidth={w}
            fill="none"
          />
          <Path d="M10 12.5h4" stroke={c} strokeWidth={w} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'sparkle':
      return (
        <Svg {...p}>
          <Path
            d="M12 3.5l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5 1.5-5z"
            stroke={c}
            strokeWidth={w}
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M18.5 16.5l.7 2.2 2.2.7-2.2.7-.7 2.2-.7-2.2-2.2-.7 2.2-.7.7-2.2z"
            fill={c}
            opacity={0.7}
          />
        </Svg>
      );
    case 'flag':
      return (
        <Svg {...p}>
          <Path
            d="M6 21V4M6 4.8h11l-2.4 3.6L17 12H6"
            stroke={c}
            strokeWidth={w}
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      );
    default:
      return null;
  }
};
