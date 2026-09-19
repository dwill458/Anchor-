import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { V2PracticeMode } from '@/constants/v2/practice';

type ArtworkProps = {
  width?: number | string;
  height?: number;
  variant?: 'card' | 'featured';
  style?: StyleProp<ViewStyle>;
};

type Props = ArtworkProps & {
  mode: V2PracticeMode | string;
};

// -----------------------------------------------------------------------------
// 1. FOCUS ARTWORK (Purple)
// Returning to center, narrowing attention, concentric rings, centered staircase
// -----------------------------------------------------------------------------
export function FocusArtwork({
  width = '100%',
  height = 115,
  variant = 'card',
  style,
}: ArtworkProps) {
  if (variant === 'featured') {
    const vbWidth = 360;
    const vbHeight = 190;
    const cx = vbWidth / 2;
    const cy = 76;

    return (
      <View style={[styles.container, style]}>
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <LinearGradient id="focusHeroSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#2E1065" />
              <Stop offset="45%" stopColor="#4C1D95" />
              <Stop offset="75%" stopColor="#6D28D9" />
              <Stop offset="100%" stopColor="#8B5CF6" />
            </LinearGradient>
            <RadialGradient id="focusHeroApertureGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="40%" stopColor="#FAF5FF" stopOpacity="0.95" />
              <Stop offset="70%" stopColor="#DDD6FE" stopOpacity="0.6" />
              <Stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="focusHeroStepTread" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#EDE9FE" />
              <Stop offset="100%" stopColor="#DDD6FE" />
            </LinearGradient>
            <LinearGradient id="focusHeroStepRiser" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#C4B5FD" />
              <Stop offset="100%" stopColor="#7C3AED" />
            </LinearGradient>
            <ClipPath id="focusHeroClip">
              <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
            </ClipPath>
          </Defs>

          <G clipPath="url(#focusHeroClip)">
            {/* Background night sky */}
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#focusHeroSky)" />

            {/* Subtle paper grain / starlight speckles in upper sky */}
            <Circle cx={cx - 130} cy={28} r={1.2} fill="#EDE9FE" fillOpacity={0.65} />
            <Circle cx={cx - 95} cy={44} r={1} fill="#EDE9FE" fillOpacity={0.5} />
            <Circle cx={cx - 70} cy={22} r={1.3} fill="#EDE9FE" fillOpacity={0.7} />
            <Circle cx={cx - 40} cy={35} r={0.9} fill="#EDE9FE" fillOpacity={0.4} />
            <Circle cx={cx + 38} cy={26} r={1.1} fill="#EDE9FE" fillOpacity={0.6} />
            <Circle cx={cx + 72} cy={38} r={0.9} fill="#EDE9FE" fillOpacity={0.45} />
            <Circle cx={cx + 105} cy={24} r={1.2} fill="#EDE9FE" fillOpacity={0.7} />
            <Circle cx={cx + 138} cy={42} r={1} fill="#EDE9FE" fillOpacity={0.5} />

            {/* Concentric rings radiating outward from glowing center */}
            <Circle cx={cx} cy={cy} r={115} stroke="#C4B5FD" strokeOpacity={0.22} strokeWidth={1.2} fill="none" />
            <Circle cx={cx} cy={cy} r={95} stroke="#C4B5FD" strokeOpacity={0.32} strokeWidth={1.4} fill="none" />
            <Circle cx={cx} cy={cy} r={75} stroke="#DDD6FE" strokeOpacity={0.45} strokeWidth={1.6} fill="none" />
            <Circle cx={cx} cy={cy} r={56} stroke="#EDE9FE" strokeOpacity={0.65} strokeWidth={1.8} fill="none" />
            <Circle cx={cx} cy={cy} r={40} stroke="#FAF5FF" strokeOpacity={0.85} strokeWidth={2} fill="none" />

            {/* Radiant glowing sun aperture */}
            <Circle cx={cx} cy={cy} r={32} fill="url(#focusHeroApertureGlow)" />
            <Circle cx={cx} cy={cy} r={22} fill="#FAF5FF" />

            {/* Billowing textured clouds / nebula masses on left */}
            <Path
              d={`M -20 50 Q 15 35 40 60 Q 65 85 50 115 Q 75 135 60 170 Q 30 195 -20 190 Z`}
              fill="#581C87"
              fillOpacity={0.75}
            />
            <Path
              d={`M -20 70 Q 20 60 38 88 Q 55 115 35 145 Q 50 175 -20 190 Z`}
              fill="#6D28D9"
              fillOpacity={0.85}
            />
            <Path
              d={`M -20 100 Q 15 95 30 120 Q 42 150 10 185 L -20 190 Z`}
              fill="#7C3AED"
              fillOpacity={0.7}
            />

            {/* Billowing textured clouds on right */}
            <Path
              d={`M ${vbWidth + 20} 50 Q ${vbWidth - 15} 35 ${vbWidth - 40} 60 Q ${vbWidth - 65} 85 ${vbWidth - 50} 115 Q ${vbWidth - 75} 135 ${vbWidth - 60} 170 Q ${vbWidth - 30} 195 ${vbWidth + 20} 190 Z`}
              fill="#581C87"
              fillOpacity={0.75}
            />
            <Path
              d={`M ${vbWidth + 20} 70 Q ${vbWidth - 20} 60 ${vbWidth - 38} 88 Q ${vbWidth - 55} 115 ${vbWidth - 35} 145 Q ${vbWidth - 50} 175 ${vbWidth + 20} 190 Z`}
              fill="#6D28D9"
              fillOpacity={0.85}
            />
            <Path
              d={`M ${vbWidth + 20} 100 Q ${vbWidth - 15} 95 ${vbWidth - 30} 120 Q ${vbWidth - 42} 150 ${vbWidth - 10} 185 L ${vbWidth + 20} 190 Z`}
              fill="#7C3AED"
              fillOpacity={0.7}
            />

            {/* Flanking monolithic architectural gateway pillars */}
            <Polygon
              points={`${cx - 78},${cy + 10} ${cx - 62},${cy + 12} ${cx - 58},${vbHeight} ${cx - 88},${vbHeight}`}
              fill="#3B0764"
            />
            <Polygon
              points={`${cx - 62},${cy + 12} ${cx - 56},${cy + 12} ${cx - 52},${vbHeight} ${cx - 58},${vbHeight}`}
              fill="#581C87"
            />
            <Polygon
              points={`${cx + 78},${cy + 10} ${cx + 62},${cy + 12} ${cx + 58},${vbHeight} ${cx + 88},${vbHeight}`}
              fill="#3B0764"
            />
            <Polygon
              points={`${cx + 62},${cy + 12} ${cx + 56},${cy + 12} ${cx + 52},${vbHeight} ${cx + 58},${vbHeight}`}
              fill="#581C87"
            />

            {/* Grand perspective monolithic staircase ascending to glowing center */}
            {/* Step 1 (top-most, nearest aperture) */}
            <Polygon
              points={`${cx - 10},${cy + 16} ${cx + 10},${cy + 16} ${cx + 12},${cy + 20} ${cx - 12},${cy + 20}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 12} y={cy + 20} width={24} height={4} fill="url(#focusHeroStepRiser)" />

            {/* Step 2 */}
            <Polygon
              points={`${cx - 14},${cy + 24} ${cx + 14},${cy + 24} ${cx + 17},${cy + 29} ${cx - 17},${cy + 29}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 17} y={cy + 29} width={34} height={5} fill="url(#focusHeroStepRiser)" />

            {/* Step 3 */}
            <Polygon
              points={`${cx - 19},${cy + 34} ${cx + 19},${cy + 34} ${cx + 23},${cy + 40} ${cx - 23},${cy + 40}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 23} y={cy + 40} width={46} height={6} fill="url(#focusHeroStepRiser)" />

            {/* Step 4 */}
            <Polygon
              points={`${cx - 26},${cy + 46} ${cx + 26},${cy + 46} ${cx + 31},${cy + 53} ${cx - 31},${cy + 53}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 31} y={cy + 53} width={62} height={7} fill="url(#focusHeroStepRiser)" />

            {/* Step 5 */}
            <Polygon
              points={`${cx - 34},${cy + 60} ${cx + 34},${cy + 60} ${cx + 41},${cy + 69} ${cx - 41},${cy + 69}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 41} y={cy + 69} width={82} height={8} fill="url(#focusHeroStepRiser)" />

            {/* Step 6 */}
            <Polygon
              points={`${cx - 44},${cy + 77} ${cx + 44},${cy + 77} ${cx + 53},${cy + 88} ${cx - 53},${cy + 88}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 53} y={cy + 88} width={106} height={10} fill="url(#focusHeroStepRiser)" />

            {/* Step 7 (foreground platform base) */}
            <Polygon
              points={`${cx - 56},${cy + 98} ${cx + 56},${cy + 98} ${cx + 68},${vbHeight} ${cx - 68},${vbHeight}`}
              fill="url(#focusHeroStepTread)"
            />
            <Rect x={cx - 68} y={cy + 112} width={136} height={12} fill="url(#focusHeroStepRiser)" />
          </G>
        </Svg>
      </View>
    );
  }

  // Card variant (200x110)
  const vbWidth = 200;
  const vbHeight = 110;
  const cx = vbWidth / 2;
  const cy = 46;

  return (
    <View style={[styles.container, style]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="focusCardSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#EDE9FE" />
            <Stop offset="60%" stopColor="#DDD6FE" />
            <Stop offset="100%" stopColor="#C4B5FD" />
          </LinearGradient>
          <RadialGradient id="focusCardCore" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#3B0764" />
            <Stop offset="70%" stopColor="#581C87" />
            <Stop offset="100%" stopColor="#6D28D9" />
          </RadialGradient>
          <ClipPath id="focusCardClip">
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
          </ClipPath>
        </Defs>

        <G clipPath="url(#focusCardClip)">
          {/* Base sky */}
          <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#focusCardSky)" />

          {/* Concentric rings radiating outward */}
          <Circle cx={cx} cy={cy} r={82} stroke="#8B5CF6" strokeOpacity={0.16} strokeWidth={1.2} fill="none" />
          <Circle cx={cx} cy={cy} r={66} stroke="#8B5CF6" strokeOpacity={0.24} strokeWidth={1.3} fill="none" />
          <Circle cx={cx} cy={cy} r={50} stroke="#8B5CF6" strokeOpacity={0.36} strokeWidth={1.4} fill="none" />
          <Circle cx={cx} cy={cy} r={35} stroke="#7C3AED" strokeOpacity={0.52} strokeWidth={1.5} fill="none" />
          <Circle cx={cx} cy={cy} r={22} stroke="#6D28D9" strokeOpacity={0.72} strokeWidth={1.6} fill="none" />

          {/* Flanking cloud/mountain silhouettes */}
          <Path
            d={`M 0 54 Q 24 48 38 68 Q 50 86 36 110 L 0 110 Z`}
            fill="#8B5CF6"
            fillOpacity={0.55}
          />
          <Path
            d={`M ${vbWidth} 54 Q ${vbWidth - 24} 48 ${vbWidth - 38} 68 Q ${vbWidth - 50} 86 ${vbWidth - 36} 110 L ${vbWidth} 110 Z`}
            fill="#8B5CF6"
            fillOpacity={0.55}
          />

          {/* Center dark core portal */}
          <Circle cx={cx} cy={cy} r={13} fill="url(#focusCardCore)" />

          {/* Stepping perspective staircase leading to center */}
          {/* Step 1 */}
          <Polygon
            points={`${cx - 6},${cy + 13} ${cx + 6},${cy + 13} ${cx + 8},${cy + 17} ${cx - 8},${cy + 17}`}
            fill="#FAF5FF"
          />
          <Rect x={cx - 8} y={cy + 17} width={16} height={3} fill="#A78BFA" />

          {/* Step 2 */}
          <Polygon
            points={`${cx - 9},${cy + 20} ${cx + 9},${cy + 20} ${cx + 12},${cy + 25} ${cx - 12},${cy + 25}`}
            fill="#FAF5FF"
          />
          <Rect x={cx - 12} y={cy + 25} width={24} height={3.5} fill="#8B5CF6" />

          {/* Step 3 */}
          <Polygon
            points={`${cx - 13},${cy + 28.5} ${cx + 13},${cy + 28.5} ${cx + 17},${cy + 35} ${cx - 17},${cy + 35}`}
            fill="#FAF5FF"
          />
          <Rect x={cx - 17} y={cy + 35} width={34} height={4.5} fill="#7C3AED" />

          {/* Step 4 */}
          <Polygon
            points={`${cx - 18},${cy + 39.5} ${cx + 18},${cy + 39.5} ${cx + 24},${cy + 48} ${cx - 24},${cy + 48}`}
            fill="#FAF5FF"
          />
          <Rect x={cx - 24} y={cy + 48} width={48} height={5.5} fill="#6D28D9" />

          {/* Step 5 (base) */}
          <Polygon
            points={`${cx - 26},${cy + 53.5} ${cx + 26},${cy + 53.5} ${cx + 34},${vbHeight} ${cx - 34},${vbHeight}`}
            fill="#EDE9FE"
          />
        </G>
      </Svg>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 2. DEEP PRIME ARTWORK (Gold)
// Settling inward, descending canyon arches, warm glowing subterranean chamber
// -----------------------------------------------------------------------------
export function DeepPrimeArtwork({
  width = '100%',
  height = 115,
  variant = 'card',
  style,
}: ArtworkProps) {
  if (variant === 'featured') {
    const vbWidth = 360;
    const vbHeight = 190;
    const cx = vbWidth / 2;
    const cy = 110;

    return (
      <View style={[styles.container, style]}>
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <LinearGradient id="dpHeroBackdrop" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#451A03" />
              <Stop offset="40%" stopColor="#78350F" />
              <Stop offset="80%" stopColor="#B45309" />
              <Stop offset="100%" stopColor="#D97706" />
            </LinearGradient>
            <RadialGradient id="dpHeroChamberGlow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="35%" stopColor="#FEF3C7" stopOpacity="0.95" />
              <Stop offset="65%" stopColor="#FBBF24" stopOpacity="0.7" />
              <Stop offset="100%" stopColor="#92400E" stopOpacity="0" />
            </RadialGradient>
            <ClipPath id="dpHeroClip">
              <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
            </ClipPath>
          </Defs>

          <G clipPath="url(#dpHeroClip)">
            {/* Rich dark bronze base */}
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#dpHeroBackdrop)" />

            {/* Outer canyon arch layer 1 */}
            <Path
              d={`M 0 0 C 60 20 100 45 125 75 C 138 90 142 105 142 135 L 0 135 Z`}
              fill="#92400E"
              fillOpacity={0.8}
            />
            <Path
              d={`M ${vbWidth} 0 C ${vbWidth - 60} 20 ${vbWidth - 100} 45 ${vbWidth - 125} 75 C ${vbWidth - 138} 90 ${vbWidth - 142} 105 ${vbWidth - 142} 135 L ${vbWidth} 135 Z`}
              fill="#92400E"
              fillOpacity={0.8}
            />

            {/* Stepped concentric arch layers descending inward */}
            {/* Arch ring 5 (outermost gold) */}
            <Path
              d={`M ${cx - 150} ${vbHeight} A 150 140 0 0 1 ${cx + 150} ${vbHeight} Z`}
              fill="#B45309"
            />
            {/* Arch ring 4 */}
            <Path
              d={`M ${cx - 120} ${vbHeight} A 120 115 0 0 1 ${cx + 120} ${vbHeight} Z`}
              fill="#C28328"
            />
            {/* Arch ring 3 */}
            <Path
              d={`M ${cx - 92} ${vbHeight} A 92 90 0 0 1 ${cx + 92} ${vbHeight} Z`}
              fill="#D49B3E"
            />
            {/* Arch ring 2 */}
            <Path
              d={`M ${cx - 68} ${vbHeight} A 68 68 0 0 1 ${cx + 68} ${vbHeight} Z`}
              fill="#E9C47A"
            />
            {/* Arch ring 1 (inner sanctuary opening) */}
            <Path
              d={`M ${cx - 46} ${vbHeight} A 46 48 0 0 1 ${cx + 46} ${vbHeight} Z`}
              fill="#FEF3C7"
            />

            {/* Radiant glowing warm aperture core */}
            <Circle cx={cx} cy={cy + 8} r={44} fill="url(#dpHeroChamberGlow)" />
            <Circle cx={cx} cy={cy + 12} r={28} fill="#FFFFFF" />

            {/* Descending golden staircase into the chamber */}
            <Polygon
              points={`${cx - 16},${cy + 22} ${cx + 16},${cy + 22} ${cx + 19},${cy + 28} ${cx - 19},${cy + 28}`}
              fill="#FEF3C7"
            />
            <Rect x={cx - 19} y={cy + 28} width={38} height={5} fill="#D49B3E" />

            <Polygon
              points={`${cx - 22},${cy + 33} ${cx + 22},${cy + 33} ${cx + 26},${cy + 41} ${cx - 26},${cy + 41}`}
              fill="#FEF3C7"
            />
            <Rect x={cx - 26} y={cy + 41} width={52} height={6} fill="#B45309" />

            <Polygon
              points={`${cx - 30},${cy + 47} ${cx + 30},${cy + 47} ${cx + 36},${cy + 57} ${cx - 36},${cy + 57}`}
              fill="#FDE68A"
            />
            <Rect x={cx - 36} y={cy + 57} width={72} height={7} fill="#92400E" />

            <Polygon
              points={`${cx - 42},${cy + 64} ${cx + 42},${cy + 64} ${cx + 52},${vbHeight} ${cx - 52},${vbHeight}`}
              fill="#FBBF24"
            />

            {/* Terraced geological shelf contours for textural depth */}
            <Path
              d={`M 0 60 Q 50 80 90 70 Q 120 62 140 85`}
              stroke="#D49B3E"
              strokeOpacity={0.4}
              strokeWidth={1.5}
              fill="none"
            />
            <Path
              d={`M ${vbWidth} 60 Q ${vbWidth - 50} 80 ${vbWidth - 90} 70 Q ${vbWidth - 120} 62 ${vbWidth - 140} 85`}
              stroke="#D49B3E"
              strokeOpacity={0.4}
              strokeWidth={1.5}
              fill="none"
            />
          </G>
        </Svg>
      </View>
    );
  }

  // Card variant (200x110)
  const vbWidth = 200;
  const vbHeight = 110;
  const cx = vbWidth / 2;

  return (
    <View style={[styles.container, style]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="dpCardSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FDFBF4" />
            <Stop offset="60%" stopColor="#F8E9C4" />
            <Stop offset="100%" stopColor="#E9C47A" />
          </LinearGradient>
          <RadialGradient id="dpCardCoreGlow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="50%" stopColor="#FEF3C7" />
            <Stop offset="100%" stopColor="#F59E0B" />
          </RadialGradient>
          <ClipPath id="dpCardClip">
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
          </ClipPath>
        </Defs>

        <G clipPath="url(#dpCardClip)">
          {/* Base */}
          <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#dpCardSky)" />

          {/* Stepped concentric organic arch chambers descending inward */}
          {/* Layer 5 */}
          <Path
            d={`M ${cx - 96} ${vbHeight} A 96 90 0 0 1 ${cx + 96} ${vbHeight} Z`}
            fill="#B45309"
          />
          {/* Layer 4 */}
          <Path
            d={`M ${cx - 76} ${vbHeight} A 76 74 0 0 1 ${cx + 76} ${vbHeight} Z`}
            fill="#C28328"
          />
          {/* Layer 3 */}
          <Path
            d={`M ${cx - 58} ${vbHeight} A 58 58 0 0 1 ${cx + 58} ${vbHeight} Z`}
            fill="#D49B3E"
          />
          {/* Layer 2 */}
          <Path
            d={`M ${cx - 42} ${vbHeight} A 42 43 0 0 1 ${cx + 42} ${vbHeight} Z`}
            fill="#E9C47A"
          />
          {/* Layer 1 (aperture wall) */}
          <Path
            d={`M ${cx - 28} ${vbHeight} A 28 30 0 0 1 ${cx + 28} ${vbHeight} Z`}
            fill="#FEF3C7"
          />

          {/* Glowing central sun chamber */}
          <Circle cx={cx} cy={vbHeight - 34} r={18} fill="url(#dpCardCoreGlow)" />
          <Circle cx={cx} cy={vbHeight - 34} r={11} fill="#FFFFFF" />

          {/* Descending steps */}
          <Polygon
            points={`${cx - 10},${vbHeight - 24} ${cx + 10},${vbHeight - 24} ${cx + 12},${vbHeight - 19} ${cx - 12},${vbHeight - 19}`}
            fill="#FFFFFF"
          />
          <Rect x={cx - 12} y={vbHeight - 19} width={24} height={3.5} fill="#D49B3E" />

          <Polygon
            points={`${cx - 15},${vbHeight - 15.5} ${cx + 15},${vbHeight - 15.5} ${cx + 19},${vbHeight - 9} ${cx - 19},${vbHeight - 9}`}
            fill="#FEF3C7"
          />
          <Rect x={cx - 19} y={vbHeight - 9} width={38} height={4} fill="#B45309" />

          <Polygon
            points={`${cx - 22},${vbHeight - 5} ${cx + 22},${vbHeight - 5} ${cx + 27},${vbHeight} ${cx - 27},${vbHeight}`}
            fill="#FDE68A"
          />
        </G>
      </Svg>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 3. VISUALIZE ARTWORK (Blue)
// Open future horizon, classical framed arch, golden guiding star beacon, river path
// -----------------------------------------------------------------------------
export function VisualizeArtwork({
  width = '100%',
  height = 115,
  variant = 'card',
  style,
}: ArtworkProps) {
  if (variant === 'featured') {
    const vbWidth = 360;
    const vbHeight = 190;
    const cx = vbWidth / 2;
    const archW = 150;
    const archH = 175;
    const archLeft = cx - archW / 2;
    const archRight = cx + archW / 2;
    const archRadius = archW / 2;
    const starY = 74;

    return (
      <View style={[styles.container, style]}>
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <LinearGradient id="visHeroSky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#93C5FD" />
              <Stop offset="50%" stopColor="#E0F2FE" />
              <Stop offset="80%" stopColor="#FEF3C7" />
              <Stop offset="100%" stopColor="#FDE68A" />
            </LinearGradient>
            <LinearGradient id="visHeroSea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#60A5FA" />
              <Stop offset="55%" stopColor="#3B82C4" />
              <Stop offset="100%" stopColor="#1E40AF" />
            </LinearGradient>
            <LinearGradient id="visHeroWall" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#E0E7FF" />
              <Stop offset="100%" stopColor="#C7D2FE" />
            </LinearGradient>
            <ClipPath id="visHeroArchClip">
              <Path
                d={`M ${archLeft} ${vbHeight} L ${archLeft} ${archRadius + 14} A ${archRadius} ${archRadius} 0 0 1 ${archRight} ${archRadius + 14} L ${archRight} ${vbHeight} Z`}
              />
            </ClipPath>
            <ClipPath id="visHeroFullClip">
              <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
            </ClipPath>
          </Defs>

          <G clipPath="url(#visHeroFullClip)">
            {/* Outer architectural wall frame */}
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#visHeroWall)" />

            {/* Framed vista through the grand arch */}
            <G clipPath="url(#visHeroArchClip)">
              {/* Sky */}
              <Rect x={archLeft - 10} y="0" width={archW + 20} height={vbHeight} fill="url(#visHeroSky)" />

              {/* Distant soft mountain horizon */}
              <Path
                d={`M ${archLeft - 10} 95 Q ${cx - 30} 86 ${cx} 92 Q ${cx + 40} 85 ${archRight + 10} 96 L ${archRight + 10} 115 L ${archLeft - 10} 115 Z`}
                fill="#93C5FD"
                fillOpacity={0.85}
              />
              <Path
                d={`M ${archLeft - 10} 104 Q ${cx - 20} 98 ${cx + 15} 102 Q ${cx + 50} 96 ${archRight + 10} 106 L ${archRight + 10} 120 L ${archLeft - 10} 120 Z`}
                fill="#60A5FA"
              />

              {/* Water / ground surface */}
              <Rect x={archLeft - 10} y="112" width={archW + 20} height={vbHeight - 112} fill="url(#visHeroSea)" />

              {/* Winding luminous river path toward horizon */}
              <Path
                d={`M ${cx - 16} ${vbHeight} C ${cx - 5} 155 ${cx + 20} 142 ${cx + 6} 126 C ${cx - 2} 116 ${cx} 110 ${cx} 96 C ${cx + 3} 110 ${cx + 7} 116 ${cx + 18} 126 C ${cx + 32} 142 ${cx + 6} 155 ${cx + 18} ${vbHeight} Z`}
                fill="#FFFFFF"
                fillOpacity={0.8}
              />

              {/* Radiant 8-point golden guiding star / beacon */}
              <Circle cx={cx} cy={starY} r={22} fill="#FEF08A" fillOpacity={0.5} />
              <Circle cx={cx} cy={starY} r={12} fill="#FDE047" fillOpacity={0.8} />

              {/* Star points (8-point compass star) */}
              <Polygon
                points={`${cx},${starY - 18} ${cx + 3},${starY - 4} ${cx + 18},${starY} ${cx + 3},${starY + 4} ${cx},${starY + 18} ${cx - 3},${starY + 4} ${cx - 18},${starY} ${cx - 3},${starY - 4}`}
                fill="#F59E0B"
              />
              <Polygon
                points={`${cx - 7},${starY - 7} ${cx},${starY - 2} ${cx + 7},${starY - 7} ${cx + 2},${starY} ${cx + 7},${starY + 7} ${cx},${starY + 2} ${cx - 7},${starY + 7} ${cx - 2},${starY}`}
                fill="#D97706"
              />
              <Circle cx={cx} cy={starY} r={3.5} fill="#FFFFFF" />
            </G>

            {/* Inner bevel border of the archway */}
            <Path
              d={`M ${archLeft} ${vbHeight} L ${archLeft} ${archRadius + 14} A ${archRadius} ${archRadius} 0 0 1 ${archRight} ${archRadius + 14} L ${archRight} ${vbHeight}`}
              stroke="#A5B4FC"
              strokeWidth={4.5}
              fill="none"
            />
            <Path
              d={`M ${archLeft - 2} ${vbHeight} L ${archLeft - 2} ${archRadius + 12} A ${archRadius + 2} ${archRadius + 2} 0 0 1 ${archRight + 2} ${archRadius + 12} L ${archRight + 2} ${vbHeight}`}
              stroke="#FFFFFF"
              strokeWidth={1.5}
              strokeOpacity={0.7}
              fill="none"
            />

            {/* Foreground botanical silhouettes framing left and right */}
            {/* Left foliage branch */}
            <Path d="M 12 110 C 26 95 44 98 48 112 C 34 116 20 114 12 110 Z" fill="#1E3A8A" fillOpacity={0.85} />
            <Path d="M 6 128 C 24 115 48 120 54 135 C 38 140 18 138 6 128 Z" fill="#1E3A8A" fillOpacity={0.9} />
            <Path d="M 18 148 C 36 135 58 144 60 160 C 44 164 26 160 18 148 Z" fill="#1E3A8A" fillOpacity={0.85} />
            <Path d="M 8 168 C 28 158 48 166 50 184 C 32 186 16 180 8 168 Z" fill="#1E3A8A" fillOpacity={0.8} />
            <Path d="M 0 190 Q 25 155 35 110" stroke="#1E3A8A" strokeWidth={2} fill="none" />

            {/* Right foliage branch */}
            <Path d={`M ${vbWidth - 12} 110 C ${vbWidth - 26} 95 ${vbWidth - 44} 98 ${vbWidth - 48} 112 C ${vbWidth - 34} 116 ${vbWidth - 20} 114 ${vbWidth - 12} 110 Z`} fill="#1E3A8A" fillOpacity={0.85} />
            <Path d={`M ${vbWidth - 6} 128 C ${vbWidth - 24} 115 ${vbWidth - 48} 120 ${vbWidth - 54} 135 C ${vbWidth - 38} 140 ${vbWidth - 18} 138 ${vbWidth - 6} 128 Z`} fill="#1E3A8A" fillOpacity={0.9} />
            <Path d={`M ${vbWidth - 18} 148 C ${vbWidth - 36} 135 ${vbWidth - 58} 144 ${vbWidth - 60} 160 C ${vbWidth - 44} 164 ${vbWidth - 26} 160 ${vbWidth - 18} 148 Z`} fill="#1E3A8A" fillOpacity={0.85} />
            <Path d={`M ${vbWidth - 8} 168 C ${vbWidth - 28} 158 ${vbWidth - 48} 166 ${vbWidth - 50} 184 C ${vbWidth - 32} 186 ${vbWidth - 16} 180 ${vbWidth - 8} 168 Z`} fill="#1E3A8A" fillOpacity={0.8} />
            <Path d={`M ${vbWidth} 190 Q ${vbWidth - 25} 155 ${vbWidth - 35} 110`} stroke="#1E3A8A" strokeWidth={2} fill="none" />
          </G>
        </Svg>
      </View>
    );
  }

  // Card variant (200x110)
  const vbWidth = 200;
  const vbHeight = 110;
  const cx = vbWidth / 2;
  const archW = 86;
  const archLeft = cx - archW / 2;
  const archRight = cx + archW / 2;
  const archRadius = archW / 2;
  const starY = 46;

  return (
    <View style={[styles.container, style]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="visCardSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#BAE6FD" />
            <Stop offset="55%" stopColor="#E0F2FE" />
            <Stop offset="100%" stopColor="#FEF3C7" />
          </LinearGradient>
          <LinearGradient id="visCardSea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#60A5FA" />
            <Stop offset="60%" stopColor="#3B82C4" />
            <Stop offset="100%" stopColor="#1E3A8A" />
          </LinearGradient>
          <ClipPath id="visCardArchClip">
            <Path
              d={`M ${archLeft} ${vbHeight} L ${archLeft} ${archRadius + 6} A ${archRadius} ${archRadius} 0 0 1 ${archRight} ${archRadius + 6} L ${archRight} ${vbHeight} Z`}
            />
          </ClipPath>
          <ClipPath id="visCardFullClip">
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
          </ClipPath>
        </Defs>

        <G clipPath="url(#visCardFullClip)">
          {/* Wall background */}
          <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="#EDF4FA" />

          {/* Arch aperture */}
          <G clipPath="url(#visCardArchClip)">
            <Rect x={archLeft - 10} y="0" width={archW + 20} height={vbHeight} fill="url(#visCardSky)" />

            {/* Mountains */}
            <Path
              d={`M ${archLeft - 10} 56 Q ${cx - 15} 50 ${cx} 54 Q ${cx + 20} 49 ${archRight + 10} 56 L ${archRight + 10} 68 L ${archLeft - 10} 68 Z`}
              fill="#93C5FD"
            />
            {/* Water */}
            <Rect x={archLeft - 10} y="62" width={archW + 20} height={vbHeight - 62} fill="url(#visCardSea)" />

            {/* Winding river path */}
            <Path
              d={`M ${cx - 8} ${vbHeight} C ${cx - 2} 94 ${cx + 12} 88 ${cx + 4} 78 C ${cx - 1} 70 ${cx} 66 ${cx} 58 C ${cx + 2} 66 ${cx + 4} 70 ${cx + 10} 78 C ${cx + 18} 88 ${cx + 4} 94 ${cx + 10} ${vbHeight} Z`}
              fill="#FFFFFF"
              fillOpacity={0.8}
            />

            {/* Golden 8-point guiding star */}
            <Circle cx={cx} cy={starY} r={12} fill="#FEF08A" fillOpacity={0.5} />
            <Polygon
              points={`${cx},${starY - 11} ${cx + 2},${starY - 3} ${cx + 11},${starY} ${cx + 2},${starY + 3} ${cx},${starY + 11} ${cx - 2},${starY + 3} ${cx - 11},${starY} ${cx - 2},${starY - 3}`}
              fill="#F59E0B"
            />
            <Circle cx={cx} cy={starY} r={2.5} fill="#FFFFFF" />
          </G>

          {/* Arch frame border */}
          <Path
            d={`M ${archLeft} ${vbHeight} L ${archLeft} ${archRadius + 6} A ${archRadius} ${archRadius} 0 0 1 ${archRight} ${archRadius + 6} L ${archRight} ${vbHeight}`}
            stroke="#9CBED6"
            strokeWidth={3}
            fill="none"
          />

          {/* Left foliage branch */}
          <Path d="M 4 64 C 12 55 22 57 24 65 C 16 68 8 67 4 64 Z" fill="#1E3A8A" fillOpacity={0.8} />
          <Path d="M 2 76 C 14 68 28 72 32 80 C 20 83 8 82 2 76 Z" fill="#1E3A8A" fillOpacity={0.85} />
          <Path d="M 6 90 C 18 82 32 87 34 96 C 22 99 10 97 6 90 Z" fill="#1E3A8A" fillOpacity={0.8} />
          <Path d="M 0 110 Q 14 88 18 62" stroke="#1E3A8A" strokeWidth={1.4} fill="none" />

          {/* Right foliage branch */}
          <Path d={`M ${vbWidth - 4} 64 C ${vbWidth - 12} 55 ${vbWidth - 22} 57 ${vbWidth - 24} 65 C ${vbWidth - 16} 68 ${vbWidth - 8} 67 ${vbWidth - 4} 64 Z`} fill="#1E3A8A" fillOpacity={0.8} />
          <Path d={`M ${vbWidth - 2} 76 C ${vbWidth - 14} 68 ${vbWidth - 28} 72 ${vbWidth - 32} 80 C ${vbWidth - 20} 83 ${vbWidth - 8} 82 ${vbWidth - 2} 76 Z`} fill="#1E3A8A" fillOpacity={0.85} />
          <Path d={`M ${vbWidth - 6} 90 C ${vbWidth - 18} 82 ${vbWidth - 32} 87 ${vbWidth - 34} 96 C ${vbWidth - 22} 99 ${vbWidth - 10} 97 ${vbWidth - 6} 90 Z`} fill="#1E3A8A" fillOpacity={0.8} />
          <Path d={`M ${vbWidth} 110 Q ${vbWidth - 14} 88 ${vbWidth - 18} 62`} stroke="#1E3A8A" strokeWidth={1.4} fill="none" />
        </G>
      </Svg>
    </View>
  );
}

// -----------------------------------------------------------------------------
// 4. RELEASE ARTWORK (Orange)
// Completion and letting go, sweeping flowing ribbons, dispersing leaves / sparks
// -----------------------------------------------------------------------------
export function ReleaseArtwork({
  width = '100%',
  height = 115,
  variant = 'card',
  style,
}: ArtworkProps) {
  if (variant === 'featured') {
    const vbWidth = 360;
    const vbHeight = 190;
    const sunCx = vbWidth * 0.44;
    const sunCy = 85;
    const sunR = 38;

    return (
      <View style={[styles.container, style]}>
        <Svg
          width={width}
          height={height}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            <LinearGradient id="relHeroBackdrop" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFF7ED" />
              <Stop offset="50%" stopColor="#FED7AA" />
              <Stop offset="100%" stopColor="#FDBA74" />
            </LinearGradient>
            <RadialGradient id="relHeroSunHalo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.4" />
              <Stop offset="65%" stopColor="#FDBA74" stopOpacity="0.15" />
              <Stop offset="100%" stopColor="#FFF7ED" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="relHeroSun" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#F97316" />
              <Stop offset="60%" stopColor="#FB923C" />
              <Stop offset="100%" stopColor="#FBBF24" />
            </LinearGradient>
            <LinearGradient id="relHeroRibbon1" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#FB923C" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#EA580C" stopOpacity="0.9" />
            </LinearGradient>
            <ClipPath id="relHeroClip">
              <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
            </ClipPath>
          </Defs>

          <G clipPath="url(#relHeroClip)">
            {/* Sky */}
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#relHeroBackdrop)" />

            {/* Glowing Sun Halo & Disc */}
            <Circle cx={sunCx} cy={sunCy} r={sunR * 2.2} fill="url(#relHeroSunHalo)" />
            <Circle cx={sunCx} cy={sunCy} r={sunR} fill="url(#relHeroSun)" />
            <Circle cx={sunCx} cy={sunCy} r={sunR * 0.65} fill="#FEF08A" fillOpacity={0.8} />

            {/* Sweeping organic wave ribbons of unwinding tension */}
            <Path
              d={`M 0 115 C 70 85 140 120 200 95 C 260 70 310 115 ${vbWidth} 90 L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
              fill="url(#relHeroRibbon1)"
              fillOpacity={0.65}
            />
            <Path
              d={`M 0 135 C 80 110 160 142 230 118 C 290 98 330 130 ${vbWidth} 115 L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
              fill="#EA580C"
              fillOpacity={0.78}
            />
            <Path
              d={`M 0 155 C 90 140 180 162 250 145 C 310 130 340 150 ${vbWidth} 142 L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
              fill="#9A3412"
              fillOpacity={0.88}
            />

            {/* Flowing wind line releasing tension across the sky */}
            <Path
              d={`M 0 100 Q 110 70 210 98 T ${vbWidth} 75`}
              stroke="#EA580C"
              strokeWidth={1.8}
              strokeOpacity={0.4}
              fill="none"
            />

            {/* Dispersal of drifting leaves/seed fragments floating away freely */}
            {/* Leaf 1 */}
            <Path d="M 230 65 C 235 55 248 56 246 68 C 242 76 232 74 230 65 Z" fill="#C2410C" />
            {/* Leaf 2 */}
            <Path d="M 252 50 C 258 40 270 42 268 54 C 264 61 254 58 252 50 Z" fill="#EA580C" />
            {/* Leaf 3 */}
            <Path d="M 275 35 C 280 26 292 28 290 38 C 286 46 277 43 275 35 Z" fill="#9A3412" />
            {/* Leaf 4 */}
            <Path d="M 300 24 C 304 16 314 18 312 26 C 309 33 302 31 300 24 Z" fill="#C2410C" />
            {/* Leaf 5 */}
            <Path d="M 324 16 C 328 10 336 12 334 18 C 332 23 326 21 324 16 Z" fill="#EA580C" />
            {/* Leaf 6 */}
            <Path d="M 240 85 C 246 76 258 78 255 88 C 251 95 242 93 240 85 Z" fill="#D97706" />
            {/* Leaf 7 */}
            <Path d="M 268 70 C 274 62 284 64 282 72 C 279 79 271 77 268 70 Z" fill="#EA580C" />
            {/* Leaf 8 */}
            <Path d="M 292 56 C 297 48 307 50 305 58 C 302 64 295 62 292 56 Z" fill="#C2410C" />
            {/* Leaf 9 */}
            <Path d="M 315 44 C 319 38 328 40 326 47 C 323 52 318 50 315 44 Z" fill="#EA580C" />
            {/* Floating sparks */}
            <Circle cx={260} cy={35} r={2} fill="#F59E0B" />
            <Circle cx={285} cy={22} r={1.5} fill="#F59E0B" />
            <Circle cx={310} cy={14} r={1.8} fill="#EA580C" />
            <Circle cx={335} cy={30} r={1.6} fill="#F97316" />
            <Circle cx={348} cy={45} r={1.4} fill="#EA580C" />
          </G>
        </Svg>
      </View>
    );
  }

  // Card variant (200x110)
  const vbWidth = 200;
  const vbHeight = 110;
  const sunCx = 135;
  const sunCy = 50;
  const sunR = 24;

  return (
    <View style={[styles.container, style]}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbWidth} ${vbHeight}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="relCardSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFF7ED" />
            <Stop offset="60%" stopColor="#FED7AA" />
            <Stop offset="100%" stopColor="#FDBA74" />
          </LinearGradient>
          <RadialGradient id="relCardSunHalo" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#EA580C" stopOpacity="0.4" />
            <Stop offset="65%" stopColor="#FDBA74" stopOpacity="0.15" />
            <Stop offset="100%" stopColor="#FFF7ED" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="relCardSun" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#F97316" />
            <Stop offset="60%" stopColor="#FB923C" />
            <Stop offset="100%" stopColor="#FBBF24" />
          </LinearGradient>
          <ClipPath id="relCardClip">
            <Rect x="0" y="0" width={vbWidth} height={vbHeight} rx="0" />
          </ClipPath>
        </Defs>

        <G clipPath="url(#relCardClip)">
          {/* Base */}
          <Rect x="0" y="0" width={vbWidth} height={vbHeight} fill="url(#relCardSky)" />

          {/* Glowing sun */}
          <Circle cx={sunCx} cy={sunCy} r={sunR * 1.8} fill="url(#relCardSunHalo)" />
          <Circle cx={sunCx} cy={sunCy} r={sunR} fill="url(#relCardSun)" />
          <Circle cx={sunCx} cy={sunCy} r={sunR * 0.6} fill="#FEF08A" fillOpacity={0.8} />

          {/* Flowing dunes / release wave ribbons */}
          <Path
            d={`M 0 68 Q 50 58 100 74 Q 150 90 ${vbWidth} 60 L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
            fill="#FB923C"
            fillOpacity={0.72}
          />
          <Path
            d={`M 0 80 Q 55 74 110 88 Q 160 98 ${vbWidth} 78 L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
            fill="#EA580C"
            fillOpacity={0.75}
          />
          <Path
            d={`M 0 94 Q 60 92 120 102 Q 170 112 ${vbWidth} 94 L ${vbWidth} ${vbHeight} L 0 ${vbHeight} Z`}
            fill="#9A3412"
            fillOpacity={0.8}
          />

          {/* Dispersing leaf fragments floating away to the right */}
          <Path d="M 148 42 C 151 36 158 37 157 44 C 155 49 149 48 148 42 Z" fill="#EA580C" />
          <Path d="M 160 32 C 163 26 170 27 169 34 C 167 39 161 38 160 32 Z" fill="#C2410C" />
          <Path d="M 172 24 C 175 18 181 20 180 26 C 178 30 173 29 172 24 Z" fill="#9A3412" />
          <Path d="M 184 16 C 187 11 193 12 192 18 C 190 22 185 21 184 16 Z" fill="#C2410C" />

          <Path d="M 154 54 C 158 48 165 50 164 57 C 161 62 155 60 154 54 Z" fill="#EA580C" />
          <Path d="M 168 46 C 172 41 179 43 177 49 C 175 54 169 53 168 46 Z" fill="#D97706" />
          <Path d="M 180 36 C 183 31 190 33 188 38 C 186 43 181 42 180 36 Z" fill="#C2410C" />

          {/* Floating tiny sparks */}
          <Circle cx={165} cy={20} r={1.5} fill="#F59E0B" />
          <Circle cx={188} cy={28} r={1.3} fill="#EA580C" />
        </G>
      </Svg>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Unified Practice Artwork Component
// -----------------------------------------------------------------------------
export function V2PracticeArtwork({
  mode,
  width = '100%',
  height = 115,
  variant = 'card',
  style,
}: Props) {
  const normalized = mode.replace(/[\s_-]/g, '').toLowerCase();

  switch (normalized) {
    case 'deepprime':
      return <DeepPrimeArtwork width={width} height={height} variant={variant} style={style} />;
    case 'visualize':
      return <VisualizeArtwork width={width} height={height} variant={variant} style={style} />;
    case 'release':
      return <ReleaseArtwork width={width} height={height} variant={variant} style={style} />;
    case 'focus':
    default:
      return <FocusArtwork width={width} height={height} variant={variant} style={style} />;
  }
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
});
