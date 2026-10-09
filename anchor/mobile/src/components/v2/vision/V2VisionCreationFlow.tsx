import { VisionCeremony } from './ceremony/VisionCeremony';
import { useVisionImageArrival } from './VisionImageArrival';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { uploadVisionPhoto, useV2VisionSceneGeneration, type VisionGenerationCandidate, type UploadAssetResult } from '@/hooks/v2/vision';
import { colors, radii, spacing } from '@/theme/v2';
import type { VisionSceneSource } from '@/adapters/v2/vision';

import type { VisionAnchorArt } from './VisionChrome';
import { VISION_DESCRIPTION_MAX_CHARS, VISION_DESCRIPTION_MIN_CHARS, visionPhotoSceneDescription } from './visionGuidance';
import { VisionStageTransition } from './VisionMotion';
import { VisionBackButton, VisionInkPill, VISION_SERIF } from './VisionPaperChrome';
import { VisionIntroStage } from './VisionIntroStage';
import { VisionMethodStage } from './VisionMethodStage';
import { VisionMomentInput, type VisionInputPath, type VisionStartPhoto } from './VisionMomentInput';
import { VisionTwoUpStage, type VisionTwoUpSelection } from './VisionTwoUpStage';
import { VISION_BOARD_MAX_IMAGES } from './board/visionBoardLayouts';

export type VisionFlowAsset = { assetId: string; prompt: string; imageUrl?: string; sourceType: VisionSceneSource; caption?: string };
type UploadItem = { key: string; uri: string; mimeType: string; assetId?: string; imageUrl?: string | null; status: 'uploading' | 'ready' | 'failed'; error?: string };
type Step = 'empty' | 'method' | 'prompt' | 'generating' | 'uploading';

/** A photos-only Vision has no written description; the Anchor's own intention stands in until the person writes one. */
function photoVisionDescription(written: string, intention: string): string {
  if (written.length >= VISION_DESCRIPTION_MIN_CHARS) return written;
  const base = intention.trim();
  return base.length >= VISION_DESCRIPTION_MIN_CHARS ? base : `${base} — my Vision`.trim();
}

const SUPPORTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface V2VisionCreationFlowProps {
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorImageUrl?: string | null;
  /** The real Anchor artwork (`anchorRenderProps(anchor)`). */
  anchorArt?: VisionAnchorArt | null;
  initialDescription?: string;
  initialStep?: 'ready' | 'empty' | 'prompt';
  onBack: () => void;
  onPremiumRequired?: () => void;
  /** Creates the Vision with this description. Resolves false when it could not be saved. */
  onSaveDescription?: (description: string) => Promise<boolean>;
  resumeGeneration?: boolean;
  onResumeGenerationConsumed?: () => void;
  onUploadAsset: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
  /** Puts the chosen image(s) on the Vision. The first is its hero. Resolves false when it could not be saved. */
  onAssemble: (result: { description: string; selectedAssets: VisionFlowAsset[]; selection?: VisionTwoUpSelection;
    /** The print in flight; independent of the persisted picker/board order. */
    arrivingAssetId?: string }) => Promise<boolean | void>;
  testID?: string;
}

/**
 * Creating a Vision, in order: the intro, how to build it, the description,
 * then either two generated moments (tap one) or the person's own photos. The
 * chosen image becomes the Vision's first image and the flow hands over to the board.
 */
