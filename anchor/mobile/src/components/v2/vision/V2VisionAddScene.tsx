import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, RefreshCw } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useV2VisionSceneGeneration, type VisionGenerationCandidate } from '@/hooks/v2/vision';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import { VisionHeaderRow, VisionIdentity, VisionInkBand, type VisionAnchorArt } from './VisionChrome';
import { visionPossibleFuturePhoto } from './visionArt';
import { visionGenerationProgress } from './visionGenerationProgress';
import { useVisionPresentationQueue, VISION_REVEAL_TIMING } from './useVisionPresentationQueue';
import { VisionGenerationStage } from './VisionGenerationStage';

export const VISION_SCENE_MIN_CHARS = 6;
export const VISION_SCENE_MAX_CHARS = 400;
const CARD_GAP = 12;
const EXAMPLE = 'Working from a beach house with my family';

type Step = 'describe' | 'generating' | 'choose';

export type V2VisionAddSceneProps = {
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  onPremiumRequired?: () => void;
  onCancel: () => void;
  /** Adds the chosen image to the board. Resolves false when it could not be saved. */
  onAdd: (choice: { assetId: string; prompt: string }) => Promise<boolean>;
  testID?: string;
};

/**
 * "Add to your Vision": the person says what they want to see, two candidates
 * arrive through the same cinematic reveal as the first Vision, and the one
 * they choose joins the board.
 */
