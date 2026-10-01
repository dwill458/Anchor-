import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path, Defs, RadialGradient, Stop } from "react-native-svg";

interface Props {
  size: number;
}

/**
 * Screen 8 background reticle & celestial starburst behind the hero Anchor.
 * Matches the refined astrolabe / star burst compass design from the Anchor 2.0 system.
 */
export function Screen8CelestialReticle({ size }: Props) {
  const pad = 50;
  const svgSize = size + pad * 2;
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const r = size / 2;

  const ring1 = r + 12;
  const ring2 = r + 24;
  const rayExt = 36;
  const gold = "#D4AF6A";

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.center]} pointerEvents="none">
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <Defs>
          <RadialGradient id="anchorGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#F9ECD2" stopOpacity="0.8" />
            <Stop offset="55%" stopColor="#F6E4C0" stopOpacity="0.35" />
            <Stop offset="85%" stopColor="#FBF8F2" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#FBF8F2" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Soft luminous ambient warm backing */}
        <Circle cx={cx} cy={cy} r={r + 42} fill="url(#anchorGlow)" />

        {/* Inner concentric ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={ring1}
          stroke={gold}
          strokeWidth="0.85"
          strokeOpacity="0.32"
          fill="none"
        />

        {/* Outer concentric ring */}
        <Circle
          cx={cx}
          cy={cy}
          r={ring2}
          stroke={gold}
          strokeWidth="1.1"
          strokeOpacity="0.5"
          fill="none"
        />

        {/* Small cardinal dots on outer ring */}
        <Circle cx={cx} cy={cy - ring2} r="2" fill={gold} fillOpacity="0.75" />
        <Circle cx={cx} cy={cy + ring2} r="2" fill={gold} fillOpacity="0.75" />
        <Circle cx={cx - ring2} cy={cy} r="2" fill={gold} fillOpacity="0.75" />
        <Circle cx={cx + ring2} cy={cy} r="2" fill={gold} fillOpacity="0.75" />

        {/* North Ray & Diamond Star */}
        <Line
          x1={cx}
          y1={cy - ring2}
          x2={cx}
          y2={cy - ring2 - rayExt}
          stroke={gold}
          strokeWidth="1.1"
          strokeOpacity="0.6"
        />
        <Path
          d={`M ${cx} ${cy - ring2 - rayExt - 10} Q ${cx + 3} ${cy - ring2 - rayExt - 4} ${cx + 5} ${cy - ring2 - rayExt} Q ${cx + 3} ${cy - ring2 - rayExt + 4} ${cx} ${cy - ring2 - rayExt + 10} Q ${cx - 3} ${cy - ring2 - rayExt + 4} ${cx - 5} ${cy - ring2 - rayExt} Q ${cx - 3} ${cy - ring2 - rayExt - 4} ${cx} ${cy - ring2 - rayExt - 10} Z`}
          fill={gold}
          fillOpacity="0.85"
        />

        {/* South Ray & Diamond Star */}
        <Line
          x1={cx}
          y1={cy + ring2}
          x2={cx}
          y2={cy + ring2 + rayExt}
          stroke={gold}
          strokeWidth="1.1"
          strokeOpacity="0.6"
        />
        <Path
          d={`M ${cx} ${cy + ring2 + rayExt + 10} Q ${cx + 3} ${cy + ring2 + rayExt + 4} ${cx + 5} ${cy + ring2 + rayExt} Q ${cx + 3} ${cy + ring2 + rayExt - 4} ${cx} ${cy + ring2 + rayExt - 10} Q ${cx - 3} ${cy + ring2 + rayExt - 4} ${cx - 5} ${cy + ring2 + rayExt} Q ${cx - 3} ${cy + ring2 + rayExt + 4} ${cx} ${cy + ring2 + rayExt + 10} Z`}
          fill={gold}
          fillOpacity="0.85"
        />

        {/* West Ray & Diamond Star */}
        <Line
          x1={cx - ring2}
          y1={cy}
          x2={cx - ring2 - rayExt}
          y2={cy}
          stroke={gold}
          strokeWidth="1.1"
          strokeOpacity="0.6"
        />
        <Path
          d={`M ${cx - ring2 - rayExt - 10} ${cy} Q ${cx - ring2 - rayExt - 4} ${cy + 3} ${cx - ring2 - rayExt} ${cy + 5} Q ${cx - ring2 - rayExt + 4} ${cy + 3} ${cx - ring2 - rayExt + 10} ${cy} Q ${cx - ring2 - rayExt + 4} ${cy - 3} ${cx - ring2 - rayExt} ${cy - 5} Q ${cx - ring2 - rayExt - 4} ${cy - 3} ${cx - ring2 - rayExt - 10} ${cy} Z`}
          fill={gold}
          fillOpacity="0.85"
        />

        {/* East Ray & Diamond Star */}
        <Line
          x1={cx + ring2}
          y1={cy}
          x2={cx + ring2 + rayExt}
          y2={cy}
          stroke={gold}
          strokeWidth="1.1"
          strokeOpacity="0.6"
        />
        <Path
          d={`M ${cx + ring2 + rayExt + 10} ${cy} Q ${cx + ring2 + rayExt + 4} ${cy + 3} ${cx + ring2 + rayExt} ${cy + 5} Q ${cx + ring2 + rayExt - 4} ${cy + 3} ${cx + ring2 + rayExt - 10} ${cy} Q ${cx + ring2 + rayExt - 4} ${cy - 3} ${cx + ring2 + rayExt} ${cy - 5} Q ${cx + ring2 + rayExt + 4} ${cy - 3} ${cx + ring2 + rayExt + 10} ${cy} Z`}
          fill={gold}
          fillOpacity="0.85"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});
