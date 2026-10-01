import { memo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Check, RefreshCw } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
import { colors, radii, spacing, typography } from '@/theme/v2';
import type { VisionImageRect } from './VisionImageArrival';
import { VisionHeaderRow, VisionStatusBarScrim, type VisionAnchorArt } from './VisionChrome';
import { VISION_HERO_ASPECT } from './board/visionBoardLayouts';

export interface VisionCandidateSelectionProps {
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  candidates: VisionGenerationCandidate[];
  onBack: () => void;
  onConfirm: (selectedCandidate: VisionGenerationCandidate, source?: VisionImageRect) => Promise<boolean | void> | void;
  onRegenerate?: () => void;
  isSaving?: boolean;
  error?: string | null;
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
  isSaving = false, error,
  testID = 'vision-candidate-selection',
}: VisionCandidateSelectionProps) {
  const candidateRefs = useRef<Record<string, View | null>>({});
  const sourceRects = useRef<Record<string, VisionImageRect>>({});
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useV2ReduceMotion();

  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set());
  const readyCandidates = candidates.filter(c => Boolean(c.imageUrl));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cardWidth = windowWidth - spacing[5] * 2;
  const cardHeight = Math.round(cardWidth / VISION_HERO_ASPECT);

  const handleSelect = (candidateId: string) => {
    if (isSaving || failedIds.has(candidateId)) return;
    v2Haptics.selection();
    setSelectedId(candidateId);
    candidateRefs.current[candidateId]?.measureInWindow?.((x, y, width, height) => {
      if (width > 0 && height > 0) sourceRects.current[candidateId] = { x, y, width, height };
    });
  };

  const handleConfirm = () => {
    const candidate = candidates.find(c => c.id === selectedId);
    if (!candidate || isSaving || failedIds.has(candidate.id)) return;
    const source = sourceRects.current[candidate.id];
    if (source) void onConfirm(candidate, source); else void onConfirm(candidate);
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
          <VisionHeaderRow title="Choose Image" onBack={isSaving ? undefined : onBack} tone="light" />
        </View>

        {/* Cinematic headline */}
        <View style={styles.headlineWrapper}>
          <Text accessibilityRole="header" style={styles.title}>
            Pick the image that feels right.
          </Text>
        </View>

        {/* Candidate photographs stacked vertically */}
        <View style={styles.cardsContainer}>
          {readyCandidates.map((candidate, index) => {
            const isSelected = candidate.id === selectedId;
            return (
              <Pressable
                ref={node => { candidateRefs.current[candidate.id] = node; }}
                onLayout={() => candidateRefs.current[candidate.id]?.measureInWindow?.((x, y, width, height) => {
                  if (width > 0 && height > 0) sourceRects.current[candidate.id] = { x, y, width, height };
                })}
                collapsable={false}
                key={candidate.id}
                testID={`scene-candidate-${candidate.id}`}
                disabled={isSaving || failedIds.has(candidate.id)}
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
                {candidate.imageUrl && !failedIds.has(candidate.id) ? (
                  <Image
                    source={{ uri: candidate.imageUrl }}
                    onError={() => {
                      setFailedIds(previous => new Set(previous).add(candidate.id));
                      if (selectedId === candidate.id) setSelectedId(null);
                    }}
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
          {error ? <Text accessibilityLiveRegion="polite" style={styles.subtitle}>{error}</Text> : null}


          {onRegenerate && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate More"
              disabled={isSaving}
              onPress={onRegenerate}
              style={[styles.secondaryButton, isSaving && styles.disabled]}
            >
              <RefreshCw size={15} color={colors.ink.text.primary} />
              <Text style={styles.secondaryButtonText}>Generate More</Text>
            </Pressable>
          )}
          <V2Button
            testID={`${testID}-confirm-button`}
            size="large"
            variant="secondary"
            accessibilityLabel="Use This Image"
            disabled={!selectedId || isSaving}
            loading={isSaving}
            onPress={handleConfirm}
            style={styles.submitButton}
          >
            Use This Image
          </V2Button>
        </View>
      </ScrollView>
      <VisionStatusBarScrim />
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
    ...typography.bodyMD,
    color: colors.ink.text.primary,
    lineHeight: 24,
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
    borderColor: colors.paper,
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
    backgroundColor: colors.ink.base,
    borderColor: colors.paper,
  },
  footerSection: {
    width: '100%',
    paddingHorizontal: spacing[5],
    marginTop: spacing[4],
    gap: spacing[3],
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
