import { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { composeVisionBoard } from './visionBoardComposition';

/** Native font measurement is shared by interactive, cinematic and export hosts. Never measures during a gesture. */
export function useVisionBoardComposition(
  input: Parameters<typeof composeVisionBoard>[0],
) {
  const { fontScale } = useWindowDimensions();
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const { tiles, notes, width, boardLayout, slotMap, reserve } = input;
  const composition = useMemo(
    () =>
      composeVisionBoard({
        tiles,
        notes,
        width,
        boardLayout,
        slotMap,
        reserve,
        fontScale,
        measured,
      }),
    [tiles, notes, width, boardLayout, slotMap, reserve, fontScale, measured],
  );
  const ready = composition.measurements.every(
    (m) => measured[m.key] !== undefined,
  );
  const measurementView = useMemo(
    () => (
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -10000, top: 0, opacity: 0 }}
      >
        {composition.measurements.map((m) => (
          <Text
            key={m.key}
            allowFontScaling={false}
            style={{
              width: m.width,
              fontSize: m.fontSize,
              lineHeight: m.lineHeight,
              letterSpacing: m.letterSpacing,
              fontFamily: m.fontFamily,
              includeFontPadding: false,
            }}
            onTextLayout={(event) => {
              const height = Math.max(
                m.lineHeight,
                ...event.nativeEvent.lines.map(
                  (line) => line.y + Math.max(m.lineHeight, line.height),
                ),
              );
              setMeasured((previous) =>
                Math.abs((previous[m.key] ?? -1) - height) < 0.5
                  ? previous
                  : { ...previous, [m.key]: height },
              );
            }}
          >
            {m.text}
          </Text>
        ))}
      </View>
    ),
    [composition.measurements],
  );
  return useMemo(
    () => ({ ...composition, ready, measurementView }),
    [composition, ready, measurementView],
  );
}
