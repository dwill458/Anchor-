import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { V2SegmentedControl } from '@/components/v2/primitives';
import { MilestoneArtwork } from '@/components/v2/milestones/MilestoneArtwork';
import { progressTokens } from '@/components/v2/progress/progressTokens';
import { useAnchorMilestones } from '@/hooks/v2/milestones/useAnchorMilestones';
import { useAnchorStore } from '@/stores/anchorStore';
import { MILESTONE_SPECS } from '@/milestones/registry';
import { buildMilestoneItems, type MilestoneFilter, type MilestoneItem } from '@/milestones/milestoneModel';

export interface V2MilestoneCollectionScreenProps {
  /** The Anchor Progress was showing. Every milestone here belongs to it. */
  anchorId: string;
  onBack?: () => void;
  onOpenMilestone?: (definitionId: string) => void;
  testID?: string;
}

const FILTERS: Array<{ value: MilestoneFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'strength', label: 'Strength' },
  { value: 'commitment', label: 'Commitment' },
  { value: 'journey', label: 'Journey' },
  { value: 'vision', label: 'Vision' },
];

const COLUMNS = 3;
const ART = 76;

const shortDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Every milestone, in one place, filterable by family. Earned ones show their artwork and date;
 * locked ones are drawn as dashed outlines with a "Locked" label so they can never be mistaken
 * for earned. The list is virtualized.
 */
export const V2MilestoneCollectionScreen: React.FC<V2MilestoneCollectionScreenProps> = ({
  anchorId,
  onBack,
  onOpenMilestone,
  testID = 'v2-milestone-collection',
}) => {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = React.useState<MilestoneFilter>('all');
  const { records, status } = useAnchorMilestones(anchorId);
  const reconciling = status === 'loading';
  const incomplete = reconciling || status === 'error' || status === 'offline';
  const category = useAnchorStore((state) => state.anchors.find((anchor) => anchor.id === anchorId)?.category);
  const categoryColor = getCategoryColor(category);

  const items = React.useMemo(() => buildMilestoneItems(records, filter, { includeLocked: !incomplete }), [records, filter, incomplete]);
  const earnedCount = React.useMemo(() => buildMilestoneItems(records, 'all', { includeLocked: false }).length, [records]);

  const renderItem = React.useCallback(
    ({ item }: { item: MilestoneItem }) => {
      const earned = item.state === 'earned';
      return (
        <Pressable
          onPress={onOpenMilestone ? () => onOpenMilestone(item.spec.id) : undefined}
          disabled={!onOpenMilestone}
          accessibilityRole="button"
          accessibilityLabel={
            earned ? `${item.spec.title}, earned ${shortDate(item.record!.earnedAt)}` : `${item.spec.title}, locked`
          }
          style={styles.cell}
          testID={`${testID}-item-${item.spec.id}`}
        >
          <MilestoneArtwork
            definitionId={item.spec.id}
            state={item.state}
            size={ART}
            categoryColor={categoryColor}
          />
          <Text style={[styles.title, !earned && styles.titleLocked]} numberOfLines={2}>
            {item.spec.title}
          </Text>
          <Text style={[styles.meta, !earned && styles.metaLocked]} testID={`${testID}-meta-${item.spec.id}`}>
            {earned ? shortDate(item.record!.earnedAt) : 'Locked'}
          </Text>
        </Pressable>
      );
    },
    [categoryColor, onOpenMilestone, testID],
  );

  return (
    <View style={styles.root} testID={testID}>
      <StatusBar barStyle="dark-content" animated />
      <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}
            testID={`${testID}-back`}
          >
            <ArrowLeft size={18} color={progressTokens.text} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.screenTitle}>Milestones</Text>
          <Text style={styles.count} testID={`${testID}-count`}>
            {reconciling ? 'Updating milestones…' : incomplete ? `${earnedCount} earned · saved progress` : `${earnedCount} of ${MILESTONE_SPECS.length} earned`}
          </Text>
        </View>
        <View style={styles.back} />
      </View>

      <View style={styles.filters}>
        <V2SegmentedControl
          options={FILTERS}
          value={filter}
          onChange={(value) => setFilter(value as MilestoneFilter)}
          accessibilityLabel="Milestone family"
        />
      </View>

      <FlatList
        key={filter}
        data={items}
        numColumns={COLUMNS}
        keyExtractor={(item) => item.spec.id}
        renderItem={renderItem}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing[6] }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={9}
        windowSize={7}
        testID={`${testID}-list`}
        ListEmptyComponent={reconciling ? <ActivityIndicator accessibilityLabel="Updating milestones" /> : incomplete ? <Text>Connect to update milestone progress.</Text> : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: progressTokens.bodyBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center' },
  screenTitle: { fontFamily: progressTokens.serif, fontSize: 22, lineHeight: 28, color: progressTokens.text },
  count: { ...typography.caption, color: progressTokens.muted },
  filters: { paddingHorizontal: spacing[5], paddingBottom: spacing[3] },
  list: { paddingHorizontal: spacing[4], gap: spacing[3] },
  row: { gap: spacing[3] },
  cell: {
    flex: 1 / COLUMNS,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing[3],
    paddingHorizontal: 4,
    borderRadius: radii.xl,
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
  },
  title: { ...typography.labelMD, fontSize: 11.5, color: progressTokens.text, textAlign: 'center' },
  titleLocked: { color: colors.text.secondary },
  meta: { ...typography.caption, fontSize: 10.5, color: progressTokens.muted },
  metaLocked: { color: colors.text.disabled },
});
