import type { ViewInstance } from 'react-native';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolateColor, runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { VISION_GOLD } from '../VisionPaperChrome';
import { CEREMONY, ceremonyDuration } from '../ceremony/VisionDevelop';
import { useVisionImageArrival } from '../VisionImageArrival';
import { colors, typography } from '@/theme/v2';
import { VisionImageEdge } from '../VisionImageEdge';
import { VisionPhotograph, type VisionFocalFrame } from '../VisionPhotograph';
import { panVisionFocal, resolveVisionFocal, visionCoverFrame, type VisionFocal } from '../visionPhotoFocus';
import { planCaption, CAPTION_PAD } from './visionCaptionLayout';
import { VisionTapeOverlay } from '../material/VisionTapeOverlay';
import { VisionPolaroidFrame } from '../material/VisionPolaroidFrame';
import { visionMaterials } from '@/assets/vision/materials/manifest';
import type { VisionPolaroidVariant } from '@/assets/vision/materials/manifest';
import { VISION_CAPTION_COLOR, VISION_CAPTION_FONTS, VISION_PHOTO, VISION_SHADOW, VISION_TAPE } from '../material/visionMaterialTokens';
import { BOARD_CAPTION_BAND_FRACTION, BOARD_FRAME_WINDOW, type BoardTape } from './visionBoardLayouts';
import { boardDelay, boardRecomposeEasing, boardSpring, boardTiming, VISION_BOARD_MOTION as MOTION } from './visionBoardMotion';
import { boardSlotAtPoint, swapBoardOrder } from './visionBoardReorder';
import type { BoardSlotRect, VisionBoardShared } from './useVisionBoardScene';

const W = BOARD_FRAME_WINDOW;
/** Photographs fill their mount's aperture; the mount carries the border. */
const BLEED = 0;
const CAPTION_TOUCH_HEIGHT = 30;
/** The polaroid art's aperture ends here, as a share of the print's height (0.70 on the wide-bottom variant). */
const windowBottomFraction = (variant: VisionPolaroidVariant) => (variant === 'wide-bottom' ? 0.7 : 0.78);

export type VisionBoardPhotoProps = {
  materialMode?: 'legacy' | 'photographic';
  frameVariant?: VisionPolaroidVariant;
  caption?: string;
  /**
   * Present on the Vision board only. It is the on-screen size of the scene at rest (scene px to points) and switches on
   * the board's caption sizing and positioning. Visualize and the share image leave it off and keep their own.
   */
  displayScale?: number;
  /** Where the photograph sits in its window, 0..1; absent means the automatic upper-biased position. Board only. */
  focal?: VisionFocal | null;
  /** While true, dragging the photograph repositions it inside its window instead of moving the print. */
  repositioning?: boolean;
  onFocalCommit?: (sceneId: string, focal: VisionFocal) => void;
  arriving?: boolean;
  sceneId: string;
  imageUrl: string | null;
  uploaded?: boolean;
  displayAspect?: number;
  hero?: boolean;
  detailEdges?: boolean;
  accessibilityLabel: string;
  initialRect: BoardSlotRect | null;
  entering: boolean;
  exiting: boolean;
  shared: VisionBoardShared;
  reduceMotion: boolean;
  /** Taps and drags are only wired on the interactive board, never in Visualize. */
  interactive: boolean;
  dragEnabled: boolean;
  onPress?: (sceneId: string) => void;
  onCaptionEdit?: (sceneId: string) => void;
  onDragActive?: (active: boolean) => void;
  onSwap?: () => void;
  onOrderCommit?: (order: string[]) => void;
  onExited?: (sceneId: string) => void;
  onPhotoAssetReady?: (sceneId: string) => void;
  onPhotoAssetError?: (sceneId: string) => void;
  onMove?: (sceneId: string, direction: -1 | 1) => void;
  /** Board only: opens position choosing for this photograph (an accessibility action and the focus control). */
  onMoveRequest?: (sceneId: string) => void;
  onTeachingMotionChange?: (sceneId: string, moving: boolean) => void;
  canMoveEarlier?: boolean;
  canMoveLater?: boolean;
  testID?: string;
  /** Optional cinematic owner; ordinary board gestures and presence remain unchanged. */
  cinematicOpacity?: SharedValue<number>;
  /** 0 to 1: the paper edges travel from cream to ink (the Visualize setup darkening into its session). */
  edgeDarken?: SharedValue<number>;
  /** Tape strips holding this print to the board. They move with the print. */
  tapes?: readonly BoardTape[];
};

