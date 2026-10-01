import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import Animated from 'react-native-reanimated';
import { useAnchorTransitionReveal } from '@/navigation/v2/ProgressiveFocusTransition';
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
  /**
   * Replaces the cream page behind the content (the page itself goes transparent), so a
   * setup can darken into its session without a cut. Rendered beneath everything.
   */
  backdrop?: React.ReactNode;
  /** Applied to the header and footer, e.g. to fade them as the session begins. */
  chromeStyle?: StyleProp<ViewStyle>;
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
export function V2PracticeSetupLayout({ testID, onBack, backTestID, children, sidePadding, footer, footerPaddingBottom, centered = false, overlay, backdrop, chromeStyle }: Props) {
  // When the Anchor flies in, the setup arrives behind it: header, then the
  // body that holds the Anchor (opacity only, so its landing point stays put),
  // then the primary action.
  const headerReveal = useAnchorTransitionReveal('practiceSetup', 1);
  const bodyReveal = useAnchorTransitionReveal('practiceSetup', 2, { rise: false });
  const footerReveal = useAnchorTransitionReveal('practiceSetup', 3);
  return (
    <SafeAreaView style={[styles.safe, backdrop ? styles.transparent : null]} edges={SAFE_EDGES} testID={testID}>
      {backdrop ? <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>{backdrop}</Animated.View> : null}
      <Animated.View style={[styles.header, headerReveal, chromeStyle]}>
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
      </Animated.View>

      <Animated.ScrollView
        style={[styles.scroll, bodyReveal]}
        contentContainerStyle={[styles.body, centered && styles.bodyCentered, { paddingHorizontal: sidePadding }]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>

      {footer ? (
        <Animated.View style={[styles.footer, { paddingHorizontal: sidePadding, paddingBottom: footerPaddingBottom }, footerReveal, chromeStyle]}>{footer}</Animated.View>
      ) : null}
      {overlay}
    </SafeAreaView>
  );
}

const SAFE_EDGES = ['top', 'bottom'] as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  transparent: { backgroundColor: 'transparent' },
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
