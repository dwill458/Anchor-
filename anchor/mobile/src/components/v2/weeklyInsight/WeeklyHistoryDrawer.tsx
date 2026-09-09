/**
 * History archive drawer for past Weekly Insight snapshots.
 *
 * Sourced from Section 23 of Anchor_Design_System_Living_Spec_v0_4_WEEKLY_INSIGHT_LOCKED.docx:
 * - Shows date range + headline + insight family.
 * - Opens the persisted snapshot without recomputing or altering old weeks.
 */

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { WeeklyInsightHistoryItem } from '@/adapters/v2/weeklyInsight/types';

interface WeeklyHistoryDrawerProps {
  visible: boolean;
  onClose: () => void;
  items: WeeklyInsightHistoryItem[];
  onSelectSnapshot: (id: string) => void;
  testID?: string;
}

export const WeeklyHistoryDrawer: React.FC<WeeklyHistoryDrawerProps> = ({
  visible,
  onClose,
  items,
  onSelectSnapshot,
  testID = 'weekly-history-drawer',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}
          testID={`${testID}-sheet`}
        >
          {/* Grabber */}
          <View style={styles.grabber} />

          {/* Header */}
          <View style={styles.head}>
            <Text style={styles.title}>Weekly Insights</Text>
            <Pressable
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close past insights"
              testID={`${testID}-close-btn`}
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Past weeks stay preserved as snapshots, even when the insight engine changes later.
          </Text>

          {/* Snapshot List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {items.map((item) => (
              <Pressable
                key={`archive-${item.id}`}
                style={styles.item}
                onPress={() => onSelectSnapshot(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.dateRange}`}
                testID={`${testID}-item-${item.id}`}
              >
                <Text style={styles.itemDate}>{item.dateRange}</Text>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemType}>{item.typeLabel}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 23, 23, 0.28)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing[5],
    paddingTop: 12,
    paddingBottom: 34,
    maxHeight: '75%',
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginBottom: 18,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: typography.displaySemiBold,
    fontSize: 25,
    letterSpacing: -0.6,
    color: colors.text.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.text.primary,
    fontWeight: '400',
  },
  note: {
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.disabled,
    marginTop: 7,
    marginBottom: 16,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing[4],
  },
  item: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  itemDate: {
    fontFamily: typography.bodyMedium,
    fontSize: 10,
    color: colors.text.disabled,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontFamily: typography.displaySemiBold,
    fontSize: 18,
    color: colors.text.primary,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  itemType: {
    fontFamily: typography.body,
    fontSize: 10.5,
    color: colors.text.disabled,
    marginTop: 3,
  },
});
