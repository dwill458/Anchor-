import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, withDelay } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { VisionNote } from '@/adapters/v2/vision';
import { VisionNoteRenderer } from '@/components/v2/vision/notes/VisionNoteRenderer';
import { clampVisionNotePresentationForAspect, visionNoteZIndex } from '@/components/v2/vision/notes/visionNotePlacement';

type Props = {
  note: VisionNote;
  arriving?: boolean;
  sceneWidth: number;
  sceneHeight: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onPresentationChange: (id: string, presentation: VisionNote['presentation']) => Promise<boolean>;
  cameraScale: SharedValue<number>;
  onDragActive?: (active: boolean) => void;
  reduceMotion: boolean;
};

/** Gesture-capable note surface; persistence occurs once when a gesture settles. */
export function VisionBoardNoteElement({ note, sceneWidth, sceneHeight, selected, onSelect, onPresentationChange, cameraScale, onDragActive, reduceMotion, arriving = false }: Props) {
  const p = note.presentation;
  const centerX = useSharedValue(p.x);
  const centerY = useSharedValue(p.y);
  const scale = useSharedValue(p.scale);
  const rotation = useSharedValue(p.rotation);
  const startX = useSharedValue(p.x);
  const startY = useSharedValue(p.y);
  const startScale = useSharedValue(p.scale);
  const startRotation = useSharedValue(p.rotation);
  const activeGestures = useSharedValue(0);
  const saving = useSharedValue(false);
  const [isSaving, setIsSaving] = useState(false);
  const panStarted = useSharedValue(false);
  const pinchStarted = useSharedValue(false);
  const rotationStarted = useSharedValue(false);
  const didMove = useSharedValue(false);
  const lift = useSharedValue(1);
  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (arriving && !reduceMotion) arrival.value = 0;
    arrival.value = reduceMotion ? 1 : arriving ? withDelay(360, withTiming(1, { duration: 280 })) : withTiming(1, { duration: 280 });
  }, [arrival, arriving, reduceMotion]);
  useEffect(() => {
    centerX.value = p.x; centerY.value = p.y; scale.value = p.scale; rotation.value = p.rotation;
  }, [centerX, centerY, p.rotation, p.scale, p.x, p.y, rotation, scale]);
  const save = useCallback(async (x: number, y: number, nextScale: number, nextRotation: number) => {
    if (saving.value) return;
    saving.value = true;
    setIsSaving(true);
    const next = clampVisionNotePresentationForAspect({ ...p, x, y, scale: nextScale, rotation: nextRotation }, sceneHeight / sceneWidth);
    centerX.value = next.x; centerY.value = next.y; scale.value = next.scale; rotation.value = next.rotation;
    onDragActive?.(false);
    try {
      const saved = await onPresentationChange(note.id, next);
      if (!saved) { centerX.value = p.x; centerY.value = p.y; scale.value = p.scale; rotation.value = p.rotation; }
    } catch {
      centerX.value = p.x; centerY.value = p.y; scale.value = p.scale; rotation.value = p.rotation;
    } finally {
      saving.value = false;
      setIsSaving(false);
    }
  }, [centerX, centerY, note.id, onDragActive, onPresentationChange, p, rotation, saving, scale, sceneHeight, sceneWidth]);
  const gesture = useMemo(() => {
    const begin = () => { 'worklet'; activeGestures.value += 1; };
    const finish = (started: typeof panStarted) => {
      'worklet';
      if (!started.value) return;
      started.value = false;
      activeGestures.value = Math.max(0, activeGestures.value - 1);
      if (activeGestures.value === 0 && didMove.value) {
        runOnJS(save)(centerX.value, centerY.value, scale.value, rotation.value);
        didMove.value = false;
        lift.value = reduceMotion ? 1 : withSpring(1, { damping: 18, stiffness: 220 });
      } else if (activeGestures.value === 0) {
        runOnJS(onDragActive ?? (() => undefined))(false);
      }
    };
    const pan = Gesture.Pan().enabled(!isSaving).activateAfterLongPress(280)
      .onStart(() => { if (saving.value) return; begin(); panStarted.value = true; startX.value = centerX.value; startY.value = centerY.value; didMove.value = true; if (!reduceMotion) lift.value = withSpring(1.025, { damping: 16, stiffness: 260 }); runOnJS(onSelect)(note.id); runOnJS(onDragActive ?? (() => undefined))(true); })
      .onUpdate(event => {
        if (saving.value) return;
        const cx = Math.cos(rotation.value * Math.PI / 180); const sx = Math.sin(rotation.value * Math.PI / 180);
        const aspect = sceneHeight / sceneWidth;
        const hw = (Math.abs(p.width * scale.value * cx) + Math.abs(p.height * aspect * scale.value * sx)) / 2;
        const hh = (Math.abs(p.height * scale.value * cx) + Math.abs(p.width / aspect * scale.value * sx)) / 2;
        centerX.value = Math.min(1 - hw, Math.max(hw, startX.value + event.translationX / (sceneWidth * cameraScale.value)));
        centerY.value = Math.min(1 - hh, Math.max(hh, startY.value + event.translationY / (sceneHeight * cameraScale.value)));
      })
      .onFinalize(() => finish(panStarted));
    const pinch = Gesture.Pinch().enabled(!isSaving).onStart(() => { if (saving.value) return; begin(); pinchStarted.value = true; startScale.value = scale.value; didMove.value = true; runOnJS(onDragActive ?? (() => undefined))(true); })
      .onUpdate(event => {
        if (saving.value) return;
        const a = rotation.value * Math.PI / 180; const c = Math.abs(Math.cos(a)); const s = Math.abs(Math.sin(a));
        const maxScale = Math.max(0.5, Math.min(2, 1 / (p.width * c + p.height * 2.65 * s), 1 / (p.height * c + p.width / 0.45 * s)));
        scale.value = Math.max(0.5, Math.min(maxScale, startScale.value * event.scale));
      })
      .onFinalize(() => finish(pinchStarted));
    const rotate = Gesture.Rotation().enabled(!isSaving).onStart(() => { if (saving.value) return; begin(); rotationStarted.value = true; startRotation.value = rotation.value; didMove.value = true; runOnJS(onDragActive ?? (() => undefined))(true); })
      .onUpdate(event => {
        if (saving.value) return;
        rotation.value = Math.max(-180, Math.min(180, startRotation.value + event.rotation * 180 / Math.PI));
        const a = rotation.value * Math.PI / 180; const c = Math.abs(Math.cos(a)); const s = Math.abs(Math.sin(a));
        const maxScale = Math.max(0.5, Math.min(2, 1 / (p.width * c + p.height * 2.65 * s), 1 / (p.height * c + p.width / 0.45 * s)));
        scale.value = Math.min(scale.value, maxScale);
      })
      .onFinalize(() => finish(rotationStarted));
    const select = Gesture.Tap().onEnd((_event, success) => { if (success) runOnJS(onSelect)(note.id); });
    return Gesture.Simultaneous(pan, pinch, rotate, select);
  }, [activeGestures, cameraScale, centerX, centerY, didMove, isSaving, lift, note.id, onDragActive, onSelect, p, panStarted, pinchStarted, reduceMotion, rotation, rotationStarted, save, saving, scale, sceneHeight, sceneWidth, startRotation, startScale, startX, startY]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: arrival.value, transform: [
    { translateX: (centerX.value - p.x) * sceneWidth }, { translateY: (centerY.value - p.y) * sceneHeight },
    { rotate: `${rotation.value + (1 - arrival.value) * 1.2}deg` }, { scale: scale.value * lift.value * (0.96 + arrival.value * 0.04) },
  ] }));
  const width = sceneWidth * p.width;
  const height = sceneHeight * p.height;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.note, selected && styles.lifted, { width, height, left: sceneWidth * p.x - width / 2, top: sceneHeight * p.y - height / 2, zIndex: visionNoteZIndex(p.layerOrder) }, animatedStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Vision note: ${note.content.text || p.styleId.replaceAll('_', ' ')}`} accessibilityState={{ selected }} onPress={() => onSelect(note.id)} style={styles.fill}>
          <VisionNoteRenderer styleId={p.styleId} fontId={p.fontId} text={note.content.text} width={width} height={height} rotationOverride={0} scaleOverride={1} scrollText />
          {selected ? <View pointerEvents="none" style={styles.selected} /> : null}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  note: { position: 'absolute' },
  lifted: { zIndex: 39, elevation: 8, shadowColor: '#161B16', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
  fill: { flex: 1 },
  selected: { ...StyleSheet.absoluteFillObject, borderColor: '#283D36', borderWidth: 1.5, borderRadius: 12 },
});
