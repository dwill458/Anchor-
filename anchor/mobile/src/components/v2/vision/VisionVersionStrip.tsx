import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type ScrollViewInstance } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { typography } from '@/theme/v2';
import { visionRoundLabel, type VisionConversationRound } from '@/types/visionConversation';

export interface VisionVersionStripProps {
  rounds: readonly VisionConversationRound[];
  selectedRoundId: string | null;
  onSelect: (roundId: string) => void;
  compact?: boolean;
  testID?: string;
}

const GOLD = '#B08A4A';
const CREAM = '#F4EDE0';
const orderedRounds = (rounds: readonly VisionConversationRound[]) =>
  [...rounds].sort((left, right) => left.roundNumber - right.roundNumber);

/** A compact, horizontally browsable index of saved rounds. */
export const VisionVersionStrip = memo(function VisionVersionStrip({
  rounds, selectedRoundId, onSelect, compact = false, testID = 'vision-version-strip',
}: VisionVersionStripProps) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const layouts = useRef(new Map<string, { x: number; width: number }>());
  const itemOffsets = useRef(new Map<string, number>());
  const [viewportWidth, setViewportWidth] = useState(0);
  const roundIds = rounds.map(round => round.id).join('|');

  const centerSelected = useCallback(() => {
    if (!selectedRoundId || viewportWidth === 0) return;
    const layout = layouts.current.get(selectedRoundId);
    if (!layout) return;
    scrollRef.current?.scrollTo({ x: Math.max(0, layout.x + layout.width / 2 - viewportWidth / 2), animated: true });
  }, [selectedRoundId, viewportWidth]);

  useEffect(() => { centerSelected(); }, [centerSelected, roundIds]);

  const onViewportLayout = (event: LayoutChangeEvent) => {
    setViewportWidth(event.nativeEvent.layout.width);
    requestAnimationFrame(centerSelected);
  };

  return (
    <View testID={testID} style={[styles.root, compact && styles.compactRoot]} onLayout={onViewportLayout}>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, compact && styles.compactContent]} accessibilityRole="none">
        {orderedRounds(rounds).map((round, index) => {
          const selected = round.id === selectedRoundId;
          const label = visionRoundLabel(round.roundNumber);
          return (
            <View key={round.id} style={[styles.item, compact && styles.compactItem]} onLayout={event => {
                itemOffsets.current.set(round.id, event.nativeEvent.layout.x);
                if (round.id === selectedRoundId) centerSelected();
              }}>
              {index > 0 ? <ChevronRight accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                size={compact ? 12 : 15} color={GOLD} strokeWidth={1.8} style={[styles.arrow, compact && styles.compactArrow]} /> : null}
              <Pressable
                testID={`${testID}-round-${round.id}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                onPress={() => onSelect(round.id)}
                onLayout={event => {
                  const { x, width } = event.nativeEvent.layout;
                  layouts.current.set(round.id, { x: (itemOffsets.current.get(round.id) ?? 0) + x, width });
                  if (round.id === selectedRoundId) centerSelected();
                }}
                hitSlop={4}
                style={[styles.pill, compact && styles.compactPill]}
              >
                {compact ? <View pointerEvents="none" style={[styles.compactVisual, selected && styles.compactSelectedVisual]}>
                  {selected ? <View accessible={false} style={styles.dot} /> : null}
                  <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
                </View> : <>
                  {selected ? <View accessible={false} style={styles.dot} /> : null}
                  <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
                </>}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { width: '100%' },
  compactRoot: { height: 44, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(176,138,74,0.58)', borderRadius: 22 },
  content: { alignItems: 'center', paddingHorizontal: 8 },
  compactContent: { minHeight: 44, alignItems: 'center', paddingHorizontal: 4 },
  item: { flexDirection: 'row', alignItems: 'center' },
  compactItem: { minHeight: 44 },
  arrow: { marginHorizontal: 7 },
  compactArrow: { marginHorizontal: 3 },
  pill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, borderRadius: 22 },
  compactPill: { minHeight: 44, paddingHorizontal: 3, borderRadius: 22 },
  compactVisual: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 19 },
  compactSelectedVisual: { backgroundColor: CREAM },
  selectedPill: { backgroundColor: CREAM },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GOLD },
  label: { color: '#C9C4D3', fontFamily: typography.bodyMedium, fontSize: 15, lineHeight: 20 },
  selectedLabel: { color: '#14162B', fontFamily: typography.bodySemiBold },
});
