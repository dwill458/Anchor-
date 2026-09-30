import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Asset } from 'expo-asset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cancelAnimation, Easing, ReduceMotion, runOnJS, useAnimatedReaction, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import { runOnUI } from 'react-native-worklets';
import { Skia, useImage } from '@shopify/react-native-skia';
import type { Anchor } from '@/types';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { anchorArtworkSvg } from '@/components/v2/anchors/anchorPresentation';
import { VisionBoardScene } from '@/components/v2/vision/board/VisionBoardScene';
import { useVisionBoardScene } from '@/components/v2/vision/board/useVisionBoardScene';
import { BOARD_ATTACHMENT_ART, BOARD_CARD_PIN, BOARD_DECOR_IMAGES, BOARD_FRAME_IMAGES, VISION_BOARD_IMAGES } from '@/components/v2/vision/board/visionBoardAssets';
import { boardAttachmentFor, boardSizeForWidth, toSceneRect, VISION_BOARD_MAX_IMAGES } from '@/components/v2/vision/board/visionBoardLayouts';
import { useV2ReduceMotion } from '@/hooks/v2';
import { typography } from '@/theme/v2';
import { photoWindow, rotatedChild, type Rect } from './cinematicGeometry';
import { SIGNATURE_BEATS, controlAction, signatureGeometry, signaturePlaybackRange } from './signatureMotion';
import { SignatureStage } from './SignatureStage';

type Props = { anchor: Anchor; tiles: V2VisionTile[]; onClose: () => void };
const marks = [['Board', 0], ['Breakout', 3000], ['Immersed', 6000], ['Compress', 11000], ['Anchor', 15000], ['Return', 17000], ['Board restored', 21000]] as const;
const boardAssets = [...Object.values(VISION_BOARD_IMAGES), ...Object.values(BOARD_FRAME_IMAGES),
  ...Object.values(BOARD_DECOR_IMAGES), ...Object.values(BOARD_ATTACHMENT_ART).map(value => value.source), BOARD_CARD_PIN] as number[];

/** Development-only evidence harness. Uses account data; never records a practice. */
export function VisualizeSignaturePrototype(props: Props) {
  const [attempt, setAttempt] = useState(0);
  // Lock account content for the life of the reel, including during reload/retry.
  const [snapshot] = useState(() => ({ anchor: props.anchor, tiles: props.tiles.filter(tile => tile.imageUrl).slice(0, VISION_BOARD_MAX_IMAGES) }));
  const viewport = useWindowDimensions();
  if (!snapshot.tiles.length) return <View style={styles.empty}><Text style={styles.copy}>No Vision images available.</Text><Control label="Close" onPress={props.onClose} /></View>;
  return <PrototypeRun key={`${attempt}:${viewport.width}:${viewport.height}`} {...snapshot} onClose={props.onClose} onRetry={() => setAttempt(value => value + 1)} />;
}

