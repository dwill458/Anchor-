import { useEffect, useState } from 'react';
import { DeviceEventEmitter, DevSettings, Image, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { VisionMomentInput } from '@/components/v2/vision/VisionMomentInput';
import { V2VisualizePrepareScreen, type V2VisualizeBeginConfig } from '@/screens/v2/practice/visualize/V2VisualizePrepareScreen';
import { V2CinematicSessionScreen } from '@/screens/v2/practice/visualize/V2CinematicSessionScreen';
import { isV2VisualizeDuration } from '@/screens/v2/practice/visualize/visualizeVisionPlan';
import { VisionImageArrivalProvider, useVisionImageArrival } from '@/components/v2/vision/VisionImageArrival';
import { VisionTwoUpStage } from '@/components/v2/vision/VisionTwoUpStage';
import { VisionIntroStage } from '@/components/v2/vision/VisionIntroStage';
import { VisionMethodStage } from '@/components/v2/vision/VisionMethodStage';
import { VisionAddSheet } from '@/components/v2/vision/VisionAddSheet';
import { V2VisionAddPhoto } from '@/components/v2/vision/V2VisionAddPhoto';
import { VisionBoardPreview } from '@/components/v2/vision/VisionBoardPreview';
import { V2HomeVisionSection } from '@/components/v2/home/V2HomeVisionSection';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { colors, typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionGenerationCandidate, VisionGenerationJob } from '@/hooks/v2/vision';
import { useV2Vision } from '@/hooks/v2/vision';

// Local fixtures exercise production components; never mounted in release builds.
const sources = [require('@/assets/vision/vision-future-desk.jpg'), require('@/assets/vision/vision-future-window.jpg'), require('@/assets/vision/vision-future-family.jpg')];
const tiles: V2VisionTile[] = Array.from({ length: 6 }, (_, i) => ({ id: `qa-${i}`, sceneId: `qa-${i}`, imageUrl: Image.resolveAssetSource(sources[i % 3]).uri,
  prompt: null, sortOrder: i, isHero: i === 0, sourceType: 'AI_GENERATED' }));
const description = 'My app is thriving. I see ten thousand people using something I created, and I have the freedom to work by the ocean with my family. The work is meaningful, and there is room to enjoy the life around it.';
const noop = () => undefined;
const saved = async () => true;

function SavedImageGeometry({ anchorId }: { anchorId: string }) {
  const vision = useV2Vision(anchorId);
  const [dimensions, setDimensions] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    vision.tiles.forEach((tile, index) => {
      if (tile.imageUrl) Image.getSize(tile.imageUrl, (width, height) => {
        if (live) setDimensions(previous => ({ ...previous, [tile.id]: `Image ${index + 1}: ${width} x ${height} (${tile.sourceType})` }));
      }, noop);
    });
    return () => { live = false; };
  }, [vision.tiles]);
  return <View style={{ flex: 1, padding: 30, paddingTop: 100, backgroundColor: colors.canvas }}>
    <Text style={typography.headingMD}>Saved image geometry</Text>
    {Object.values(dimensions).map(value => <Text key={value} style={typography.bodyMD}>{value}</Text>)}
  </View>;
}

/** The hand-off from choosing one of two moments to the board, with the real Anchor in flight. */
function HandoffLab({ identity, candidates, onClose }: { identity: { anchorIntention: string; anchorCategory: string; anchorArt: any }; candidates: VisionGenerationCandidate[]; onClose: () => void }) {
  const arrival = useVisionImageArrival();
  const [chosen, setChosen] = useState<string | null>(null);
  const job = { id: 'qa-job', kind: 'SCENE', status: 'COMPLETE', stage: 'complete', setNumber: 1, retryCount: 0, error: null,
    candidates: candidates.map((candidate, index) => ({ ...candidate, sortOrder: index })) } as unknown as VisionGenerationJob;
  if (chosen) {
    return <V2SavedVision {...identity} tiles={[{ id: 'qa-hero', sceneId: 'qa-hero', imageUrl: chosen, prompt: null, sortOrder: 0, isHero: true, sourceType: 'AI_GENERATED' }]}
      description={description} onBack={onClose} onVisualize={noop} onChart={noop} chartSummary={null as any}
      onUpdateDescription={saved} onReorder={saved} onRemove={saved} onAddPhoto={noop} onAddGenerate={noop} onReplace={async () => undefined} onRegenerate={noop} canGenerateMore onArchive={saved} />;
  }
  return <VisionTwoUpStage anchorIntention={identity.anchorIntention} anchorArt={identity.anchorArt} job={job} onBack={onClose}
    onSelect={(candidate, selection) => {
      if (candidate.imageUrl && selection.image) arrival?.begin(candidate.imageUrl, selection.image, selection.anchor ? { svg: identity.anchorArt.svg, category: identity.anchorCategory, rect: selection.anchor } : undefined);
      setChosen(candidate.imageUrl);
    }} />;
}

