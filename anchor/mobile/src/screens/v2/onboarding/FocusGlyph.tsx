/**
 * Wayfinding glyphs for the onboarding question, drawn in the anchor sigil's own language:
 * a thin perimeter circle and a mark made of straight segments, round caps and joins, one
 * stroke weight, one ink. They are small on purpose; they point at a choice, they are not art.
 */
import React, { memo } from "react";
import Svg, { Circle, Path } from "react-native-svg";
import type { FocusAreaId } from "@/constants/v2/focusAreas";

/** Shared by every glyph, in viewBox units (48), so all six read as one hand. */
const STROKE = 2;
const PERIMETER_OPACITY = 0.3;

const MARKS: Record<FocusAreaId, string[]> = {
  // A pulse: flat, up, down, up, flat.
  health: ["M10 26 L18 26 L22 15 L28 35 L32 24 L38 24"],
  // A case: body and handle.
  career: ["M13 19 L35 19 L35 34 L13 34 Z", "M20 19 L20 14 L28 14 L28 19", "M13 26 L35 26"],
  // Two circles, held together.
  relationships: [],
  // A coin with an angular S.
  money: ["M29 19 L20 19 L20 24 L28 24 L28 29 L19 29", "M24 15 L24 19", "M24 29 L24 33"],
  // A house: roof, walls, door.
  family: ["M11 26 L24 14 L37 26", "M15 23 L15 35 L33 35 L33 23", "M21 35 L21 28 L27 28 L27 35"],
  // An open diamond around a point.
  something_else: ["M24 12 L36 24 L24 36 L12 24 Z"],
};

type Props = { id: FocusAreaId; size?: number; color: string };

function FocusGlyphComponent({ id, size = 34, color }: Props) {
  const common = { stroke: color, strokeWidth: STROKE, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={24} cy={24} r={21} {...common} strokeOpacity={PERIMETER_OPACITY} />
      {id === "relationships" ? (
        <>
          <Circle cx={19} cy={24} r={8} {...common} />
          <Circle cx={29} cy={24} r={8} {...common} />
        </>
      ) : null}
      {id === "money" ? <Circle cx={24} cy={24} r={11} {...common} /> : null}
      {id === "something_else" ? <Circle cx={24} cy={24} r={1.5} {...common} /> : null}
      {MARKS[id].map((d) => (
        <Path key={d} d={d} {...common} />
      ))}
    </Svg>
  );
}

export const FocusGlyph = memo(FocusGlyphComponent);