function kindWeight(kind: number, target: number) {
  'worklet';
  return kind === target ? 1 : 0;
}

/** A strip of tape across the top edge of a print. Its width follows the print on the UI thread. */
function PrintTape({ tape, width, testID, photographic = false }: { tape: BoardTape; width: SharedValue<number>; testID?: string; photographic?: boolean }) {
  const style = useAnimatedStyle(() => {
    const tapeWidth = tape.width * width.value;
    return { left: tape.offset * width.value - tapeWidth / 2, width: tapeWidth };
  });
  return (
    <Animated.View pointerEvents="none" testID={testID} style={[styles.tapeHolder, style]}>
      <VisionTapeOverlay photographic={photographic} width={1} tone={tape.tone} rotation={tape.rotation} style={styles.tapeFill} />
    </Animated.View>
  );
}

/** A real photograph; stable UI-thread geometry preserves gestures and recomposition. */
export const VisionBoardPhoto = memo(function VisionBoardPhoto({
  sceneId, imageUrl, arriving = false, caption, displayScale, focal = null, repositioning = false, onFocalCommit, uploaded = false, displayAspect = 1.12, hero = false, detailEdges = false, accessibilityLabel, initialRect, entering, exiting, shared, reduceMotion,
  interactive, dragEnabled, onPress, onCaptionEdit, onDragActive, onSwap, onOrderCommit, onExited, onPhotoAssetReady, onPhotoAssetError, onMove, onMoveRequest, onTeachingMotionChange,
  canMoveEarlier = false, canMoveLater = false, testID, cinematicOpacity, edgeDarken, tapes = [], materialMode = 'legacy', frameVariant = 'classic',
}: VisionBoardPhotoProps) {
  const photographic = materialMode === 'photographic';
  const arrival = useVisionImageArrival();
  const setPrint = arrival?.setPrints?.find(item => item.sceneId === sceneId);
  const setPhase = setPrint?.phase;
  const flightPresence = useSharedValue(setPrint && setPhase !== 'landed' && setPhase !== 'pinned' && setPhase !== 'failed' ? 0 : 1);
  const captionPresence = useSharedValue(setPrint ? 0 : 1);
  const pin = useSharedValue(0);
  useEffect(() => {
    if (setPrint) {
      flightPresence.value = setPhase === 'landed' || setPhase === 'pinned' || setPhase === 'failed' ? 1 : 0;
      if (setPhase === 'landed') pin.value = withTiming(1, { duration: ceremonyDuration(CEREMONY.pinDropMs, reduceMotion) });
      if (setPhase === 'pinned' || setPhase === 'failed') captionPresence.value = withTiming(1, { duration: reduceMotion ? 0 : 240 });
      return;
    }
    if (!arriving) return;
    pin.value = withDelay(reduceMotion ? 0 : CEREMONY.pinDelayMs, withTiming(1, { duration: ceremonyDuration(CEREMONY.pinDropMs, reduceMotion) }));
    const timer = setTimeout(() => { void safeHaptics.impact(ImpactFeedbackStyle.Light); }, reduceMotion ? 180 : CEREMONY.pinDelayMs + CEREMONY.pinDropMs);
    return () => clearTimeout(timer);
  }, [arriving, reduceMotion, setPhase]);
  const pinStyle = useAnimatedStyle(() => ({ opacity: pin.value, transform: reduceMotion ? [] : [{ translateY: -40 * (1 - pin.value) }, { scale: 1.6 - .6 * pin.value }] }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: captionPresence.value }));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failedFallbackReady = useRef<string | null>(null);
  // Signed image URLs change on every read, so a reorder used to hand each photo a new source and reload it,
  // which left the board blank while the images decoded again. While the path is unchanged the photo keeps
  // the URL it is showing; a URL that fails to load is replaced by the current one.
  const [shownUrl, setShownUrl] = useState<string | null>(imageUrl ?? null);
  const pathOf = (url: string | null) => (url ?? '').split('?')[0];
  const sameImage = pathOf(shownUrl) === pathOf(imageUrl ?? null);
  const displayUrl = sameImage ? shownUrl : (imageUrl ?? null);
  const imageFailed = Boolean(displayUrl && failedUrl === displayUrl);
  const retryImage = () => {
    setShownUrl(imageUrl ?? null);
    setFailedUrl(null);
  };
  useEffect(() => { if (!sameImage) setShownUrl(imageUrl ?? null); }, [imageUrl, sameImage]);
  useEffect(() => {
    if (!imageUrl) onPhotoAssetReady?.(sceneId);
  }, [imageUrl, onPhotoAssetReady, sceneId]);
  useEffect(() => {
    if (!imageFailed || !displayUrl || failedFallbackReady.current === displayUrl) return;
    // Foreground failure replaces VisionPhotograph (and its blur layer) with
    // the final unavailable card. Signal only after that fallback commits.
    requestAnimationFrame(() => {
      if (failedUrl === displayUrl && imageUrl && pathOf(displayUrl) === pathOf(imageUrl)) {
        failedFallbackReady.current = displayUrl;
        onPhotoAssetReady?.(sceneId);
      }
    });
  }, [displayUrl, failedUrl, imageFailed, imageUrl, onPhotoAssetReady, sceneId]);
  const imageRef = useRef<ViewInstance>(null);
  // The flight lands only once this photograph has decoded. Landing on layout let the arrival
  // overlay dissolve over a frame that was still blank, which read as a cream flash.
  const decodedUrl = useRef<string | null>(null);
  const landImage = () => {
    if (setPrint) imageRef.current?.measureInWindow?.((x, y, width, height) => arrival?.landSet?.(sceneId, { x, y, width, height }));
    if (imageUrl && arrival?.url === imageUrl) imageRef.current?.measureInWindow?.((x, y, width, height) => arrival.land(imageUrl, { x, y, width, height }));
  };
  const handleDecoded = () => {
    decodedUrl.current = imageUrl ?? null;
    landImage();
  };
  // A photograph that decoded before the flight began lands at once; otherwise it lands when it decodes.
  useEffect(() => { if (imageUrl && decodedUrl.current === imageUrl) landImage(); }, [imageUrl, arrival?.url, setPrint?.sceneId]);
  const start = initialRect ?? { x: 0, y: 0, width: 1, height: 1, rotation: 0, zIndex: 12, frame: 0 };
  const x = useSharedValue(start.x);
  const y = useSharedValue(start.y);
  const width = useSharedValue(start.width);
  const height = useSharedValue(start.height);
  // The legacy caption lives in the mount's band at the foot of the print. The band is a fraction of the print's height.
  const captionPositionStyle = useAnimatedStyle(() => ({ top: height.value - height.value * BOARD_CAPTION_BAND_FRACTION / 2 - CAPTION_TOUCH_HEIGHT / 2 }));

  // Board only: where the photograph sits in its window. `-1` means automatic (upper-biased) until the person sets one.
  const boardMode = displayScale !== undefined && displayScale > 0;
  const focalX = useSharedValue(focal ? focal.x : -1);
  const focalY = useSharedValue(focal ? focal.y : -1);
  const photoAspect = useSharedValue(0);
  const windowWidth = useDerivedValue(() => width.value * 0.88);
  const windowHeight = useDerivedValue(() => height.value * (frameVariant === 'wide-bottom' ? 0.64 : 0.72));
  const focalFrame = useMemo<VisionFocalFrame>(() => ({ windowWidth, windowHeight, focalX, focalY, aspect: photoAspect }),
    [windowWidth, windowHeight, focalX, focalY, photoAspect]);
  useEffect(() => {
    if (repositioning) return;
    focalX.value = focal ? focal.x : -1;
    focalY.value = focal ? focal.y : -1;
  }, [focal?.x, focal?.y, repositioning]);

  // Board only: the caption is sized in the points the person sees. The scene is drawn larger than the screen and scaled
  // down, so scene units convert by 1 / displayScale. Long captions grow the paper under the print instead of clipping.
  const captionText = caption?.trim() ?? '';
  const editableCaption = interactive && Boolean(onCaptionEdit);
  const windowBottom = windowBottomFraction(frameVariant);
  const plan = useMemo(() => {
    if (!boardMode || !initialRect) return null;
    return planCaption(captionText || (editableCaption ? 'Add caption' : ''), initialRect.width * displayScale!, initialRect.height * displayScale! * (1 - windowBottom));
  }, [boardMode, initialRect?.width, initialRect?.height, displayScale, captionText, editableCaption, windowBottom]);
  const toScene = boardMode ? 1 / displayScale! : 1;
  const extraScene = plan && captionText ? plan.extra * toScene : 0;
  const boardCaptionStyle = useAnimatedStyle(() => {
    if (!plan) return {};
    const textH = plan.textHeight * toScene, pad = CAPTION_PAD * toScene;
    const margin = height.value * (1 - windowBottom);
    const top = height.value * windowBottom + (plan.extra > 0 ? pad : Math.max(pad / 2, (margin - textH) / 2));
    return { top, left: (width.value - plan.width * toScene) / 2, width: plan.width * toScene, minHeight: textH };
  });
  // A caption that needs more room stretches only the frame art's bottom margin, so the paper, its torn edge and the
  // aperture all stay in register with the print; nothing is bolted on underneath.
  const frameTopStyle = useAnimatedStyle(() => ({ height: height.value * windowBottom }));
  const frameFootStyle = useAnimatedStyle(() => ({ top: height.value * windowBottom - 0.5, height: height.value * (1 - windowBottom) + extraScene + 0.5 }));
  const frameFootImageStyle = useAnimatedStyle(() => {
    const strip = height.value * (1 - windowBottom) + extraScene;
    const full = strip / (1 - windowBottom);
    return { height: full, top: -full * windowBottom };
  });
  const frameTopImageStyle = useAnimatedStyle(() => ({ height: height.value }));
  const frameArt = visionMaterials[`polaroid-${frameVariant}` as const].source;
  const rotation = useSharedValue(start.rotation);
  const z = useSharedValue(start.zIndex);
  const landscape = useSharedValue(kindWeight(0, start.frame));
  const portrait = useSharedValue(kindWeight(1, start.frame));
  const square = useSharedValue(kindWeight(2, start.frame));
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const lift = useSharedValue(0);
  const presence = useSharedValue(entering ? 0 : 1);
  const presenceScale = useSharedValue<number>(entering && !reduceMotion ? MOTION.recompose.enterFromScale : 1);
  const presenceLift = useSharedValue<number>(entering && !reduceMotion ? MOTION.recompose.enterFromLift : 0);
  const orderAtDragStart = useSharedValue('');
  const movedDuringHold = useSharedValue(false);
  const reduced = useSharedValue(reduceMotion);
  // Observe the real animation values; no per-frame JS work and no changes to gesture ownership.
  useAnimatedReaction(() => {
    if (!onTeachingMotionChange) return false;
    const index = shared.order.value.indexOf(sceneId);
    const slot = shared.slots.value[index];
    return exiting || !slot || shared.dragging.value === sceneId ||
      Math.abs(x.value - slot.x) > 0.1 || Math.abs(y.value - slot.y) > 0.1 ||
      Math.abs(width.value - slot.width) > 0.1 || Math.abs(height.value - slot.height) > 0.1 ||
      Math.abs(rotation.value - slot.rotation) > 0.05 || Math.abs(lift.value) > 0.001 ||
      presence.value < 0.999 || Math.abs(presenceScale.value - 1) > 0.001 || Math.abs(presenceLift.value) > 0.1 ||
      ((arriving || Boolean(setPrint)) && setPhase !== 'failed' && pin.value < 0.999);
  }, (moving, previous) => {
    if (onTeachingMotionChange && moving !== previous) runOnJS(onTeachingMotionChange)(sceneId, moving);
  }, [onTeachingMotionChange, sceneId, exiting, arriving]);
  useEffect(() => () => onTeachingMotionChange?.(sceneId, false), [sceneId, onTeachingMotionChange]);
  useEffect(() => { reduced.value = reduceMotion; }, [reduceMotion, reduced]);

  // Arrive: the others make room first, then this one is laid into its place.
  useEffect(() => {
    if (!entering) return;
    const { enterDelayMs, enterMs } = MOTION.recompose;
    if (reduceMotion) {
      presence.value = boardDelay(MOTION.reduced.recomposeMs, boardTiming(1, { duration: MOTION.reduced.recomposeMs }));
      return;
    }
    presence.value = boardDelay(enterDelayMs, boardTiming(1, { duration: enterMs * 0.7 }));
    presenceScale.value = boardDelay(enterDelayMs, boardTiming(1, { duration: enterMs, easing: boardRecomposeEasing }));
    presenceLift.value = boardDelay(enterDelayMs, boardTiming(0, { duration: enterMs, easing: boardRecomposeEasing }));
    // Mount-time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leave: lift away and fade while the board recomposes beneath.
  useEffect(() => {
    if (!exiting) return;
    const duration = reduceMotion ? MOTION.reduced.recomposeMs : MOTION.recompose.exitMs;
    const done = (finished?: boolean) => {
      'worklet';
      if (finished && onExited) runOnJS(onExited)(sceneId);
    };
    presence.value = boardTiming(0, { duration }, done);
    if (!reduceMotion) presenceScale.value = boardTiming(MOTION.recompose.exitToScale, { duration });
  }, [exiting, onExited, presence, presenceScale, reduceMotion, sceneId]);

  // Follow this photo's slot. A new composition travels on the recompose
  // curve; a swap within the same composition settles on the spring.
  useAnimatedReaction(
    () => {
      const index = shared.order.value.indexOf(sceneId);
      return { index, version: shared.layoutVersion.value, rect: index >= 0 ? shared.slots.value[index] : null };
    },
    (next, previous) => {
      if (!next.rect || shared.dragging.value === sceneId) return;
      if (!previous) return; // placed at mount
      if (previous.index === next.index && previous.version === next.version && previous.rect === next.rect) return;
      const rect = next.rect;
      const recomposing = previous.version !== next.version;
      const move = (to: number) => {
        'worklet';
        if (reduced.value) return boardTiming(to, { duration: recomposing ? MOTION.reduced.recomposeMs : MOTION.reduced.swapMs });
        return recomposing ? boardTiming(to, { duration: MOTION.recompose.moveMs, easing: boardRecomposeEasing }) : boardSpring(to);
      };
      x.value = move(rect.x);
      y.value = move(rect.y);
      width.value = move(rect.width);
      height.value = move(rect.height);
      rotation.value = move(rect.rotation);
      z.value = rect.zIndex;
      const fade = { duration: reduced.value ? 0 : MOTION.frameCrossfadeMs };
      landscape.value = boardTiming(kindWeight(0, rect.frame), fade);
      portrait.value = boardTiming(kindWeight(1, rect.frame), fade);
      square.value = boardTiming(kindWeight(2, rect.frame), fade);
    },
    [sceneId],
  );

  const settleIntoSlot = () => {
    'worklet';
    const index = shared.order.value.indexOf(sceneId);
    const rect = index >= 0 ? shared.slots.value[index] : null;
    // Carry the finger offset into the position, then settle from where it is.
    x.value += dragX.value;
    y.value += dragY.value;
    dragX.value = 0;
    dragY.value = 0;
    if (rect) {
      const settle = (to: number) => {
        'worklet';
        return reduced.value ? boardTiming(to, { duration: MOTION.reduced.swapMs }) : boardSpring(to);
      };
      x.value = settle(rect.x);
      y.value = settle(rect.y);
      width.value = settle(rect.width);
      height.value = settle(rect.height);
      rotation.value = settle(rect.rotation);
      z.value = rect.zIndex;
      landscape.value = boardTiming(kindWeight(0, rect.frame), { duration: MOTION.frameCrossfadeMs });
      portrait.value = boardTiming(kindWeight(1, rect.frame), { duration: MOTION.frameCrossfadeMs });
      square.value = boardTiming(kindWeight(2, rect.frame), { duration: MOTION.frameCrossfadeMs });
    }
    lift.value = reduced.value ? boardTiming(0, { duration: MOTION.reduced.swapMs }) : boardSpring(0);
    shared.dragging.value = '';
  };

  const pan = Gesture.Pan()
    .enabled(interactive && dragEnabled && !exiting)
    .activateAfterLongPress(MOTION.lift.longPressMs)
    .onStart(() => {
      shared.dragging.value = sceneId;
      orderAtDragStart.value = shared.order.value.join('|');
      lift.value = reduced.value ? boardTiming(1, { duration: MOTION.reduced.swapMs }) : boardSpring(1);
      if (onDragActive) runOnJS(onDragActive)(true);
    })
    .onUpdate(event => {
      if (Math.hypot(event.translationX, event.translationY) > 8) movedDuringHold.value = true;
      const scale = shared.cameraScale.value || 1;
      dragX.value = event.translationX / scale;
      dragY.value = event.translationY / scale;
      const order = shared.order.value;
      const from = order.indexOf(sceneId);
      if (from < 0) return;
      const centre = { x: x.value + width.value / 2 + dragX.value, y: y.value + height.value / 2 + dragY.value };
      const to = boardSlotAtPoint(centre, shared.slots.value, from);
      if (to >= 0) {
        shared.order.value = swapBoardOrder(order, from, to);
        if (onSwap) runOnJS(onSwap)();
      }
    })
    .onFinalize((_event, success) => {
      if (shared.dragging.value !== sceneId) return;
      settleIntoSlot();
      if (onDragActive) runOnJS(onDragActive)(false);
      const order = shared.order.value;
      if (success && onOrderCommit && order.join('|') !== orderAtDragStart.value) runOnJS(onOrderCommit)(order);
    });

  const tap = Gesture.Tap()
    .enabled(interactive && !exiting)
    .maxDuration(MOTION.lift.longPressMs - 20)
    .onEnd((_event, success) => {
      if (success && imageFailed) runOnJS(retryImage)();
      else if (success && onPress) runOnJS(onPress)(sceneId);
    });

  // Defer actions until release: focusing while the finger is down disables
  // dragging on the board. A moved hold belongs entirely to the pan gesture.
  const hold = Gesture.LongPress()
    .enabled(interactive && !exiting)
    .minDuration(MOTION.lift.longPressMs + 100)
    .maxDistance(8)
    .onBegin(() => { movedDuringHold.value = false; })
    .onEnd((_event, success) => {
      if (success && !movedDuringHold.value && onPress) runOnJS(onPress)(sceneId);
    });
  const focalStart = useSharedValue({ x: 0.5, y: 0.5 });
  const focalMoved = useSharedValue(false);
  const commitFocal = (x: number, y: number) => onFocalCommit?.(sceneId, { x, y });
  // Reposition: dragging moves the picture inside its window, in the points the finger moved on screen.
  const repositionPan = repositioning ? Gesture.Pan()
    .enabled(!exiting)
    .minDistance(2)
    .onBegin(() => {
      const w = windowWidth.value, h = windowHeight.value;
      focalStart.value = resolveVisionFocal(focalX.value, focalY.value, photoAspect.value, h > 0 ? w / h : 1);
      focalMoved.value = false;
    })
    .onStart(() => { if (onDragActive) runOnJS(onDragActive)(true); })
    .onUpdate(event => {
      const scale = shared.cameraScale.value || 1;
      const w = windowWidth.value, h = windowHeight.value;
      const frame = visionCoverFrame(photoAspect.value, w, h, focalStart.value);
      const next = panVisionFocal(focalStart.value, { x: event.translationX / scale, y: event.translationY / scale }, { x: frame.overflowX, y: frame.overflowY });
      focalX.value = next.x;
      focalY.value = next.y;
      focalMoved.value = true;
    })
    .onFinalize((_event, success) => {
      if (success && onDragActive) runOnJS(onDragActive)(false);
      if (focalMoved.value && onFocalCommit) runOnJS(commitFocal)(focalX.value, focalY.value);
      focalMoved.value = false;
    }) : null;
  const gesture = repositionPan ?? Gesture.Race(Gesture.Simultaneous(pan, hold), tap);

  const containerStyle = useAnimatedStyle(() => ({
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value + (boardMode ? extraScene : interactive && onCaptionEdit ? CAPTION_TOUCH_HEIGHT : 0),
    zIndex: z.value + (shared.dragging.value === sceneId ? 100 : 0),
    opacity: presence.value * flightPresence.value * (cinematicOpacity?.value ?? 1),
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value + presenceLift.value },
      { rotate: `${rotation.value}deg` },
      { scale: presenceScale.value * (1 + (MOTION.lift.scale - 1) * lift.value) },
    ],
  }));

  // The print is its mount: archival paper, darkening with the page when Visualize sets its edges.
  const frameStyle = useAnimatedStyle(() => ({
    width: width.value,
    height: height.value,
    backgroundColor: photographic ? 'transparent' : edgeDarken ? interpolateColor(edgeDarken.value, [0, 1], [VISION_PHOTO.mount, colors.ink.deep]) : VISION_PHOTO.mount,
  }));

  const windowStyle = useAnimatedStyle(() => {
    if (photographic) return { left: width.value * 0.06, top: height.value * 0.06, width: width.value * 0.88, height: height.value * (frameVariant === 'wide-bottom' ? 0.64 : 0.72) };
    const total = landscape.value + portrait.value + square.value || 1;
    const blend = (key: 'left' | 'top' | 'right' | 'bottom') =>
      (W.landscape[key] * landscape.value + W.portrait[key] * portrait.value + W.square[key] * square.value) / total;
    const left = blend('left') - BLEED;
    const top = blend('top') - BLEED;
    const right = blend('right') + BLEED;
    const bottom = blend('bottom') + BLEED;
    return {
      left: left * width.value,
      top: top * height.value,
      width: (right - left) * width.value,
      height: (bottom - top) * height.value,
    };
  });

  const actions = [
    { name: 'activate', label: 'Focus image' },
    ...(canMoveEarlier ? [{ name: 'moveEarlier', label: 'Move earlier' }] : []),
    ...(canMoveLater ? [{ name: 'moveLater', label: 'Move later' }] : []),
    ...(onMoveRequest ? [{ name: 'moveTo', label: 'Move to another position' }] : []),
  ];
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'activate') { if (imageFailed) retryImage(); else onPress?.(sceneId); }
    else if (event.nativeEvent.actionName === 'moveEarlier') onMove?.(sceneId, -1);
    else if (event.nativeEvent.actionName === 'moveLater') onMove?.(sceneId, 1);
    else if (event.nativeEvent.actionName === 'moveTo') onMoveRequest?.(sceneId);
  };

  const frame = (
    <Animated.View
      testID={testID}
      style={[styles.photo, photographic && styles.materialPhoto, frameStyle]}
      accessible={interactive && !exiting}
      accessibilityRole={interactive ? 'imagebutton' : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={interactive ? imageFailed ? 'Image unavailable. Double tap to retry.' : 'Double tap to bring it forward. Actions can move it.' : undefined}
      accessibilityActions={interactive ? actions : undefined}
      onAccessibilityAction={interactive ? onAccessibilityAction : undefined}
      importantForAccessibility={exiting ? 'no-hide-descendants' : 'auto'}
    >
      <Animated.View ref={imageRef} collapsable={false} style={[styles.window, windowStyle]}>
        {displayUrl && failedUrl !== displayUrl ? (
          <VisionPhotograph source={{ uri: displayUrl }} displayAspect={displayAspect} uploaded={uploaded} fill focalFrame={boardMode ? focalFrame : undefined} onLoad={handleDecoded}
            onAssetReady={() => onPhotoAssetReady?.(sceneId)}
            onError={() => { if (displayUrl !== imageUrl) setShownUrl(imageUrl ?? null); else { onPhotoAssetError?.(sceneId); setFailedUrl(displayUrl); } }}
            accessible={false} accessibilityIgnoresInvertColors style={styles.fill} />
        ) : (
          <View style={styles.unavailable}><Text style={styles.unavailableText}>{interactive && imageFailed ? 'Image unavailable. Tap to retry.' : 'Image unavailable'}</Text></View>
        )}
        <LinearGradient pointerEvents="none" colors={['rgba(255,249,235,0.10)', 'transparent', 'rgba(14,21,28,0.08)']} style={StyleSheet.absoluteFill} />
        {/* The torn edges of the aperture take the mount's paper colour. */}
        {!photographic ? <VisionImageEdge hero={hero} brush={detailEdges} color={VISION_PHOTO.mount} darken={edgeDarken} /> : null}
      </Animated.View>
      {photographic && extraScene <= 0 ? <VisionPolaroidFrame variant={frameVariant} testID={`${testID}-material-frame`} /> : null}
      {photographic && extraScene > 0 ? <>
        <Animated.View pointerEvents="none" style={[styles.frameSlice, { top: 0 }, frameTopStyle]}>
          <Animated.Image source={frameArt} resizeMode="stretch" fadeDuration={0} style={[styles.frameSliceImage, frameTopImageStyle]} />
        </Animated.View>
        <Animated.View pointerEvents="none" testID={`${testID}-caption-paper`} style={[styles.frameSlice, frameFootStyle]}>
          <Animated.Image source={frameArt} resizeMode="stretch" fadeDuration={0} style={[styles.frameSliceImage, frameFootImageStyle]} />
        </Animated.View>
      </> : null}
      {tapes.map((tape, index) => <PrintTape photographic={photographic} key={`${tape.photo}-${index}`} tape={tape} width={width}
        testID={testID ? `${testID}-tape-${index}` : undefined} />)}
      {arriving || setPrint ? <Animated.View pointerEvents="none" testID={`${testID}-arrival-pin`} style={[styles.attachment, { width: 16, height: 16, top: -8, left: '50%', marginLeft: -8 }, pinStyle]}>
        <Svg width={16} height={16}><Defs><RadialGradient id="arrival-pin" cx="35%" cy="30%"><Stop offset="0" stopColor="#F3DCA0" /><Stop offset=".45" stopColor={VISION_GOLD} /><Stop offset="1" stopColor="#7d5d22" /></RadialGradient></Defs><Circle cx={8} cy={8} r={8} fill="url(#arrival-pin)" /></Svg>
      </Animated.View> : null}
    </Animated.View>
  );

  // Board: caption and any extra paper are sized by `planCaption` in the points the person sees.
  const boardCaption = plan ? (
    <Animated.View pointerEvents={interactive && editableCaption ? 'auto' : 'none'} style={[styles.boardCaptionBox, boardCaptionStyle, captionStyle]}>
      {editableCaption ? (
        <Pressable testID={`vision-board-photo-${sceneId}-caption-edit`} accessibilityRole="button" accessibilityLabel="Edit photo caption"
          accessibilityHint="Opens the caption for this photo" onPress={() => onCaptionEdit?.(sceneId)} hitSlop={8} disabled={repositioning} style={styles.boardCaptionPressable}>
          <Text testID={`${testID}-caption`} allowFontScaling={false} style={[styles.boardCaption, { fontSize: plan.fontSize * toScene, lineHeight: plan.lineHeight * toScene }, !captionText && styles.captionPlaceholder]}>
            {captionText || 'Add caption'}
          </Text>
        </Pressable>
      ) : (
        <Text testID={`${testID}-caption`} allowFontScaling={false} style={[styles.boardCaption, { fontSize: plan.fontSize * toScene, lineHeight: plan.lineHeight * toScene }]}>{captionText}</Text>
      )}
    </Animated.View>
  ) : null;

  const body = (
    <Animated.View pointerEvents={exiting ? 'none' : 'auto'} style={[styles.container, containerStyle]}>
      {interactive ? <GestureDetector gesture={gesture}>{frame}</GestureDetector> : frame}
      {boardMode ? boardCaption : interactive && onCaptionEdit ? (
        <Animated.View style={[styles.captionHitArea, captionPositionStyle, captionStyle]}>
          <Pressable testID={`vision-board-photo-${sceneId}-caption-edit`} accessibilityRole="button" accessibilityLabel="Edit photo caption"
            accessibilityHint="Opens the caption for this photo" onPress={() => onCaptionEdit(sceneId)} hitSlop={6} style={styles.captionPressable}>
            <Text testID={`${testID}-caption`} numberOfLines={1} style={[styles.captionText, !caption?.trim() && styles.captionPlaceholder]}>
              {caption?.trim() || 'Add caption'}
            </Text>
          </Pressable>
        </Animated.View>
      ) : (interactive || photographic) && caption?.trim() ? (
        <Animated.Text pointerEvents="none" testID={`${testID}-caption`} numberOfLines={1}
          style={[styles.captionText, captionStyle, captionPositionStyle]}>{caption}</Animated.Text>
      ) : null}
    </Animated.View>
  );

  return body;
});

