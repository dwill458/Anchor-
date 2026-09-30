import React, { memo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Check, RefreshCw } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
import { colors, radii, spacing, typography, getCategoryColor } from '@/theme/v2';
import { VisionHeaderRow, VisionIdentity, type VisionAnchorArt } from './VisionChrome';

export interface VisionCandidateSelectionProps {
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  candidates: VisionGenerationCandidate[];
  onBack: () => void;
  onConfirm: (selectedCandidate: VisionGenerationCandidate) => Promise<boolean | void> | void;
  onRegenerate?: () => void;
  isSaving?: boolean;
  testID?: string;
}

export const VisionCandidateSelection = memo(function VisionCandidateSelection({
  anchorIntention,
  anchorCategory,
  anchorArt,
  anchorImageUrl,
  candidates,
  onBack,
  onConfirm,
  onRegenerate,
  isSaving = false,
  testID = 'vision-candidate-selection',
}: VisionCandidateSelectionProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();
  const categoryColor = getCategoryColor(anchorCategory);

  const readyCandidates = candidates.filter(c => Boolean(c.imageUrl));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cardWidth = windowWidth - spacing[5] * 2;
  const cardHeight = Math.round(cardWidth * 0.58);

  const handleSelect = (candidateId: string) => {
    if (isSaving) return;
    v2Haptics.selection();
    setSelectedId(candidateId);
  };

  const handleConfirm = () => {
    const candidate = candidates.find(c => c.id === selectedId);
    if (!candidate || isSaving) return;
    void onConfirm(candidate);
  };

  return (
    <View testID={testID} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: insets.bottom + spacing[4] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header without circular Anchor avatar */}
        <View style={styles.headerWrapper}>
          <VisionHeaderRow title="Choose your image" onBack={isSaving ? undefined : onBack} tone="light" />
          <VisionIdentity
            intention={anchorIntention}
            category={anchorCategory}
            art={anchorArt}
            imageUrl={anchorImageUrl}
            showAnchor={false}
            tone="light"
          />
        </View>

        {/* Cinematic headline */}
        <View style={styles.headlineWrapper}>
          <Text accessibilityRole="header" style={styles.title}>
            Here are two perspectives.
          </Text>
          <Text style={styles.subtitle}>
            Pick the one that feels most real.
          </Text>
        </View>

        {/* Candidate photographs stacked vertically */}
        <View style={styles.cardsContainer}>
          {readyCandidates.map((candidate, index) => {
            const isSelected = candidate.id === selectedId;
            return (
              <Pressable
                key={candidate.id}
                testID={`scene-candidate-${candidate.id}`}
                onPress={() => handleSelect(candidate.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Perspective ${index + 1}, ${isSelected ? 'selected' : 'not selected'}`}
                style={({ pressed }) => [
                  styles.card,
                  { width: cardWidth, height: cardHeight },
                  isSelected && styles.cardSelected,
                  pressed && styles.cardPressed,
                ]}
              >
                {candidate.imageUrl ? (
                  <Image
                    source={{ uri: candidate.imageUrl }}
                    resizeMode="cover"
                    accessible={false}
                    accessibilityIgnoresInvertColors
                    style={styles.cardImage}
                  />
                ) : (
                  <View style={styles.placeholderCard}>
                    <Text style={styles.placeholderText}>Image preview unavailable</Text>
                  </View>
                )}

                {/* Selection Indicator on top-right */}
                <View style={[styles.indicator, isSelected && styles.indicatorSelected]}>
                  {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* CTA & Actions */}
        <View style={styles.footerSection}>
          <V2Button
            testID={`${testID}-confirm-button`}
            size="large"
            accessibilityLabel="Add to Vision"
            disabled={!selectedId || isSaving}
            loading={isSaving}
            onPress={handleConfirm}
            style={styles.submitButton}
          >
            Add to Vision →
          </V2Button>

          {onRegenerate && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Regenerate"
              disabled={isSaving}
              onPress={onRegenerate}
              style={[styles.secondaryButton, isSaving && styles.disabled]}
            >
              <RefreshCw size={15} color={colors.ink.text.primary} />
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink.base,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  headerWrapper: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing[5],
    gap: spacing[2],
  },
  headlineWrapper: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[5],
    marginTop: spacing[3],
    marginBottom: spacing[3],
    gap: 4,
  },
  title: {
    ...typography.displayMedium,
    color: colors.ink.text.primary,
    fontSize: 26,
    lineHeight: 34,
  },
  subtitle: {
    ...typography.bodyMD,
    color: colors.ink.text.secondary,
    lineHeight: 22,
  },
  cardsContainer: {
    width: '100%',
    paddingHorizontal: spacing[5],
    gap: spacing[3],
    marginVertical: spacing[2],
  },
  card: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.ink.raised,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardSelected: {
    borderColor: '#A855F7',
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  placeholderText: {
    ...typography.caption,
    color: colors.ink.text.tertiary,
  },
  indicator: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorSelected: {
    backgroundColor: '#A855F7',
    borderColor: '#A855F7',
  },
  footerSection: {
    width: '100%',
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
  },
  submitButton: {
    width: '100%',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    marginTop: spacing[3],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  secondaryButtonText: {
    ...typography.labelMD,
    color: colors.ink.text.primary,
  },
  disabled: {
    opacity: 0.45,
  },
});
