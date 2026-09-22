import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme/v2';

type Props = {
  testID?: string;
  onBack: () => void;
  backTestID?: string;
  /** The scrolling body. Its own horizontal padding comes from `sidePadding`. */
  children: React.ReactNode;
  sidePadding: number;
  /** Primary CTA. Rendered below the scroll region, never over it. */
  footer?: React.ReactNode;
  footerPaddingBottom: number;
  /** Centre the body horizontally (Focus) or stretch it (Deep Prime / Visualize). */
  centered?: boolean;
  /** Content rendered outside the layout flow, such as a settings sheet. */
  overlay?: React.ReactNode;
};

/**
 * Shared frame for the Practice setup screens:
 *
 *   safe area → header → scrollable body → footer CTA
 *
 * The footer is a sibling of the ScrollView, not an overlay, so the body can
 * never render underneath it and there is no inset to keep in sync with the
 * CTA's height. Safe-area padding comes from this SafeAreaView alone, so it is
 * applied exactly once. The body is `flexGrow: 1`: on a tall phone it fills the
 * space and the footer sits at the bottom exactly as designed; on a short phone
 * it scrolls instead of compressing.
 */
export function V2PracticeSetupLayout({ testID, onBack, backTestID, children, sidePadding, footer, footerPaddingBottom, centered = false, overlay }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={SAFE_EDGES} testID={testID}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Practice"
          testID={backTestID}
          onPress={onBack}
          hitSlop={12}
          style={styles.backButton}
        >
          <ArrowLeft size={20} color={colors.text.primary} />
          <Text style={styles.backText}>Practice</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, centered && styles.bodyCentered, { paddingHorizontal: sidePadding }]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>

      {footer ? (
        <View style={[styles.footer, { paddingHorizontal: sidePadding, paddingBottom: footerPaddingBottom }]}>{footer}</View>
      ) : null}
      {overlay}
    </SafeAreaView>
  );
}

const SAFE_EDGES = ['top', 'bottom'] as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  backText: { ...typography.labelLG, color: colors.text.primary },
  scroll: { flex: 1 },
  body: { flexGrow: 1, paddingTop: spacing[1], paddingBottom: spacing[4] },
  bodyCentered: { alignItems: 'center' },
  footer: { paddingTop: spacing[2] },
});
