import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
} from 'react-native';
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Compass, Eye, Image as ImageIcon, MapPin, PenLine, RefreshCw } from 'lucide-react-native';
import { V2Button } from '@/components/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import { useVisionAppearanceReference } from '@/hooks/v2/vision';
import { useV2VisionGeneration, type VisionGenerationCandidate, type UploadAssetResult } from '@/hooks/v2/vision';
import { colors, getCategoryColor, radii, spacing, typography } from '@/theme/v2';
import type { VisionSceneSource } from '@/adapters/v2/vision';
import { VisionPhoto } from './VisionPhoto';
import { VisionHeaderRow, VisionIdentity, type VisionAnchorArt } from './VisionChrome';
import { visionPossibleFuturePhoto } from './visionArt';
import {
  VISION_DESCRIPTION_MAX_CHARS, VISION_DESCRIPTION_MIN_CHARS, VISION_DESCRIPTION_PROMPTS,
  visionDescriptionExample, visionDetailHint, visionDetailLevel,
} from './visionGuidance';
import { visionGenerationProgress } from './visionGenerationProgress';
import { useVisionPresentationQueue, VISION_REVEAL_TIMING } from './useVisionPresentationQueue';
import { VisionGenerationStage } from './VisionGenerationStage';

type SelectedAsset = { assetId: string; prompt: string; imageUrl?: string; sourceType: VisionSceneSource };
type UploadItem = { key: string; uri: string; mimeType: string; assetId?: string; imageUrl?: string | null; status: 'uploading' | 'ready' | 'failed'; error?: string };
/** Selection order is meaningful: the first chosen image becomes the Vision cover. */
type Selection = { kind: 'candidate'; id: string } | { kind: 'upload'; key: string };

const MAX_IMAGES = 5;
const MAX_SETS = 3;
const TILE_GAP = 10;

const PROMPT_ICONS = { where: MapPin, doing: PenLine, see: Eye, different: Compass } as const;

export interface V2VisionCreationFlowProps {
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorImageUrl?: string | null;
  /** The real Anchor artwork for the identity row (`anchorRenderProps(anchor)`). */
  anchorArt?: VisionAnchorArt | null;
  initialDescription?: string;
  initialStep?: 'ready' | 'empty' | 'prompt' | 'curation';
  /** Optional normalized focal point for entrance image motion (x: 0.0-1.0, y: 0.0-1.0). */
  focalPoint?: { x: number; y: number } | null;
  onBack: () => void;
  onPremiumRequired?: () => void;
  onSaveDescription?: (description: string) => Promise<boolean>;
  resumeGeneration?: boolean;
  onResumeGenerationConsumed?: () => void;
  onUploadAsset: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
  onAssemble: (result: { description: string; selectedAssets: SelectedAsset[] }) => Promise<boolean | void>;
  testID?: string;
}

/** Fades and settles a newly arrived image into place. Shared values, not a layout animation. */
function Reveal({ children, style, reduceMotion, delay = 0, fromStage = false }: { children: React.ReactNode; style?: any; reduceMotion: boolean; delay?: number; fromStage?: boolean }) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => {
      progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, progress, reduceMotion]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: (fromStage ? 1.08 : 0.965) + progress.value * (fromStage ? -0.08 : 0.035) }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

