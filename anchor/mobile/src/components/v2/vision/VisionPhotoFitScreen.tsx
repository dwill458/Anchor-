import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, Image, PanResponder, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { v2Haptics } from '@/hooks/v2';
import { cropPhoto, discardTemporaryPhoto, requestPhotoExpansion, type ExpandResult, type FitPhoto } from '@/hooks/v2/vision/visionPhotoFitProcessing';
import { colors, radii, spacing } from '@/theme/v2';
import { VisionBackButton, VisionInkPill, VISION_GOLD, VISION_SERIF } from './VisionPaperChrome';
import { assessPhotoFit, computeCropRect, photoFitExplanation, VISION_PHOTO_TARGET_ASPECT } from './visionPhotoFit';
import { createSingleFlight } from './visionSingleFlight';

export type PhotoFitChoice = 'keep' | 'crop' | 'expand';
type Step = 'choose' | 'crop' | 'expanding' | 'preview';

type Props = {
  photo: FitPhoto;
  size: { width: number; height: number };
  /** The person's decision. `photo` is the original for Keep, or a new cache file for Crop and Expand. */
  onConfirm: (result: { photo: FitPhoto; choice: PhotoFitChoice }) => void;
  /** Leaves without choosing: nothing was created that survives. */
  onCancel: () => void;
  onPremiumRequired?: () => void;
  testID?: string;
};

/** A 9:16 frame with the photo shown whole (never stretched) over paper. */
function Frame({ uri, width, fit, bands = false }: { uri: string; width: number; fit: 'contain' | 'cover'; bands?: boolean }) {
  const height = width / VISION_PHOTO_TARGET_ASPECT;
  return (
    <View style={[styles.frame, { width, height }]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode={fit} resizeMethod="resize" accessible={false} />
      {bands ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.bands]} /> : null}
    </View>
  );
}

/**
 * "Make Your Photo Fit": offered when a personal photo is not the Vision's portrait frame. Three honest
 * choices: keep it exactly as it is, crop it yourself, or let AI extend its surroundings. The original file
 * is never modified, a photo is never stretched, and an AI result is previewed beside the original and
 * only used if the person says so.
 */
