import { AnalyticsService } from '@/services/AnalyticsService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { V2VisionAddPhoto, V2VisionAddScene, V2VisionCreationFlow } from '@/components/v2/vision';
import { playCreationSound } from '@/services/CreationSounds';
import { VisionImageArrivalProvider, useVisionImageArrival } from '@/components/v2/vision/VisionImageArrival';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { V2Button, V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { pickVisionPhoto, uploadVisionPhoto, useV2Vision, type PickedVisionPhoto, type VisionPhotoPick, type VisionPhotoSource } from '@/hooks/v2/vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { resolveAnchorCategory } from '@/utils/categoryDetection';
import { colors } from '@/theme/v2';
import type { V2VisualizeHandoff } from '@/adapters/v2/vision';
import { toChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';

const WARM_IMAGE_MAX_MS = 3000;

export interface V2VisionRouteParams {
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
  testID?: string;
}

export function V2VisionScreen(props: V2VisionScreenProps) {
  return <VisionImageArrivalProvider><VisionScreenContent {...props} /></VisionImageArrivalProvider>;
}

function VisionScreenContent(props: V2VisionScreenProps) {
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
  // Warm every board image (and the Anchor's enhanced art) while the Vision is on screen, so the Visualize setup and
  // session that follow find them decoded-cache-ready instead of fetching them as they appear.
  const warmUrls = model.tiles.map(tile => tile.imageUrl).concat(anchor?.enhancedImageUrl ?? null).filter((url): url is string => Boolean(url)).join('|');
  useEffect(() => {
    if (typeof Image.prefetch !== 'function') return;
    warmUrls.split('|').filter(Boolean).forEach(url => { void Promise.resolve(Image.prefetch(url)).catch(() => false); });
  }, [warmUrls]);
  const anchorChart = useAnchorChart(anchor?.id ?? null);
  const chartSummary = useMemo(() => toChartSummary(anchorChart.data?.chart), [anchorChart.data?.chart]);
  const [mode, setMode] = useState<'view' | 'create' | 'ready' | 'addScene'>(props.initialMode ?? route.params?.initialMode ?? 'view');
  useEffect(() => {
    if (route.params?.resumeGeneration) setMode('create');
  }, [route.params?.resumeGeneration]);
  const [actionError, setActionError] = useState<string | null>(null);
  // Choosing generated images for one place on the board (Regenerate), or for any free places (add).
  const [replaceSceneId, setReplaceSceneId] = useState<string | null>(null);
  // The board as it was before leaving to add images, so it can recompose on return.
  const [arrivedFrom, setArrivedFrom] = useState<string[] | null>(null);
  // A photo chosen or taken for the board, previewed until the person confirms it.
  const [pendingPhoto, setPendingPhoto] = useState<PickedVisionPhoto | null>(null);
  const anchorIntention = (anchor as { intention?: string } | undefined)?.intention ?? anchor?.intentionText ?? 'Your Anchor';
  const anchorArt = useMemo(() => (anchor ? anchorRenderProps(anchor) : null), [anchor]);
  // The Anchor's persisted category is the only source: art, accent and label all read it.
  const anchorCategory = anchor ? resolveAnchorCategory(anchor.category) : undefined;
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
    // A prefetch that never settles must not hold the save open: the board shows the image either way.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bound = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), WARM_IMAGE_MAX_MS); });
    await Promise.race([Promise.resolve(Image.prefetch(url)).catch(() => false), bound]);
    if (timer) clearTimeout(timer);
  };

  /** Chooses or takes a photo; it is previewed, and nothing is uploaded until the person confirms. */
  const startAddPhoto = async (source: VisionPhotoSource) => {
    AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: source });
    setActionError(null);
    const picked = await pickVisionPhoto(source);
    if (picked.status === 'cancelled') return;
    if (picked.status !== 'picked') { reportPickProblem(picked); return; }
    setArrivedFrom(model.tiles.map(tile => tile.sceneId));
    setPendingPhoto(picked.photo);
  };

  /** Uploads the confirmed photo and adds it to the board. Returns an error message, or null when added. */
  const confirmAddPhoto = async (): Promise<string | null> => {
    if (!pendingPhoto) return null;
    const uploaded = await uploadVisionPhoto(pendingPhoto, model.uploadAsset);
    if (!uploaded.ok) return uploaded.message;
    const saved = await model.addScene({ assetId: uploaded.assetId, sourceType: pendingPhoto.sourceType });
    if (!saved) return 'Your photo was uploaded, but could not be added to your Vision. Please try again.';
    const url = saved.scenes.find(scene => scene.assetId === uploaded.assetId)?.resolvedImageUrl;
    playVisionPin();
    await warmImage(url);
    if (url) arrival?.resolve(url); else arrival?.cancel();
    setActionError(null);
    setPendingPhoto(null);
    return null;
  };

  const openAddScene = () => {
    AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: 'AI_GENERATED' });
    setActionError(null);
    setArrivedFrom(model.tiles.map(tile => tile.sceneId));
    setMode('addScene');
  };

  /** Adds the generated image the person chose. */
  const addGeneratedScene = async (choice: { assetId: string; prompt: string }): Promise<boolean> => {
    const saved = await model.addScene({ assetId: choice.assetId, prompt: choice.prompt, sourceType: 'AI_GENERATED' });
    if (!saved) return false;
    const destinationUrl = saved.scenes.find(scene => scene.assetId === choice.assetId)?.resolvedImageUrl;
    playVisionPin();
    await warmImage(destinationUrl);
    if (destinationUrl) arrival?.resolve(destinationUrl); else arrival?.cancel();
    setActionError(null);
    setMode('view');
    return true;
  };

  /**
   * Puts a new image where an old one was: the new scene takes the old one's
   * sort order, then the old one is archived. A full board archives first so
   * the image limit is never exceeded.
   */
  const replaceScene = async (
    sceneId: string,
    next: { assetId: string; sourceType: 'USER_UPLOAD' | 'AI_GENERATED' | 'USER_CAMERA'; prompt?: string },
  ): Promise<boolean> => {
    const old = model.tiles.find(tile => tile.sceneId === sceneId);
    if (!old) return false;
    const full = model.tiles.length >= VISION_BOARD_MAX_IMAGES;
    if (full && !(await model.deleteScene(sceneId))) { setActionError('Image could not be replaced.'); return false; }
    const added = await model.addScene({ ...next, sortOrder: old.sortOrder });
    if (!added) { setActionError('The new image could not be added to your Vision. Please try again.'); return false; }
    playVisionPin();
    if (!full && !(await model.deleteScene(sceneId))) { setActionError('The new image was added, but the old one could not be removed.'); return false; }
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
    setActionError(null);
    setArrivedFrom(null);
    setReplaceSceneId(forSceneId);
    setMode('addScene');
  };

  /** Adds the generated image the person chose, or puts it where the one being regenerated was. */
  const placeGeneratedScene = async (choice: { assetId: string; prompt: string }): Promise<boolean> => {
    if (!replaceSceneId) return addGeneratedScene(choice);
    const replaced = await replaceScene(replaceSceneId, { assetId: choice.assetId, sourceType: 'AI_GENERATED', prompt: choice.prompt });
    if (!replaced) return false;
    arrival?.cancel();
    setReplaceSceneId(null);
    setMode('view');
    return true;
  };

  const renderContent = () => {
  if (model.loading && !model.vision) return (
    <V2Screen testID="v2-vision-screen-loading">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.text.primary} /></View>
    </V2Screen>
  );

  if (model.state.state === 'error' && !model.vision) return (
    <V2Screen testID="v2-vision-screen-error">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <V2EmptyState title="Unable to load Vision" message={model.error ?? 'Please check your connection and try again.'} action={<V2Button onPress={() => { void model.refresh(); }}>Retry Vision</V2Button>} />
    </V2Screen>
  );

  if (pendingPhoto) return (
    <V2VisionAddPhoto
      uri={pendingPhoto.uri}
      source={pendingPhoto.sourceType === 'USER_CAMERA' ? 'camera' : 'library'}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorArt={anchorArt}
      anchorImageUrl={anchor?.enhancedImageUrl}
      onConfirm={confirmAddPhoto}
      onChooseAgain={() => {
        const source = pendingPhoto.sourceType === 'USER_CAMERA' ? 'camera' : 'library';
        setPendingPhoto(null);
        void startAddPhoto(source);
      }}
      onCancel={() => setPendingPhoto(null)}
    />
  );

  if (mode === 'addScene' && model.state.state === 'ready') return (
    <V2VisionAddScene
      anchorId={anchorId}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorArt={anchorArt}
      anchorImageUrl={anchor?.enhancedImageUrl}
      existingTiles={model.tiles}
      onPremiumRequired={openPaywall}
      onUploadAsset={model.uploadAsset}
      onCancel={() => { setReplaceSceneId(null); setMode('view'); }}
      onAdd={placeGeneratedScene}
    />
  );

  if (mode === 'create' || mode === 'ready' || model.state.state === 'none') return (
    <V2VisionCreationFlow
      anchorId={anchorId}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorImageUrl={anchor?.enhancedImageUrl}
      anchorArt={anchorArt}
      initialDescription={model.vision?.description ?? ''}
      initialStep={mode === 'ready' ? 'ready' : mode === 'create' ? 'prompt' : 'empty'}
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
      onAssemble={async ({ description, selectedAssets }) => {
        const saved = await model.createVision({
          description,
          scenes: selectedAssets.map(asset => ({
            assetId: asset.assetId, prompt: asset.prompt, sourceType: asset.sourceType,
          })),
        });
        if (!saved) return false;
        if (selectedAssets.length) playVisionPin();
        const destination = saved.scenes.find(scene => scene.assetId === selectedAssets[0]?.assetId)?.resolvedImageUrl;
        await warmImage(destination);
        if (destination) arrival?.resolve(destination); else arrival?.cancel();
        setMode('view');
        return true;
      }}
    />
  );

  if (model.state.state !== 'ready') return null;

  return (
    <V2SavedVision
      testID={props.testID ?? 'v2-vision-screen'}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorImageUrl={anchor?.enhancedImageUrl}
      anchorArt={anchorArt}
      initialEdit={props.edit ?? route.params?.edit}
      description={model.description}
      annotation={model.vision?.title ?? ''}
      onUpdateAnnotation={async title => Boolean(await model.updateVision({ title }))}
      tiles={model.tiles}
      error={actionError ?? model.error}
      onBack={handleBack}
      onVisualize={() => {
        // One Visualize: every entry reaches the same setup, where the duration is chosen.
        if (props.onVisualize) { props.onVisualize(model.visualizeHandoff); return; }
        navigation.navigate('V2Practice', { anchorId, resumeMode: 'visualize', resumeSource: 'practice_hub', returnRoute: 'V2Vision' });
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
      onReplace={replaceWithOwnImage}
      onRegenerate={sceneId => openImageGeneration(sceneId)}
      arrivedFrom={arrivedFrom}
      canGenerateMore
      onArchive={model.archiveVision}
    />
  );
  };
  return <View style={{ flex: 1 }}>{renderContent()}</View>;
}
