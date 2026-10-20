import { useVisionPicker, VisionPickerHolding } from '@/components/v2/vision/ceremony/VisionPickerHolding';
import type { SavedVisionImage } from '@/components/v2/vision/VisionArrivalSet';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { queueVisionMilestones } from '@/milestones/queueVisionMilestones';
import { useMilestonePresentationHold } from '@/hooks/v2/milestones/useMilestonePresentationHold';
import { useTeachingFocus } from '@/hooks/v2/teaching/useTeachingFocus';
import { ActivityIndicator, Alert, Image, Linking, View } from 'react-native';
import { useNavigation, useRoute, UNSTABLE_usePreventRemove as usePreventRemove, type RouteProp } from '@react-navigation/native';
import { VisionCeremony } from '@/components/v2/vision/ceremony/VisionCeremony';
import { VisionPhotoFit } from '@/components/v2/vision/VisionPhotoFitScreen';
import { assessPhotoFit } from '@/components/v2/vision/visionPhotoFit';
import { VisionAddSceneSheet, type AddSceneRequest } from '@/components/v2/vision/VisionAddSceneSheet';
import { readPhotoSize } from '@/hooks/v2/vision/visionPhotoFitProcessing';
import { playCreationSound } from '@/services/CreationSounds';
import { VisionImageArrivalProvider, useVisionImageArrival } from '@/components/v2/vision/VisionImageArrival';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { V2Button, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { pickVisionPhoto, uploadVisionPhoto, useV2Vision, type PickedVisionPhoto, type VisionPhotoPick, type VisionPhotoSource } from '@/hooks/v2/vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { resolveAnchorCategory } from '@/utils/categoryDetection';
import { colors } from '@/theme/v2';
import type { V2VisualizeHandoff, V2VisionTile, VisionNotePresentation } from '@/adapters/v2/vision';
import { toChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';
import { newestVisionScene } from '@/hooks/v2/teaching/visionTeaching';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import revenueCatService from '@/services/RevenueCatService';
import { AnchorShareStudio } from '@/components/share/AnchorShareStudio';
import { buildShareExportData } from '@/components/share/shareData';

const WARM_IMAGE_MAX_MS = 3000;

export interface V2VisionRouteParams {
  savedNoteId?: string;
  edit?: boolean;
  anchorId: string;
  initialMode?: 'view' | 'create' | 'ready';
  resumeGeneration?: boolean;
}

export interface V2VisionScreenProps {
  edit?: boolean;
  anchorId?: string;
  initialMode?: 'view' | 'create' | 'ready';
  onBack?: () => void;
  onVisualize?: (handoff: V2VisualizeHandoff) => void;
  onChart?: (anchorId: string) => void;
  onAddNote?: (params: { anchorId: string; visionId?: string }) => void;
  testID?: string;
}

export function V2VisionScreen(props: V2VisionScreenProps) {
  return <VisionImageArrivalProvider><VisionScreenContent {...props} /></VisionImageArrivalProvider>;
}

function VisionScreenContent(props: V2VisionScreenProps) {
  const alive = useRef(true);
  const warmedImages = useRef(new Map<string, Promise<void>>());
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const lastVisionPinAt = useRef<number | null>(null);
  const playVisionPin = useCallback(() => {
    const now = Date.now();
    if (lastVisionPinAt.current !== null && now - lastVisionPinAt.current < 150) return;
    lastVisionPinAt.current = now;
    playCreationSound('visionPin');
  }, []);
  const arrival = useVisionImageArrival();
  const route = useRoute<RouteProp<Record<string, V2VisionRouteParams>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = props.anchorId ?? route.params?.anchorId ?? '';
  const anchor = useAnchorStore(state => state.anchors.find(item => item.id === anchorId || item.localId === anchorId));
  useEffect(() => { if (anchorId) AnalyticsService.track('vision_opened', { anchor_id: anchorId }); }, [anchorId]);
  const model = useV2Vision(anchorId);
  const { entitlementReady, hasActiveEntitlement } = useTrialStatus();
  const picker = useVisionPicker(anchorId);
  // Warm every board image (and the Anchor's enhanced art) while the Vision is on screen, so the Visualize setup and
  // session that follow find them decoded-cache-ready instead of fetching them as they appear.
  const warmUrls = model.tiles.map(tile => tile.imageUrl).concat(anchor?.enhancedImageUrl ?? null).filter((url): url is string => Boolean(url)).join('|');
  useEffect(() => {
    if (typeof Image.prefetch !== 'function') return;
    warmUrls.split('|').filter(Boolean).forEach(url => { void warmImage(url); });
  }, [warmUrls]);
  const anchorChart = useAnchorChart(anchor?.id ?? null);
  const chartSummary = useMemo(() => toChartSummary(anchorChart.data?.chart), [anchorChart.data?.chart]);
  const [mode, setMode] = useState<'view' | 'create' | 'ready' | 'addScene'>(props.initialMode ?? route.params?.initialMode ?? 'view');
  const [sealingBusy, setSealingBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const sealingBusyRef = useRef(false);
  const handleSealingChange = useCallback((active: boolean) => {
    sealingBusyRef.current = active;
    setSealingBusy(active);
  }, []);
  // React Navigation 6's hook also informs the native stack, unlike a listener alone.
  usePreventRemove(sealingBusy, () => undefined);
  useEffect(() => {
    navigation.setOptions?.({ gestureEnabled: !sealingBusy });
    return navigation.addListener?.('beforeRemove', (event: { preventDefault: () => void }) => {
      if (sealingBusyRef.current) event.preventDefault();
    });
  }, [navigation, sealingBusy]);
  useEffect(() => {
    if (route.params?.resumeGeneration && mode !== 'addScene') setMode('create');
  }, [route.params?.resumeGeneration]);
  const [justAdded, setJustAdded] = useState<'create' | 'add' | undefined>();
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<SavedVisionImage[]>([]);
  // The pin finds the new scene by id: signed URLs can differ between the save response and the refreshed read model.
  const [savedSceneId, setSavedSceneId] = useState<string | null>(null);
  const recordSaved = (scenes: ReadonlyArray<{ id: string; assetId: string | null; resolvedImageUrl?: string | null }>, assetId?: string) => {
    const scene = assetId ? scenes.find(item => item.assetId === assetId) : undefined;
    setSavedSceneId(scene?.id ?? null);
    setSavedImages(scene?.resolvedImageUrl ? [{ sceneId: scene.id, url: scene.resolvedImageUrl }] : []);
    return scene?.resolvedImageUrl;
  };
  const uploadedPhoto = useRef<{ uri: string; assetId: string } | null>(null);
  const photoUpload = useRef<{ uri: string; task: ReturnType<typeof uploadVisionPhoto> } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  useEffect(() => navigation.addListener?.('blur', () => setJustAdded(undefined)), [navigation]);
  const finishCeremony = (kind: 'create' | 'add') => {
    setJustAdded(kind); if (!arrival?.beginSet) playVisionPin();
    // The board mounts again from scratch, so every photograph is decoded before it shows (each wait is bounded).
    // The ceremony stays up until then.
    void Promise.all(model.tiles.map(tile => warmImage(tile.imageUrl))).then(() => {
      if (!alive.current) return;
      setPendingPhoto(null); setReplaceSceneId(null); setAddRequest(null); setMode('view');
      void queueVisionMilestones(anchorId);
    });
  };
  const [actionError, setActionError] = useState<string | null>(null);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  // Choosing generated images for one place on the board (Regenerate), or for any free places (add).
  const [replaceSceneId, setReplaceSceneId] = useState<string | null>(null);
  const replacementTarget = useRef<V2VisionTile | null>(null);
  const replacementProgress = useRef(new Map<string, { sortOrder: number; full: boolean; removed: boolean; added: boolean; url?: string | null }>());
  // The board as it was before leaving to add images, so it can recompose on return.
  const [arrivedFrom, setArrivedFrom] = useState<string[] | null>(null);
  // A photo chosen or taken for the board, previewed until the person confirms it.
  const [pendingPhoto, setPendingPhoto] = useState<PickedVisionPhoto | null>(null);
  // A chosen photo waiting for the person to decide how it fits the Vision frame (Smart Photo Fit).
  const [fitRequest, setFitRequest] = useState<{ photo: PickedVisionPhoto; size: { width: number; height: number } } | null>(null);
  const anchorIntention = (anchor as { intention?: string } | undefined)?.intention ?? anchor?.intentionText ?? 'Your Anchor';
  // Thread Strength is passed through from the stored Anchor for the board's glow; the board never derives it.
  const anchorArt = useMemo(() => (anchor ? { ...anchorRenderProps(anchor), threadStrength: anchor.threadStrength ?? null } : null), [anchor]);
  // The Anchor's persisted category is the only source: art, accent and label all read it.
  const anchorCategory = anchor ? resolveAnchorCategory(anchor.category) : undefined;
  // Every ceremony starts with no saved result, so a stale pin can never drop on the wrong scene.
  const ceremonyKey = pendingPhoto ? `photo:${pendingPhoto.uri}` : mode === 'addScene' ? `add:${replaceSceneId ?? ''}`
    : mode === 'create' || mode === 'ready' || model.state.state === 'none' ? 'create' : null;
  useEffect(() => {
    if (ceremonyKey) { setSavedImageUrl(null); setSavedSceneId(null); setSavedImages([]); }
  }, [ceremonyKey]);
  const handleBack = () => {
    if ((mode === 'create' || mode === 'addScene') && model.state.state === 'ready') {
      setReplaceSceneId(null);
      setMode('view');
      return;
    }
    if (props.onBack) props.onBack();
    else if (navigation.canGoBack()) navigation.goBack();
  };

  const openPaywall = () => navigation.navigate('V2Paywall', {
    context: 'VISION_PREMIUM_ACTION',
    resumeIntent: { type: 'vision_premium_action', anchorId, action: 'generate' },
  });

  const entitlementRefreshStarted = useRef(false);
  const [entitlementRefreshAttempt, setEntitlementRefreshAttempt] = useState(0);
  useEffect(() => {
    if (entitlementReady || entitlementRefreshStarted.current) return;
    entitlementRefreshStarted.current = true;
    void revenueCatService.refreshTrialStatus().finally(() => {
      entitlementRefreshStarted.current = false;
    });
  }, [entitlementReady, entitlementRefreshAttempt]);

  const needsCreationPaywall = !model.loading && !model.error && !model.vision && entitlementReady && !hasActiveEntitlement;
  const creationPaywallOpened = useRef(false);
  useEffect(() => {
    if (!needsCreationPaywall || creationPaywallOpened.current) return;
    creationPaywallOpened.current = true;
    navigation.replace('V2Paywall', {
      context: 'VISION_PREMIUM_ACTION',
      resumeIntent: { type: 'vision_premium_action', anchorId, action: 'create' },
    });
  }, [anchorId, navigation, needsCreationPaywall]);

  /** Permission refusals are explained; a permanent refusal points to Settings. */
  const reportPickProblem = (result: Exclude<VisionPhotoPick, { status: 'picked' } | { status: 'cancelled' }>) => {
    setActionError(result.message);
    if (result.status === 'denied' && !result.canAskAgain) {
      Alert.alert('Permission needed', result.message, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
      ]);
    }
  };

  /** Picks one of the person's photos and uploads it as a Vision asset; null when cancelled or failed. */
  const pickAndUploadOwnImage = async (): Promise<string | null> => {
    const picked = await pickVisionPhoto('library');
    if (picked.status === 'cancelled') return null;
    if (picked.status !== 'picked') { reportPickProblem(picked); return null; }
    const uploaded = await uploadVisionPhoto(picked.photo, model.uploadAsset);
    if (!uploaded.ok) { setActionError(uploaded.message); return null; }
    return uploaded.assetId;
  };

  /** Loads the new board image before the board is shown, so it does not arrive as an empty frame. */
  const warmImage = async (url?: string | null) => {
    if (!url || typeof Image.prefetch !== 'function') return;
    const previous = warmedImages.current.get(url);
    if (previous) return previous;
    // A prefetch that never settles must not hold the save open: the board shows the image either way.
    const warming = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const bound = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), WARM_IMAGE_MAX_MS); });
      await Promise.race([Promise.resolve(Image.prefetch(url)).catch(() => false), bound]);
      if (timer) clearTimeout(timer);
    })();
    warmedImages.current.set(url, warming);
    return warming;
  };

  const beginPendingPhoto = (photo: PickedVisionPhoto) => {
    setArrivedFrom(model.tiles.map(tile => tile.sceneId));
    setPendingPhoto(photo);
    setPhotoUploading(true);
    const uri = photo.uri;
    photoUpload.current = { uri, task: uploadVisionPhoto(photo, model.uploadAsset).finally(() => {
      if (alive.current && photoUpload.current?.uri === uri) setPhotoUploading(false);
    }) };
  };

  /** Chooses or takes a photo; it is previewed, and nothing is uploaded until the person confirms. */
  const startAddPhoto = async (source: VisionPhotoSource) => {
    setPhotoPickerOpen(true);
    try {
    AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: source });
    setActionError(null);
    await picker.run(async () => {
      const result = await pickVisionPhoto(source);
      if (result.status === 'error') throw new Error(result.message);
      return result;
    }, picked => {
      if (picked.status === 'cancelled') return;
      if (picked.status !== 'picked') { reportPickProblem(picked); return; }
      // A photo that is not the Vision's portrait frame is offered Smart Photo Fit before it is previewed or uploaded.
      void (async () => {
        const size = await readPhotoSize(picked.photo.uri);
        if (!alive.current) return;
        if (size && assessPhotoFit(size).relation !== 'fits') { setFitRequest({ photo: picked.photo, size }); return; }
        beginPendingPhoto(picked.photo);
      })();
    });
    } finally { setPhotoPickerOpen(false); }
  };

  /** Uploads the confirmed photo and adds it to the board. Returns an error message, or null when added. */
  const confirmAddPhoto = async (caption?: string): Promise<string | null> => {
    if (!pendingPhoto) return null;
    let assetId = uploadedPhoto.current?.uri === pendingPhoto.uri ? uploadedPhoto.current.assetId : null;
    if (!assetId) {
      const uploaded = await (photoUpload.current?.uri === pendingPhoto.uri ? photoUpload.current.task : uploadVisionPhoto(pendingPhoto, model.uploadAsset));
      photoUpload.current = null;
      if (!uploaded.ok) return uploaded.message;
      assetId = uploaded.assetId;
      uploadedPhoto.current = { uri: pendingPhoto.uri, assetId };
    }
    const saved = await model.addScene({ assetId, sourceType: pendingPhoto.sourceType, caption });
    if (!saved) return 'Your photo was uploaded, but could not be added to your Vision. Please try again.';
    const url = recordSaved(saved.scenes, assetId);
    await warmImage(url);
    setSavedImageUrl(url ?? null);
    setActionError(null);
    return null;
  };

  // Add Image opens a compact composer over the board; submitting hands a prepared request to the generation experience.
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addRequest, setAddRequest] = useState<AddSceneRequest | null>(null);
  // A request taken back from generation reopens the Add sheet with its words and photo intact.
  const [addDraft, setAddDraft] = useState<AddSceneRequest | null>(null);
  const openAddScene = () => { setActionError(null); setAddSheetOpen(true); };
  const startAddScene = (request: AddSceneRequest) => {
    setActionError(null);
    setSavedImageUrl(null);
    setArrivedFrom(model.tiles.map(tile => tile.sceneId));
    setAddRequest(request);
    setMode('addScene');
  };

  // The composer pops to this existing route after the confirmed mutation.
  // Local Add mode must be cleared even though initialMode does not change.
  useEffect(() => {
    if (!route.params?.savedNoteId) return;
    setMode('view');
    setPendingPhoto(null);
    setReplaceSceneId(null);
    setActionError(null);
  }, [route.params?.savedNoteId]);

  const openNoteComposer = () => {
    setMode('view');
    setReplaceSceneId(null);
    setPendingPhoto(null);
    const params = { anchorId, ...(model.vision?.id ? { visionId: model.vision.id } : {}) };
    if (props.onAddNote) props.onAddNote(params);
    else navigation.navigate('V2VisionNoteComposer', params);
  };

  const openEditNote = (noteId: string) => {
    const params = { anchorId, visionId: model.vision?.id, noteId };
    navigation.navigate('V2VisionNoteComposer', params);
  };

  const deleteNote = (noteId: string) => {
    Alert.alert('Delete this note?', 'You can undo this from the next message.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        void model.deleteNote(noteId).then(updated => {
          if (!updated) return;
          Alert.alert('Note deleted', 'This note was removed from your Vision.', [
            { text: 'Undo', onPress: () => { void model.restoreNote(noteId); } },
            { text: 'Done', style: 'cancel' },
          ]);
        });
      } },
    ]);
  };

  const updateNotePresentation = async (noteId: string, presentation: VisionNotePresentation) =>
    Boolean(await model.updateNote(noteId, { presentation }));

  /** Adds the generated image the person chose. */
  const addGeneratedScene = async (choice: { assetId: string; prompt: string; caption?: string }): Promise<boolean> => {
    const saved = await model.addScene({ assetId: choice.assetId, prompt: choice.prompt, caption: choice.caption, sourceType: 'AI_GENERATED' });
    if (!saved) return false;
    const destinationUrl = recordSaved(saved.scenes, choice.assetId);
    await warmImage(destinationUrl);
    setSavedImageUrl(destinationUrl ?? null);
    setActionError(null);
    return true;
  };

  /**
   * Puts a new image where an old one was: the new scene takes the old one's
   * sort order, then the old one is archived. A full board archives first so
   * the image limit is never exceeded.
   */
  const replaceScene = async (
    sceneId: string,
    next: { assetId: string; sourceType: 'USER_UPLOAD' | 'AI_GENERATED' | 'USER_CAMERA'; prompt?: string; caption?: string },
  ): Promise<boolean> => {
    const key = `${sceneId}:${next.assetId}`;
    let progress = replacementProgress.current.get(key);
    if (!progress) {
      const old = model.tiles.find(tile => tile.sceneId === sceneId) ?? (replacementTarget.current?.sceneId === sceneId ? replacementTarget.current : null);
      if (!old) return false;
      progress = { sortOrder: old.sortOrder, full: model.tiles.length >= VISION_BOARD_MAX_IMAGES, removed: false, added: false };
      replacementProgress.current.set(key, progress);
    }
    // A committed retry continues the same replacement, even after tiles become empty on error.
    if (progress.full && !progress.removed) {
      if (!(await model.deleteScene(sceneId))) { setActionError('Image could not be replaced.'); return false; }
      progress.removed = true;
    }
    if (!progress.added) {
      const added = await model.addScene({ ...next, sortOrder: progress.sortOrder });
      if (!added) { setActionError('The new image could not be added to your Vision. Please try again.'); return false; }
      progress.added = true; progress.url = recordSaved(added.scenes, next.assetId);
    }
    if (!progress.removed) {
      if (!(await model.deleteScene(sceneId))) { setActionError('The new image was added, but the old one could not be removed.'); return false; }
      progress.removed = true;
    }
    await warmImage(progress.url);
    setSavedImageUrl(progress.url ?? null);
    setActionError(null);
    return true;
  };

  const replaceWithOwnImage = async (sceneId: string) => {
    try {
      const assetId = await pickAndUploadOwnImage();
      if (assetId) await replaceScene(sceneId, { assetId, sourceType: 'USER_UPLOAD' });
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to replace this image.');
    }
  };

  /** Regenerating one image: the same two-moments choice, but the pick takes that image's place. */
  const openImageGeneration = (forSceneId: string) => {
    replacementTarget.current = model.tiles.find(tile => tile.sceneId === forSceneId) ?? null;
    replacementProgress.current.clear();
    setActionError(null);
    setSavedImageUrl(null);
    setArrivedFrom(null);
    setReplaceSceneId(forSceneId);
    setMode('addScene');
  };

  /** Adds the generated image the person chose, or puts it where the one being regenerated was. */
  const placeGeneratedScene = async (choice: { assetId: string; prompt: string; caption?: string }): Promise<boolean> => {
    if (!replaceSceneId) return addGeneratedScene(choice);
    const replaced = await replaceScene(replaceSceneId, { assetId: choice.assetId, sourceType: 'AI_GENERATED', prompt: choice.prompt, caption: choice.caption });
    if (!replaced) return false;
    return true;
  };

  const renderContent = () => {
  if (!model.vision && !entitlementReady) return (
    <V2Screen testID="v2-vision-entitlement-loading">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Checking subscription access" color={colors.text.primary} />
        <V2Button size="compact" variant="secondary" onPress={() => setEntitlementRefreshAttempt((attempt) => attempt + 1)}>
          Try again
        </V2Button>
      </View>
    </V2Screen>
  );

  if (needsCreationPaywall) return (
    <V2Screen testID="v2-vision-premium-gate">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Opening Anchor Pro" color={colors.text.primary} />
      </View>
    </V2Screen>
  );

  if (model.loading && !model.vision) return (
    <V2Screen testID="v2-vision-screen-loading">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.text.primary} /></View>
    </V2Screen>
  );

  if (model.state.state === 'error' && !model.vision && mode !== 'create' && mode !== 'ready' && mode !== 'addScene' && !pendingPhoto) return (
    <V2Screen testID="v2-vision-screen-error">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <V2EmptyState title="Unable to load Vision" message={model.error ?? 'Please check your connection and try again.'} action={<V2Button onPress={() => { void model.refresh(); }}>Retry Vision</V2Button>} />
    </V2Screen>
  );

  if (fitRequest) return (
    <VisionPhotoFit photo={fitRequest.photo} size={fitRequest.size} onPremiumRequired={openPaywall} onCancel={() => setFitRequest(null)}
      onConfirm={({ photo: fitted }) => { const original = fitRequest.photo; setFitRequest(null); beginPendingPhoto({ ...original, uri: fitted.uri, mimeType: fitted.mimeType }); }} />
  );

  if (pendingPhoto) return (
    <VisionCeremony mode="add" startAt="develop" photo={pendingPhoto} photoUploading={photoUploading} anchorId={anchorId}
      anchorIntention={anchorIntention} anchorCategory={anchorCategory} anchorArt={anchorArt} anchorImageUrl={anchor?.enhancedImageUrl}
      onUploadAsset={model.uploadAsset} onAssemble={async () => false} onPhotoConfirm={confirmAddPhoto}
      savedImageUrl={savedImageUrl} savedImages={savedImages} onPinned={() => finishCeremony('add')} onSealingChange={handleSealingChange}
      onChooseAgain={() => {
        const source = pendingPhoto.sourceType === 'USER_CAMERA' ? 'camera' : 'library';
        setPendingPhoto(null); void startAddPhoto(source);
      }} onBack={() => setPendingPhoto(null)} />
  );

  if (mode === 'addScene') return (
    <VisionCeremony mode="add" visionId={model.vision?.id} startAt={replaceSceneId ? 'describe' : addRequest ? 'develop' : 'ask'} regenerating={Boolean(replaceSceneId)}
      autoStart={Boolean(addRequest) && !replaceSceneId} initialDescription={addRequest?.description} initialStartPhoto={addRequest?.photo ?? null}
      onAddNote={replaceSceneId ? undefined : openNoteComposer} canAddImage={model.tiles.length < VISION_BOARD_MAX_IMAGES}
      previewImageUrl={model.tiles[0]?.imageUrl} previewCaption={model.tiles[0]?.caption}
      anchorId={anchorId} anchorIntention={anchorIntention} anchorCategory={anchorCategory} anchorArt={anchorArt}
      anchorImageUrl={anchor?.enhancedImageUrl} onPremiumRequired={openPaywall} onUploadAsset={model.uploadAsset}
      resumeGeneration={route.params?.resumeGeneration}
      onResumeGenerationConsumed={() => navigation.setParams({ resumeGeneration: false })}
      onBack={() => { const taken = replaceSceneId ? null : addRequest; setReplaceSceneId(null); setAddRequest(null); setMode('view'); if (taken) { setAddDraft(taken); setAddSheetOpen(true); } }} onAdd={placeGeneratedScene}
      savedImageUrl={savedImageUrl} savedImages={savedImages} onPinned={() => finishCeremony('add')} onSealingChange={handleSealingChange}
      onAssemble={async ({ selectedAssets }) => {
        const asset = selectedAssets[0];
        if (!asset) return false;
        const saved = await model.addScene({ assetId: asset.assetId, prompt: asset.prompt, sourceType: asset.sourceType, caption: asset.caption });
        if (!saved) return false;
        const url = recordSaved(saved.scenes, asset.assetId);
        await warmImage(url); setSavedImageUrl(url ?? null); return true;
      }} />
  );

  if (mode === 'create' || mode === 'ready' || model.state.state === 'none') return (
    <VisionCeremony mode="create" visionId={model.vision?.id} startAt="ask" firstImage={model.tiles.length === 0}
      onAddNote={openNoteComposer} canAddImage={model.tiles.length < VISION_BOARD_MAX_IMAGES}
      anchorId={anchorId}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorImageUrl={anchor?.enhancedImageUrl}
      anchorArt={anchorArt}
      initialDescription={model.vision?.description ?? ''}
      savedImageUrl={savedImageUrl} savedImages={savedImages}
      onPinned={() => finishCeremony('create')} onSealingChange={handleSealingChange}
      resumeGeneration={route.params?.resumeGeneration}
      onResumeGenerationConsumed={() => navigation.setParams({ resumeGeneration: false })}
      onBack={handleBack}
      onPremiumRequired={openPaywall}
      onSaveDescription={async description => {
        setMode('create');
        const saved = await model.createVision({ description });
        return Boolean(saved);
      }}
      onUploadAsset={model.uploadAsset}
      onAssemble={async ({ description, selectedAssets, arrivingAssetId }) => {
        // Stay mounted while first-photo persistence changes the read model.
        setMode('create');
        const saved = await model.createVision({
          description,
          scenes: selectedAssets.map(asset => ({
            assetId: asset.assetId, prompt: asset.prompt, sourceType: asset.sourceType, caption: asset.caption,
          })),
        });
        if (!saved) return false;
        const destination = recordSaved(saved.scenes, arrivingAssetId ?? selectedAssets[0]?.assetId);
        setSavedImages(selectedAssets.flatMap(asset => {
          const scene = saved.scenes.find(item => item.assetId === asset.assetId);
          return scene?.resolvedImageUrl ? [{ sceneId: scene.id, url: scene.resolvedImageUrl }] : [];
        }));
        await Promise.all(saved.scenes.map(scene => warmImage(scene.resolvedImageUrl)));
        setSavedImageUrl(destination ?? null);
        return true;
      }}
    />
  );

  if (model.state.state !== 'ready') return null;

  return (
    <V2SavedVision
      teachingEnabled
      teachingBlocked={photoPickerOpen || model.loading || Boolean(arrival?.url)}
      teachingSceneId={savedSceneId ?? newestVisionScene(model.vision?.scenes ?? [])}
      testID={props.testID ?? 'v2-vision-screen'}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorImageUrl={anchor?.enhancedImageUrl}
      anchorArt={anchorArt}
      initialEdit={props.edit ?? route.params?.edit}
      description={model.description}
      annotation={model.vision?.title ?? ''}
      onUpdateAnnotation={async title => Boolean(await model.updateVision({ title }))}
      onUpdateSceneCaption={async (sceneId, caption) => Boolean(await model.updateSceneCaption(sceneId, caption))}
      tiles={model.tiles}
      arrivingNoteId={route.params?.savedNoteId}
      notes={model.vision?.notes ?? []}
      onNotePresentationChange={updateNotePresentation}
      onNoteEdit={openEditNote}
      onNoteDelete={deleteNote}
      error={actionError ?? model.error}
      onBack={handleBack}
      onShare={anchor ? async () => {
        // Vision reads contain short-lived signed image URLs. A freshly mounted
        // Share Studio starts new native Image requests, so give it the latest
        // URLs before composing the export instead of reusing an old board cache.
        await model.refresh();
        if (alive.current) setShareOpen(true);
      } : undefined}
      onVisualize={sourceFrame => {
        // One Visualize: every entry reaches the same setup, where the duration is chosen.
        if (props.onVisualize) { props.onVisualize(model.visualizeHandoff); return; }
        navigation.navigate('V2Practice', { anchorId, resumeMode: 'visualize', resumeSource: 'practice_hub', returnRoute: 'V2Vision',
          visionEntry: { anchorId, visionId: model.vision!.id, tiles: model.tiles.map(tile => ({ ...tile })),
            notes: (model.vision?.notes ?? []).map(note => ({ ...note, content: { ...note.content }, presentation: { ...note.presentation } })),
            ...(sourceFrame ? { sourceFrame } : {}) } });
      }}
      chartSummary={chartSummary}
      onChart={() => {
        if (props.onChart) props.onChart(anchorId);
        else navigation.navigate('V2Chart', { anchorId, source: 'vision' });
      }}
      onUpdateDescription={async description => Boolean(await model.updateVision({ description }))}
      onReorder={async sceneOrders => Boolean(await model.reorderScenes(sceneOrders))}
      onRemove={async sceneId => Boolean(await model.deleteScene(sceneId))}
      onAddPhoto={source => { void startAddPhoto(source); }}
      onAddGenerate={openAddScene}
      onAddImage={openAddScene}
      justAdded={justAdded}
      arrivingSceneId={justAdded ? savedSceneId ?? undefined : undefined}
      onReplace={replaceWithOwnImage}
      onRegenerate={sceneId => openImageGeneration(sceneId)}
      arrivedFrom={arrivedFrom}
      canGenerateMore
      onArchive={async () => {
        const archived = await model.archiveVision();
        if (archived) {
          if (props.onBack) props.onBack();
          else if (navigation.canGoBack()) navigation.goBack();
        }
        return archived;
      }}
    />
  );
  };
  // Paint the board's cream behind the saved board and ink behind the ceremony, so a mode change never
  // shows a frame of the other colour (one of the flashes seen on device, Oct 7).
  const onBoard = mode === 'view' && !pendingPhoto && model.state.state === 'ready';
  const milestoneFocus = useTeachingFocus();
  useMilestonePresentationHold(milestoneFocus.isFocused && (!onBoard || shareOpen || addSheetOpen || photoPickerOpen || Boolean(picker.state) || Boolean(fitRequest) || Boolean(arrival?.setActive) || Boolean(arrival?.url)));
  useEffect(() => {
    if (onBoard && route.params?.savedNoteId) void queueVisionMilestones(anchorId);
  }, [anchorId, onBoard, route.params?.savedNoteId]);
  return <View style={{ flex: 1, backgroundColor: onBoard ? colors.canvas : '#14162B' }}>{renderContent()}
    {shareOpen && anchor ? <AnchorShareStudio visible onClose={() => setShareOpen(false)} initialLayout="vision"
      data={buildShareExportData(anchor, { visionTiles: model.tiles, visionNotes: model.vision?.notes ?? [],
        visionAnnotation: model.vision?.title ?? '' })} /> : null}
    {picker.state ? <VisionPickerHolding anchorArt={anchorArt} retrying={picker.state === 'retry'} onRetry={picker.retry} onBack={picker.dismiss} /> : null}
    {onBoard ? <VisionAddSceneSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} anchorIntention={anchorIntention}
      restoreDraft={addDraft} onDraftRestored={() => setAddDraft(null)}
      onSubmit={startAddScene} onAddOwnPhoto={source => { void startAddPhoto(source); }} onAddNote={openNoteComposer}
      canAddImage={model.tiles.length < VISION_BOARD_MAX_IMAGES} /> : null}
  </View>;
}
