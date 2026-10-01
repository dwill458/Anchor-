import { useEffect, useState } from 'react';
import { Image, Linking, Modal, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { V2SavedVision } from '@/components/v2/vision/V2SavedVision';
import { VisionCandidateSelection } from '@/components/v2/vision/VisionCandidateSelection';
import { VisionGenerationBoard } from '@/components/v2/vision/VisionGenerationBoard';
import { VisionMomentInput } from '@/components/v2/vision/VisionMomentInput';
import { VisionAddSheet } from '@/components/v2/vision/VisionAddSheet';
import { V2VisionAddPhoto } from '@/components/v2/vision/V2VisionAddPhoto';
import { VisionBoardPreview } from '@/components/v2/vision/VisionBoardPreview';
import { V2HomeVisionSection } from '@/components/v2/home/V2HomeVisionSection';
import { V2_SAMPLE_ANCHOR_SVGS } from '@/constants/v2';
import { useAnchorStore } from '@/stores/anchorStore';
import { anchorRenderProps } from '@/components/v2/anchors/anchorPresentation';
import { colors, typography } from '@/theme/v2';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
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

/** Open with anchor://vision-visual-qa?surface=2 (0/1/2/3/6/add/generate/choose/home/details/photo/sources). */
export function VisionVisualQADevHost() {
  const [surface, setSurface] = useState<string | null>(null);
  const anchor = useAnchorStore(state => state.anchors[0]);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    const open = ({ url }: { url: string }) => {
      if (!url.startsWith('anchor://vision-visual-qa')) return;
      setSurface(url.split('surface=')[1]?.split('&')[0] ?? '2');
    };
    const listener = Linking.addEventListener('url', open);
    void Linking.getInitialURL().then(url => { if (url) open({ url }); });
    return () => listener.remove();
  }, []);
  const identity = { anchorIntention: anchor?.intentionText ?? 'Anchor has ten thousand users', anchorCategory: anchor?.category ?? 'desire',
    anchorArt: anchor ? anchorRenderProps(anchor) : { svg: V2_SAMPLE_ANCHOR_SVGS.medium, category: 'desire' } };
  const close = () => setSurface(null);
  const candidates = tiles.slice(0, 2).map((tile, i) => ({ id: tile.id, imageUrl: tile.imageUrl, assetId: `qa-asset-${i}`, prompt: '', status: 'SUCCEEDED' })) as VisionGenerationCandidate[];
  let content;
  if (surface === 'geometry' && anchor) return <Modal visible animationType="none" onRequestClose={close}><SavedImageGeometry anchorId={anchor.id} /></Modal>;
  if (surface === 'add') content = <VisionMomentInput {...identity} mode="add" anchorId="qa-fixture" previewImageUrl={tiles[0].imageUrl} initialDescription="Working by the ocean with my family while Anchor continues to grow." onBack={close} onSubmit={noop} />;
  else if (surface === 'choose') content = <VisionCandidateSelection {...identity} candidates={candidates} onBack={close} onConfirm={noop} onRegenerate={noop} />;
  else if (surface === 'generate') content = <VisionGenerationBoard {...identity} mode="add" job={null} onBack={close} />;
  else if (surface === 'photo') content = <V2VisionAddPhoto {...identity} uri={tiles[0].imageUrl!} source="library" onCancel={close} onChooseAgain={noop} onConfirm={async () => null} />;
  else if (surface === 'home' || surface === 'details') content = <ScrollView contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, flexGrow: 1, backgroundColor: surface === 'home' ? colors.ink.base : colors.canvas }}>
    <Text style={{ ...typography.headingMD, color: surface === 'home' ? colors.paper : colors.text.primary }}>QA fixture · {surface}</Text>
    {surface === 'home' ? <V2HomeVisionSection vision={{ state: 'ready', visionId: 'qa', tiles, previewText: description, seenToday: false }} categoryColor="#CE6091" onOpenVision={noop} /> :
      <View style={{ marginTop: 24 }}><VisionBoardPreview tiles={tiles} statement={description} variant="details" accent="#CE6091" onPress={noop} /></View>}
  </ScrollView>;
  else content = <V2SavedVision {...identity} key={surface} tiles={tiles.slice(0, Number(surface) || 0)} description={description} onBack={close} onVisualize={noop} onChart={noop}
    chartSummary={{ courseId: 'qa', waypointNumber: 1, total: 5, waypointTitle: 'First thousand active users', oneMoveTitle: null, isFinished: false, destination: 'Ten thousand users' }}
    onUpdateDescription={saved} onReorder={saved} onRemove={saved} onAddPhoto={noop} onAddGenerate={noop} onReplace={async () => undefined} onRegenerate={noop} canGenerateMore onArchive={saved} />;
  return <Modal visible={surface !== null} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      {surface ? content : null}
      {surface === 'sources' ? <VisionAddSheet visible onClose={close} onChoose={noop} /> : null}
    </GestureHandlerRootView>
  </Modal>;
}
