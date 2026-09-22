import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, Crown } from 'lucide-react-native';
import { V2_PRACTICE_MODE_BY_ID, type V2PracticeMode } from '@/constants/v2/practice';
import type { V2PracticeCapabilities } from '@/hooks/v2/practice';
import { colors, getPracticeCardTheme, practiceDarkText, radii, spacing, typography } from '@/theme/v2';
import { V2PracticeArtwork } from './V2PracticeArtwork';

type Props = {
  capabilities: V2PracticeCapabilities;
  heroMode?: V2PracticeMode | null;
  onSelectMode: (mode: V2PracticeMode) => void;
};

const ARTWORK_HEIGHT = 95;
const SLIM_ARTWORK_HEIGHT = 82;
/** The dissolve only occupies the bottom third of the scene, so the
 *  illustration itself keeps its colours and reads unobstructed. */
const ARTWORK_FADE_HEIGHT = 34;

/** Dark edge scrims for the Release slim row: left text block and right descriptor/arrow. */
const RELEASE_SCRIM_COLORS = ['rgba(10, 8, 14, 0.78)', 'rgba(10, 8, 14, 0)', 'rgba(10, 8, 14, 0)', 'rgba(10, 8, 14, 0.74)'] as const;
const RELEASE_SCRIM_LOCATIONS = [0, 0.4, 0.62, 1] as const;

const FIXED_MODE_ORDER: readonly V2PracticeMode[] = ['focus', 'deep_prime', 'visualize', 'release'];

const modeLabel = (mode: V2PracticeMode) => V2_PRACTICE_MODE_BY_ID[mode].title.toUpperCase();

