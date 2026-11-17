import { Pressable, StyleSheet, View } from 'react-native';
import { classicSlotOutlines, slotBoardHeightRatio } from '../board/visionBoardLayouts';

const GOLD = '#B08A4A';
const OUTLINES = classicSlotOutlines();
const HEIGHT_RATIO = slotBoardHeightRatio(OUTLINES.length - 1, true);

/**
 * A small drawing of the eight-slot board. The target slot is gold; filled slots are dim paper; empty ones are
 * pencil outlines. With `onPick`, each empty slot is a target the person can tap.
 */
export function VisionPlacementMap({ width, selected, occupied, onPick, viewportHeight, testID = 'vision-placement-map' }: {
  width: number;
  selected: number;
  occupied: ReadonlyArray<boolean>;
  onPick?: (slot: number) => void;
  /** Shows only this much of the board, centred on the selected slot (the compact icon in the placement row). */
  viewportHeight?: number;
  testID?: string;
}) {
  const height = width * HEIGHT_RATIO;
  const shown = viewportHeight ? Math.min(viewportHeight, height) : height;
  const target = OUTLINES[selected] ?? OUTLINES[0];
  const offset = Math.max(0, Math.min(height - shown, target.cy * width - shown / 2));
  return (
    <View testID={testID} style={[styles.board, { width, height: shown, overflow: 'hidden' }]} accessible={!onPick} accessibilityLabel={!onPick ? `Position ${selected + 1} on your board` : undefined}>
      <View style={{ width, height, transform: [{ translateY: -offset }] }}>
      {OUTLINES.map((slot, index) => {
        const w = slot.width * width, h = slot.height * width;
        const style = [styles.slot, {
          left: slot.cx * width - w / 2, top: slot.cy * width - h / 2, width: w, height: h, transform: [{ rotate: `${slot.rotation}deg` }],
        }, index === selected ? styles.selected : occupied[index] ? styles.filled : styles.empty];
        if (!onPick || occupied[index]) return <View key={index} style={style} />;
        return (
          <Pressable key={index} testID={`${testID}-slot-${index}`} accessibilityRole="button" accessibilityLabel={`Place it in position ${index + 1}`}
            accessibilityState={{ selected: index === selected }} hitSlop={2} onPress={() => onPick(index)} style={style} />
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { position: 'relative', borderRadius: 5, backgroundColor: '#ffffff0d', borderWidth: StyleSheet.hairlineWidth, borderColor: '#ffffff22' },
  slot: { position: 'absolute', borderRadius: 1 },
  selected: { backgroundColor: GOLD },
  filled: { backgroundColor: '#F4EDE033' },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#F4EDE055' },
});
