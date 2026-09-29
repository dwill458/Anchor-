import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { V2VisionAddPhoto, V2VisionAddScene, V2VisionCreationFlow } from '@/components/v2/vision';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import {
  pickVisionPhoto, uploadVisionPhoto, useV2Vision, useV2VisionGeneration,
  type PickedVisionPhoto, type VisionPhotoPick, type VisionPhotoSource,
} from '@/hooks/v2/vision';
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { resolveAnchorCategory } from '@/utils/categoryDetection';
import { colors } from '@/theme/v2';
import type { V2VisualizeHandoff } from '@/adapters/v2/vision';
import { toChartSummary } from '@/adapters/v2/chart/chartV2Model';
import { useAnchorChart } from '@/hooks/v2/chart/useAnchorChart';
import { VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';

export interface V2VisionRouteParams {
  anchorId: string;
  initialMode?: 'view' | 'create' | 'ready';
  resumeGeneration?: boolean;
}

export interface V2VisionScreenProps {
  anchorId?: string;
  initialMode?: 'view' | 'create' | 'ready';
  onBack?: () => void;
  onVisualize?: (handoff: V2VisualizeHandoff) => void;
  onChart?: (anchorId: string) => void;
  testID?: string;
}

export function V2VisionScreen(props: V2VisionScreenProps) {
  const route = useRoute<RouteProp<Record<string, V2VisionRouteParams>, string>>();
  const navigation = useNavigation<any>();
  const anchorId = props.anchorId ?? route.params?.anchorId ?? '';
  const anchor = useAnchorStore(state => state.anchors.find(item => item.id === anchorId || item.localId === anchorId));
  const model = useV2Vision(anchorId);
  const generation = useV2VisionGeneration(anchorId);
  const anchorChart = useAnchorChart(anchor?.id ?? null);
  const chartSummary = useMemo(() => toChartSummary(anchorChart.data?.chart), [anchorChart.data?.chart]);
  const [mode, setMode] = useState<'view' | 'create' | 'ready' | 'add' | 'addScene'>(props.initialMode ?? route.params?.initialMode ?? 'view');
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
    if ((mode === 'create' || mode === 'add' || mode === 'addScene') && model.state.state === 'ready') {
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
    await Promise.race([
      Promise.resolve(Image.prefetch(url)).catch(() => false),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ]);
  };

  /** Chooses or takes a photo; it is previewed, and nothing is uploaded until the person confirms. */
  const startAddPhoto = async (source: VisionPhotoSource) => {
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
    await warmImage(saved.scenes.find(scene => scene.assetId === uploaded.assetId)?.resolvedImageUrl);
    setActionError(null);
    setPendingPhoto(null);
    return null;
  };

  const openAddScene = () => {
    setActionError(null);
    setArrivedFrom(model.tiles.map(tile => tile.sceneId));
    setMode('addScene');
  };

  /** Adds the generated image the person chose. */
  const addGeneratedScene = async (choice: { assetId: string; prompt: string }): Promise<boolean> => {
    const saved = await model.addScene({ assetId: choice.assetId, prompt: choice.prompt, sourceType: 'AI_GENERATED' });
    if (!saved) return false;
    await warmImage(saved.scenes.find(scene => scene.assetId === choice.assetId)?.resolvedImageUrl);
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

  const openImageGeneration = (forSceneId: string | null) => {
    // Adding recomposes the board on return; a replacement simply appears in its place.
    setArrivedFrom(forSceneId ? null : model.tiles.map(tile => tile.sceneId));
    setReplaceSceneId(forSceneId);
    setMode('add');
  };

  if (model.loading && !model.vision) return (
    <V2Screen testID="v2-vision-screen-loading">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.text.primary} /></View>
    </V2Screen>
  );

  if (model.state.state === 'error' && !model.vision) return (
    <V2Screen testID="v2-vision-screen-error">
      <V2TopBar title="Vision" onBackPress={handleBack} />
      <V2EmptyState title="Unable to load Vision" message={model.error ?? 'Please check your connection and try again.'} />
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
      onPremiumRequired={openPaywall}
      onCancel={() => setMode('view')}
      onAdd={addGeneratedScene}
    />
  );

  if (mode === 'create' || mode === 'ready' || mode === 'add' || model.state.state === 'none') return (
    <V2VisionCreationFlow
      anchorId={anchorId}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorImageUrl={anchor?.enhancedImageUrl}
      anchorArt={anchorArt}
      initialDescription={model.vision?.description ?? ''}
      initialStep={mode === 'add' ? 'curation' : mode === 'ready' ? 'ready' : mode === 'create' ? 'prompt' : 'empty'}
      selectionLimit={mode === 'add'
        ? (replaceSceneId ? 1 : Math.max(1, VISION_BOARD_MAX_IMAGES - model.tiles.length))
        : VISION_BOARD_MAX_IMAGES}
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
        if (mode === 'add' && replaceSceneId && selectedAssets[0]) {
          const [asset] = selectedAssets;
          const replaced = await replaceScene(replaceSceneId, { assetId: asset.assetId, sourceType: asset.sourceType, prompt: asset.prompt });
          if (!replaced) return false;
          setReplaceSceneId(null);
          setMode('view');
          return true;
        }
        const saved = await model.createVision({
          description,
          scenes: selectedAssets.map(asset => ({
            assetId: asset.assetId, prompt: asset.prompt, sourceType: asset.sourceType,
          })),
        });
        if (!saved) return false;
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
      description={model.description}
      tiles={model.tiles}
      error={actionError ?? model.error}
      onBack={handleBack}
      onVisualize={() => {
        void model.recordVisionView();
        if (props.onVisualize) props.onVisualize(model.visualizeHandoff);
        else navigation.navigate('V2Practice', {
          anchorId, resumeMode: 'visualize', resumeSource: 'practice_hub', returnRoute: 'V2Vision',
        });
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
      canGenerateMore={!generation.job || generation.job.setNumber < 3}
      onArchive={model.archiveVision}
    />
  );
}