export function V2PracticeGrid({ capabilities, heroMode, onSelectMode }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(0, Math.floor((width - spacing[6] * 2 - spacing[3]) / 2));
  const slimMode: V2PracticeMode = heroMode === 'release' ? 'visualize' : 'release';
  const tileModes = FIXED_MODE_ORDER.filter((mode) => mode !== heroMode && mode !== slimMode);
  const slimItem = V2_PRACTICE_MODE_BY_ID[slimMode];
  const slimTheme = getPracticeCardTheme(slimMode);
  const slimShowPro = slimItem.premium && !capabilities[slimMode];

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>CHOOSE ANOTHER PRACTICE</Text>
      <View style={styles.grid}>
        {tileModes.map((mode) => {
          const item = V2_PRACTICE_MODE_BY_ID[mode];
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
                pressed && styles.pressed,
              ]}
            >
              {/* Artwork scene header */}
              <View style={styles.artworkContainer}>
                <V2PracticeArtwork mode={item.mode} height={ARTWORK_HEIGHT} variant="card" />
                {showPro ? (
                  <View style={styles.proBadge}>
                    <Crown size={10} color={practiceDarkText.title} />
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                ) : null}
              </View>

              {/* Lower cream text content */}
              <View style={styles.content}>
                {/* Group 1 — identity */}
                <Text style={[styles.modeTag, { color: theme.labelColor }]}>
                  {modeLabel(item.mode)}
                </Text>

                <View style={styles.titleRow}>
                  <Text numberOfLines={1} style={styles.title}>
                    {item.title}
                  </Text>
                  <View style={styles.actionCircle}>
                    <ArrowRight size={13} color="#121820" strokeWidth={2.4} />
                  </View>
                </View>

                {/* Group 2 — duration and purpose */}
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
      <Pressable
        testID={`v2-practice-row-${slimMode}`}
        accessibilityRole="button"
        accessibilityLabel={`${slimItem.title}. ${slimItem.duration}.${slimShowPro ? ' Premium required.' : ''}`}
        onPress={() => onSelectMode(slimMode)}
        style={({ pressed }) => [styles.slimRow, { backgroundColor: slimTheme.dark.surface, borderColor: 'rgba(255, 255, 255, 0.12)' }, pressed && styles.pressed]}
      >
        <View style={[styles.slimArtwork, { backgroundColor: slimTheme.dark.surface }]}>
          <V2PracticeArtwork mode={slimMode} height={SLIM_ARTWORK_HEIGHT} variant="card" imageStyle={slimMode === 'release' ? styles.releaseSlimCrop : styles.visualizeSlimCrop} />
          {/* Edge scrims sit behind the text blocks only, so the sun/ribbon in the middle stays vivid. */}
          {slimMode === 'release' ? (
            <LinearGradient
              pointerEvents="none"
              colors={[...RELEASE_SCRIM_COLORS]}
              locations={[...RELEASE_SCRIM_LOCATIONS]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <LinearGradient pointerEvents="none" colors={[...slimTheme.dark.fade]} locations={[0, 0.62, 1]} style={styles.slimArtworkFade} />
          )}
        </View>
        <View style={styles.slimContent}>
          <View style={styles.slimTitleGroup}>
            <Text style={[styles.modeTag, { color: slimMode === 'release' ? 'rgba(244, 246, 250, 0.7)' : slimTheme.dark.label }]}>{modeLabel(slimMode)}</Text>
            <Text numberOfLines={1} style={styles.slimTitle}>{slimItem.title}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.slimDescriptor, slimMode === 'release' && styles.releaseSlimDescriptor]}>{slimMode === 'release' ? 'When ready' : '1 min · 3 min · 5 min'}</Text>
          {slimShowPro ? <View style={styles.slimProBadge}><Crown size={10} color={practiceDarkText.title} /><Text style={styles.proText}>PRO</Text></View> : null}
          <View style={[styles.slimActionCircle, slimMode === 'release' ? styles.releaseSlimAction : { backgroundColor: slimTheme.dark.actionBg }]}>
            <ArrowRight size={15} color={slimMode === 'release' ? '#FFFFFF' : slimTheme.dark.arrow} strokeWidth={2.1} />
          </View>
        </View>
      </Pressable>
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
    color: colors.ink.text.secondary,
    letterSpacing: 1.1,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing[3],
    rowGap: spacing[3],
  },
  slimRow: { height: SLIM_ARTWORK_HEIGHT, borderRadius: 18, borderWidth: 1, overflow: 'hidden', position: 'relative', shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  slimArtwork: { ...StyleSheet.absoluteFillObject },
  slimArtworkFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%' },
  releaseSlimCrop: { transform: [{ scale: 1.16 }, { translateY: -5 }] },
  visualizeSlimCrop: { transform: [{ scale: 1.16 }, { translateY: 5 }] },
  slimContent: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: BODY_INSET, gap: spacing[3] },
  slimTitleGroup: { width: 96, justifyContent: 'center' },
  slimTitle: { fontFamily: typography.displayBold, fontSize: 17, lineHeight: 20, letterSpacing: -0.3, color: practiceDarkText.title },
  slimDescriptor: { ...typography.caption, flex: 1, color: practiceDarkText.meta, fontSize: 12, textAlign: 'right' },
  slimProBadge: { position: 'absolute', top: 8, right: 46, flexDirection: 'row', alignItems: 'center', gap: 3 },
  slimActionCircle: { width: 28, height: 28, borderRadius: radii.round, alignItems: 'center', justifyContent: 'center' },
  releaseSlimDescriptor: { color: 'rgba(242, 238, 228, 0.92)' },
  // Muted/outlined, no accent fill; cream outline stays clearly visible over the art.
  releaseSlimAction: { borderWidth: 1, borderColor: 'rgba(242, 238, 228, 0.7)', backgroundColor: 'rgba(12, 10, 16, 0.35)' },
  card: {
    flexShrink: 0,
    backgroundColor: '#F4EFE6',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    justifyContent: 'flex-start',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
    backgroundColor: '#F4EFE6',
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 16,
  },
  modeTag: {
    ...typography.labelSM,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    fontFamily: typography.displayBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.3,
    color: '#121820',
    flex: 1,
  },
  actionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5DFD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    ...typography.caption,
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },
  purpose: {
    ...typography.bodySM,
    color: '#4B5563',
    fontSize: 11.5,
    lineHeight: 15.5,
    marginTop: 4,
  },
});