export function VisionPhotoFit({ photo, size, onConfirm, onCancel, onPremiumRequired, testID = 'vision-photo-fit' }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const assessment = useMemo(() => assessPhotoFit(size), [size]);
  const [step, setStep] = useState<Step>('choose');
  const [choice, setChoice] = useState<PhotoFitChoice>(assessment.canExpand ? 'expand' : 'crop');
  const [notice, setNotice] = useState<string | null>(null);
  const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
  const [expanded, setExpanded] = useState<FitPhoto | null>(null);
  const flight = useRef(createSingleFlight()).current;
  const alive = useRef(true);
  const pending = useRef<string[]>([]);
  useEffect(() => () => {
    alive.current = false;
    flight.cancel();
    // Whatever was made and not chosen is removed.
    pending.current.forEach(uri => { void discardTemporaryPhoto(uri); });
  }, [flight]);

  const optionWidth = Math.min(96, (windowWidth - spacing[4] * 2 - spacing[3] * 2) / 3.2);

  const useOriginal = () => onConfirm({ photo, choice: 'keep' });

  const runExpand = async () => {
    setNotice(null);
    setStep('expanding');
    let produced: ExpandResult | null = null;
    const outcome = await flight.run(async () => { produced = await requestPhotoExpansion(photo, size); return produced; });
    const result = produced as ExpandResult | null;
    // Cancelled, left, or unmounted before it came back: anything that was made is removed.
    if (!alive.current || outcome.status !== 'done') { if (result?.ok) void discardTemporaryPhoto(result.photo.uri); return; }
    if (!result) return;
    if (!result.ok) {
      setStep('choose');
      setNotice(result.message);
      if (result.premiumRequired) onPremiumRequired?.();
      return;
    }
    pending.current.push(result.photo.uri);
    setExpanded(result.photo);
    setStep('preview');
  };

  const cancelExpand = () => { flight.cancel(); setStep('choose'); };

  const rejectExpansion = () => {
    if (expanded) { void discardTemporaryPhoto(expanded.uri); pending.current = pending.current.filter(uri => uri !== expanded.uri); }
    setExpanded(null);
    setNotice(null);
    setStep('choose');
  };

  const acceptExpansion = () => {
    if (!expanded) return;
    pending.current = pending.current.filter(uri => uri !== expanded.uri); // kept: now owned by the caller
    onConfirm({ photo: expanded, choice: 'expand' });
  };

  const [cropping, setCropping] = useState(false);
  const applyCrop = async () => {
    setNotice(null);
    setCropping(true);
    const outcome = await flight.run(async () => {
      try { return await cropPhoto(photo.uri, computeCropRect(size, focal)); } catch { return null; }
    });
    if (!alive.current) { if (outcome.status === 'done' && outcome.value) void discardTemporaryPhoto(outcome.value.uri); return; }
    setCropping(false);
    if (outcome.status !== 'done') return;
    if (!outcome.value) { setNotice('The photo could not be cropped. You can keep the original instead.'); setStep('choose'); return; }
    onConfirm({ photo: outcome.value, choice: 'crop' });
  };

  const proceed = () => {
    v2Haptics.selection();
    if (choice === 'keep') useOriginal();
    else if (choice === 'crop') setStep('crop');
    else void runExpand();
  };

  const back = () => {
    if (step === 'choose') onCancel();
    else if (step === 'preview') rejectExpansion();
    else if (step === 'expanding') cancelExpand();
    else setStep('choose');
  };

  const options: ReadonlyArray<{ key: PhotoFitChoice; title: string; detail: string; badge?: string; preview: ReactElement }> = [
    { key: 'keep', title: 'Keep original', detail: 'Use your photo exactly as it is, framed on the board.', preview: <Frame uri={photo.uri} width={optionWidth} fit="contain" /> },
    { key: 'crop', title: 'Crop to fit', detail: 'Choose the framing yourself. No AI.', preview: <Frame uri={photo.uri} width={optionWidth} fit="cover" /> },
    ...(assessment.canExpand ? [{ key: 'expand' as const, title: 'Expand with AI', detail: 'Extend the edges to fill the frame. Your photo stays as it is.', badge: 'Recommended',
      preview: <Frame uri={photo.uri} width={optionWidth} fit="contain" bands /> }] : []),
  ];

  return (
    <View testID={testID} style={styles.stage}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.canvas} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing[2], paddingBottom: insets.bottom + spacing[6] }]} showsVerticalScrollIndicator={false}>
        <VisionBackButton onPress={back} style={[styles.back, { backgroundColor: 'transparent', borderColor: 'transparent' }]} color={colors.text.primary} />

        {step === 'choose' ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>Make Your Photo Fit</Text>
            <Text style={styles.sub}>{photoFitExplanation(assessment.relation)}</Text>
            <View style={styles.options}>
              {options.map(option => (
                <Pressable key={option.key} testID={`${testID}-${option.key}`} accessibilityRole="radio" accessibilityLabel={option.title} accessibilityHint={option.detail}
                  accessibilityState={{ selected: choice === option.key }} onPress={() => { v2Haptics.selection(); setChoice(option.key); setNotice(null); }}
                  style={[styles.option, choice === option.key && styles.optionOn]}>
                  {option.preview}
                  <View style={styles.optionCopy}>
                    <View style={styles.optionHead}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      {option.badge ? <Text style={styles.badge}>{option.badge}</Text> : null}
                    </View>
                    <Text style={styles.optionDetail}>{option.detail}</Text>
                  </View>
                  <View style={[styles.radio, choice === option.key && styles.radioOn]} />
                </Pressable>
              ))}
            </View>
            {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
            <VisionInkPill testID={`${testID}-continue`} label={choice === 'expand' ? 'Expand my photo' : 'Continue'} accessibilityLabel="Continue" onPress={proceed} />
          </>
        ) : null}

        {step === 'crop' ? (
          <CropStep uri={photo.uri} size={size} focal={focal} onFocal={setFocal} maxWidth={windowWidth - spacing[4] * 2} maxHeight={windowHeight * 0.58}
            onApply={() => { void applyCrop(); }} busy={cropping} notice={notice} testID={testID} />
        ) : null}

        {step === 'expanding' ? (
          <View style={styles.center} testID={`${testID}-expanding`}>
            <Frame uri={photo.uri} width={Math.min(windowWidth * 0.5, 200)} fit="contain" bands />
            <ActivityIndicator color={VISION_GOLD} style={{ marginTop: spacing[4] }} />
            <Text accessibilityLiveRegion="polite" style={styles.sub}>Extending the edges of your photo…</Text>
            <Pressable testID={`${testID}-cancel-expand`} accessibilityRole="button" accessibilityLabel="Cancel" onPress={cancelExpand} style={styles.link}>
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'preview' && expanded ? (
          <>
            <Text accessibilityRole="header" style={styles.title}>Preview Result</Text>
            <Text style={styles.sub}>The new edges were created by AI. Your original photo is unchanged.</Text>
            <View style={styles.compare}>
              <View style={styles.compareItem}>
                <Frame uri={photo.uri} width={Math.min(110, windowWidth * 0.28)} fit="contain" />
                <Text style={styles.compareLabel}>Original</Text>
              </View>
              <View style={styles.compareItem} testID={`${testID}-expanded-preview`}>
                <Frame uri={expanded.uri} width={Math.min(180, windowWidth * 0.46)} fit="cover" />
                <Text style={styles.compareLabel}>AI expanded</Text>
              </View>
            </View>
            <VisionInkPill testID={`${testID}-use-expanded`} label="Use This Version" accessibilityLabel="Use this version" onPress={acceptExpansion} />
            <Pressable testID={`${testID}-keep-original`} accessibilityRole="button" accessibilityLabel="Keep my original instead" onPress={useOriginal} style={styles.link}>
              <Text style={styles.linkText}>Keep my original instead</Text>
            </Pressable>
            <Pressable testID={`${testID}-different`} accessibilityRole="button" accessibilityLabel="Try a different option" onPress={rejectExpansion} style={styles.link}>
              <Text style={styles.linkText}>Try a different option</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function CropStep({ uri, size, focal, onFocal, maxWidth, maxHeight, onApply, busy, notice, testID }: {
  uri: string; size: { width: number; height: number }; focal: { x: number; y: number }; onFocal: (focal: { x: number; y: number }) => void;
  maxWidth: number; maxHeight: number; onApply: () => void; busy: boolean; notice: string | null; testID: string;
}) {
  const windowWidth = Math.min(maxWidth, maxHeight * VISION_PHOTO_TARGET_ASPECT);
  const windowHeight = windowWidth / VISION_PHOTO_TARGET_ASPECT;
  const scale = Math.max(windowWidth / size.width, windowHeight / size.height);
  const shownWidth = size.width * scale;
  const shownHeight = size.height * scale;
  const slackX = Math.max(0, shownWidth - windowWidth);
  const slackY = Math.max(0, shownHeight - windowHeight);
  const latest = useRef({ focal, slackX, slackY });
  latest.current = { focal, slackX, slackY };
  const start = useRef(focal);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = latest.current.focal; },
    onPanResponderMove: (_event, gesture) => {
      const { slackX: sx, slackY: sy } = latest.current;
      // Dragging the photo right reveals more of its left: the focal point moves the other way.
      const x = sx > 0 ? Math.min(1, Math.max(0, start.current.x - gesture.dx / sx)) : 0.5;
      const y = sy > 0 ? Math.min(1, Math.max(0, start.current.y - gesture.dy / sy)) : 0.5;
      onFocal({ x, y });
    },
  }), [onFocal]);

  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>Crop to Fit</Text>
      <Text style={styles.sub}>Drag your photo to choose what stays in the frame.</Text>
      <View style={styles.center}>
        <View testID={`${testID}-crop-window`} accessibilityLabel="Crop frame. Drag to move your photo." style={[styles.frame, { width: windowWidth, height: windowHeight }]} {...responder.panHandlers}>
          <Image source={{ uri }} resizeMethod="resize" accessible={false}
            style={{ position: 'absolute', width: shownWidth, height: shownHeight, left: -slackX * focal.x, top: -slackY * focal.y }} />
        </View>
      </View>
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      <VisionInkPill testID={`${testID}-apply-crop`} label={busy ? 'Cropping…' : 'Use This Crop'} accessibilityLabel="Use this crop" disabled={busy} onPress={onApply} />
    </>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: spacing[4], gap: spacing[3] },
  back: { alignSelf: 'flex-start' },
  title: { fontFamily: VISION_SERIF, fontSize: 32, lineHeight: 37, letterSpacing: -0.5, textAlign: 'center', color: colors.text.primary },
  sub: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, textAlign: 'center', color: colors.text.secondary, alignSelf: 'center', maxWidth: 320 },
  options: { gap: spacing[3] },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border.default },
  optionOn: { borderColor: VISION_GOLD, borderWidth: 1.5 },
  optionCopy: { flex: 1, gap: 2 },
  optionHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
  optionTitle: { fontFamily: VISION_SERIF, fontSize: 19, lineHeight: 24, color: colors.text.primary },
  optionDetail: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.text.secondary },
  badge: { fontFamily: 'Inter-SemiBold', fontSize: 11, lineHeight: 14, color: colors.ink.deep, backgroundColor: '#E9D9AE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill, overflow: 'hidden' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border.strong },
  radioOn: { borderColor: VISION_GOLD, backgroundColor: VISION_GOLD },
  frame: { overflow: 'hidden', borderRadius: 4, backgroundColor: colors.grouped, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border.default },
  bands: { borderTopWidth: 10, borderBottomWidth: 10, borderColor: 'rgba(176,138,74,0.35)', borderStyle: 'dashed' },
  center: { alignItems: 'center', gap: spacing[2] },
  notice: { fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18, color: colors.semantic.error, textAlign: 'center' },
  compare: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: spacing[4] },
  compareItem: { alignItems: 'center', gap: spacing[2] },
  compareLabel: { fontFamily: 'Inter-SemiBold', fontSize: 12, lineHeight: 16, color: colors.text.secondary },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text.secondary, textDecorationLine: 'underline' },
});