// DEFERRED: original stages and uploading block replaced by ceremony Ask → Develop → Seal.
function DeferredVisionCreationFlow({
  anchorId, anchorIntention, anchorCategory, anchorImageUrl, anchorArt, initialDescription = '',
  initialStep = 'prompt', onBack, onPremiumRequired, onSaveDescription, resumeGeneration, onResumeGenerationConsumed, onUploadAsset, onAssemble,
  testID = 'v2-vision-creation-flow',
}: V2VisionCreationFlowProps) {
  const arrival = useVisionImageArrival();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(initialStep === 'ready' || initialStep === 'empty' ? 'empty' : initialStep);
  const [fromMethod, setFromMethod] = useState(false);
  const [description, setDescription] = useState(initialDescription);
  const [inputPath, setInputPath] = useState<VisionInputPath>('photo');
  const [startPhoto, setStartPhoto] = useState<VisionStartPhoto | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const generation = useV2VisionSceneGeneration(anchorId, onPremiumRequired);
  const createStarted = useRef(false);
  const startingRef = useRef(false);
  const trimmed = description.trim();
  const validDescription = trimmed.length >= VISION_DESCRIPTION_MIN_CHARS && trimmed.length <= VISION_DESCRIPTION_MAX_CHARS;
  /** True while the Vision is being made from a photo of the person's real world rather than from words alone. */
  const photoStart = inputPath === 'photo' && Boolean(startPhoto);

  useEffect(() => {
    if (step === 'prompt' && !createStarted.current) { createStarted.current = true; AnalyticsService.track('vision_create_started', { anchor_id: anchorId }); }
  }, [anchorId, step]);

  /** Saves the description (which creates the Vision), then asks for two moments. */
  const generate = useCallback(async (appearanceReferenceId?: string | null, photo?: VisionStartPhoto | null) => {
    // Starting from a photo, the description is optional: the photo alone is enough to generate.
    if (photo ? trimmed.length > 0 && !validDescription : !validDescription) { setNotice(`Describe your Vision in at least ${VISION_DESCRIPTION_MIN_CHARS} characters.`); return; }
    // One request per tap sequence: saving the description is awaited first.
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setNotice(null);
    try {
      let startAssetId: string | null = null;
      if (photo) {
        // Uploaded before the Vision is created, so a failed upload leaves nothing half-made.
        const uploaded = await uploadVisionPhoto(photo, onUploadAsset);
        if (!uploaded.ok) { setNotice(uploaded.message); return; }
        startAssetId = uploaded.assetId;
      }
      const visionDescription = photo ? photoVisionDescription(trimmed, anchorIntention) : trimmed;
      if (onSaveDescription && !(await onSaveDescription(visionDescription))) {
        setNotice('Your description could not be saved. Please try again.');
        return;
      }
      const sceneDescription = photo
        ? visionPhotoSceneDescription(trimmed, anchorIntention, VISION_DESCRIPTION_MAX_CHARS, VISION_DESCRIPTION_MIN_CHARS)
        : trimmed;
      const started = photo
        ? await generation.start(sceneDescription, null, startAssetId)
        : await generation.start(sceneDescription, appearanceReferenceId);
      if (started) setStep('generating');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }, [anchorIntention, generation, onSaveDescription, onUploadAsset, trimmed, validDescription]);

  // Returning from the paywall resumes the request the person had already made.
  useEffect(() => {
    if (!resumeGeneration || !validDescription) return;
    onResumeGenerationConsumed?.();
    void generate();
  }, [resumeGeneration, validDescription]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Explicit preview confirmation makes this the Vision's first image. */
  const choose = useCallback(async (candidate: VisionGenerationCandidate, selection: VisionTwoUpSelection) => {
    if (!candidate.assetId || saving) return;
    setSaving(true);
    setNotice(null);
    if (candidate.imageUrl && selection.image) {
      arrival?.begin(candidate.imageUrl, selection.image, anchorArt?.svg && selection.anchor
        ? { svg: anchorArt.svg, imageUrl: anchorArt.imageUrl, expression: anchorArt.expression, category: anchorArt.category ?? anchorCategory, rect: selection.anchor } : undefined);
    }
    try {
      const result = await onAssemble({
        description: photoStart ? photoVisionDescription(trimmed, anchorIntention) : trimmed,
        selectedAssets: [{ assetId: candidate.assetId, prompt: candidate.prompt || trimmed, imageUrl: candidate.imageUrl ?? undefined, sourceType: 'AI_GENERATED' }],
        selection,
      });
      if (result === false) { arrival?.cancel(); setNotice('Your Vision could not be saved. Please try again.'); }
    } catch (cause) {
      arrival?.cancel();
      setNotice(cause instanceof Error ? cause.message : 'Your Vision could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [anchorArt, anchorCategory, anchorIntention, arrival, onAssemble, photoStart, saving, trimmed]);

  const uploadOne = useCallback(async (item: UploadItem) => {
    setUploads(prev => prev.map(value => value.key === item.key ? { ...value, status: 'uploading', error: undefined } : value));
    try {
      const info = await FileSystem.getInfoAsync(item.uri);
      if (!info.exists) throw new Error('Photo is no longer available. Choose it again.');
      const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.Base64 });
      const result = await onUploadAsset({ base64Image: `data:${item.mimeType};base64,${base64}`, mimeType: item.mimeType });
      if (!result.ok) throw new Error(result.message);
      setUploads(prev => prev.map(value => value.key === item.key
        ? { ...value, assetId: result.asset.id, imageUrl: result.asset.resolvedUrl, status: 'ready' } : value));
    } catch (cause) {
      setUploads(prev => prev.map(value => value.key === item.key
        ? { ...value, status: 'failed', error: cause instanceof Error ? cause.message : 'Upload failed' } : value));
    }
  }, [onUploadAsset]);

  /** The personal-photo path: choose photos, upload them, and they become the Vision. */
  const pickImages = async () => {
    try {
      if (Platform.OS === 'ios') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') { setNotice('Allow photo library access to add your images.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: VISION_BOARD_MAX_IMAGES, quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked = result.assets.slice(0, VISION_BOARD_MAX_IMAGES).map((asset, index) => ({
        key: `${Date.now()}-${index}`, uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg',
      }));
      const supported = picked.filter(item => SUPPORTED_MIME.includes(item.mimeType));
      if (supported.length !== picked.length) setNotice('Choose JPEG, PNG, WebP, or GIF images.');
      if (!supported.length) return;
      const items: UploadItem[] = supported.map(item => ({ ...item, status: 'uploading' }));
      setUploads(items);
      setStep('uploading');
      await Promise.all(items.map(item => uploadOne(item)));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Unable to open your photos.');
    }
  };

  const saveUploads = useCallback(async () => {
    if (saving) return;
    const assets: VisionFlowAsset[] = uploads.flatMap(item => item.status === 'ready' && item.assetId
      ? [{ assetId: item.assetId, prompt: '', imageUrl: item.imageUrl ?? item.uri, sourceType: 'USER_UPLOAD' as const }] : []);
    if (!assets.length) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await onAssemble({ description: photoVisionDescription(trimmed, anchorIntention), selectedAssets: assets });
      if (result === false) setNotice('Your Vision could not be saved. Please try again.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Your Vision could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [anchorIntention, onAssemble, saving, trimmed, uploads]);

  // Once every photo is uploaded the Vision is made without another tap.
  const allReady = uploads.length > 0 && uploads.every(item => item.status === 'ready');
  const autoSaved = useRef(false);
  useEffect(() => {
    if (step !== 'uploading' || !allReady || autoSaved.current) return;
    autoSaved.current = true;
    void saveUploads();
  }, [allReady, saveUploads, step]);
  useEffect(() => { if (step !== 'uploading') autoSaved.current = false; }, [step]);

  // Each step is chosen here and rendered through one transition: the old stage fades out, the new one fades in.
  let stage: ReactElement;
  if (step === 'empty') stage = (
    <VisionIntroStage
      anchorCategory={anchorCategory}
      anchorIntention={anchorIntention}
      onBack={onBack}
      onStartCreate={() => setStep('method')}
      testID={testID}
    />
  );

  else if (step === 'method') stage = (
    <VisionMethodStage
      onBack={() => setStep('empty')}
      onChoose={path => {
        setFromMethod(true);
        // Personal photos are their own branch: straight to the picker, never the AI description step.
        if (path === 'photos') void pickImages(); else setStep('prompt');
      }}
      testID={testID}
    />
  );

  else if (step === 'generating') stage = (
    <VisionTwoUpStage
      anchorIntention={anchorIntention}
      anchorArt={anchorArt}
      job={generation.job}
      busy={saving}
      error={notice ?? generation.error}
      onBack={() => setStep('prompt')}
      onRetry={() => { void generation.retry(); }}
      onEditDescription={() => setStep('prompt')}
      onSelect={(candidate, selection) => { void choose(candidate, selection); }}
      testID={`${testID}-generating`}
    />
  );

  else if (step === 'uploading') {
    const failed = uploads.some(item => item.status === 'failed');
    stage = (
      <View testID={`${testID}-uploading`} style={styles.paper}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
        <ScrollView contentContainerStyle={[styles.paperContent, { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[5] }]}>
          <VisionBackButton onPress={() => { setUploads([]); setStep('method'); }} style={styles.paperBack} />
          <Text accessibilityRole="header" style={styles.paperTitle}>{failed ? 'One photo needs another try.' : 'Placing your photos…'}</Text>
          <View style={styles.thumbs}>
            {uploads.map(item => (
              <Pressable key={item.key} testID={`vision-upload-item-${item.key}`} accessibilityRole="button"
                accessibilityLabel={item.status === 'failed' ? 'Retry image upload' : item.status === 'ready' ? 'Photo ready' : 'Uploading personal image'}
                onPress={() => { if (item.status === 'failed') void uploadOne(item); }} style={styles.thumb}>
                <Image source={{ uri: item.imageUrl ?? item.uri }} style={styles.thumbImage} />
                {item.status === 'uploading' ? <View style={styles.thumbShade}><ActivityIndicator color={colors.paper} /></View> : null}
                {item.status === 'failed' ? <View style={styles.thumbShade}><Text style={styles.thumbError}>Tap to retry</Text></View> : null}
              </Pressable>
            ))}
          </View>
          {notice ? <Text accessibilityLiveRegion="polite" style={styles.paperNotice}>{notice}</Text> : null}
          {failed ? (
            <VisionInkPill label="Choose different photos" onPress={() => { setUploads([]); void pickImages(); }} style={styles.paperAction} />
          ) : null}
        </ScrollView>
      </View>
    );
  }

  else stage = (
    <VisionMomentInput
      mode="create"
      anchorId={anchorId}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorArt={anchorArt}
      anchorImageUrl={anchorImageUrl}
      initialDescription={description}
      description={description}
      onChangeDescription={setDescription}
      onBack={() => { if (fromMethod) setStep('method'); else onBack(); }}
      onSubmit={async (_description, referenceId, photo) => { await generate(referenceId, photo); }}
      startPhotoEnabled
      startPhoto={startPhoto}
      onChangeStartPhoto={setStartPhoto}
      inputPath={inputPath}
      onChangeInputPath={setInputPath}
      loading={starting}
      error={notice || generation.error}
      testID={`${testID}-prompt`}
    />
  );

  return <VisionStageTransition stage={step}>{stage}</VisionStageTransition>;
}

const styles = StyleSheet.create({
  paper: { flex: 1, backgroundColor: colors.canvas },
  paperContent: { paddingHorizontal: spacing[4], gap: spacing[4] },
  paperBack: { alignSelf: 'flex-start' },
  paperTitle: { fontFamily: VISION_SERIF, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, textAlign: 'center', color: colors.text.primary },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center' },
  thumb: { width: 104, height: 140, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.grouped },
  thumbImage: { width: '100%', height: '100%' },
  thumbShade: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,15,20,0.5)' },
  thumbError: { fontFamily: 'Inter-SemiBold', fontSize: 12, color: colors.paper, textAlign: 'center', padding: 6 },
  paperNotice: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, textAlign: 'center', color: colors.semantic.error },
  paperAction: { alignSelf: 'stretch' },
});

export function V2VisionCreationFlow(props: V2VisionCreationFlowProps) {
  return <VisionCeremony {...props} mode="create" startAt="ask" />;
}