function VisionEntranceStage({
  possibleFuture, anchorCategory, anchorIntention, anchorArt, anchorImageUrl, focalPoint, insets, onBack, onStartCreate, testID,
}: {
  possibleFuture: any;
  anchorCategory?: string | null;
  anchorIntention: string;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  focalPoint?: { x: number; y: number } | null;
  insets: any;
  onBack: () => void;
  onStartCreate: () => void;
  testID: string;
}) {
  const reduceMotion = useV2ReduceMotion();
  const [isExiting, setIsExiting] = useState(false);
  const isExitingRef = useRef(false);

  const headerProgress = useSharedValue(reduceMotion ? 1 : 0);
  const titleProgress = useSharedValue(reduceMotion ? 1 : 0);
  const bodyProgress = useSharedValue(reduceMotion ? 1 : 0);
  const footerProgress = useSharedValue(reduceMotion ? 1 : 0);
  const exitOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    headerProgress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    const timer1 = setTimeout(() => {
      titleProgress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    }, 150);
    const timer2 = setTimeout(() => {
      bodyProgress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    }, 300);
    const timer3 = setTimeout(() => {
      footerProgress.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) });
    }, 450);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [bodyProgress, footerProgress, headerProgress, reduceMotion, titleProgress]);

  const handleCreatePress = () => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);
    if (reduceMotion) {
      onStartCreate();
      return;
    }
    exitOpacity.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
    setTimeout(() => {
      onStartCreate();
    }, 300);
  };

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerProgress.value * exitOpacity.value,
    transform: [{ translateY: (1 - headerProgress.value) * 6 }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleProgress.value * exitOpacity.value,
    transform: [{ translateY: (1 - titleProgress.value) * 8 }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyProgress.value * exitOpacity.value,
  }));

  const footerStyle = useAnimatedStyle(() => ({
    opacity: footerProgress.value * exitOpacity.value,
  }));

  const identity = (tone: 'light' | 'dark' = 'light') => (
    <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} tone={tone} />
  );

  return (
    <View testID={`${testID}-empty`} style={styles.stage}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <VisionPhoto
        source={possibleFuture}
        category={anchorCategory}
        tint={0.12}
        scrim="both"
        bottomScrimColor={colors.canvas}
        cinematic={true}
        focalPoint={focalPoint}
        isExiting={isExiting}
        style={styles.emptyPhoto}
      >
        <View pointerEvents="none" style={styles.emptyTextShade} />
        <View style={[styles.photoContent, { paddingTop: insets.top }]}>
          <Animated.View style={headerStyle}>
            <VisionHeaderRow title="Vision" onBack={onBack} />
            {identity()}
          </Animated.View>
          <Animated.View style={titleStyle}>
            <Text accessibilityRole="header" style={styles.emptyTitle}>See your future.</Text>
          </Animated.View>
          <Animated.View style={bodyStyle}>
            <Text style={styles.emptyBody}>Turn your intention into a visual future you can step into.</Text>
          </Animated.View>
        </View>
      </VisionPhoto>
      <Animated.View style={[styles.emptyFooter, { paddingBottom: insets.bottom + spacing[4] }, footerStyle]}>
        <View style={styles.rule} />
        <Text style={styles.quote}>A clear Vision changes everything.</Text>
        <View style={styles.rule} />
        <V2Button size="large" accessibilityLabel="Create Vision" onPress={handleCreatePress} style={styles.fullWidth}>
          Create Vision →
        </V2Button>
      </Animated.View>
    </View>
  );
}

