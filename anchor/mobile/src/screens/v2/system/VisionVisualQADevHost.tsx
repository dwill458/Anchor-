import { useEffect, useState } from 'react';
import { DeviceEventEmitter, DevSettings, Image, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { runOnJS, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { VisionMomentInput, type VisionInputPath, type VisionStartPhoto } from '@/components/v2/vision/VisionMomentInput';
import { V2VisualizePrepareScreen, type V2VisualizeBeginConfig } from '@/screens/v2/practice/visualize/V2VisualizePrepareScreen';
import { V2CinematicSessionScreen } from '@/screens/v2/practice/visualize/V2CinematicSessionScreen';
import { isV2VisualizeDuration } from '@/screens/v2/practice/visualize/visualizeVisionPlan';
import { V2FocusCompleteScreen } from '@/screens/v2/practice/focus/V2FocusCompleteScreen';
import { VisionImageArrivalProvider, useVisionImageArrival } from '@/components/v2/vision/VisionImageArrival';
import { VisionTwoUpStage } from '@/components/v2/vision/VisionTwoUpStage';
import { VisionCeremony } from '@/components/v2/vision/ceremony/VisionCeremony';
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
const sessionSources = [require('@/assets/vision/vision-future-desk.jpg'), require('@/assets/vision/vision-future-window-wide.jpg'),
  require('@/assets/vision/vision-future-family.jpg'), require('@/assets/vision/vision-future-home.jpg'),
  require('@/assets/vision/vision-future-studio.jpg'), require('@/assets/vision/vision-future-movement.jpg')];
const sessionTiles: V2VisionTile[] = sessionSources.map((source, i) => ({ ...tiles[i],
  imageUrl: Image.resolveAssetSource(source).uri, sourceType: 'USER_UPLOAD' }));
const description = 'My app is thriving. I see ten thousand people using something I created, and I have the freedom to work by the ocean with my family. The work is meaningful, and there is room to enjoy the life around it.';
const noop = () => undefined;
const saved = async () => true;

/** Native presentation QA only: local artwork, with no account mutation or upload. */
function CeremonyLab({ identity, photo, onClose }: { identity: any; photo: boolean; onClose: () => void }) {
  const [pinned, setPinned] = useState(false);
  if (pinned) return <V2SavedVision {...identity} tiles={tiles.slice(0, 1)} description={description}
    justAdded="add" arrivingSceneId={tiles[0].sceneId} onBack={onClose} onVisualize={noop} onChart={noop}
    onUpdateDescription={saved} onReorder={saved} onRemove={saved} onAddPhoto={noop} onAddGenerate={noop}
    onReplace={async () => undefined} onRegenerate={noop} canGenerateMore onArchive={saved} />;
  return <VisionCeremony {...identity} anchorId="qa-fixture" mode="add" startAt={photo ? 'develop' : 'ask'}
    photo={photo ? { uri: tiles[0].imageUrl!, mimeType: 'image/jpeg', sourceType: 'USER_UPLOAD' } : undefined}
    onBack={onClose} onAssemble={saved} onUploadAsset={async () => ({ ok: false, message: 'QA fixture does not upload.' })}
    onPhotoConfirm={async () => null} savedImageUrl={tiles[0].imageUrl} onPinned={() => setPinned(true)} />;
}

/** Explicit QA sample content, confined to this development-only host. */
function ParityLab({ identity, onClose, count = 3, longCaption = false, noChart = false, longWaypoint = false }: { identity: any; onClose: () => void; count?: number; longCaption?: boolean; noChart?: boolean; longWaypoint?: boolean }) {
  const [caption, setCaption] = useState(longCaption ? 'A beautiful ordinary life with room for family, meaningful work and time together.' : 'Freedom Through Creation');
  const [statement, setStatement] = useState('My RevenueCat dashboard shows 10,000 active users for Anchor. The app is thriving in the app store, making a real impact, and I am working on the beach with my family. There is time to enjoy what we have built together.');
  return <V2SavedVision {...identity} anchorIntention="Anchor has ten thousand users" tiles={tiles.slice(0, count)} description={statement}
    annotation={caption} onUpdateAnnotation={async value => { setCaption(value); return true; }}
    onBack={onClose} onVisualize={noop} onChart={noop}
    chartSummary={noChart ? null : { courseId: 'qa', waypointNumber: longWaypoint ? 4 : 1, total: 5, waypointTitle: longWaypoint ? 'Build a steady weekly rhythm with meaningful time together as a family' : 'First thousand active users', oneMoveTitle: null, isFinished: false, destination: 'Ten thousand users' }}
    onUpdateDescription={async value => { setStatement(value); return true; }} onReorder={saved} onRemove={saved}
    onAddPhoto={noop} onAddGenerate={noop} onReplace={async () => undefined} onRegenerate={noop} canGenerateMore onArchive={saved} />;
}

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
/** The photo-first describe screen with state held locally, so QA can see empty, photo set, and photo plus description. */
function PhotoPathLab({ mode, photo, text, onBack, ...identity }: { mode: 'create' | 'add'; photo: string | null; text: string; onBack: () => void; anchorIntention: string; anchorCategory: string; anchorArt: any }) {
  const [startPhoto, setStartPhoto] = useState<VisionStartPhoto | null>(photo ? { uri: photo, mimeType: 'image/jpeg' } : null);
  const [path, setPath] = useState<VisionInputPath>('photo');
  const [description, setDescription] = useState(text);
  return <VisionMomentInput {...identity} mode={mode} anchorId="qa-fixture" description={description} onChangeDescription={setDescription}
    startPhotoEnabled startPhoto={startPhoto} onChangeStartPhoto={setStartPhoto} inputPath={path} onChangeInputPath={setPath} onBack={onBack} onSubmit={() => undefined} />;
}

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
/** Visual fixture: the production coaching and choice components, a 36-second simulated job. */
function PolishLab({ identity, candidates, onClose }: { identity: any; candidates: VisionGenerationCandidate[]; onClose: () => void }) {
  const arrival = useVisionImageArrival();
  const [step, setStep] = useState<'method' | 'prompt' | 'wait' | 'saved'>('method');
  const [prompt, setPrompt] = useState('');
  const [ready, setReady] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => {
    if (step !== 'wait') return;
    setReady(false);
    const timer = setTimeout(() => setReady(true), 36000);
    return () => clearTimeout(timer);
  }, [step]);
  if (step === 'method') return <VisionMethodStage testID="qa-polish" onBack={onClose} onChoose={() => setStep('prompt')} />;
  if (step === 'prompt') return <VisionMomentInput {...identity} anchorId="qa-fixture" mode="create" description={prompt} onChangeDescription={setPrompt}
    initialDescription={prompt} onBack={() => setStep('method')} onSubmit={async value => { setPrompt(value); setStep('wait'); }} />;
  if (step === 'saved') return <V2SavedVision {...identity} tiles={[{ ...tiles[0], imageUrl: chosen }]} description={prompt}
    onBack={onClose} onVisualize={noop} onChart={noop} onUpdateDescription={saved} onReorder={saved} onRemove={saved}
    onAddPhoto={noop} onAddGenerate={noop} onReplace={async () => undefined} onRegenerate={noop} canGenerateMore onArchive={saved} />;
  const job = { id: 'qa-polish-job', kind: 'SCENE', status: ready ? 'COMPLETE' : 'RUNNING', stage: ready ? 'complete' : 'creating_images',
    setNumber: 1, retryCount: 0, error: null, candidates: ready ? candidates.map((value, index) => ({ ...value, sortOrder: index })) : [] } as unknown as VisionGenerationJob;
  return <VisionTwoUpStage {...identity} job={job} onBack={() => setStep('prompt')} onEditDescription={() => setStep('prompt')}
    onSelect={(candidate, selection) => {
      if (candidate.imageUrl && selection.image) {
        arrival?.begin(candidate.imageUrl, selection.image, selection.anchor ? { ...identity.anchorArt, rect: selection.anchor } : undefined);
        arrival?.resolve(candidate.imageUrl);
      }
      setChosen(candidate.imageUrl ?? null);
      setStep('saved');
    }} />;
}

export function VisionVisualQADevHost() {
  const [surface, setSurface] = useState<string | null>(null);
  const frameSample = useSharedValue({ count: 0, sum: 0, slow: 0, max: 0 });
  useEffect(() => { frameSample.value = { count: 0, sum: 0, slow: 0, max: 0 }; }, [surface, frameSample]);
  const reportFrames = (sample: { count: number; sum: number; slow: number; max: number }) => {
    console.info('[VISION_QA_FRAMES]', JSON.stringify({ surface, frames: sample.count, averageMs: sample.sum / sample.count,
      over20ms: sample.slow, maxMs: sample.max, fixture: true, build: 'development' }));
  };
  useFrameCallback(frame => {
    if (!surface || frame.timeSincePreviousFrame === null) return;
    const dt = frame.timeSincePreviousFrame;
    const previous = frameSample.value;
    const next = { count: previous.count + 1, sum: previous.sum + dt, slow: previous.slow + (dt > 20 ? 1 : 0), max: Math.max(previous.max, dt) };
    if (next.sum >= 10000) {
      runOnJS(reportFrames)(next);
      frameSample.value = { count: 0, sum: 0, slow: 0, max: 0 };
    } else frameSample.value = next;
  });
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
    // Exercise the real session and completion without writing a fixture session to the user's account.
    content = finished ? <V2FocusCompleteScreen anchor={qaAnchor} durationSeconds={qaDuration} practiceTitle="Visualize"
      enterFrom="cream" sessionSaved={false} onDone={close} onAgain={() => { setFinished(false); setRun(null); }} />
      : run ? <V2CinematicSessionScreen anchor={qaAnchor} accountId={null} tiles={run.prepared.assets.tiles} statement={description} visionId="qa-vision"
        durationSeconds={isV2VisualizeDuration(run.durationSeconds) ? run.durationSeconds : 60} voice={qaVoice} ambient={false} haptics={run.haptics} source="practice_hub"
        prepared={run.prepared} onExit={close} onContinue={() => setFinished(true)} />
      : <V2VisualizePrepareScreen key={`${surface}-${qaDuration}`} anchor={qaAnchor} statement={description} visionId="qa-vision" tiles={sessionTiles.slice(0, count)} initialDuration={qaDuration} onBack={close} onOpenVision={noop} onBegin={setRun} />;
  } else if (surface?.startsWith('ceremony')) content = <VisionImageArrivalProvider key={surface}><CeremonyLab identity={identity} photo={surface.includes('photo')} onClose={close} /></VisionImageArrivalProvider>;
  else if (surface?.startsWith('parity')) content = <ParityLab key={surface} identity={identity} onClose={close} count={Number(surface.split('-')[1]) || 3} longCaption={surface.includes('long')} noChart={surface.includes('empty')} longWaypoint={surface.includes('waypoint')} />;
  else if (surface === 'polish') content = <VisionImageArrivalProvider><PolishLab identity={identity} candidates={candidates} onClose={close} /></VisionImageArrivalProvider>;
  else if (surface === 'handoff') content = <VisionImageArrivalProvider><HandoffLab identity={identity as any} candidates={candidates} onClose={close} /></VisionImageArrivalProvider>;
  else if (surface?.startsWith('twoup')) {
    const variant = surface.split('-')[1] ?? '2';
    const job = variant === '0' ? twoUp('RUNNING', 0) : variant === '1' ? twoUp('PARTIAL', 1) : variant === 'fail' ? twoUp('FAILED', 1) : twoUp('COMPLETE', 2);
    content = <VisionTwoUpStage anchorIntention={identity.anchorIntention} anchorArt={identity.anchorArt} job={job} onBack={close} onSelect={() => close()} onRetry={noop} onEditDescription={noop} />;
  } else if (surface === 'intro') content = <VisionIntroStage {...identity} onBack={close} onStartCreate={() => setSurface('method')} testID="qa" />;
  else if (surface === 'method') content = <VisionMethodStage onBack={() => setSurface('intro')} onChoose={path => setSurface(path === 'photos' ? 'method' : 'create')} testID="qa" />;
  else if (surface?.startsWith('photo-path')) content = <PhotoPathLab {...identity} mode={surface.includes('add') ? 'add' : 'create'} photo={surface.includes('set') || surface.includes('text') ? tiles[1].imageUrl! : null}
    text={surface.includes('text') ? 'The kitchen is finished, bright and quiet. The window and the old table stay.' : ''} onBack={close} />;
  else if (surface === 'create') content = <VisionMomentInput {...identity} mode="create" anchorId="qa-fixture" onBack={close} onSubmit={noop} />;
  else if (surface === 'add') content = <VisionMomentInput {...identity} mode="add" anchorId="qa-fixture" previewImageUrl={tiles[0].imageUrl} initialDescription="Working by the ocean with my family while Anchor continues to grow." onBack={close} onSubmit={noop} />;
  else if (surface === 'photo') content = <V2VisionAddPhoto {...identity} uri={tiles[0].imageUrl!} source="library" onCancel={close} onChooseAgain={noop} onConfirm={async () => null} />;
  else if (surface?.startsWith('home') || surface?.startsWith('details')) {
    const home = surface.startsWith('home');
    const count = Math.max(0, Math.min(6, Number(surface.split('-')[1] ?? '5')));
    const previewTiles = sessionTiles.slice(0, count);
    content = <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, flexGrow: 1, backgroundColor: home ? colors.ink.base : colors.canvas }}>
      <Text style={{ ...typography.headingMD, color: home ? colors.paper : colors.text.primary }}>QA fixture · {surface}</Text>
      {home ? <V2HomeVisionSection vision={{ state: 'ready', visionId: 'qa', tiles: previewTiles, previewText: description, seenToday: false }} categoryColor="#CE6091" onOpenVision={noop} /> :
        <View style={{ marginTop: 24 }}><VisionBoardPreview tiles={previewTiles} variant="details" accent="#CE6091" onPress={noop} /></View>}
    </ScrollView>;
  }
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
