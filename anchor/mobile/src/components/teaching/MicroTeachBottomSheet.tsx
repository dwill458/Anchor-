/**
 * MicroTeachBottomSheet — registry-driven explanation sheet.
 *
 * Renders one or more teachings (title + copy + optional secondary) from the
 * central registry as stacked blocks. Generalizes the previously hardcoded
 * practice explainer sheets so copy lives in one place.
 *
 * This sheet is ungated: it is opened on demand (e.g. from an info chip) and
 * does NOT record shows or affect lifetime exhaustion.
 */
import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { TEACHINGS } from '@/constants/teaching';
import { colors, spacing, typography } from '@/theme';

interface MicroTeachBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** One or more registry ids to render as stacked blocks. */
  teachingIds: string[];
  /** Optional sheet heading. */
  title?: string;
  /** Confirm CTA label. */
  ctaLabel?: string;
}

export const MicroTeachBottomSheet: React.FC<MicroTeachBottomSheetProps> = ({
  visible,
  onClose,
  teachingIds,
  title,
  ctaLabel = 'Got it',
}) => {
  const blocks = teachingIds
    .map((id) => TEACHINGS[id])
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidFill]} />
          )}
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {blocks.map((block) => (
            <View key={block.teachingId} style={styles.block}>
              {block.title ? <Text style={styles.blockTitle}>{block.title}</Text> : null}
              <Text style={styles.copy}>{block.copy}</Text>
              {block.copySecondary ? (
                <Text style={styles.copySecondary}>{block.copySecondary}</Text>
              ) : null}
            </View>
          ))}
          <TouchableOpacity onPress={onClose} style={styles.cta} activeOpacity={0.85}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    backgroundColor: 'rgba(10,14,20,0.96)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  androidFill: {
    backgroundColor: 'rgba(10,14,20,0.98)',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  title: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    fontFamily: typography.fontFamily.serifSemiBold,
    fontSize: 22,
    color: colors.text.primary,
  },
  block: {
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  blockTitle: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.gold,
    fontSize: 12,
    marginBottom: 2,
  },
  copy: {
    fontFamily: typography.fontFamily.sans,
    color: colors.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  copySecondary: {
    marginTop: 4,
    fontFamily: typography.fontFamily.sans,
    color: colors.text.tertiary,
    fontSize: 12,
    lineHeight: 17,
  },
  cta: {
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.36)',
    backgroundColor: 'rgba(212,175,55,0.16)',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
  },
  ctaText: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.gold,
    fontSize: 14,
  },
});
