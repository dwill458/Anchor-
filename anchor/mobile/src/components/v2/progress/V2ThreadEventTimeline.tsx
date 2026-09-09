import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { V2ThreadEventItem, ThreadEventSignificance } from '@/adapters/v2/progress/types';

export interface V2ThreadEventTimelineProps {
  events: V2ThreadEventItem[];
  onSelectEvent: (event: V2ThreadEventItem) => void;
  testID?: string;
}

function getDotColor(significance: ThreadEventSignificance): string {
  switch (significance) {
    case 'MAJOR':
      return '#FFA32C';
    case 'HIGH':
      return '#6C90F3';
    case 'MEDIUM':
      return '#41C8C6';
    default:
      return '#8EE0CF';
  }
}

export const V2ThreadEventTimeline: React.FC<V2ThreadEventTimelineProps> = ({
  events,
  onSelectEvent,
  testID = 'v2-thread-event-timeline',
}) => {
  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyTitle}>No Thread Events Yet</Text>
        <Text style={styles.emptySubtext}>
          Practice sessions, reaching waypoints, and structural milestones will create permanent,
          verifiable markers here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.sectionHeader}>DURABLE THREAD EVENTS</Text>

      <View style={styles.timelineList}>
        {events.map((event, index) => {
          const dotColor = getDotColor(event.significance);
          const isLast = index === events.length - 1;

          return (
            <Pressable
              key={event.id}
              testID={`thread-event-item-${event.id}`}
              style={styles.eventRow}
              onPress={() => onSelectEvent(event)}
              accessible
              accessibilityRole="button"
              accessibilityLabel={`${event.title}, on ${event.formattedDate}`}
            >
              {/* Rail Column */}
              <View style={styles.railColumn}>
                <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]} />
                {!isLast && <View style={styles.line} />}
              </View>

              {/* Event Content Card */}
              <View style={styles.contentCard}>
                <View style={styles.eventHeaderRow}>
                  <Text style={styles.eventDate}>
                    {event.formattedDate} {event.formattedTime ? `• ${event.formattedTime}` : ''}
                  </Text>
                  <View style={styles.domainBadge}>
                    <Text style={styles.domainBadgeText}>{event.sourceDomain.replace('_', ' ')}</Text>
                  </View>
                </View>

                <View style={styles.titleRow}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <ChevronRight size={16} color={colors.text.secondary} />
                </View>

                <Text style={styles.eventCopy} numberOfLines={2}>
                  {event.copy}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  emptyContainer: {
    padding: spacing.xl,
    backgroundColor: '#141820',
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.headingSM,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.bodySM,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  timelineList: {
    paddingLeft: spacing.xs,
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  railColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 6,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 4,
  },
  contentCard: {
    flex: 1,
    backgroundColor: '#141820',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDate: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  domainBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  domainBadgeText: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '600',
    color: colors.text.secondary,
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTitle: {
    ...typography.headingSM,
    fontSize: 15,
    color: colors.text.primary,
    flex: 1,
  },
  eventCopy: {
    ...typography.bodySM,
    color: colors.text.secondary,
  },
});