/** Open with anchor://vision-visual-qa?surface=2 (visualize-3/visualize-1/handoff/intro/method/create/twoup-0/twoup-1/twoup-2/twoup-fail/0/1/2/3/6/add/home/details/photo/sources). */
export function VisionVisualQADevHost() {
  const [surface, setSurface] = useState<string | null>(null);
  const [run, setRun] = useState<V2VisualizeBeginConfig | null>(null);
  const [finished, setFinished] = useState(false);
  // anchor://vision-visual-qa?surface=visualize-3&voice=male|female picks the guide (default: silent, as before).
  const [qaVoice, setQaVoice] = useState<'male' | 'female' | 'none'>('none');
  // &duration=60|180|600 preselects the length on the setup.
  const [qaDuration, setQaDuration] = useState(60);
  const anchor = useAnchorStore(state => state.anchors[0]);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const openLab = (surfaceParam = '2') => {
      setRun(null);
      setFinished(false);
      setSurface(surfaceParam);
    };
    DevSettings.addMenuItem?.('Vision visual QA lab', () => openLab('2'));
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const devMenu = require('expo-dev-menu') as { registerDevMenuItems?: (items: { name: string; callback: () => void; shouldCollapse?: boolean }[]) => Promise<void> };
      void devMenu.registerDevMenuItems?.([{ name: 'Vision visual QA lab', callback: () => openLab('2'), shouldCollapse: true }]);
    } catch {
      // Not in dev client
    }
    const emitterSub = DeviceEventEmitter.addListener('openVisionVisualQA', (data?: { surface?: string }) => {
      openLab(data?.surface ?? '2');
    });

    const open = ({ url }: { url: string }) => {
      if (!url.startsWith('anchor://vision-visual-qa')) return;
      const voice = url.split('voice=')[1]?.split('&')[0];
      setQaVoice(voice === 'male' || voice === 'female' ? voice : 'none');
      const duration = Number(url.split('duration=')[1]?.split('&')[0]);
      setQaDuration(isV2VisualizeDuration(duration) ? duration : 60);
      openLab(url.split('surface=')[1]?.split('&')[0] ?? '2');
    };
    const listener = Linking.addEventListener('url', open);
    void Linking.getInitialURL().then(url => { if (url) open({ url }); });
    return () => {
      listener.remove();
      emitterSub.remove();
    };
  }, []);
  const identity = { anchorIntention: anchor?.intentionText ?? 'Anchor has ten thousand users', anchorCategory: anchor?.category ?? 'desire',
    anchorArt: anchor ? anchorRenderProps(anchor) : { svg: V2_SAMPLE_ANCHOR_SVGS.medium, category: 'desire' } };
  const close = () => setSurface(null);
  const candidates = tiles.slice(0, 2).map((tile, i) => ({ id: tile.id, imageUrl: tile.imageUrl, assetId: `qa-asset-${i}`, prompt: '', status: 'SUCCEEDED' })) as VisionGenerationCandidate[];
  let content;
  if (surface === 'geometry' && anchor) return <Modal visible animationType="none" onRequestClose={close}><SavedImageGeometry anchorId={anchor.id} /></Modal>;
  const twoUp = (status: string, count: number) => ({ id: 'qa-job', kind: 'SCENE', status, stage: 'creating_images', setNumber: 1, retryCount: 0, error: null,
    candidates: candidates.slice(0, count).map((candidate, index) => ({ ...candidate, sortOrder: index })) }) as unknown as VisionGenerationJob;
  if (surface?.startsWith('visualize')) {
    const count = Number(surface.split('-')[1] ?? '3');
    const qaAnchor = { id: 'qa-anchor', localId: 'qa-anchor', intentionText: identity.anchorIntention, category: identity.anchorCategory,
      baseSigilSvg: identity.anchorArt.svg, reinforcedSigilSvg: null, enhancedImageUrl: null } as any;
    // Begin runs the real cinematic session (60 s) so the whole hand-off can be recorded; completion shows a marker instead of the Thread screen.
    content = finished ? <View testID="qa-visualize-complete" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}><Text style={typography.headingMD}>Completion reached</Text></View>
      : run ? <V2CinematicSessionScreen anchor={qaAnchor} accountId={null} tiles={run.prepared.assets.tiles} statement={description} visionId="qa-vision"
        durationSeconds={isV2VisualizeDuration(run.durationSeconds) ? run.durationSeconds : 60} voice={qaVoice} ambient={false} haptics={run.haptics} source="practice_hub"
        prepared={run.prepared} onExit={close} onContinue={() => setFinished(true)} />
      : <V2VisualizePrepareScreen anchor={qaAnchor} statement={description} visionId="qa-vision" tiles={tiles.slice(0, count)} initialDuration={qaDuration} onBack={close} onOpenVision={noop} onBegin={setRun} />;
  } else if (surface === 'handoff') content = <VisionImageArrivalProvider><HandoffLab identity={identity as any} candidates={candidates} onClose={close} /></VisionImageArrivalProvider>;
  else if (surface?.startsWith('twoup')) {
    const variant = surface.split('-')[1] ?? '2';
    const job = variant === '0' ? twoUp('RUNNING', 0) : variant === '1' ? twoUp('PARTIAL', 1) : variant === 'fail' ? twoUp('FAILED', 1) : twoUp('COMPLETE', 2);
    content = <VisionTwoUpStage anchorIntention={identity.anchorIntention} anchorArt={identity.anchorArt} job={job} onBack={close} onSelect={() => close()} onRetry={noop} onEditDescription={noop} />;
  } else if (surface === 'intro') content = <VisionIntroStage {...identity} onBack={close} onStartCreate={() => setSurface('method')} testID="qa" />;
  else if (surface === 'method') content = <VisionMethodStage onBack={() => setSurface('intro')} onChoose={path => setSurface(path === 'photos' ? 'method' : 'create')} testID="qa" />;
  else if (surface === 'create') content = <VisionMomentInput {...identity} mode="create" anchorId="qa-fixture" onBack={close} onSubmit={noop} />;
  else if (surface === 'add') content = <VisionMomentInput {...identity} mode="add" anchorId="qa-fixture" previewImageUrl={tiles[0].imageUrl} initialDescription="Working by the ocean with my family while Anchor continues to grow." onBack={close} onSubmit={noop} />;
  else if (surface === 'photo') content = <V2VisionAddPhoto {...identity} uri={tiles[0].imageUrl!} source="library" onCancel={close} onChooseAgain={noop} onConfirm={async () => null} />;
  else if (surface === 'home' || surface === 'details') content = <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, flexGrow: 1, backgroundColor: surface === 'home' ? colors.ink.base : colors.canvas }}>
    <Text style={{ ...typography.headingMD, color: surface === 'home' ? colors.paper : colors.text.primary }}>QA fixture · {surface}</Text>
    {surface === 'home' ? <V2HomeVisionSection vision={{ state: 'ready', visionId: 'qa', tiles, previewText: description, seenToday: false }} categoryColor="#CE6091" onOpenVision={noop} /> :
      <View style={{ marginTop: 24 }}><VisionBoardPreview tiles={tiles} statement={description} variant="details" accent="#CE6091" onPress={noop} /></View>}
  </ScrollView>;
  else content = <V2SavedVision {...identity} key={surface} tiles={tiles.slice(0, Number(surface) || 0)} description={description} onBack={close} onVisualize={noop} onChart={noop}
    chartSummary={{ courseId: 'qa', waypointNumber: 1, total: 5, waypointTitle: 'First thousand active users', oneMoveTitle: null, isFinished: false, destination: 'Ten thousand users' }}
    onUpdateDescription={saved} onReorder={saved} onRemove={saved} onAddPhoto={noop} onAddGenerate={noop} onReplace={async () => undefined} onRegenerate={noop} canGenerateMore onArchive={saved} />;
  // A plain overlay, not a Modal: a Modal is a separate window and does not receive keyboard insets, which hid keyboard behaviour from QA.
  if (surface === null) return null;
  return <View style={StyleSheet.absoluteFill}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      {content}
      {surface === 'sources' ? <VisionAddSheet visible onClose={close} onChoose={noop} /> : null}
    </GestureHandlerRootView>
  </View>;
}