const styles = StyleSheet.create({
  container: { position: 'absolute', overflow: 'visible' },
  photo: { position: 'absolute', left: 0, top: 0, borderRadius: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: VISION_PHOTO.mountEdge, ...VISION_SHADOW.ambient },
  materialPhoto: { borderWidth: 0, borderRadius: 0 },
  layer: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  window: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.canvas },
  fill: { width: '100%', height: '100%' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CFC6B6' },
  unavailableText: { ...typography.caption, color: colors.text.secondary },
  captionHitArea: { position: 'absolute', left: 0, right: 0, height: CAPTION_TOUCH_HEIGHT, alignItems: 'center', justifyContent: 'flex-start' },
  captionPressable: { minHeight: CAPTION_TOUCH_HEIGHT, minWidth: '100%', alignItems: 'center', justifyContent: 'center' },
  // Visualize and the share image keep the original thin script at its original size; the Vision board uses `boardCaption`.
  captionText: { fontFamily: VISION_CAPTION_FONTS.script, fontSize: 15, lineHeight: 18, color: VISION_CAPTION_COLOR, textAlign: 'center' },
  boardCaption: { fontFamily: VISION_CAPTION_FONTS.handwritten, color: VISION_CAPTION_COLOR, textAlign: 'center', includeFontPadding: false },
  boardCaptionBox: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start' },
  boardCaptionPressable: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  frameSlice: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  frameSliceImage: { position: 'absolute', left: 0, width: '100%' },
  captionPlaceholder: { color: colors.text.secondary, opacity: 0.78 },
  attachment: { position: 'absolute' },
  tapeHolder: { position: 'absolute', top: -VISION_TAPE.height * 0.45, height: VISION_TAPE.height, zIndex: 2 },
  tapeFill: { width: '100%' },
});

