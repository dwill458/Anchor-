import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type ViewInstance } from 'react-native';
import { ChevronRight, ZoomIn, SlidersHorizontal, RefreshCw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
import { colors, radii, spacing, typography } from '@/theme/v2';
import { visionRoundLabel, type VisionConversationRound } from '@/types/visionConversation';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { VisionBackButton, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import type { VisionAnchorArt } from './VisionChrome';
import { VisionLineageLine } from './VisionLineageLine';
import { VisionVersionStrip } from './VisionVersionStrip';
import { VisionPrint } from './ceremony/VisionPrint';

export interface VisionConversationSelectionProps {
  anchorArt?: VisionAnchorArt | null;
  round: VisionConversationRound;
  rounds: readonly VisionConversationRound[];
  selectedCandidateId: string | null;
  onSelect: (candidate: VisionGenerationCandidate, index: number) => void;
  onRefine: (candidate: VisionGenerationCandidate, index: number) => void;
  onSelectRound: (id: string) => void;
  onViewCandidate: (id: string) => void;
  onAnother: () => void;
  onBack: () => void;
  onRetry?: () => void;
  inspectCandidateId?: string | null;
  onInspectClosed?: () => void;
  onImageError?: (uri: string) => void;
  onPrintLayout?: (index: number, rect: { x: number; y: number; width: number; height: number }) => void;
  busy?: boolean;
  error?: string | null;
}

const PAPER = '#F4EDE0';
const MUTED = '#C9C4D3';
const SORTED = (round: VisionConversationRound) => [...round.candidates].sort((left, right) => left.sortOrder - right.sortOrder);

function optionIndex(round: VisionConversationRound, candidateId: string | null) {
  return candidateId ? SORTED(round).findIndex(candidate => candidate.id === candidateId) + 1 : 0;
}

function useWindowFrame(ref: React.RefObject<ViewInstance | null>, callback?: (rect: { x: number; y: number; width: number; height: number }) => void) {
  if (!callback || !ref.current?.measureInWindow) return;
  ref.current.measureInWindow((x, y, width, height) => {
    if (width > 0 && height > 0) callback({ x, y, width, height });
  });
}

function PrintCard({
  candidate, index, selected, refined, disabled, width, height, onInspect, onRefine, onSelect, onImageError, onPrintLayout, testID,
}: {
  candidate: VisionGenerationCandidate;
  index: number;
  selected: boolean;
  refined: boolean;
  disabled: boolean;
  width: number;
  height: number;
  onInspect: () => void;
  onRefine: () => void;
  onSelect: () => void;
  onImageError?: (uri: string) => void;
  onPrintLayout?: (index: number, rect: { x: number; y: number; width: number; height: number }) => void;
  testID: string;
}) {
  const printRef = useRef<ViewInstance>(null);
  const measurePrint = (_event: LayoutChangeEvent) => useWindowFrame(printRef, rect => onPrintLayout?.(index, rect));

  return (
    <View style={[styles.card, { width }]} testID={`${testID}-card-${index}`}>
      <View
        ref={printRef}
        collapsable={false}
        testID={`${testID}-print-frame-${index}`}
        onLayout={measurePrint}
        style={[styles.printFrame, { width, height }, selected && styles.selectedPrint]}
      >
        <Pressable testID={`${testID}-inspect-${index}`} accessibilityRole="button"
          accessibilityLabel={`Inspect Option ${index + 1}`} accessibilityHint="Opens this image for a closer look"
          accessibilityState={{ disabled }} disabled={disabled || !candidate.imageUrl} onPress={onInspect} style={styles.printHitArea}>
          <VisionPrint testID={`${testID}-print-${index}`} uri={candidate.imageUrl ?? undefined} developing={false}
            revealed instant silent showCaption={false} caption="" pinned={false} empty={!candidate.imageUrl}
            onImageError={onImageError} />
        </Pressable>
        <Pressable testID={`${testID}-zoom-${index}`} accessibilityRole="button" accessibilityLabel={`Open image inspector for Option ${index + 1}`}
          accessibilityState={{ disabled }} disabled={disabled || !candidate.imageUrl} onPress={onInspect} style={styles.zoomButton}>
          <ZoomIn size={19} color={PAPER} strokeWidth={2} />
        </Pressable>
      </View>
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Option {index + 1}</Text>
        {refined ? <Badge label="Refined" testID={`${testID}-refined-${index}`} /> : null}
        {selected ? <Badge label="Your pick" testID={`${testID}-pick-${index}`} /> : null}
      </View>
      <Pressable testID={`${testID}-refine-${index}`} accessibilityRole="button" accessibilityLabel={`Refine Option ${index + 1}`}
        accessibilityState={{ disabled }} disabled={disabled || !candidate.imageUrl} onPress={onRefine} style={({ pressed }) => [styles.refineButton, pressed && styles.pressed, disabled && styles.disabled]}>
        <SlidersHorizontal size={17} color={VISION_GOLD} strokeWidth={1.8} />
        <Text style={styles.refineLabel}>Refine</Text>
      </Pressable>
      <Pressable testID={`${testID}-select-${index}`} accessibilityRole="button" accessibilityLabel={`Use This One, Option ${index + 1}`}
        accessibilityState={{ disabled, selected }} disabled={disabled || !candidate.imageUrl} onPress={onSelect} style={({ pressed }) => [styles.selectButton, selected && styles.selectedButton, pressed && styles.pressed, disabled && styles.disabled]}>
        <Text style={[styles.selectLabel, selected && styles.selectedLabel]}>Use This One</Text>
      </Pressable>
    </View>
  );
}

function Badge({ label, testID }: { label: string; testID: string }) {
  return <View testID={testID} style={styles.badge}><View style={styles.badgeDot} /><Text style={styles.badgeLabel}>{label}</Text></View>;
}

export function VisionConversationSelection({
  round, rounds, selectedCandidateId, anchorArt, onSelect, onRefine, onSelectRound, onViewCandidate, onAnother, onBack,
  inspectCandidateId, onInspectClosed, onRetry, onImageError, onPrintLayout, busy = false, error = null,
}: VisionConversationSelectionProps) {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [inspecting, setInspecting] = useState<{ candidate: VisionGenerationCandidate; index: number } | null>(null);
  const candidates = useMemo(() => SORTED(round), [round]);
  const maxRoundNumber = Math.max(...rounds.map(item => item.roundNumber), round.roundNumber);
  const isLatest = round.roundNumber === maxRoundNumber;
  const isInitialChoice = round.roundNumber === 0 && rounds.length <= 1;
  const parentRound = round.parentCandidateId
    ? rounds.find(item => item.candidates.some(candidate => candidate.id === round.parentCandidateId))
    : undefined;
  const parentOption = parentRound ? optionIndex(parentRound, round.parentCandidateId) : 0;
  const galleryWidth = Math.min(viewportWidth - spacing[5] * 2, 430);
  const cardGap = spacing[3];
  const cardWidth = Math.max(1, (galleryWidth - cardGap) / 2);
  const cardHeight = Math.min(cardWidth * 1.52, viewportHeight * 0.35);
  const focusedCandidate = inspecting?.candidate;
  const modalCardHeight = Math.min(Math.min(viewportWidth - 52, 390) * 1.5, viewportHeight * 0.5);

  const refinedCandidateIds = useMemo(() => new Set(rounds.map(item => item.parentCandidateId).filter((id): id is string => Boolean(id))), [rounds]);
  useEffect(() => {
    if (!inspectCandidateId) return;
    const index = candidates.findIndex(candidate => candidate.id === inspectCandidateId);
    if (index >= 0) setInspecting({ candidate: candidates[index], index });
  }, [candidates, inspectCandidateId]);
  const closeInspect = () => {
    if (busy) return;
    setInspecting(null);
    onInspectClosed?.();
  };
  const submitFor = (candidate: VisionGenerationCandidate, index: number, action: 'select' | 'refine') => {
    if (busy || !candidate.imageUrl) return;
    setInspecting(null);
    onInspectClosed?.();
    if (action === 'select') onSelect(candidate, index);
    else onRefine(candidate, index);
  };

  let kicker = 'YOUR SCENE IS READY';
  let title = 'Which one feels right?';
  let subtitle = 'Tap a print to inspect, refine details, or keep the one that belongs in your Vision.';
  if (!isInitialChoice && round.roundNumber === 0) {
    kicker = 'YOUR VERSIONS';
    title = 'Your first options';
    subtitle = 'Every version stays saved. Tap one above to return to it.';
  } else if (!isInitialChoice && isLatest && round.roundNumber === 1) {
    kicker = `VERSION ${round.roundNumber}`;
    title = 'Here is your new version';
    subtitle = parentRound && parentOption ? `Refined from ${visionRoundLabel(parentRound.roundNumber)} · Option ${parentOption}` : 'A new version of your scene.';
  } else if (!isInitialChoice && isLatest) {
    kicker = `VERSION ${round.roundNumber}`;
    title = 'Your latest options';
    subtitle = 'Tap a version above to go back. Nothing is lost.';
  } else if (!isInitialChoice) {
    kicker = `VERSION ${round.roundNumber}`;
    title = 'Your earlier options';
    subtitle = 'Tap a version above to move through your Vision.';
  }

  const bottomLabel = round.roundNumber === 0 && rounds.length === 1
    ? 'Neither feels right · Generate new options'
    : 'Generate another variation';

  return (
    <View testID="vision-conversation-selection" style={styles.stage}>
      <StatusBar barStyle="light-content" animated />
      <LinearGradient pointerEvents="none" colors={[colors.ink.base, colors.ink.deep, '#090D12']} style={StyleSheet.absoluteFill} />
      <ScrollView
        testID="vision-conversation-selection-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2], paddingBottom: spacing[4] }]}
      >
        <View style={styles.topRow}>
          <VisionBackButton onPress={onBack} color={PAPER} />
          <View testID="vision-selection-anchor-mark" style={styles.anchorMark} accessible accessibilityRole="image" accessibilityLabel="Anchor">
            <View style={styles.anchorInner}>
              {anchorArt?.svg || anchorArt?.imageUrl ? <CircularAnchorRenderer
                svg={anchorArt.svg}
                imageUrl={anchorArt.imageUrl ?? undefined}
                category={anchorArt.category}
                expression={anchorArt.expression ?? undefined}
                size={32}
                appearance="paper"
                testID="vision-selection-anchor-artwork"
              /> : null}
            </View>
          </View>
          <View style={styles.topSpacer} />
        </View>

        <View style={styles.header}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text testID="vision-conversation-selection-title" accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {rounds.length > 1 ? (
          <VisionVersionStrip rounds={rounds} selectedRoundId={round.id} onSelect={onSelectRound} testID="vision-selection-history" />
        ) : null}
        {rounds.length > 1 && selectedCandidateId ? (
          <VisionLineageLine rounds={rounds} selectedRoundId={round.id} selectedCandidateId={selectedCandidateId}
            onViewCandidate={onViewCandidate} testID="vision-selection-lineage" />
        ) : null}

        {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
        {onRetry ? <Pressable testID="vision-conversation-selection-retry" accessibilityRole="button" accessibilityLabel="Retry image" accessibilityState={{ disabled: busy }} disabled={busy} onPress={onRetry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed, busy && styles.disabled]}>
          <RefreshCw size={16} color={PAPER} strokeWidth={1.8} /><Text style={styles.retryLabel}>Retry image</Text>
        </Pressable> : null}

        <View testID="vision-conversation-selection-candidates" style={[styles.candidateRow, { width: galleryWidth, gap: cardGap }]}>
          {candidates.map((candidate, index) => (
            <PrintCard
              key={candidate.id}
              candidate={candidate}
              index={index}
              selected={candidate.id === selectedCandidateId}
              refined={refinedCandidateIds.has(candidate.id)}
              disabled={busy}
              width={cardWidth}
              height={cardHeight}
              onInspect={() => setInspecting({ candidate, index })}
              onRefine={() => submitFor(candidate, index, 'refine')}
              onSelect={() => submitFor(candidate, index, 'select')}
              onImageError={onImageError}
              onPrintLayout={onPrintLayout}
              testID="vision-conversation-selection"
            />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing[3] }]}>
        {error ? <Text accessibilityLiveRegion="polite" style={styles.bottomError}>{error}</Text> : null}
        <Pressable testID="vision-conversation-selection-another" accessibilityRole="button" accessibilityLabel={bottomLabel}
          accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={onAnother} style={({ pressed }) => [styles.anotherButton, pressed && styles.pressed, busy && styles.disabled]}>
          <RefreshCw size={18} color={MUTED} strokeWidth={1.8} />
          <Text style={styles.anotherLabel}>{busy ? 'Working…' : bottomLabel}</Text>
          <ChevronRight size={16} color={MUTED} strokeWidth={1.8} />
        </Pressable>
      </View>

      <Modal visible={Boolean(focusedCandidate)} animationType="fade" onRequestClose={closeInspect}>
        <View testID="vision-conversation-selection-inspect" style={[styles.stage, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <LinearGradient pointerEvents="none" colors={[colors.ink.base, colors.ink.deep, '#090D12']} style={StyleSheet.absoluteFill} />
          <View style={styles.modalTop}>
            <VisionBackButton label="Back to options" color={PAPER} onPress={closeInspect} />
            <Text style={styles.modalCount}>{inspecting ? `Candidate ${inspecting.index + 1} of ${candidates.length}` : ''}</Text>
            <View style={styles.topSpacer} />
          </View>
          <View style={styles.modalHeading}>
            <Text style={styles.kicker}>INSPECT YOUR SCENE</Text>
            <Text accessibilityRole="header" style={styles.modalTitle}>Take a closer look</Text>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {focusedCandidate?.imageUrl ? (
              <View testID="vision-conversation-selection-inspect-print" style={{ width: Math.min(viewportWidth - 52, 390), height: modalCardHeight }}>
                <VisionPrint testID="vision-conversation-selection-inspect-image" uri={focusedCandidate.imageUrl} developing={false}
                  revealed instant silent showCaption={false} caption="" pinned={false} onImageError={onImageError} />
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.modalActions}>
            {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
            <View style={styles.modalActionRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Refine This Image" accessibilityState={{ disabled: busy }} disabled={busy || !focusedCandidate?.imageUrl}
                onPress={() => inspecting && submitFor(inspecting.candidate, inspecting.index, 'refine')} style={({ pressed }) => [styles.modalRefine, pressed && styles.pressed, busy && styles.disabled]}>
                <SlidersHorizontal size={17} color={VISION_GOLD} strokeWidth={1.8} />
                <Text style={styles.refineLabel}>Refine This Image</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Use This One" accessibilityState={{ disabled: busy }} disabled={busy || !focusedCandidate?.imageUrl}
                onPress={() => inspecting && submitFor(inspecting.candidate, inspecting.index, 'select')} style={({ pressed }) => [styles.modalSelect, pressed && styles.pressed, busy && styles.disabled]}>
                <Text style={styles.modalSelectLabel}>Use This One</Text><ChevronRight size={18} color={colors.ink.base} />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="See both candidates again" disabled={busy} onPress={closeInspect} style={styles.seeBoth}>
              <Text style={styles.seeBothLabel}>See both candidates again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.ink.base },
  content: { alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[4] },
  topRow: { width: '100%', minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topSpacer: { width: 44, height: 44 },
  anchorMark: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 36, borderWidth: 1, borderColor: 'rgba(176,138,74,0.7)' },
  anchorInner: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 1, borderColor: VISION_GOLD },
  header: { width: '100%', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[2], marginBottom: spacing[1] },
  kicker: { color: MUTED, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 2.5, textAlign: 'center' },
  title: { color: PAPER, fontFamily: VISION_SERIF, fontSize: 34, lineHeight: 40, letterSpacing: -0.4, textAlign: 'center' },
  subtitle: { color: MUTED, fontFamily: typography.body, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 360 },
  candidateRow: { maxWidth: 430, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start' },
  card: { gap: spacing[2] },
  printFrame: { position: 'relative', overflow: 'hidden', borderRadius: 5, backgroundColor: PAPER, borderWidth: 2, borderColor: PAPER },
  selectedPrint: { borderColor: VISION_GOLD },
  printHitArea: { flex: 1 },
  zoomButton: { position: 'absolute', right: 10, bottom: 10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(14, 21, 28, 0.78)', borderWidth: 1, borderColor: 'rgba(244,237,224,0.35)' },
  optionRow: { minHeight: 28, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  optionLabel: { color: MUTED, fontFamily: typography.body, fontSize: 14, lineHeight: 20 },
  badge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(176,138,74,0.6)' },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: VISION_GOLD },
  badgeLabel: { color: VISION_GOLD, fontFamily: typography.bodyMedium, fontSize: 11, lineHeight: 16 },
  refineButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radii.round, borderWidth: 1, borderColor: 'rgba(176,138,74,0.72)', backgroundColor: 'rgba(244,237,224,0.06)' },
  refineLabel: { color: PAPER, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  selectButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.round, borderWidth: 1, borderColor: 'rgba(201,196,211,0.55)', backgroundColor: 'transparent' },
  selectedButton: { backgroundColor: PAPER, borderColor: PAPER },
  selectLabel: { color: PAPER, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 20 },
  selectedLabel: { color: colors.ink.base },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  bottom: { paddingHorizontal: spacing[4], paddingTop: spacing[2], backgroundColor: 'rgba(20,22,43,0.98)' },
  anotherButton: { minHeight: 56, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing[2], borderRadius: radii.round, borderWidth: 1, borderColor: 'rgba(201,196,211,0.4)', backgroundColor: 'rgba(244,237,224,0.025)', paddingHorizontal: spacing[4] },
  anotherLabel: { flexShrink: 1, color: MUTED, fontFamily: typography.body, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  errorText: { color: '#F4A49A', fontFamily: typography.body, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 48, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingHorizontal: spacing[4], borderRadius: radii.pill, borderWidth: 1, borderColor: '#F4EDE066' },
  retryLabel: { color: PAPER, fontFamily: typography.body, fontSize: 14 },
  bottomError: { color: '#F4A49A', fontFamily: typography.body, fontSize: 12, lineHeight: 17, textAlign: 'center', marginBottom: spacing[2] },
  modalTop: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4] },
  modalCount: { color: MUTED, fontFamily: typography.bodyMedium, fontSize: 14, lineHeight: 20 },
  modalHeading: { alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3] },
  modalTitle: { color: PAPER, fontFamily: VISION_SERIF, fontSize: 32, lineHeight: 39, textAlign: 'center' },
  modalScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  modalActions: { gap: spacing[2], padding: spacing[4], paddingBottom: spacing[4] },
  modalActionRow: { flexDirection: 'row', gap: spacing[2] },
  modalRefine: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: radii.round, borderWidth: 1, borderColor: VISION_GOLD, paddingHorizontal: spacing[2] },
  modalSelect: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radii.round, backgroundColor: PAPER, paddingHorizontal: spacing[2] },
  modalSelectLabel: { color: colors.ink.base, fontFamily: typography.bodySemiBold, fontSize: 14, lineHeight: 19 },
  seeBoth: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  seeBothLabel: { color: MUTED, fontFamily: typography.body, fontSize: 14, lineHeight: 20, textDecorationLine: 'underline' },
});
