import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, getPracticeColor, radii, typography } from '@/theme/v2';
import { V2SectionHeader } from '@/components/v2/primitives';
import { groupThreadEventsByDay } from '@/adapters/v2/progress/progressAdapter';
import type { V2ThreadEventItem, ThreadEventSignificance } from '@/adapters/v2/progress/types';
import { V2ProgressGhostCard } from './V2ProgressGhostCard';
import { progressTokens } from './progressTokens';

export interface V2ThreadEventTimelineProps {
  events: V2ThreadEventItem[];
  onSelectEvent: (event: V2ThreadEventItem) => void;
  /** For tests: the clock the day headers are measured against. */
  now?: Date;
  testID?: string;
}

/** Gold stays reserved for active states, so significance is told apart by ink weight and the two semantic hues. */
function getDotColor(event: V2ThreadEventItem): string {
  if (event.type === 'PRACTICE_COMPLETED' && event.practiceMode) return getPracticeColor(event.practiceMode);
  switch (event.significance as ThreadEventSignificance) {
    case 'MAJOR':
      return colors.ink.base;
    case 'HIGH':
      return colors.semantic.info;
    case 'MEDIUM':
      return progressTokens.reached;
    default:
      return colors.border.strong;
  }
}

/** The latest three real events, with the complete history available on demand. */
export const V2ThreadEventTimeline: React.FC<V2ThreadEventTimelineProps> = ({
  events,
  onSelectEvent,
  now,
  testID = 'v2-thread-event-timeline',
}) => {
  const [shown, setShown] = React.useState(3);
  const expanded = shown > 3;
  const listed = React.useMemo(() => [...events].sort((a, b) =>
    (Date.parse(b.occurredAt) || 0) - (Date.parse(a.occurredAt) || 0)), [events]);

  if (events.length === 0) {
    return (
      <View style={styles.container} testID={`${testID}-empty`}>
        <V2SectionHeader title="Your story" />
        <V2ProgressGhostCard title="Your course log starts with your first practice." />
      </View>
    );
  }

  const visible = listed.slice(0, shown);
  const groups = groupThreadEventsByDay(visible, now);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>YOUR STORY</Text>
        {events.length > 3 ? (
          <Pressable accessibilityRole="button" onPress={() => setShown(expanded ? 3 : 13)} style={styles.more}>
            <Text style={styles.moreText}>{expanded ? 'Show recent' : 'View all activity'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View>
        {groups.map((group) => (
          <View key={group.key}>
            <Text style={styles.dayHeader}>{group.label}</Text>
            {group.events.map((event) => (
              <Pressable
                key={event.id}
                testID={`thread-event-item-${event.id}`}
                style={styles.row}
                onPress={() => onSelectEvent(event)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={event.formattedDate ? `${event.title}, on ${event.formattedDate}` : event.title}
              >
                <View style={[styles.dot, { backgroundColor: getDotColor(event) }]} />
                <View style={styles.text}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>
                      {event.title}
                    </Text>
                    {event.formattedTime ? <Text style={styles.time}>{event.formattedTime}</Text> : null}
                  </View>
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {event.copy}
                  </Text>
                </View>
                <ChevronRight size={16} color={progressTokens.muted} style={styles.chevron} />
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      {expanded && shown < listed.length ? (
        <Pressable onPress={() => setShown(count => count + 10)} accessibilityRole="button" style={styles.more}>
          <Text style={styles.moreText}>Show earlier</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 4 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heading: { ...typography.labelSM, fontSize: 11, letterSpacing: 1.6, color: progressTokens.text },
  more: { alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  moreText: { ...typography.labelMD, color: progressTokens.text },
  dayHeader: { ...typography.labelMD, fontSize: 11, color: progressTokens.muted, paddingTop: 6, paddingBottom: 4, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 56,
    marginBottom: 4,
    backgroundColor: progressTokens.card,
    borderWidth: 1,
    borderColor: progressTokens.cardBorder,
    borderRadius: radii.lg,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  text: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 2 },
  title: { ...typography.labelLG, color: colors.text.primary, flexShrink: 1 },
  chevron: { alignSelf: 'center' },
  subtitle: { ...typography.bodySM, color: progressTokens.muted },
  time: { ...typography.caption, color: progressTokens.muted },
});