export function V2VisionAddScene({
  anchorId, anchorIntention, anchorCategory, anchorArt, anchorImageUrl, onPremiumRequired, onCancel, onAdd,
  testID = 'v2-vision-add-scene',
}: V2VisionAddSceneProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const generation = useV2VisionSceneGeneration(anchorId, onPremiumRequired);
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const startingRef = useRef(false);

  const { job } = generation;
  const candidates = useMemo(() => job?.candidates ?? [], [job?.candidates]);
  const categoryColor = getCategoryColor(anchorCategory);
  const possibleFuture = visionPossibleFuturePhoto(anchorCategory, anchorId);
  const trimmed = description.trim();
  const valid = trimmed.length >= VISION_SCENE_MIN_CHARS && trimmed.length <= VISION_SCENE_MAX_CHARS;
  const presentation = useVisionPresentationQueue(job?.id, candidates, { reduceMotion });
  const progress = visionGenerationProgress(job, presentation.idle);

  // A new job (first request or Regenerate) always returns to the reveal.
  useEffect(() => {
    if (!job) return;
    if (['QUEUED', 'RUNNING', 'PARTIAL'].includes(job.status)) setStep('generating');
    else if (job.status === 'FAILED') setStep(current => (current === 'choose' ? current : 'generating'));
  }, [job?.id, job?.status]);

  // A finished job moves on only after the reveal has shown what arrived.
  const complete = job?.status === 'COMPLETE' && candidates.length > 0;
  useEffect(() => {
    if (!complete || step !== 'generating' || !presentation.idle) return;
    const timer = setTimeout(() => setStep('choose'), reduceMotion ? 500 : VISION_REVEAL_TIMING.finalDwellMs);
    return () => clearTimeout(timer);
  }, [complete, presentation.idle, reduceMotion, step]);

  const generate = async () => {
    if (!valid) { setNotice(`Describe the scene in at least ${VISION_SCENE_MIN_CHARS} characters.`); return; }
    // One request per tap sequence.
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setNotice(null);
    setSelectedId(null);
    try {
      if (await generation.start(trimmed)) setStep('generating');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const choose = (candidate: VisionGenerationCandidate) => {
    if (!candidate.assetId || saving) return;
    v2Haptics.selection();
    setNotice(null);
    setSelectedId(current => (current === candidate.id ? null : candidate.id));
  };

  const addSelected = async () => {
    const candidate = candidates.find(item => item.id === selectedId);
    if (!candidate?.assetId || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await onAdd({ assetId: candidate.assetId, prompt: candidate.prompt || trimmed });
      if (!saved) setNotice('The image could not be added to your Vision. Please try again.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'The image could not be added to your Vision.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'generating') {
    const stageWidth = width - spacing[5] * 2;
    const stageHeight = Math.round(Math.max(340, Math.min(height * 0.55, 540)));
    const failed = job?.status === 'FAILED';
    return (
      <View testID={`${testID}-generating`} style={[styles.stage, styles.ink]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
        {/* Atmosphere, not content: the category's future, out of focus, far behind. */}
        <Image source={possibleFuture} blurRadius={26} resizeMode="cover" style={[styles.atmosphere, { width, height }]} />
        <LinearGradient pointerEvents="none" colors={[`${colors.ink.base}D9`, `${colors.ink.base}F2`, colors.ink.base]}
          locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={[styles.inkPage, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing[6] }]}>
          <VisionHeaderRow title="Add to your Vision" onBack={onCancel} />
          <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} />
          <Text accessibilityRole="header" style={styles.inkTitle}>Your future{'\n'}is growing.</Text>
          <Text style={styles.inkBody} numberOfLines={3}>{trimmed}</Text>
          <VisionGenerationStage presented={presentation.presented} width={stageWidth} height={stageHeight}
            accent={categoryColor} reduceMotion={reduceMotion} />
          <View accessibilityLiveRegion="polite" style={styles.status}>
            <Text style={styles.statusText}>{progress.title}</Text>
          </View>
          {failed ? (
            <View style={styles.failure}>
              <Text style={styles.failureTitle}>This moment needs another try.</Text>
              <Text style={styles.centeredBody}>
                {candidates.some(item => item.imageUrl) ? 'An image is ready to choose from, or you can try again.' : 'We could not bring it into view just yet.'}
              </Text>
              {(job?.retryCount ?? 0) < 2 ? <V2Button variant="secondary" onPress={() => { void generation.retry(); }}>Try again</V2Button> : null}
              {candidates.some(item => item.imageUrl) ? (
                <Pressable accessibilityRole="button" onPress={() => setStep('choose')} style={styles.linkHit}>
                  <Text style={styles.link}>Choose the available image</Text>
                </Pressable>
              ) : null}
              <Pressable accessibilityRole="button" onPress={() => setStep('describe')} style={styles.linkHit}>
                <Text style={styles.link}>Change what I described</Text>
              </Pressable>
            </View>
          ) : null}
          {generation.error ? <Text style={styles.centeredBody}>{generation.error}</Text> : null}
        </ScrollView>
      </View>
    );
  }

  if (step === 'choose') {
    const cardWidth = Math.floor((width - spacing[5] * 2 - CARD_GAP) / 2);
    const cardHeight = Math.min(Math.round(cardWidth * (16 / 9)), Math.round(height * 0.5));
    return (
      <View testID={`${testID}-choose`} style={[styles.stage, styles.ink]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
        <ScrollView contentContainerStyle={[styles.inkPage, { paddingTop: insets.top, paddingBottom: spacing[6] }]}>
          <VisionHeaderRow title="Choose an image" onBack={saving ? undefined : () => setStep('describe')} />
          <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} />
          <Text accessibilityRole="header" style={styles.chooseTitle}>Which one belongs?</Text>
          <Text style={styles.inkBody}>{trimmed}</Text>
          <View style={styles.cards}>
            {candidates.map((candidate, index) => {
              const selected = selectedId === candidate.id;
              return (
                <Pressable key={candidate.id} testID={`scene-candidate-${candidate.id}`} disabled={!candidate.assetId || !candidate.imageUrl}
                  accessibilityRole="button" accessibilityState={{ selected }}
                  accessibilityLabel={selected ? `Option ${index + 1}, selected` : `Choose option ${index + 1}`}
                  onPress={() => choose(candidate)}
                  style={({ pressed }) => [styles.card, { width: cardWidth, height: cardHeight },
                    selected && { borderColor: categoryColor, borderWidth: 3 }, pressed && styles.pressed]}>
                  {candidate.imageUrl
                    ? <Image source={{ uri: candidate.imageUrl }} resizeMode="cover" accessibilityIgnoresInvertColors style={styles.cardImage} />
                    : <View style={styles.unavailable}><Text style={styles.unavailableText}>Image unavailable</Text></View>}
                  {selected ? <View style={[styles.badge, { backgroundColor: categoryColor }]}><Check size={14} color={colors.paper} /></View> : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[3] }]}>
          {notice || generation.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{notice ?? generation.error}</Text> : null}
          <V2Button size="large" accessibilityLabel="Add to Vision" loading={saving} disabled={!selectedId || saving}
            onPress={() => { void addSelected(); }}>
            Add to Vision
          </V2Button>
          <View style={styles.secondaryRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Regenerate" disabled={saving || starting}
              onPress={() => { void generate(); }} style={[styles.secondary, (saving || starting) && styles.disabled]}>
              <RefreshCw size={15} color={colors.text.primary} />
              <Text style={styles.secondaryText}>Regenerate</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel" disabled={saving} onPress={onCancel}
              style={[styles.secondary, saving && styles.disabled]}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View testID={`${testID}-describe`} style={styles.stage}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }}>
          <VisionInkBand>
            <View style={styles.band}>
              <VisionHeaderRow title="Add to your Vision" onBack={onCancel} />
              <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} />
            </View>
            <View style={styles.bandTail} />
          </VisionInkBand>
          <View style={styles.body}>
            <Text accessibilityRole="header" style={styles.heading}>What do you want to see?</Text>
            <Text style={styles.description}>Describe another moment from this future: where you are and what is happening.</Text>
            <View style={styles.inputFrame}>
              <TextInput testID="vision-scene-input" accessibilityLabel="Describe the scene" multiline maxLength={VISION_SCENE_MAX_CHARS}
                value={description} onChangeText={setDescription} placeholder={`Example: ${EXAMPLE}`}
                placeholderTextColor={colors.text.disabled} style={styles.input} textAlignVertical="top" />
            </View>
            <View style={styles.meter}>
              <Text style={styles.meterHint}>Where you are · what you are doing · what you see</Text>
              <Text style={styles.counter}>{description.length}/{VISION_SCENE_MAX_CHARS}</Text>
            </View>
            {notice || generation.error ? <Text style={styles.error}>{notice ?? generation.error}</Text> : null}
            <V2Button testID="vision-scene-generate" size="large" accessibilityLabel="Generate image" disabled={!valid} loading={starting}
              onPress={() => { Keyboard.dismiss(); void generate(); }}>
              Generate image
            </V2Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stage: { flex: 1, backgroundColor: colors.canvas },
  ink: { backgroundColor: colors.ink.base },
  atmosphere: { position: 'absolute', left: 0, top: 0, opacity: 0.5 },
  band: { paddingHorizontal: spacing[5], gap: spacing[4] },
  bandTail: { height: spacing[5] },
  body: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3] },
  heading: { ...typography.headingXL, color: colors.text.primary },
  description: { ...typography.bodyMD, color: colors.text.secondary },
  inputFrame: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface },
  input: { ...typography.bodyLG, color: colors.text.primary, minHeight: 140, maxHeight: 240, padding: spacing[4] },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  meterHint: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  counter: { ...typography.caption, color: colors.text.tertiary },
  error: { ...typography.caption, color: colors.semantic.error },
  inkPage: { paddingHorizontal: spacing[5], gap: spacing[3] },
  inkTitle: { ...typography.displayMedium, color: colors.ink.text.primary, marginTop: spacing[4] },
  chooseTitle: { ...typography.headingXL, color: colors.ink.text.primary, marginTop: spacing[3] },
  inkBody: { ...typography.bodyMD, color: colors.ink.text.secondary },
  status: { alignSelf: 'center', minHeight: 24, justifyContent: 'center', marginTop: spacing[1] },
  statusText: { ...typography.bodySM, color: colors.ink.text.secondary, textAlign: 'center' },
  failure: { gap: spacing[3], alignItems: 'center', marginTop: spacing[4] },
  failureTitle: { ...typography.headingMD, color: colors.ink.text.primary, textAlign: 'center' },
  centeredBody: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center' },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { ...typography.labelMD, color: colors.ink.text.primary, textDecorationLine: 'underline' },
  cards: { flexDirection: 'row', justifyContent: 'center', gap: CARD_GAP, marginTop: spacing[2] },
  card: { borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink.hairline, backgroundColor: colors.ink.raised },
  cardImage: { width: '100%', height: '100%' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unavailableText: { ...typography.caption, color: colors.ink.text.tertiary },
  badge: { position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  footer: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3], backgroundColor: colors.canvas, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  secondaryRow: { flexDirection: 'row', gap: spacing[2] },
  secondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface },
  secondaryText: { ...typography.labelMD, color: colors.text.primary },
  disabled: { opacity: 0.45 },
});
