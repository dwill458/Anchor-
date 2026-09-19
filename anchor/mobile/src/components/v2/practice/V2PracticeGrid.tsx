import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Crown } from 'lucide-react-native';
import {
  V2_PRACTICE_MODE_DEFINITIONS,
  type V2PracticeMode,
} from '@/constants/v2/practice';
import type { V2PracticeCapabilities } from '@/hooks/v2/practice';
import { colors, getPracticeCardTheme, radii, spacing, typography } from '@/theme/v2';
import { V2PracticeArtwork } from './V2PracticeArtwork';

type Props = {
  capabilities: V2PracticeCapabilities;
  onSelectMode: (mode: V2PracticeMode) => void;
};

export function V2PracticeGrid({ capabilities, onSelectMode }: Props) {
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
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
                pressed && styles.pressed,
              ]}
            >
              {/* Artwork scene header */}
              <View style={styles.artworkContainer}>
                <V2PracticeArtwork mode={item.mode} height={108} variant="card" />
                {showPro ? (
                  <View style={styles.proBadge}>
                    <Crown size={10} color={colors.text.secondary} />
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                ) : null}
              </View>

              {/* Lower text content */}
              <View style={styles.content}>
                <Text style={[styles.modeTag, { color: theme.labelColor }]}>
                  {item.mode === 'deep_prime' ? 'DEEP PRIME' : item.mode.toUpperCase()}
                </Text>

                <View style={styles.titleRow}>
                  <Text numberOfLines={1} style={styles.title}>
                    {item.title}
                  </Text>
                  <View style={[styles.actionCircle, { backgroundColor: theme.actionCircleBg }]}>
                    <ArrowRight size={14} color={theme.accent} strokeWidth={2.4} />
                  </View>
                </View>

                <Text numberOfLines={1} style={styles.duration}>
                  {item.duration}
                </Text>

                <Text numberOfLines={2} style={styles.purpose}>
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

const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
  },
  sectionTitle: {
    ...typography.labelSM,
    color: colors.text.secondary,
    letterSpacing: 0.8,
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  card: {
    // 2-column layout: (100% - gap) / 2
    width: '48%',
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  artworkContainer: {
    position: 'relative',
    width: '100%',
    height: 108,
    backgroundColor: colors.surface,
  },
  proBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  proText: {
    ...typography.labelSM,
    fontSize: 9,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  content: {
    padding: spacing[3],
    paddingTop: spacing[2],
    gap: 2,
    minHeight: 116,
  },
  modeTag: {
    ...typography.labelSM,
    fontSize: 9.5,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[1],
  },
  title: {
    fontFamily: typography.displayBold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: colors.text.primary,
    flex: 1,
  },
  actionCircle: {
    width: 26,
    height: 26,
    borderRadius: radii.round,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  purpose: {
    ...typography.bodySM,
    color: colors.text.secondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
});
