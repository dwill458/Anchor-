import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  V2SheetGrabZone,
  V2SheetModal,
} from '@/components/v2/primitives/V2SheetModal';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import {
  VISION_BOARD_LAYOUTS,
  type VisionBoardLayout,
  type V2VisionTile,
  type VisionNote,
} from '@/adapters/v2/vision';
import { VisionBoardScene } from './board/VisionBoardScene';
import type { VisionBoardCardArt } from './board/VisionBoardIntentionCard';
import { useVisionBoardScene } from './board/useVisionBoardScene';
import { useVisionBoardComposition } from './board/useVisionBoardComposition';

export const VISION_LAYOUT_NAMES = {
  CLASSIC: 'Classic',
  EDITORIAL: 'Editorial',
  SCRAPBOOK: 'Scrapbook',
};
const DETAILS = {
  CLASSIC: 'Your board now',
  EDITORIAL: 'Clean grid, quiet captions',
  SCRAPBOOK: 'Snapshots, tape and stickies',
};
type Content = {
  tiles: V2VisionTile[];
  notes: readonly VisionNote[];
  intention: string;
  category?: string | null;
  art?: VisionBoardCardArt | null;
  width: number;
};
function Thumbnail({
  layout,
  ...content
}: Content & { layout: VisionBoardLayout }) {
  const composition = useVisionBoardComposition({
    tiles: content.tiles,
    notes: content.notes,
    width: content.width,
    boardLayout: layout,
  });
  const board = useVisionBoardScene(
    content.tiles,
    composition.size,
    1,
    true,
    undefined,
    composition,
  );
  const scale = Math.min(
    84 / composition.size.width,
    166 / composition.size.height,
  );
  return (
    <View
      pointerEvents="none"
      style={{
        width: 86,
        height: 170,
        overflow: 'hidden',
        backgroundColor: '#F6F2E9',
      }}
    >
      {composition.measurementView}
      <View
        style={{
          position: 'absolute',
          width: composition.size.width,
          height: composition.size.height,
          left: (86 - composition.size.width) / 2,
          top: (170 - composition.size.height) / 2,
          transform: [{ scale }],
        }}
      >
        <VisionBoardScene
          materialMode="photographic"
          sharedComposition
          scene={composition.size}
          layout={board.layout}
          roster={board.roster}
          entering={board.entering}
          shared={board.shared}
          initialRectFor={board.initialRectFor}
          slotOrder={composition.order}
          notes={composition.notes}
          intention={content.intention}
          category={content.category}
          art={content.art}
          focals={Object.fromEntries(
            content.tiles
              .filter((t) => t.focal)
              .map((t) => [t.sceneId, t.focal!]),
          )}
          displayScale={1}
          markAppearance="paper"
          reduceMotion
        />
      </View>
    </View>
  );
}
export function VisionLayoutSheet({
  visible,
  current,
  onPreview,
  onClose,
  onApply,
  busy,
  ...content
}: Content & {
  visible: boolean;
  current: VisionBoardLayout;
  onPreview: (layout: VisionBoardLayout) => void;
  onClose: () => void;
  onApply: (layout: VisionBoardLayout) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState(current),
    reduceMotion = useV2ReduceMotion();
  useEffect(() => {
    if (visible) setSelected(current);
  }, [visible, current]);
  return (
    <V2SheetModal
      visible={visible}
      onClose={() => {
        if (!busy) onClose();
      }}
      reduceMotion={reduceMotion}
      scrimAccessibilityLabel="Keep current board layout"
      testID="vision-layout-sheet"
    >
      <SafeAreaView
        edges={['bottom']}
        style={{
          padding: 20,
          backgroundColor: '#FBF9F4',
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          flexShrink: 1,
        }}
        accessibilityViewIsModal
      >
        <V2SheetGrabZone>
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D5D0C4',
              marginBottom: 14,
            }}
          />
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: 'EBGaramond-Medium',
              fontSize: 25,
              textAlign: 'center',
              color: '#171717',
            }}
          >
            Board layout
          </Text>
          <Text
            style={{
              fontFamily: 'Inter-Regular',
              fontSize: 13,
              lineHeight: 18,
              textAlign: 'center',
              color: '#77736A',
              marginTop: 6,
              marginBottom: 12,
            }}
          >
            Same photos, captions and notes. Only the arrangement changes.
          </Text>
        </V2SheetGrabZone>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          {VISION_BOARD_LAYOUTS.map((layout) => (
            <Pressable
              key={layout}
              disabled={busy}
              accessibilityRole="radio"
              accessibilityLabel={VISION_LAYOUT_NAMES[layout]}
              accessibilityState={{ selected: layout === selected }}
              testID={`vision-layout-${layout}`}
              onPress={() => {
                setSelected(layout);
                onPreview(layout);
                v2Haptics.selection();
              }}
              style={{ flex: 1, alignItems: 'center', gap: 4 }}
            >
              <View
                style={{
                  padding: 3,
                  borderWidth: layout === selected ? 2 : 1,
                  borderColor: layout === selected ? '#26312F' : '#DDD6C9',
                  borderRadius: 9,
                }}
              >
                <Thumbnail {...content} layout={layout} />
              </View>
              <Text
                style={{
                  fontFamily: 'Inter-SemiBold',
                  fontSize: 12,
                  color: '#171717',
                }}
              >
                {VISION_LAYOUT_NAMES[layout]}
              </Text>
              <Text
                style={{
                  fontFamily: 'Inter-Regular',
                  fontSize: 10,
                  lineHeight: 14,
                  textAlign: 'center',
                  color: '#77736A',
                }}
              >
                {layout === current ? 'Your board now' : DETAILS[layout]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 11,
            lineHeight: 16,
            textAlign: 'center',
            color: '#77736A',
            marginVertical: 12,
          }}
        >
          Share Studio will suggest the {VISION_LAYOUT_NAMES[selected]}{' '}
          presentation. You can still pick any background there.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            onPress={onClose}
            style={{
              flex: 1,
              minHeight: 48,
              borderWidth: 1,
              borderColor: '#DDD6C9',
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text>Keep {VISION_LAYOUT_NAMES[current]}</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            testID="vision-layout-apply"
            onPress={() => onApply(selected)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: 28,
              backgroundColor: '#111C23',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FBF9F4', fontFamily: 'Inter-SemiBold' }}>
              {busy ? 'Saving…' : `Use ${VISION_LAYOUT_NAMES[selected]}`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </V2SheetModal>
  );
}
