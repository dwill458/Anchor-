import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { radii, typography } from '@/theme/v2';
import { MilestoneArtwork } from '@/components/v2/milestones/MilestoneArtwork';
import { buildMilestoneItems, type MilestoneItem, type MilestoneRecord } from '@/milestones/milestoneModel';
import { progressTokens } from './progressTokens';

export interface V2MilestoneShelfProps {
  records: readonly MilestoneRecord[];
  /** The Anchor's category colour, for strength artwork. */
  categoryColor?: string;
  onOpenMilestone?: (record: MilestoneRecord) => void;
  onOpenCollection?: () => void;
  testID?: string;
}

const CARD_WIDTH = 76;
const ART = 56;

const shortDate = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Earned milestones lead the compact shelf; the canonical model supplies locked artwork too.
 */
export const V2MilestoneShelf: React.FC<V2MilestoneShelfProps> = ({
  records,
  categoryColor,
  onOpenMilestone,
  onOpenCollection,
  testID = 'v2-progress-milestones',
}) => {
  const items = React.useMemo(() => buildMilestoneItems(records, 'all', { includeLocked: true }), [records]);

  const renderItem = React.useCallback(
    ({ item }: { item: MilestoneItem }) => {
      const record = item.record;
      const body = (
        <View style={styles.card}>
          <MilestoneArtwork definitionId={item.spec.id} state={item.state} size={ART} categoryColor={categoryColor} />
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.spec.title}
          </Text>
          <Text style={styles.cardDate}>{record ? shortDate(record.earnedAt) : 'Locked'}</Text>
        </View>
      );
      return record && onOpenMilestone ? (
        <Pressable
          onPress={() => onOpenMilestone(record)}
          accessibilityRole="button"
          accessibilityLabel={`${item.spec.title}, earned ${shortDate(record.earnedAt)}`}
          testID={`${testID}-card-${item.spec.id}`}
        >
          {body}
        </Pressable>
      ) : (
        <View testID={`${testID}-card-${item.spec.id}`}>{body}</View>
      );
    },
    [categoryColor, onOpenMilestone, testID],
  );

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.heading}>MILESTONES</Text>
        {onOpenCollection ? (
          <Pressable
            onPress={onOpenCollection}
            accessibilityRole="button"
            style={styles.viewAll}
            testID={`${testID}-view-all`}
          >
            <Text style={styles.viewAllText}>View all</Text>
            <ChevronRight size={16} color={progressTokens.muted} />
          </Pressable>
        ) : null}
      </View>

      {records.length === 0 ? (
        <Text style={styles.empty} testID={`${testID}-empty`}>
          Your first milestone will appear here.
        </Text>
      ) : null}
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => item.record?.id ?? item.spec.id}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          initialNumToRender={4}
          windowSize={5}
        />

    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 4 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { ...typography.labelSM, fontSize: 11, letterSpacing: 1.6, color: progressTokens.text },
  list: { gap: 4 },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radii.xl,
  },
  cardTitle: { ...typography.labelMD, fontSize: 11, color: progressTokens.text, textAlign: 'center' },
  cardDate: { ...typography.caption, fontSize: 10, color: progressTokens.muted },
  empty: { ...typography.bodySM, color: progressTokens.muted },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 4,
    borderRadius: radii.pill,
  },
  viewAllText: { ...typography.labelMD, color: progressTokens.text },
});
