import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Crown } from 'lucide-react-native';
import {
  V2_PRACTICE_MODE_DEFINITIONS,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import type { V2PracticeCapabilities } from '@/hooks/v2/practice';
import { colors, getPracticeCardTheme, practiceDarkText, radii, spacing, typography } from '@/theme/v2';
import { V2PracticeArtwork } from './V2PracticeArtwork';

type Props = {
  capabilities: V2PracticeCapabilities;
  onSelectMode: (mode: V2PracticeMode) => void;
};

const ARTWORK_HEIGHT = 95;
/** The dissolve only occupies the bottom third of the scene, so the
 *  illustration itself keeps its colours and reads unobstructed. */
const ARTWORK_FADE_HEIGHT = 34;

export function V2PracticeGrid({ capabilities, onSelectMode }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(0, Math.floor((width - spacing[6] * 2 - spacing[3]) / 2));

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CHOOSE ANOTHER PRACTICE</Text>
      <View style={styles.grid}>
        {V2_PRACTICE_MODE_DEFINITIONS.map((item) => {
          const isEntitled = capabilities[item.mode];
          const showPro = item.premium && !isEntitled;
          const theme = getPracticeCardTheme(item.mode);

          return (
            <Pressable
              key={item.mode}
              testID={`v2-practice-row-${item.mode}`}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.purpose}. ${item.duration}.${
                showPro ? ' Premium required.' : ''
              }`}
              onPress={() => onSelectMode(item.mode)}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                {
                  backgroundColor: theme.dark.surface,
                  borderColor: theme.dark.border,
                },
                pressed && styles.pressed,
              ]}
            >
              {/* Artwork scene header */}
              <View style={[styles.artworkContainer, { backgroundColor: theme.dark.surface }]}>
                <V2PracticeArtwork mode={item.mode} height={ARTWORK_HEIGHT} variant="card" />
                {/* Atmospheric dissolve so the scene and the body are one object. */}
                <LinearGradient
                  pointerEvents="none"
                  colors={[...theme.dark.fade]}
                  locations={[0, 0.62, 1]}
                  style={styles.artworkFade}
                />
                {showPro ? (
                  <View style={styles.proBadge}>
                    <Crown size={10} color={practiceDarkText.title} />
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                ) : null}
              </View>

              {/* Lower text content */}
              <View style={styles.content}>
                {/* Group 1 — identity */}
                <Text style={[styles.modeTag, { color: theme.dark.label }]}>
                  {item.mode === 'deep_prime' ? 'DEEP PRIME' : item.mode.toUpperCase()}
                </Text>

                <View style={styles.titleRow}>
                  <Text numberOfLines={2} style={styles.title}>
                    {item.title}
                  </Text>
                  <View style={[styles.actionCircle, { backgroundColor: theme.dark.actionBg }]}>
                    <ArrowRight size={13} color={theme.dark.arrow} strokeWidth={2.4} />
                  </View>
                </View>

                {/* Group 2 — what it costs you, then what it does */}
                <Text numberOfLines={2} style={styles.duration}>
                  {item.duration}
                </Text>

                <Text numberOfLines={3} style={styles.purpose}>
                  {item.purpose}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** One padding value drives the left edge of every line in the body. */
const BODY_INSET = 14;

const styles = StyleSheet.create({
  container: {
    // Deliberately half the space above the label, which binds it to the grid.
    gap: spacing[2],
  },
  sectionTitle: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.9,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing[3],
    rowGap: spacing[3],
  },
  card: {
    // The width is calculated from the actual iOS window so percentage sizing
    // cannot wrap the second column on narrow screens when gap is applied.
    flexShrink: 0,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  artworkContainer: {
    position: 'relative',
    width: '100%',
    height: ARTWORK_HEIGHT,
  },
  artworkFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ARTWORK_FADE_HEIGHT,
  },
  proBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(12, 10, 16, 0.72)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  proText: {
    ...typography.labelSM,
    fontSize: 9,
    color: practiceDarkText.title,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: BODY_INSET,
    paddingTop: 13,
    paddingBottom: BODY_INSET,
  },
  modeTag: {
    ...typography.labelSM,
    fontSize: 9.5,
    letterSpacing: 0.9,
    fontWeight: '700',
    // Small gap: the label belongs to the title.
    marginBottom: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Tight enough that "Deep Prime" holds one line at the default text size,
    // and the title wraps rather than truncating when it is scaled up.
    gap: 6,
  },
  title: {
    fontFamily: typography.displayBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: practiceDarkText.title,
    flex: 1,
  },
  actionCircle: {
    width: 24,
    height: 24,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    ...typography.caption,
    color: practiceDarkText.meta,
    fontSize: 11,
    lineHeight: 15,
    // Medium gap: opens the secondary information group.
    marginTop: 11,
  },
  purpose: {
    ...typography.bodySM,
    color: practiceDarkText.body,
    fontSize: 11,
    lineHeight: 15.5,
    // Medium-small gap: stays bound to the duration above it.
    marginTop: 5,
  },
});
