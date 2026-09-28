import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { V2VisionCreationFlow } from '@/components/v2/vision';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { V2EmptyState, V2Screen, V2TopBar } from '@/components/v2';
import { useV2Vision, useV2VisionGeneration } from '@/hooks/v2/vision';
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
  const [mode, setMode] = useState<'view' | 'create' | 'ready' | 'add'>(props.initialMode ?? route.params?.initialMode ?? 'view');
  useEffect(() => {
    if (route.params?.resumeGeneration) setMode('create');
  }, [route.params?.resumeGeneration]);
  const [actionError, setActionError] = useState<string | null>(null);
  // Choosing generated images for one place on the board (Regenerate), or for any free places (add).
  const [replaceSceneId, setReplaceSceneId] = useState<string | null>(null);
  // The board as it was before leaving to add images, so it can recompose on return.
  const [arrivedFrom, setArrivedFrom] = useState<string[] | null>(null);
  const anchorIntention = (anchor as { intention?: string } | undefined)?.intention ?? anchor?.intentionText ?? 'Your Anchor';
  const anchorArt = useMemo(() => (anchor ? anchorRenderProps(anchor) : null), [anchor]);
  // The Anchor's persisted category is the only source: art, accent and label all read it.
  const anchorCategory = anchor ? resolveAnchorCategory(anchor.category) : undefined;

  const handleBack = () => {
    if ((mode === 'create' || mode === 'add') && model.state.state === 'ready') {
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

  /** Picks one of the person's photos and uploads it as a Vision asset; null when cancelled or failed. */
  const pickAndUploadOwnImage = async (): Promise<string | null> => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') { setActionError('Allow photo library access to add an image.'); return null; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled || !result.assets?.[0]) return null;
    const item = result.assets[0];
    const mimeType = item.mimeType ?? 'image/jpeg';
    const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.Base64 });
    const uploaded = await model.uploadAsset({ base64Image: `data:${mimeType};base64,${base64}`, mimeType });
    if (!uploaded.ok) { setActionError(uploaded.message); return null; }
    return uploaded.asset.id;
  };

  const addOwnImage = async () => {
    try {
      const assetId = await pickAndUploadOwnImage();
      if (!assetId) return;
      const saved = await model.addScene({ assetId, sourceType: 'USER_UPLOAD' });
      if (!saved) setActionError('Image uploaded, but could not be added to your Vision. Please try again.');
      else setActionError(null);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to add this image.');
    }
  };

  /**
   * Puts a new image where an old one was: the new scene takes the old one's
   * sort order, then the old one is archived. A full board archives first so
   * the image limit is never exceeded.
   */
  const replaceScene = async (
    sceneId: string,
    next: { assetId: string; sourceType: 'USER_UPLOAD' | 'AI_GENERATED'; prompt?: string },
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
      onAddOwn={addOwnImage}
      onReplace={replaceWithOwnImage}
      onRegenerate={sceneId => openImageGeneration(sceneId)}
      onGenerateMore={() => openImageGeneration(null)}
      arrivedFrom={arrivedFrom}
      canGenerateMore={!generation.job || generation.job.setNumber < 3}
      onArchive={model.archiveVision}
    />
  );
}