export function V2VisionCreationFlow({
  anchorId, anchorIntention, anchorCategory, anchorImageUrl, anchorArt, initialDescription = '',
  initialStep = 'prompt', focalPoint, onBack, onPremiumRequired, onSaveDescription, resumeGeneration, onResumeGenerationConsumed, onUploadAsset, onAssemble,
  testID = 'v2-vision-creation-flow',
}: V2VisionCreationFlowProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useV2ReduceMotion();
  const [step, setStep] = useState<'empty' | 'prompt' | 'generating' | 'curation'>(
    initialStep === 'ready' || initialStep === 'empty' ? 'empty' : initialStep,
  );
  const [description, setDescription] = useState(initialDescription);
  const [selection, setSelection] = useState<Selection[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const generation = useV2VisionGeneration(anchorId, onPremiumRequired);
  const appearance = useVisionAppearanceReference();
  const [useAppearance, setUseAppearance] = useState(false);
  const [curationOriginId, setCurationOriginId] = useState<string | null>(null);
  const appearanceHydrated = useRef(false);
  const categoryColor = getCategoryColor(anchorCategory);
  const possibleFuture = visionPossibleFuturePhoto(anchorCategory, anchorId);
  const candidates = generation.job?.candidates ?? [];
  const trimmed = description.trim();
  const validDescription = trimmed.length >= VISION_DESCRIPTION_MIN_CHARS && trimmed.length <= VISION_DESCRIPTION_MAX_CHARS;
  const selectedCount = selection.length;
  const tileWidth = Math.floor((width - spacing[5] * 2 - TILE_GAP) / 2);
  const example = useMemo(() => visionDescriptionExample(anchorIntention, anchorCategory), [anchorCategory, anchorIntention]);
  // The network delivers images; this queue decides when each one is shown.
  const presentation = useVisionPresentationQueue(generation.job?.id, candidates, { reduceMotion });
  const progress = visionGenerationProgress(generation.job, presentation.idle);
  const startingRef = useRef(false);

  // This setting is an explicit future-session preference, never a silent
  // reinterpretation of a profile image in the same session.
  useEffect(() => {
    if (appearance.loading || appearanceHydrated.current) return;
    appearanceHydrated.current = true;
    if (appearance.enabledByPreference && appearance.reference?.source === 'PROFILE') setUseAppearance(true);
  }, [appearance.enabledByPreference, appearance.loading, appearance.reference?.source]);

  // Describe: typing brings the field forward and lets the cues recede.
  const scrollRef = useRef<ScrollView>(null);
  const inputOffset = useRef(0);
  const focusAmount = useSharedValue(0);
  useEffect(() => {
    focusAmount.value = withTiming(inputFocused ? 1 : 0, { duration: reduceMotion ? 0 : 280, easing: Easing.out(Easing.quad) });
  }, [focusAmount, inputFocused, reduceMotion]);
  const guideStyle = useAnimatedStyle(() => ({ opacity: 1 - focusAmount.value * 0.5 }));
  const inputFrameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusAmount.value, [0, 1], [colors.border.default, colors.text.primary]),
    shadowOpacity: focusAmount.value * 0.12,
  }));
  const focusInput = () => {
    setInputFocused(true);
    // Bring the field above the keyboard once, smoothly, rather than letting it jump.
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, inputOffset.current - spacing[8]), animated: !reduceMotion }), 120);
  };

  useEffect(() => {
    if (!generation.job) return;
    if (['QUEUED', 'RUNNING', 'PARTIAL'].includes(generation.job.status)) setStep('generating');
    // A paused set stays on the generating screen with every finished image
    // kept, offering Retry or choosing from what exists.
    else if (generation.job.status === 'FAILED') setStep(current => (current === 'curation' ? current : 'generating'));
  }, [generation.job?.id, generation.job?.status]);

  // A finished set moves on only after the screen has shown what arrived.
  const setComplete = generation.job?.status === 'COMPLETE' && candidates.length > 0;
  useEffect(() => {
    if (!setComplete) return;
    if (step !== 'generating') {
      if (step !== 'curation' && step !== 'prompt') setStep('curation');
      return;
    }
    if (!presentation.idle) return;
    const timer = setTimeout(() => {
      setCurationOriginId(presentation.presented.at(-1)?.id ?? null);
      setStep('curation');
    }, reduceMotion ? 500 : VISION_REVEAL_TIMING.finalDwellMs);
    return () => clearTimeout(timer);
  }, [presentation.idle, reduceMotion, setComplete, step]);

  // A set that has been replaced leaves nothing selectable behind.
  useEffect(() => {
    setSelection(prev => prev.filter(item => item.kind === 'upload' || candidates.some(candidate => candidate.id === item.id)));
  }, [generation.job?.id]);

  const selectedAssets = useMemo<SelectedAsset[]>(() => selection.flatMap<SelectedAsset>(item => {
    if (item.kind === 'candidate') {
      const candidate = candidates.find(value => value.id === item.id);
      return candidate?.assetId ? [{ assetId: candidate.assetId, prompt: candidate.prompt, imageUrl: candidate.imageUrl ?? undefined, sourceType: 'AI_GENERATED' }] : [];
    }
    const upload = uploads.find(value => value.key === item.key);
    return upload?.status === 'ready' && upload.assetId
      ? [{ assetId: upload.assetId, prompt: '', imageUrl: upload.imageUrl ?? upload.uri, sourceType: 'USER_UPLOAD' }]
      : [];
  }), [candidates, selection, uploads]);

  const generate = async () => {
    if (!validDescription) { setNotice(`Describe your Vision in at least ${VISION_DESCRIPTION_MIN_CHARS} characters.`); return; }
    // One request per tap sequence: saving the description is awaited before
    // the job starts, so a second tap in that window must not start another.
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setNotice(null);
    try {
      if (onSaveDescription && !(await onSaveDescription(trimmed))) {
        setNotice('Your description could not be saved. Please try again.');
        return;
      }
      const started = await generation.start(trimmed, useAppearance ? appearance.reference?.id : null);
      if (started) { setSelection(prev => prev.filter(item => item.kind === 'upload')); setStep('generating'); }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!resumeGeneration || !validDescription || generation.loading) return;
    onResumeGenerationConsumed?.();
    void generate();
  }, [resumeGeneration, validDescription, generation.loading]);

  const uploadOne = async (item: UploadItem, mimeType: string) => {
    setUploads(prev => prev.map(value => value.key === item.key ? { ...value, status: 'uploading', error: undefined } : value));
    try {
      const info = await FileSystem.getInfoAsync(item.uri);
      if (!info.exists) throw new Error('Photo is no longer available. Choose it again.');
      const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.Base64 });
      const result = await onUploadAsset({ base64Image: `data:${mimeType};base64,${base64}`, mimeType });
      if (!result.ok) throw new Error(result.message);
      setUploads(prev => prev.map(value => value.key === item.key
        ? { ...value, assetId: result.asset.id, imageUrl: result.asset.resolvedUrl, status: 'ready' } : value));
    } catch (cause) {
      setUploads(prev => prev.map(value => value.key === item.key
        ? { ...value, status: 'failed', error: cause instanceof Error ? cause.message : 'Upload failed' } : value));
    }
  };

  const pickImages = async () => {
    if (!validDescription) { setNotice('Describe your Vision first.'); return; }
    const remaining = MAX_IMAGES - selectedCount;
    if (remaining < 1) { setNotice('A Vision can contain up to five images.'); return; }
    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') { setNotice('Allow photo library access to add your images.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets.slice(0, remaining).map((asset, index) => ({
        key: `${Date.now()}-${index}`, uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg',
      }));
      const supported = picked.filter(item => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(item.mimeType));
      if (supported.length !== picked.length) setNotice('Choose JPEG, PNG, WebP, or GIF images.');
      setStep('curation');
      const items: UploadItem[] = supported.map(item => ({ key: item.key, uri: item.uri, mimeType: item.mimeType, status: 'uploading' }));
      setUploads(prev => [...prev, ...items]);
      // Personal photos are chosen deliberately, so they arrive selected.
      setSelection(prev => [...prev, ...items.map(item => ({ kind: 'upload' as const, key: item.key }))]);
      await Promise.all(supported.map((item, index) => uploadOne(items[index], item.mimeType)));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Unable to open your photos.');
    }
  };

  const pickAppearanceReference = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') { setNotice('Allow photo library access to add a reference photo.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false });
      const item = result.assets?.[0];
      if (result.canceled || !item) return;
      const next = await appearance.upload(item.uri, 'CUSTOM');
      if (!next) { setNotice('That photo could not be used as a reference. Choose a clear photo of one person.'); return; }
      setUseAppearance(true);
      setNotice(null);
    } catch { setNotice('Unable to open your photos.'); }
  };

  const enableProfileAppearance = async () => {
    if (!appearance.profilePhoto) return;
    if (appearance.reference?.source === 'PROFILE' && appearance.enabledByPreference) { setUseAppearance(value => !value); return; }
    const saved = await appearance.setProfilePreference(true);
    if (!saved) { setNotice('Your profile photo could not be prepared for Vision.'); return; }
    setUseAppearance(true);
    setNotice(null);
  };

  const toggleCandidate = (candidate: VisionGenerationCandidate) => {
    if (selection.some(item => item.kind === 'candidate' && item.id === candidate.id)) {
      v2Haptics.selection();
      setSelection(prev => prev.filter(item => !(item.kind === 'candidate' && item.id === candidate.id)));
      return;
    }
    if (selectedCount >= MAX_IMAGES) { setNotice('A Vision can contain up to five images.'); return; }
    v2Haptics.selection();
    setNotice(null);
    setSelection(prev => [...prev, { kind: 'candidate', id: candidate.id }]);
  };

  const removeUpload = (key: string) => {
    setUploads(prev => prev.filter(value => value.key !== key));
    setSelection(prev => prev.filter(item => !(item.kind === 'upload' && item.key === key)));
  };

  const save = async () => {
    if (!validDescription || selectedAssets.length < 1 || selectedAssets.length > MAX_IMAGES || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await onAssemble({ description: trimmed, selectedAssets });
      if (result === false) setNotice('Vision could not be saved. Please try again.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Vision could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const identity = (tone: 'light' | 'dark' = 'light') => (
    <VisionIdentity intention={anchorIntention} category={anchorCategory} art={anchorArt} imageUrl={anchorImageUrl} tone={tone} />
  );
  const orderOf = (match: (item: Selection) => boolean) => {
    const index = selection.findIndex(match);
    return index < 0 ? null : index + 1;
  };

  if (step === 'empty') return (
    <VisionEntranceStage
      possibleFuture={possibleFuture}
      anchorCategory={anchorCategory}
      anchorIntention={anchorIntention}
      anchorArt={anchorArt}
      anchorImageUrl={anchorImageUrl}
      focalPoint={focalPoint}
      insets={insets}
      onBack={onBack}
      onStartCreate={() => setStep('prompt')}
      testID={testID}
    />
  );

  if (step === 'generating') {
    const stageWidth = width - spacing[5] * 2;
    const stageHeight = Math.round(Math.max(340, Math.min(height * 0.55, 540)));
    const failed = generation.job?.status === 'FAILED';
    return (
      <View testID={`${testID}-generating`} style={[styles.stage, styles.inkStage]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
        {/* Atmosphere, not content: the category's future, out of focus, far behind. */}
        <Image source={possibleFuture} blurRadius={26} resizeMode="cover" style={[styles.atmosphere, { width, height }]} />
        <LinearGradient pointerEvents="none" colors={[`${colors.ink.base}D9`, `${colors.ink.base}F2`, colors.ink.base]}
          locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={[styles.inkPage, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing[6] }]}>
          <VisionHeaderRow title="Creating your Vision" onBack={onBack} />
          {identity()}
          <Text accessibilityRole="header" style={styles.inkTitle}>Your future{'\n'}is taking shape.</Text>
          <Text style={styles.inkBody}>Finding the moments that make it real.</Text>

          <VisionGenerationStage presented={presentation.presented} width={stageWidth} height={stageHeight}
            accent={categoryColor} reduceMotion={reduceMotion} />
          <View accessibilityLiveRegion="polite" style={styles.livingStatus}>
            <Text style={styles.livingStatusText}>{progress.title}</Text>
          </View>

          {failed && generation.job ? (
            <View style={styles.failure}>
              <Text style={styles.failureTitle}>Your Vision needs another moment.</Text>
              <Text style={styles.darkBody}>
                {progress.ready > 0
                  ? 'The moments already here are ready to choose from. You can also try again.'
                  : 'We could not bring your Vision into view just yet. Please try again.'}
              </Text>
              {generation.job.retryCount < 2 && (
                <V2Button variant="secondary" onPress={() => { void generation.retry(); }}>Retry this set</V2Button>
              )}
              {generation.job.candidates.length > 0 && (
                <Pressable accessibilityRole="button" onPress={() => setStep('curation')} style={styles.darkLinkHit}>
                  <Text style={styles.darkLink}>Choose available images</Text>
                </Pressable>
              )}
            </View>
          ) : null}
          {generation.error ? <Text style={styles.darkError}>{generation.error}</Text> : null}
        </ScrollView>
      </View>
    );
  }

  if (step === 'curation') {
    const setNumber = generation.job?.setNumber ?? 0;
    const canGenerateAnother = Boolean(generation.job && setNumber < MAX_SETS && generation.job.status !== 'RUNNING');
    const busyUploading = uploads.some(item => item.status === 'uploading');
    // The current cinematic scene leads the existing grid, so the handoff
    // resolves as a pull-back into the collection rather than an unrelated cut.
    const curationCandidates = curationOriginId
      ? [...candidates].sort((a, b) => (a.id === curationOriginId ? -1 : b.id === curationOriginId ? 1 : a.sortOrder - b.sortOrder))
      : candidates;
    return (
      <View testID={`${testID}-curation`} style={[styles.stage, styles.inkStage]}>
        <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
        <ScrollView contentContainerStyle={[styles.inkPage, { paddingTop: insets.top, paddingBottom: spacing[6] }]}>
          <VisionHeaderRow title="Choose Your Images" onBack={() => setStep('prompt')} />
          {identity()}
          <Text accessibilityRole="header" style={styles.curationTitle}>Select up to {MAX_IMAGES} images</Text>
          <Text style={styles.inkBody}>Choose the images that best represent your future. These are moments you can return to.</Text>
          <View style={styles.grid}>
            {curationCandidates.map((candidate, index) => {
              const order = orderOf(item => item.kind === 'candidate' && item.id === candidate.id);
              return (
                <Reveal key={candidate.id} reduceMotion={reduceMotion} delay={Math.min(index, 7) * 70} fromStage={candidate.id === curationOriginId}>
                  <Pressable testID={`candidate-card-${candidate.id}`} onPress={() => toggleCandidate(candidate)}
                    accessibilityRole="button" accessibilityState={{ selected: order !== null }}
                    accessibilityLabel={order ? `Remove ${candidate.role}` : `Select ${candidate.role}`}
                    style={({ pressed }) => [styles.tile, { width: tileWidth, height: tileWidth },
                      order !== null && { borderColor: categoryColor, borderWidth: 3 }, pressed && styles.tilePressed]}>
                    {candidate.imageUrl ? <Image source={{ uri: candidate.imageUrl }} style={styles.fillImage} />
                      : <View style={styles.imageUnavailable}><Text style={styles.unavailableText}>Image unavailable</Text></View>}
                    <View style={[styles.badge, order !== null && { backgroundColor: categoryColor, borderColor: categoryColor }]}>
                      {order !== null ? <Text style={styles.badgeText}>{order}</Text> : null}
                    </View>
                  </Pressable>
                </Reveal>
              );
            })}
            {uploads.map(item => {
              const order = orderOf(value => value.kind === 'upload' && value.key === item.key);
              return (
                <Pressable key={item.key} testID={`vision-upload-item-${item.key}`} accessibilityRole="button"
                  accessibilityLabel={item.status === 'failed' ? 'Retry image upload' : item.status === 'ready' ? 'Remove personal image' : 'Uploading personal image'}
                  onPress={() => {
                    if (item.status === 'failed') void uploadOne(item, item.mimeType);
                    else if (item.status === 'ready') removeUpload(item.key);
                  }}
                  style={[styles.tile, { width: tileWidth, height: tileWidth }, order !== null && item.status === 'ready' && { borderColor: categoryColor, borderWidth: 3 }]}>
                  <Image source={{ uri: item.imageUrl ?? item.uri }} style={styles.fillImage} />
                  {item.status === 'uploading' && <View style={styles.uploadShade}><ActivityIndicator color={colors.paper} /></View>}
                  {item.status === 'failed' && <View style={styles.uploadShade}><Text style={styles.uploadError}>Upload failed. Tap to retry.</Text></View>}
                  {item.status === 'ready' && order !== null ? (
                    <View style={[styles.badge, { backgroundColor: categoryColor, borderColor: categoryColor }]}><Text style={styles.badgeText}>{order}</Text></View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {selectedCount > 0 ? <Text style={styles.coverHint}>Your first choice becomes the cover.</Text> : null}
        </ScrollView>
        <View style={[styles.curationFooter, { paddingBottom: insets.bottom + spacing[3] }]}>
          <View style={styles.secondaryRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Generate another set, ${setNumber} of ${MAX_SETS} used`} accessibilityState={{ disabled: !canGenerateAnother }}
              onPress={() => { if (canGenerateAnother) void generate(); }}
              disabled={!canGenerateAnother} style={[styles.secondaryAction, !canGenerateAnother && styles.disabled]}>
              <RefreshCw size={15} color={colors.text.primary} />
              <Text style={styles.secondaryText} numberOfLines={1}>Generate another set</Text>
            </Pressable>
            <Pressable testID="vision-add-photos" accessibilityRole="button" accessibilityLabel="Add my own images" onPress={() => { void pickImages(); }} style={styles.secondaryAction}>
              <ImageIcon size={15} color={colors.text.primary} /><Text style={styles.secondaryText} numberOfLines={1}>Add my own</Text>
            </Pressable>
          </View>
          {notice && <Text style={styles.error}>{notice}</Text>}
          <V2Button size="large" accessibilityLabel="Continue" disabled={selectedCount < 1 || saving || busyUploading} onPress={() => { void save(); }}>
            {saving ? 'Saving…' : `Continue (${selectedCount}/${MAX_IMAGES}) →`}
          </V2Button>
        </View>
      </View>
    );
  }

  const hint = visionDetailHint(description);
  const level = visionDetailLevel(description);
  return (
    <View testID={`${testID}-prompt`} style={styles.stage}>
      <StatusBar barStyle="light-content" backgroundColor={colors.ink.base} animated />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: insets.bottom + spacing[6] }} keyboardShouldPersistTaps="handled">
          <VisionPhoto source={possibleFuture} category={anchorCategory} tint={0.12} scrim="both" style={styles.describeHero}>
            <View style={[styles.describeTint]} pointerEvents="none" />
            <View style={[styles.photoContent, { paddingTop: insets.top, paddingBottom: spacing[5] }]}>
              <VisionHeaderRow title="Create Vision" onBack={onBack} />
              {identity()}
              <Text accessibilityRole="header" style={styles.describeTitle}>What does this look like when it’s real?</Text>
              <Text style={styles.inkBody}>Make it yours. The more specific you are, the more accurately we can create your Vision.</Text>
              {/* Cues, not a form: quiet enough that the question and the field lead. */}
              <Animated.View style={[styles.guide, guideStyle]}>
                {VISION_DESCRIPTION_PROMPTS.map(prompt => {
                  const Icon = PROMPT_ICONS[prompt.key];
                  return (
                    <View key={prompt.key} style={styles.guideCell}>
                      <Icon size={14} color={colors.ink.text.tertiary} />
                      <View style={styles.flex}>
                        <Text style={styles.guideLabel} numberOfLines={1}>{prompt.label}</Text>
                        <Text style={styles.guideHint} numberOfLines={2}>{prompt.hint}</Text>
                      </View>
                    </View>
                  );
                })}
              </Animated.View>
            </View>
          </VisionPhoto>
          <View style={styles.describeBody} onLayout={event => { inputOffset.current = event.nativeEvent.layout.y; }}>
            <Animated.View style={[styles.inputFrame, inputFrameStyle, inputFocused && styles.inputFrameFocused]}>
              <TextInput testID="vision-prompt-input" accessibilityLabel="Vision description" accessibilityHint="Describe where you are, what you’re doing, what you can see and what has changed."
                multiline maxLength={VISION_DESCRIPTION_MAX_CHARS}
                value={description} onChangeText={setDescription} placeholder={`Example: ${example}`} placeholderTextColor={colors.text.disabled}
                onFocus={focusInput} onBlur={() => setInputFocused(false)}
                style={styles.input} textAlignVertical="top" />
            </Animated.View>
            <View style={styles.meter}>
              <Text testID="vision-detail-hint" style={[styles.meterHint, level === 'rich' && { color: colors.semantic.success }]} numberOfLines={2}>
                {hint ?? 'Where you are · what you’re doing · what you see · what’s different'}
              </Text>
              <Text style={styles.counter}>{description.length}/{VISION_DESCRIPTION_MAX_CHARS}</Text>
            </View>
            {notice && <Text style={styles.error}>{notice}</Text>}
            {generation.error && <Text style={styles.error}>{generation.error}</Text>}
            <View style={styles.appearanceCard}>
              <View style={styles.appearanceCopy}>
                <Text style={styles.appearanceTitle}>Make it look like you</Text>
                <Text style={styles.appearanceBody}>{appearance.profilePhoto
                  ? 'Use your profile photo as a reference when you appear in generated scenes.'
                  : 'Optional — add a reference photo when you want yourself represented in your Vision.'}</Text>
              </View>
              {appearance.reference ? (
                <View style={styles.appearanceReady}>
                  <Image source={{ uri: appearance.reference.source === 'PROFILE' && appearance.profilePhoto ? appearance.profilePhoto : appearance.reference.previewUrl ?? undefined }} style={styles.appearanceThumb} />
                  <View style={styles.appearanceActions}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: useAppearance }} onPress={() => {
                      if (appearance.reference?.source === 'PROFILE' && !appearance.enabledByPreference) void enableProfileAppearance();
                      else setUseAppearance(value => !value);
                    }} style={[styles.appearanceChoice, useAppearance && { borderColor: categoryColor }]}>
                      <Text style={styles.appearanceChoiceText}>{appearance.saving ? 'Preparing…' : useAppearance ? 'Use my photo ✓' : 'Use my photo'}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => { void pickAppearanceReference(); }}><Text style={styles.appearanceLink}>Change</Text></Pressable>
                    <Pressable accessibilityRole="button" onPress={() => { void appearance.remove(); setUseAppearance(false); }}><Text style={styles.appearanceLink}>Remove</Text></Pressable>
                  </View>
                </View>
              ) : appearance.profilePhoto ? (
                <View style={styles.appearanceReady}>
                  <Image source={{ uri: appearance.profilePhoto }} style={styles.appearanceThumb} />
                  <View style={styles.appearanceActions}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: useAppearance }} onPress={() => { void enableProfileAppearance(); }} style={[styles.appearanceChoice, useAppearance && { borderColor: categoryColor }]}>
                      <Text style={styles.appearanceChoiceText}>{appearance.saving ? 'Preparing…' : useAppearance ? 'Use my photo ✓' : 'Use my photo'}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => { void pickAppearanceReference(); }}><Text style={styles.appearanceLink}>Change</Text></Pressable>
                  </View>
                </View>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => { void pickAppearanceReference(); }} style={styles.addReference}>
                  <Text style={styles.addReferenceText}>+ Add reference photo</Text>
                </Pressable>
              )}
            </View>
            <V2Button testID="vision-generate" size="large" accessibilityLabel="Continue to create your Vision"
              disabled={!validDescription} loading={starting} onPress={() => { void generate(); }}>
              Continue
            </V2Button>
            <Pressable testID="vision-add-photos" accessibilityRole="button" accessibilityLabel="Add my own images"
              disabled={!validDescription} onPress={() => { void pickImages(); }} style={[styles.textAction, !validDescription && styles.disabled]}>
              <ImageIcon size={15} color={colors.text.secondary} />
              <Text style={styles.textActionLabel}>Use my own photos instead</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
  stage: { flex: 1, backgroundColor: colors.canvas },
  inkStage: { backgroundColor: colors.ink.base },
  photoContent: { paddingHorizontal: spacing[5], gap: spacing[3] },
  // Empty state
  emptyPhoto: { flex: 1 },
  // Photographs vary; this keeps the headline legible over a bright window.
  emptyTextShade: { position: 'absolute', left: 0, right: 0, top: 0, height: '52%', backgroundColor: colors.ink.base, opacity: 0.46 },
  emptyTitle: { ...typography.displayMedium, color: colors.ink.text.primary, marginTop: spacing[5] },
  emptyBody: { ...typography.bodyLG, color: colors.ink.text.primary, opacity: 0.88, maxWidth: 320, textShadowColor: 'rgba(14,21,28,0.55)', textShadowRadius: 8 },
  emptyFooter: { paddingHorizontal: spacing[5], paddingTop: spacing[5], gap: spacing[3], alignItems: 'center', backgroundColor: colors.canvas },
  rule: { width: 28, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border.strong },
  quote: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center' },
  // Describe
  describeHero: { width: '100%' },
  describeTint: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.ink.base, opacity: 0.5 },
  describeTitle: { ...typography.headingXL, color: colors.ink.text.primary, marginTop: spacing[3] },
  guide: {
    marginTop: spacing[1], flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing[3], columnGap: spacing[3],
    paddingTop: spacing[4], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ink.hairlineStrong,
  },
  guideCell: { width: '47%', flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  guideLabel: { ...typography.caption, fontFamily: typography.labelMD.fontFamily, color: colors.ink.text.secondary },
  guideHint: { ...typography.caption, color: colors.ink.text.tertiary },
  describeBody: { paddingHorizontal: spacing[5], paddingTop: spacing[5], gap: spacing[3] },
  inputFrame: {
    borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface,
    shadowColor: colors.ink.base, shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, shadowOpacity: 0,
  },
  // Android cannot animate elevation smoothly; it steps with focus instead.
  inputFrameFocused: Platform.OS === 'android' ? { elevation: 3 } : {},
  input: { ...typography.bodyLG, color: colors.text.primary, minHeight: 176, padding: spacing[4] },
  appearanceCard: { gap: spacing[2], padding: spacing[3], borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default, borderRadius: radii.md, backgroundColor: colors.surface },
  appearanceCopy: { gap: 3 },
  appearanceTitle: { ...typography.labelLG, color: colors.text.primary },
  appearanceBody: { ...typography.caption, color: colors.text.secondary, lineHeight: 17 },
  appearanceReady: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] },
  appearanceThumb: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.canvas },
  appearanceActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  appearanceChoice: { borderWidth: 1, borderColor: colors.border.default, borderRadius: radii.pill, paddingHorizontal: spacing[3], paddingVertical: 7 },
  appearanceChoiceText: { ...typography.caption, color: colors.text.primary, fontFamily: typography.labelMD.fontFamily },
  appearanceLink: { ...typography.caption, color: colors.text.secondary, textDecorationLine: 'underline' },
  addReference: { alignSelf: 'flex-start', marginTop: spacing[1], paddingVertical: 4 },
  addReferenceText: { ...typography.labelMD, color: colors.text.primary },
  meter: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3], marginTop: -spacing[1] },
  meterHint: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  counter: { ...typography.caption, color: colors.text.tertiary },
  textAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], minHeight: 44 },
  textActionLabel: { ...typography.labelMD, color: colors.text.secondary },
  // Ink pages
  inkPage: { paddingHorizontal: spacing[5], gap: spacing[3] },
  inkTitle: { ...typography.displayMedium, color: colors.ink.text.primary, marginTop: spacing[4] },
  inkBody: { ...typography.bodyMD, color: colors.ink.text.secondary },
  // Generation
  atmosphere: { position: 'absolute', left: 0, top: 0, opacity: 0.5 },
  fillImage: { width: '100%', height: '100%' },
  livingStatus: { alignSelf: 'center', minHeight: 24, justifyContent: 'center', marginTop: spacing[1] },
  livingStatusText: { ...typography.bodySM, color: colors.ink.text.secondary, textAlign: 'center' },
  failure: { gap: spacing[3], alignItems: 'center', marginTop: spacing[4] },
  failureTitle: { ...typography.headingMD, color: colors.ink.text.primary, textAlign: 'center' },
  darkBody: { ...typography.bodyMD, color: colors.ink.text.secondary, textAlign: 'center' },
  darkError: { ...typography.bodyMD, color: colors.ink.text.primary, textAlign: 'center' },
  darkLinkHit: { minHeight: 44, justifyContent: 'center' },
  darkLink: { ...typography.labelMD, color: colors.ink.text.primary, textDecorationLine: 'underline' },
  // Curation
  curationTitle: { ...typography.headingXL, color: colors.ink.text.primary, marginTop: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, marginTop: spacing[2] },
  tile: { borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink.hairline, backgroundColor: colors.ink.raised },
  tilePressed: { transform: [{ scale: 0.985 }] },
  imageUnavailable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  unavailableText: { ...typography.caption, color: colors.ink.text.tertiary },
  badge: { position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(251,249,244,0.85)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,21,28,0.28)' },
  badgeText: { ...typography.labelMD, fontSize: 12, color: colors.paper },
  uploadShade: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,15,20,0.55)' },
  uploadError: { ...typography.caption, color: colors.paper, textAlign: 'center', padding: 8 },
  coverHint: { ...typography.caption, color: colors.ink.text.tertiary, textAlign: 'center' },
  curationFooter: { paddingHorizontal: spacing[5], paddingTop: spacing[4], gap: spacing[3], backgroundColor: colors.canvas, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  secondaryRow: { flexDirection: 'row', gap: spacing[2] },
  secondaryAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 6, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.surface },
  secondaryText: { ...typography.caption, color: colors.text.primary, flexShrink: 1 },
  disabled: { opacity: 0.45 },
  error: { ...typography.caption, color: colors.semantic.error },
});