function PrototypeRun({ anchor, tiles, onClose, onRetry }: Props & { onRetry: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useV2ReduceMotion();
  const viewport = useMemo(() => ({ width, height }), [width, height]);
  const scene = useMemo(() => boardSizeForWidth(width * 2), [width]);
  const board = useVisionBoardScene(tiles, scene);
  const [markLocal, setMarkLocal] = useState<Rect | null>(null);
  const onMarkLayout = useCallback((rect: Rect) => setMarkLocal(previous => previous &&
    Math.abs(previous.x - rect.x) < 0.01 && Math.abs(previous.y - rect.y) < 0.01 && previous.width === rect.width && previous.height === rect.height ? previous : rect), []);
  const card = useMemo(() => toSceneRect(board.layout.card, scene), [board.layout.card, scene]);
  const mark = useMemo(() => markLocal ? rotatedChild(card, markLocal) : null, [card, markLocal]);
  const photo = useMemo(() => photoWindow(toSceneRect(board.layout.photos[0], scene), board.layout.photos[0].frame), [board.layout.photos, scene]);
  const svgText = anchorArtworkSvg(anchor);
  const svg = useMemo(() => {
    try { return svgText?.trim() ? Skia.SVG.MakeFromString(svgText) : null; } catch { return null; }
  }, [svgText]);
  const [error, setError] = useState<string | null>(null);
  const handleImageError = useCallback(() => setError('A prototype image could not load. Retry before playing.'), []);
  const image = useImage(tiles[0].imageUrl, handleImageError);
  const frameImage = useImage(BOARD_FRAME_IMAGES[board.layout.photos[0].frame] as number, handleImageError);
  const attachmentImage = useImage(BOARD_ATTACHMENT_ART[boardAttachmentFor(tiles[0].sceneId)].source as number, handleImageError);
  const [assetsReady, setAssetsReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => { if (mounted) setError('Asset preparation timed out. Retry before playing.'); }, 20000);
    Promise.all([Asset.loadAsync(boardAssets), ...tiles.map(tile => Image.prefetch(tile.imageUrl!))])
      .then(results => {
        if (!mounted) return;
        clearTimeout(timeout);
        if (results.some(result => result === false)) setError('A board image could not load. Retry before playing.');
        else setAssetsReady(true);
      }).catch(() => { clearTimeout(timeout); if (mounted) handleImageError(); });
    return () => { mounted = false; clearTimeout(timeout); };
  }, [handleImageError, tiles]);
  const elapsed = useSharedValue(0);
  const playing = useSharedValue(false);
  const [running, setRunning] = useState(false);
  const [position, setPosition] = useState(0);
  const [chrome, setChrome] = useState(true);
  const samples = useSharedValue({ count: 0, sum: 0, worst: 0, over20: 0 });
  const [stats, setStats] = useState({ count: 0, sum: 0, worst: 0, over20: 0 });
  const finish = useCallback(() => { setRunning(false); setPosition(SIGNATURE_BEATS.end); setChrome(true); }, []);
  useAnimatedReaction(() => elapsed.value >= SIGNATURE_BEATS.end, (done, wasDone) => {
    if (done && !wasDone) { playing.value = false; runOnJS(finish)(); }
  });
  useFrameCallback(frame => {
    if (!playing.value || frame.timeSincePreviousFrame == null) return;
    const ms = frame.timeSincePreviousFrame;
    const previous = samples.value;
    samples.value = { count: previous.count + 1, sum: previous.sum + ms, worst: Math.max(previous.worst, ms), over20: previous.over20 + (ms > 20 ? 1 : 0) };
  });
  const updatePausedPosition = useCallback((at: number) => {
    setRunning(false); setPosition(at); setStats(samples.value);
  }, [samples]);
  const pauseOnUI = useMemo(() => runOnUI(() => {
    'worklet';
    cancelAnimation(elapsed);
    playing.value = false;
    runOnJS(updatePausedPosition)(elapsed.value);
  }), [elapsed, playing, updatePausedPosition]);
  const pause = useCallback(() => pauseOnUI(), [pauseOnUI]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') pause(); });
    return () => { subscription.remove(); cancelAnimation(elapsed); playing.value = false; };
  }, [elapsed, pause, playing]);
  useEffect(() => { if (!running) { setStats(samples.value); return; }
    const timer = setInterval(() => setPosition(elapsed.value), 500);
    return () => clearInterval(timer);
  }, [running, elapsed, samples]);
  const ready = Boolean(assetsReady && image && frameImage && attachmentImage && svg && mark && !error);
  const startOnUI = useMemo(() => runOnUI((fromMs: number, duration: number) => {
    'worklet';
    cancelAnimation(elapsed);
    elapsed.value = fromMs;
    playing.value = true;
    samples.value = { count: 0, sum: 0, worst: 0, over20: 0 };
    elapsed.value = withTiming(SIGNATURE_BEATS.end, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }), [elapsed, playing, samples]);
  const seekOnUI = useMemo(() => runOnUI((at: number) => {
    'worklet';
    cancelAnimation(elapsed);
    playing.value = false;
    elapsed.value = at;
  }), [elapsed, playing]);
  const seek = (ms: number) => {
    const { start } = signaturePlaybackRange(ms);
    seekOnUI(start);
    setRunning(false);
    setPosition(start);
    setStats(samples.value);
  };
  const play = (requestedFromMs = position) => {
    if (!ready) return;
    const fromMs = requestedFromMs >= SIGNATURE_BEATS.end ? 0 : requestedFromMs;
    const range = signaturePlaybackRange(fromMs);
    setChrome(false);
    setPosition(range.start);
    setRunning(range.start < SIGNATURE_BEATS.end);
    startOnUI(range.start, range.duration);
  };
  const geometry = useMemo(() => mark ? signatureGeometry(scene, viewport, photo, mark) : null, [scene, viewport, photo, mark]);
  const noPhoto = useSharedValue(0);
  const measurement = useMemo(() => ({ photoId: tiles[0].sceneId, photoOpacity: noPhoto, onMarkLayout }), [noPhoto, onMarkLayout, tiles]);

  return <View style={styles.root}>
    <StatusBar hidden />
    {/* Lay out the actual card before calculating its mark transform. */}
    {!ready && <View pointerEvents="none" style={{ position: 'absolute', opacity: 0, width: scene.width, height: scene.height }}>
      <VisionBoardScene scene={scene} roster={board.roster} entering={board.entering} layout={board.layout} shared={board.shared}
        initialRectFor={board.initialRectFor} intention={anchor.intentionText} category={anchor.category} art={{ svg: svgText }}
        reduceMotion cinematic={measurement} />
    </View>}
    {ready && geometry && mark && image && frameImage && attachmentImage && svg && <SignatureStage tiles={tiles}
      intention={anchor.intentionText} category={anchor.category} svgText={svgText} scene={scene} viewport={viewport} mark={mark}
      geometry={geometry} image={image} frameImage={frameImage} attachmentImage={attachmentImage} svg={svg}
      elapsed={elapsed} reduced={reduced} onMarkLayout={onMarkLayout} />}
    <Pressable style={StyleSheet.absoluteFill} onPress={() => setChrome(value => !value)} accessibilityRole="button" accessibilityLabel="Show or hide prototype controls" />
    {(chrome || !ready) && <View style={[styles.panel, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.title}>Visualize · transition prototype</Text>
      <Text style={styles.copy}>Real Vision · no practice recorded{reduced ? ' · Reduced Motion' : ''}</Text>
      {image && <Text style={styles.copy}>Selected image: {image.width()}×{image.height()} · {(image.width() * image.height() * 4 / 1048576).toFixed(1)} MiB RGBA estimate (not process memory)</Text>}
      {!ready && !error && svg && <ActivityIndicator color="#EDE0CA" />}
      {(!svg || error) && <Text style={styles.copy}>{!svg ? 'The actual Anchor SVG is unavailable or cannot be rendered.' : error}</Text>}
      <View style={styles.row}><Control label="Close" onPress={onClose} /><Control label="Retry assets" onPress={onRetry} /></View>
    </View>}
    {chrome && ready && <View style={[styles.bottom, { paddingBottom: insets.bottom + 8 }]}>
      <Text style={styles.copy}>{(position / 1000).toFixed(2)}s / 24s · {stats.count ? `${(stats.sum / stats.count).toFixed(1)}ms mean · ${stats.worst.toFixed(1)}ms max · ${stats.over20}/${stats.count} >20ms` : 'Play to sample UI frame intervals'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{marks.map(([label, ms]) => <Control key={label} label={label} onPress={() => seek(ms)} />)}</ScrollView>
      <View style={styles.row}>
        <Control label="−1 frame" onPress={() => seek(position - 1000 / 60)} />
        <Control label={running ? 'Pause' : 'Play'} onPress={running ? pause : () => play(position)} />
        <Control label="+1 frame" onPress={() => seek(position + 1000 / 60)} />
        <Control label="Replay" onPress={() => play(0)} />
      </View>
    </View>}
  </View>;
}

function Control({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={controlAction(onPress)} style={styles.button}><Text style={styles.copy}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D10' },
  empty: { flex: 1, backgroundColor: '#060D10', alignItems: 'center', justifyContent: 'center' },
  panel: { position: 'absolute', top: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(6,13,16,0.92)' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, gap: 8, backgroundColor: 'rgba(6,13,16,0.92)' },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  button: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderWidth: 1, borderColor: '#455158', borderRadius: 8, margin: 3 },
  title: { ...typography.headingSM, color: '#F4E8D4' },
  copy: { ...typography.caption, color: '#D7D4CE' },
});
