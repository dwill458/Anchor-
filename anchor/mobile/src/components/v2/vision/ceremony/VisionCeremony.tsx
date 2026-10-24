import type { ViewInstance } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Keyboard, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { v2Haptics } from '@/hooks/v2';
import { useCelebrationReduceMotion } from '@/hooks/useCelebrationReduceMotion';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';
import { AnalyticsService } from '@/services/AnalyticsService';
import { playCreationSound } from '@/services/CreationSounds';
import { SoundPool } from '@/services/audio/SoundPool';
import { useCelebrationStore, type CelebrationLevel } from '@/stores/v2/celebrationStore';
import { colors } from '@/theme/v2';
import { safeHaptics } from '@/utils/haptics';
import { resolveAnchorCategory } from '@/utils/categoryDetection';
import type { AnchorCategory } from '@/types';
import { ImpactFeedbackStyle } from 'expo-haptics';
import type { PickedVisionPhoto, VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { V2VisionCreationFlowProps } from '../V2VisionCreationFlow';
import { VisionMomentInput, type VisionStartPhoto } from '../VisionMomentInput';
import { VisionPhotoFit } from '../VisionPhotoFitScreen';
import { assessPhotoFit } from '../visionPhotoFit';
import { readPhotoSize } from '@/hooks/v2/vision/visionPhotoFitProcessing';
import { VISION_SERIF, VISION_SERIF_ITALIC } from '../VisionPaperChrome';
import { VisionTornEdge } from '../VisionTornEdge';
import { useVisionImageArrival, type VisionImageRect } from '../VisionImageArrival';
import { visionTwoUpState } from '../visionTwoUp';
import { VisionPrint, VisionPrintSlot, type PrintPlacement } from './VisionPrint';
import { VisionSealHold } from './VisionSealHold';
import { VisionEntrance } from './VisionEntrance';
import { VisionPhotoStack } from './VisionPhotoStack';
import { VisionHairline } from './VisionHairline';
import { useVisionPicker, VisionPickerHolding } from './VisionPickerHolding';
import { visionCelebrationTrace } from './visionCelebrationTrace';
import { CEREMONY, ceremonyDuration } from './VisionDevelop';
import { prefillVisionCaption, visionCeremonyCopy as copy } from './visionCeremonyCopy';
import { useVisionCreationActions, photoVisionDescription, type CeremonyPhoto } from './useVisionCreationActions';
import type { VisionConversationRound, VisionReferenceAttachment, VisionSceneRequestOptions } from '@/types/visionConversation';
import { conversationAttachments } from '@/hooks/v2/vision/useVisionConversation';
import { VisionRefineSheet } from '../VisionRefineSheet';
import { VisionResumeCard } from '../VisionResumeCard';
import { VisionConversationSelection } from '../VisionConversationSelection';
import { useAuthStore } from '@/stores/authStore';

const CEREMONY_SOUND_KEYS = ['creation:uiTap', 'creation:anchorPulse', 'creation:formTick', 'creation:distillTick', 'creation:revealSettle',
  'creation:formBed', 'creation:sealRise', 'creation:seal', 'creation:visionPin'];

/** Seal flight + stamp + minimum hold + board rise + arrival settle, matching the hand-off timeline. */
const SCENE_MS = 2460, REDUCED_SCENE_MS = 1000;
let visionCeremonySequence = 0;

export type VisionCeremonyBeat = 'ask' | 'describe' | 'develop' | 'choose' | 'keep' | 'seal' | 'pinned';
export interface VisionCeremonyProps extends Omit<V2VisionCreationFlowProps, 'initialStep'> {
  mode: 'create' | 'add';
  visionId?: string;
  startAt?: 'ask' | 'describe' | 'develop';
  /** The reference photo the composer already holds; kept so Back and retry never lose it. */
  initialStartPhoto?: VisionStartPhoto | null;
  initialReferences?: VisionReferenceAttachment[];
  initialSessionId?: string;
  /** Start generating on mount from initialDescription and initialStartPhoto (the Add Image sheet has already prepared the request). */
  autoStart?: boolean;
  photo?: PickedVisionPhoto;
  regenerating?: boolean;
  /** Create only: false once the Vision already holds images, which makes this a later-image celebration (L2). */
  firstImage?: boolean;
  /** The existing save callbacks keep their boolean contract; this reports the saved hero URL. */
  savedImageUrl?: string | null;
  savedImages?: ReadonlyArray<{ sceneId: string; url: string }>;
  photoUploading?: boolean;
  /** Add mode: the newest board image, shown as a developed print behind the empty Ask frame. */
  previewImageUrl?: string | null;
  /** Add mode: that print's caption, shown under it on Ask. */
  previewCaption?: string | null;
  /** Called once when the print has reached the board. `firstImage`: this was the Vision's first image (the L4 scene). */
  onPinned?: (result: { firstImage: boolean }) => void;
  onAdd?: (choice: { assetId: string; prompt: string; caption?: string }) => Promise<boolean>;
  onPhotoConfirm?: (caption: string) => Promise<string | null>;
  onChooseAgain?: () => void;
  onAddNote?: () => void;
  /** False at the saved Vision image limit; the note entry remains available. */
  canAddImage?: boolean;
  /** Blocks parent route gestures while an accepted seal is being saved and presented. */
  onSealingChange?: (active: boolean) => void;
}

function measure(node: ViewInstance | null): Promise<VisionImageRect | null> {
  return new Promise(resolve => {
    if (!node?.measureInWindow) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), 150);
    node.measureInWindow((x, y, width, height) => { clearTimeout(timer); resolve(width > 0 && height > 0 ? { x, y, width, height } : null); });
  });
}

/** One persistent print stage for first creation, additions, and regeneration. */
export function VisionCeremony(props: VisionCeremonyProps) {
  const owner = useAuthStore(state => state.user?.id ?? 'anonymous');
  // Remount all image snapshots and ceremony state together at the account/Anchor boundary.
  return <ScopedVisionCeremony key={`${owner}:${props.anchorId}`} {...props} />;
}

function ScopedVisionCeremony(props: VisionCeremonyProps) {
  const { anchorId, anchorIntention, anchorArt, anchorCategory, mode, onBack, testID = 'vision-ceremony' } = props;
  const actions = useVisionCreationActions(props);
  const arrival = useVisionImageArrival();
  const picker = useVisionPicker(anchorId);
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  // One Reduce Motion source for the celebration: the ceremony's motion and its coordinator level agree.
  const reduced = useCelebrationReduceMotion();
  const lowPerformance=usePerformanceTier()==='low';
  const usable = height - insets.top - insets.bottom;
  const [beat, setBeat] = useState<VisionCeremonyBeat>(props.startAt ?? 'ask');
  const [description, setDescriptionState] = useState(props.initialDescription ?? '');
  const descriptionRef = useRef(description);
  const setDescription = (text: string) => { descriptionRef.current = text; setDescriptionState(text); };
  const setDescriptionFromInput = (text: string) => { descriptionRef.current = text; };
  const [startPhoto, setStartPhoto] = useState<VisionStartPhoto | null>(props.initialReferences ? null : props.initialStartPhoto ?? null);
  const conversation = actions.generation.conversation;
  const session = conversation?.session ?? null;
  const [references, setReferences] = useState<VisionReferenceAttachment[]>(() => props.initialReferences ?? (props.initialStartPhoto ? [{
    id: `initial:${props.initialStartPhoto.uri}`, ...props.initialStartPhoto, role: 'inspiration',
  }] : []));
  const [viewedRoundId, setViewedRoundId] = useState<string | null>(null);
  const [viewedRoundSnapshot, setViewedRoundSnapshot] = useState<VisionConversationRound | null>(null);
  const [refineCandidateId, setRefineCandidateId] = useState<string | null>(null);
  const [inspectCandidateId, setInspectCandidateId] = useState<string | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(Boolean(props.autoStart || props.photo || props.startAt && props.startAt !== 'ask'));
  const [choicePlacements, setChoicePlacements] = useState<Record<number, PrintPlacement>>({});
  const hydratedDraft = useRef(false);
  const [scopeReady, setScopeReady] = useState(!props.regenerating || !conversation);
  const freshScopeStarted = useRef(false);
  const rounds: VisionConversationRound[] = session ? [
    ...session.rounds.filter(round => round.id !== actions.generation.job?.id),
    ...(actions.generation.job && 'sessionId' in actions.generation.job && actions.generation.job.sessionId === session.id ? [actions.generation.job as VisionConversationRound] : session.rounds.filter(round => round.id === actions.generation.job?.id)),
  ].sort((a, b) => a.roundNumber - b.roundNumber) : [];
  const viewedRound = rounds.find(round => round.id === viewedRoundId) ?? (viewedRoundSnapshot?.id === viewedRoundId ? viewedRoundSnapshot : null);
  const displayedJob = viewedRound ?? actions.generation.job;
  const displayedRound = displayedJob && 'sessionId' in displayedJob && displayedJob.sessionId ? displayedJob as VisionConversationRound : null;
  const refineRound = rounds.find(round => round.candidates.some(candidate => candidate.id === refineCandidateId));
  const refineCandidate = refineRound?.candidates.find(candidate => candidate.id === refineCandidateId);
  const resumeVisible = !resumeDismissed && beat === 'ask' && session && (session.rounds.length > 0 || Boolean(session.description.trim()));
  useEffect(() => {
    if (!conversation?.loaded || hydratedDraft.current || props.autoStart || props.photo || props.regenerating) return;
    hydratedDraft.current = true;
    const draft = conversation.draft.current;
    if (draft && (session || !props.initialDescription)) { setDescription(draft.description); setReferences(draft.references); }
  }, [conversation?.loaded, session?.id]);
  const changeReferences = (next: VisionReferenceAttachment[]) => {
    setReferences(next); setStartPhoto(null); conversation?.saveDraft({ references: next });
  };
  const persistSelection = (input: { selectedCandidateId?: string; viewedRoundId?: string }) => {
    void conversation?.update(input).catch(() => actions.setNotice('Your choice is saved here. Reconnect to sync it.'));
  };
  const showRound = (roundId: string, exactCandidateId?: string) => {
    const round = rounds.find(item => item.id === roundId);
    if (!round) return;
    setViewedRoundId(roundId); setViewedRoundSnapshot(round); setReferences(conversationAttachments(round.references)); setChosen(null);
    setDeveloped(new Set(round.candidates.flatMap(item => item.imageUrl ? [item.imageUrl] : [])));
    setReadDone(true); setFailedImages(new Set()); setChoicePlacements({});
    persistSelection({ viewedRoundId: roundId });
    if (exactCandidateId) setInspectCandidateId(exactCandidateId);
  };
  const viewExactCandidate = (candidateId: string) => {
    const round = rounds.find(item => item.candidates.some(candidate => candidate.id === candidateId));
    if (round) showRound(round.id, candidateId);
  };
  const openRefine = (item: VisionGenerationCandidate) => {
    if (!item.assetId || !item.imageUrl || committedRef.current) return;
    setRefineCandidateId(item.id);
    const round = rounds.find(round => round.candidates.some(candidate => candidate.id === item.id));
    if (round) { setReferences(conversationAttachments(round.references)); persistSelection({ selectedCandidateId: item.id, viewedRoundId: round.id }); }
  };
  const startDifferent = async () => {
    try {
      await conversation?.startDifferent();
      setResumeDismissed(true); setViewedRoundId(null); setViewedRoundSnapshot(null); setReferences([]); setStartPhoto(null); setDescription('');
      setPhotos([]); setActivePhotoId(null); setChosen(null); setRefineCandidateId(null); setInspectCandidateId(null);
      actions.generation.restoreJob?.(null); setDeveloped(new Set()); setFailedImages(new Set()); stableUrls.current.clear(); setBeat('describe');
    } catch (cause) { actions.setNotice(cause instanceof Error ? cause.message : 'Reconnect to start a different scene.'); }
  };
  const continueSession = (candidateId?: string) => {
    if (!session) return;
    const round = (candidateId ? rounds.find(round => round.candidates.some(candidate => candidate.id === candidateId)) : rounds.find(round => round.id === session.viewedRoundId)) ?? rounds[rounds.length - 1];
    setResumeDismissed(true); setDescription(conversation?.draft.current?.description ?? session.description);
    if (!round) { setReferences(conversation?.draft.current?.references ?? conversationAttachments(session.references)); setStartPhoto(null); setBeat('describe'); return; }
    showRound(round.id); actions.generation.restoreJob?.(round);
    const index = candidateId ? round.candidates.findIndex(candidate => candidate.id === candidateId) : -1;
    if (index >= 0) { setChosen(index); persistSelection({ selectedCandidateId: candidateId!, viewedRoundId: round.id }); setBeat('keep'); }
    else setBeat(['QUEUED', 'RUNNING', 'PARTIAL'].includes(round.status) ? 'develop' : 'choose');
  };
  // A reference photo and a description are one request; the photo only changes what the scene is made from.
  const inputPath = startPhoto ? 'photo' : 'words';
  const [photos, setPhotos] = useState<CeremonyPhoto[]>(props.photo ? [{ ...props.photo, key: props.photo.uri }] : []);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(props.photo?.uri ?? null);
  const [failedImages, setFailedImages] = useState<ReadonlySet<string>>(() => new Set());
  const [photoCaptions, setPhotoCaptions] = useState<Readonly<Record<string, string>>>(() => props.photo
    ? { [props.photo.uri]: prefillVisionCaption(anchorIntention) } : {});
  const [chosen, setChosen] = useState<number | null>(photos.length ? 0 : null);
  const [developed, setDeveloped] = useState<ReadonlySet<string>>(() => new Set());
  const [imageRetryTokens, setImageRetryTokens] = useState<Readonly<Record<string, number>>>({});
  const [caption, setCaption] = useState(() => prefillVisionCaption(anchorIntention));
  const [reframe, setReframe] = useState({ x: 0, y: 0 });
  const [committed, setCommitted] = useState(false), [saving, setSaving] = useState(false);
  const [stampComplete, setStampComplete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generationPending, setGenerationPending] = useState(false);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const generationStarting = useRef(false);
  const pendingGeneration = useRef<{ text: string; refs?: VisionReferenceAttachment[]; options?: VisionSceneRequestOptions } | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const foregroundRef = useRef(foreground); foregroundRef.current = foreground;
  const [litWords, setLitWords] = useState(0), [readDone, setReadDone] = useState(false), [waitBeat, setWaitBeat] = useState(0);
  const [revealStarted, setRevealStarted] = useState(false), [keyboardH, setKeyboardH] = useState(0);
  // DEFERRED: replaced by VisionEntrance (Oct 2026). Ask no longer measures its copy and footer; the entrance lays itself out.
  // const [askCopyH, setAskCopyH] = useState(150), [askFooterH, setAskFooterH] = useState(190);
  const askCopyH = 150, askFooterH = 190;
  const [handedOff, setHandedOff] = useState(false);
  // The open plays once per ceremony: the ref flips when the person first leaves Ask, so Back never replays it.
  const entrancePlayed = useRef(false), previousBeat = useRef<VisionCeremonyBeat | null>(null);
  const printRefs = useRef<Array<ViewInstance | null>>([]), anchorRef = useRef<ViewInstance>(null);
  const savingRef = useRef(false), savedRef = useRef(false), committedRef = useRef(false), alive = useRef(true);
  const sealingNotified = useRef(false);
  const setSealingActive = (active: boolean) => {
    if (sealingNotified.current === active) return;
    sealingNotified.current = active;
    latest.current.onSealingChange?.(active);
  };
  const attempts = useRef(0), sealStarted = useRef(false), requestTime = useRef(0);
  const createStarted = useRef(false);
  // Latch the coordinator level at mount; saving refreshes the board during the ceremony.
  const [firstImage] = useState(() => mode === 'create' && (props.firstImage ?? true));
  const [celebrationId, setCelebrationId] = useState<string | null>(null);
  const celebrationRef = useRef<string | null>(null), boardHandedOff = useRef(false), handOffInFlight = useRef(false), skipRequested = useRef(false);
  const boardRiseStartedAt = useRef<number | null>(null), boardRiseRemaining = useRef<number>(CEREMONY.boardRiseMs);
  const celebrationSkippable = useCelebrationStore(state => Boolean(celebrationId && state.active?.id === celebrationId && state.active.skippable));
  // A ceremony that unmounts before its hand-off leaves the coordinator here.
  useEffect(() => () => { setSealingActive(false); if (celebrationRef.current) useCelebrationStore.getState().finish(celebrationRef.current); }, []);
  const latest = useRef(props); latest.current = props;
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const ownPhoto = photos.length > 0;
  const path = ownPhoto ? 'own_photo' : inputPath;
  const analyticsMode = props.regenerating ? 'regenerate' : mode;
  // The server re-signs image URLs on every poll. Hold the first URL seen for each candidate so a
  // print never re-loads (and re-develops) mid-ceremony: the flicker seen on device Oct 7.
  const stableUrls = useRef(new Map<string, string>());
  const stabilize = (item: VisionGenerationCandidate | null): VisionGenerationCandidate | null => {
    if (!item?.imageUrl) return item;
    const key = item.assetId ?? item.id;
    const known = stableUrls.current.get(key);
    if (!known) { stableUrls.current.set(key, item.imageUrl); return item; }
    return known === item.imageUrl ? item : { ...item, imageUrl: known };
  };
  const rawState = visionTwoUpState(generationPending ? null : displayedJob);
  const state = { ...rawState, slots: rawState.slots.map(stabilize), ready: rawState.ready.map(item => stabilize(item) as VisionGenerationCandidate) };
  const reading = !ownPhoto && (!readDone || !displayedJob || displayedJob.status === 'QUEUED');
  const candidate = chosen === null ? null : state.slots[chosen];
  const activePhotoIndex = Math.max(0, photos.findIndex(photo => photo.key === activePhotoId));
  const activePhotoCaption = activePhotoId ? photoCaptions[activePhotoId] ?? prefillVisionCaption(anchorIntention) : caption;
  const heroUri = ownPhoto ? photos[activePhotoIndex]?.uri : candidate?.imageUrl ?? undefined;
  const usableGeneratedCount = state.ready.filter(item => item.imageUrl && developed.has(item.imageUrl) && !failedImages.has(item.imageUrl)).length;
  const canChooseAnotherGenerated = !ownPhoto && usableGeneratedCount > 1;
  const later = (callback: () => void, ms: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); if (alive.current) callback(); }, ms);
    timers.current.add(timer);
  };
  useEffect(() => {
    // Cold SoundPool players drop short cues; every other flow prewarms its keys on mount.
    SoundPool.prewarm(CEREMONY_SOUND_KEYS);
    // No release on unmount: these keys are shared with the creation flow and Home, and the
    // pool's live-player cap already evicts idle players when something else needs room.
  }, []);
  // Re-assert the pool on every beat (and when the app returns): another screen's cleanup, a
  // backgrounded audio session or a dropped prewarm queue can leave the cues cold.
  useEffect(() => { SoundPool.prewarm(CEREMONY_SOUND_KEYS); }, [beat, foreground]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; timers.current.forEach(clearTimeout); timers.current.clear(); };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', value => setForeground(value === 'active'));
    // A foreground event can occur after render but before the listener mounts.
    // Native state can be null during startup; retain the foreground default then.
    setForeground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    return () => sub.remove();
  }, []);
  // The bed belongs to the Develop wait only; it fades the moment the first print begins to reveal.
  const bedOn = foreground && !ownPhoto && beat === 'develop' && !revealStarted;
  useEffect(() => {
    if (!bedOn) return;
    const bed = playCreationSound('formBed', undefined, { loop: true, fadeInMs: 2500 });
    return () => bed?.stop(550);
  }, [bedOn]);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', event => setKeyboardH(event.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardH(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (previousBeat.current === 'ask' && beat !== 'ask') entrancePlayed.current = true;
    previousBeat.current = beat;
  }, [beat]);
  useEffect(() => {
    AnalyticsService.track('vision_ceremony_beat_viewed', { anchor_id: anchorId, mode: analyticsMode, beat, path });
  }, [anchorId, analyticsMode, beat, path]);
  useEffect(() => {
    if (beat === 'describe' && mode === 'create' && !createStarted.current) {
      createStarted.current = true; AnalyticsService.track('vision_create_started', { anchor_id: anchorId });
    }
  }, [beat, mode, anchorId]);

  const words = description.trim().split(/\s+/).filter(Boolean);
  const readingAttempt = useRef<number | null>(null);
  useEffect(() => {
    if (beat !== 'develop' || ownPhoto) return;
    // A native image retry returns to Develop without starting a new generation.
    // Keep completed reading so a developed sibling cannot cancel its replacement timer.
    if (readingAttempt.current === generationAttempt && readDone) return;
    readingAttempt.current = generationAttempt;
    setLitWords(reduced ? words.length : 0); setReadDone(false); setWaitBeat(0);
    const interval = Math.min(CEREMONY.wordLightMaxMs, CEREMONY.wordLightTotalMs / Math.max(1, words.length));
    const scheduled = reduced ? [] : words.map((_, i) => setTimeout(() => {
      setLitWords(i + 1);
      if ((i + 1) % 3 === 0 && AppState.currentState === 'active') playCreationSound('distillTick', .12);
    }, interval * (i + 1)));
    scheduled.push(setTimeout(() => setReadDone(true), reduced ? 180 : Math.min(160 * words.length, 2600)));
    [9000, 20000, 40000].forEach((ms, i) => scheduled.push(setTimeout(() => setWaitBeat(i + 1), ms)));
    return () => scheduled.forEach(clearTimeout);
  }, [beat === 'develop', ownPhoto, generationAttempt, reduced]);
  // Local photos settle as soon as they decode; upload is independent of their presentation.
  useEffect(() => {
    if (photos.length && !props.onPhotoConfirm) actions.prepareUploads(photos);
  }, [photos.map(photo => photo.key).join('|')]);
  useEffect(() => {
    if (beat !== 'develop') return;
    if (ownPhoto && photos.length > 0 && photos.every(photo => developed.has(photo.uri))) setBeat('keep');
    if (!ownPhoto && !reading) {
      const usable = state.ready.filter(item => item.imageUrl && developed.has(item.imageUrl) && !failedImages.has(item.imageUrl));
      if (state.selectable && usable.length > 0) setBeat('choose');
    }
  }, [beat, ownPhoto, developed, failedImages, photos, reading, state.selectable, state.ready.map(item => item.imageUrl).join('|')]);
  const resumed = useRef(false);
  useEffect(() => {
    if (!props.resumeGeneration) { resumed.current = false; return; }
    if (!scopeReady || !props.resumeGeneration || resumed.current || !descriptionRef.current.trim()) return;
    resumed.current = true; props.onResumeGenerationConsumed?.();
    const pending = pendingGeneration.current;
    if (pending) void generate(pending.text, undefined, undefined, pending.refs, pending.options);
    else void generate(descriptionRef.current);
  }, [props.resumeGeneration, description, scopeReady]);

  const generate = async (text: string, referenceId?: string | null, photo?: VisionStartPhoto | null, selectedReferences?: VisionReferenceAttachment[], options?: VisionSceneRequestOptions) => {
    if (!scopeReady || actions.starting || generationStarting.current || committedRef.current) return false;
    generationStarting.current = true;
    pendingGeneration.current = { text, refs: selectedReferences ?? (conversation ? references : undefined), options };
    const fromChoose = beat === 'choose', priorDeveloped = developed;
    setResumeDismissed(true); setViewedRoundId(null); setViewedRoundSnapshot(null); setChoicePlacements({});
    setDescription(text); setPhotos([]); setActivePhotoId(null); setPhotoCaptions({}); setFailedImages(new Set()); setChosen(null); setDeveloped(new Set()); setRevealStarted(false); actions.setNotice(null);
    setGenerationPending(true); setGenerationAttempt(value => value + 1);
    requestTime.current = Date.now(); setBeat('develop');
    const structured = selectedReferences ?? (conversation ? references : undefined);
    const started = await actions.generate(text, structured ? null : referenceId, structured ? null : photo, structured, options);
    generationStarting.current = false;
    if (!alive.current) return false;
    setGenerationPending(false);
    // At the limit, "Neither" is a dead end: stay on the developed pair and say why.
    if (!started && fromChoose && displayedRound) { setViewedRoundId(displayedRound.id); setViewedRoundSnapshot(displayedRound); setDeveloped(priorDeveloped); setBeat('choose'); }
    else if (!started && fromChoose && actions.generation.lastErrorCode?.() === 'VISION_GENERATION_LIMIT') { setDeveloped(priorDeveloped); setBeat('choose'); }
    else if (!started) setBeat('describe');
    if (started) pendingGeneration.current = null;
    return started;
  };
  const [fitRequest, setFitRequest] = useState<{ photo: CeremonyPhoto; size: { width: number; height: number } } | null>(null);
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!props.regenerating || freshScopeStarted.current || conversation?.loaded === false) return;
    freshScopeStarted.current = true;
    void (async () => {
      await conversation?.startDifferent();
      if (alive.current) setScopeReady(true);
    })().catch(() => actions.setNotice('Reconnect to start a different scene. Your board image is safe.'));
  }, [props.regenerating, conversation?.loaded]);
  useEffect(() => {
    if (!props.autoStart || autoStarted.current || conversation?.loaded === false) return;
    autoStarted.current = true;
    const photo = props.initialStartPhoto ?? null;
    void (async () => {
      if (session && props.initialSessionId !== session.id) await conversation?.startDifferent();
      await generate(descriptionRef.current, photo ? null : undefined, photo);
    })().catch(cause => { actions.setNotice(cause instanceof Error ? cause.message : copy.failed); setBeat('describe'); });
  }, [conversation?.loaded]);
  const pick = async (source: 'library' | 'camera') => {
    if (committedRef.current) return;
    if (mode === 'add') AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: source });
    await picker.run(() => actions.pickImages(mode === 'create', source), picked => {
      if (!picked || !alive.current) return;
      void (async () => {
        // One personal photo that is not the Vision's portrait frame is offered a fit; several are shown whole as before.
        if (picked.length === 1) {
          const size = await readPhotoSize(picked[0].uri);
          if (!alive.current) return;
          if (size && assessPhotoFit(size).relation !== 'fits') { setFitRequest({ photo: picked[0], size }); return; }
        }
        applyPicked(picked);
      })();
    });
  };
  const applyPicked = (picked: CeremonyPhoto[]) => {
    setPhotos(picked); setActivePhotoId(picked[0]?.key ?? null);
    setPhotoCaptions(Object.fromEntries(picked.map(photo => [photo.key, prefillVisionCaption(anchorIntention)])));
    setFailedImages(new Set()); setChosen(0); setDeveloped(new Set()); setRevealStarted(false); setReframe({ x: 0, y: 0 }); setBeat('develop');
  };
  const replaceCurrentPhoto = async () => {
    if (props.onChooseAgain) { props.onChooseAgain(); return; }
    const previous = photos[activePhotoIndex];
    if (!previous) return;
    await picker.run(() => actions.pickImages(false, previous.sourceType === 'USER_CAMERA' ? 'camera' : 'library'), replacement => {
      if (!replacement?.[0] || !alive.current) return;
      const next = replacement[0];
      setPhotos(current => current.map(photo => photo.key === previous.key ? next : photo));
      setActivePhotoId(next.key);
      setPhotoCaptions(current => ({ ...current, [next.key]: current[previous.key] ?? prefillVisionCaption(anchorIntention) }));
      setFailedImages(current => new Set([...current].filter(uri => uri !== previous.uri)));
      setDeveloped(current => new Set([...current].filter(uri => uri !== previous.uri)));
      setBeat('develop');
    });
  };
  const retryGeneration = async () => {
    setFailedImages(new Set()); setGenerationPending(true); setGenerationAttempt(value => value + 1); setRevealStarted(false); setBeat('develop');
    await actions.generation.retry();
    if (alive.current) setGenerationPending(false);
  };
  const retryFailedGeneratedImages = async () => {
    const failed = new Set(failedImages);
    const failedSlots = state.slots.filter((item): item is VisionGenerationCandidate => Boolean(item?.imageUrl && failed.has(item.imageUrl)));
    const keys = failedSlots.map(item => item.assetId ?? item.id);
    setFailedImages(new Set());
    setDeveloped(current => new Set([...current].filter(uri => !failed.has(uri))));
    if (displayedRound && conversation) {
      const refreshed = await conversation.refresh();
      const refreshedRound = refreshed?.rounds.find(round => round.id === displayedRound.id);
      if (refreshedRound) { setViewedRoundId(refreshedRound.id); setViewedRoundSnapshot(refreshedRound); if (actions.generation.job?.id === refreshedRound.id) actions.generation.restoreJob?.(refreshedRound); }
    } else await actions.generation.refresh();
    if (!alive.current) return;
    stableUrls.current.clear();
    setImageRetryTokens(current => Object.fromEntries([...new Set([...Object.keys(current), ...keys])].map(key => [key, (current[key] ?? 0) + (keys.includes(key) ? 1 : 0)])));
  };
  // One choice per Choose beat: a second tap before the beat re-renders must not repeat the cue, the haptic or the event.
  // Cleared only when Choose is entered again (See both again, or fresh candidates), never by the choice's own re-render.
  const choosing = useRef(false);
  useEffect(() => { if (beat === 'choose') choosing.current = false; }, [beat]);
  const choose = (index: number, item: VisionGenerationCandidate, explicitSelection = false) => {
    if (!item.imageUrl || !item.assetId || failedImages.has(item.imageUrl) ||
      (!explicitSelection && !developed.has(item.imageUrl)) || committedRef.current || choosing.current) return;
    choosing.current = true;
    void v2Haptics.selection(); playCreationSound('revealSettle');
    AnalyticsService.track('vision_image_selected', { anchor_id: anchorId,
      ...(props.visionId ? { vision_id: props.visionId } : {}), asset_id: item.assetId, source_type: 'AI_GENERATED' });
    setChosen(index); setReframe({ x: 0, y: 0 }); setBeat('keep');
    if (displayedRound) { setViewedRoundId(displayedRound.id); setViewedRoundSnapshot(displayedRound); persistSelection({ selectedCandidateId: item.id, viewedRoundId: displayedRound.id }); }
  };
  const save = async () => {
    if (savingRef.current || savedRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError(null);
    try {
      const index = chosen ?? 0;
      const measureIndex = ownPhoto ? activePhotoIndex : index;
      const [image, anchor] = await Promise.all([measure(printRefs.current[measureIndex]), measure(anchorRef.current)]);
      const selection = { image, anchor };
      let result: boolean | void;
      if (ownPhoto && latest.current.onPhotoConfirm) {
        const error = await latest.current.onPhotoConfirm(activePhotoCaption.trim());
        if (error) throw new Error(error);
        result = true;
      } else if (ownPhoto) result = await actions.saveUploads(photos, descriptionRef.current, activePhotoCaption.trim(), selection, photoCaptions, activePhotoId ?? undefined);
      else {
        if (!candidate?.assetId) throw new Error(copy.saveError);
        const currentDescription = session?.description || conversation?.draft.current?.description || descriptionRef.current;
        const asset = { assetId: candidate.assetId, prompt: candidate.prompt || currentDescription.trim(), caption: caption.trim() };
        result = props.onAdd ? await props.onAdd(asset) : await props.onAssemble({ description: startPhoto ? photoVisionDescription(currentDescription.trim(), anchorIntention) : currentDescription.trim(),
          selectedAssets: [{ ...asset, imageUrl: candidate.imageUrl ?? undefined, sourceType: 'AI_GENERATED' }], selection });
      }
      if (result === false) throw new Error(ownPhoto ? copy.photoError : copy.saveError);
      savedRef.current = true;
      // The board save already validated the exact asset. Session completion is replayable and
      // must never repeat the board mutation if the network drops during this acknowledgement.
      if (!ownPhoto && candidate && session) void conversation?.update({ selectedCandidateId: candidate.id, viewedRoundId: displayedRound?.id, status: 'SEALED' }).catch(() => undefined);
      const elapsed = Date.now() - requestTime.current;
      later(() => setBeat('pinned'), skipRequested.current ? 0 : Math.max(0, ceremonyDuration(CEREMONY.printMoveMs + CEREMONY.stampMs, reduced) + CEREMONY.sealHoldMs - elapsed));
    } catch (cause) {
      setSealingActive(false);
      if (alive.current) setSaveError(cause instanceof Error ? cause.message : copy.saveError);
    } finally { savingRef.current = false; if (alive.current) setSaving(false); }
  };
  const commit = () => {
    if (committedRef.current) return;
    setSealingActive(true);
    committedRef.current = true; requestTime.current = Date.now(); setCommitted(true);
    const edited = (ownPhoto ? activePhotoCaption : caption).trim() !== prefillVisionCaption(anchorIntention);
    AnalyticsService.track('vision_seal_completed', { anchor_id: anchorId, mode: analyticsMode, path, caption_edited: edited, hold_attempts: attempts.current });
    if (edited) AnalyticsService.track('vision_caption_edited', { anchor_id: anchorId, length: (ownPhoto ? activePhotoCaption : caption).trim().length });
    later(() => {
      if (firstImage) void safeHaptics.impact(ImpactFeedbackStyle.Heavy);
      const sound = playCreationSound('seal');
      visionCelebrationTrace('seal stamp', firstImage ? 4 : 2, firstImage, Boolean(sound));
    }, ceremonyDuration(CEREMONY.printMoveMs + CEREMONY.stampMs, reduced));
    // The seal is a celebration, so it asks the coordinator before anything else plays over it. 'deferred' means a
    // higher scene is playing: this ceremony still runs, and it leaves the coordinator at its hand-off.
    const id = `vision-ceremony:${++visionCeremonySequence}`;
    celebrationRef.current = id; setCelebrationId(id);
    const level: CelebrationLevel = firstImage && !reduced ? 4 : 2;
    const durationMs = reduced ? REDUCED_SCENE_MS : SCENE_MS;
    useCelebrationStore.getState().request(level, id, { durationMs, onSkip: settleNow });
    void save();
  };
  const sealLine = useSharedValue(0);
  const sealLineStyle = useAnimatedStyle(() => ({ opacity: sealLine.value, transform: [{ scaleX: sealLine.value }] }));
  const boardRise = useSharedValue(height), ripple = useSharedValue(0), stamp = useSharedValue(1), breath = useSharedValue(0);
  const wordExit = useSharedValue(0);
  useEffect(() => { wordExit.value = withTiming(reading ? 0 : 1, { duration: ceremonyDuration(900, reduced) }); }, [reading, reduced]);
  useEffect(() => {
    if (reduced || lowPerformance || !foreground || beat !== 'develop') { cancelAnimation(breath); breath.value = 0; return; }
    breath.value = withRepeat(withSequence(withTiming(1, { duration: 1300 }), withTiming(0, { duration: 1300 })), -1);
    return () => cancelAnimation(breath);
  }, [reduced,lowPerformance,foreground,beat]);
  useEffect(() => {
    if (!committed) return;
    const timer = setTimeout(() => {
      sealLine.value = withTiming(1, { duration: ceremonyDuration(CEREMONY.stampMs, reduced) });
      stamp.value = reduced ? 1 : withSequence(withTiming(1.5, { duration: 0 }), withTiming(.92, { duration: 300 }), withTiming(1, { duration: 250 }));
    }, ceremonyDuration(CEREMONY.printMoveMs, reduced));
    const landed = setTimeout(() => {
      setStampComplete(true);
      ripple.value = 0; ripple.value = withTiming(1, { duration: ceremonyDuration(CEREMONY.rippleMs, reduced) });
    }, ceremonyDuration(CEREMONY.printMoveMs + CEREMONY.stampMs, reduced));
    return () => { clearTimeout(timer); clearTimeout(landed); };
  }, [committed, reduced]);
  /** The print reaches its board place once: the flight to it (unless skipped), then the hand-off. */
  const handOff = (instant: boolean) => {
    if (boardHandedOff.current || handOffInFlight.current || !foregroundRef.current) return;
    handOffInFlight.current = true;
    void (async () => {
      try {
        if (!instant) {
          const saved = latest.current.savedImages;
          if (saved?.length && arrival?.beginSet) {
            const prints = await Promise.all(saved.map(async (item, index) => ({
              ...item, source: await measure(printRefs.current[ownPhoto ? index : chosen ?? 0]),
            })));
            if (!alive.current || !foregroundRef.current) return;
            const fallback = await measure(printRefs.current[ownPhoto ? activePhotoIndex : chosen ?? 0]);
            arrival.beginSet(prints.flatMap(item => item.source || fallback ? [{ ...item, source: (item.source ?? fallback)! }] : []), firstImage);
          } else {
            const measureIndex = ownPhoto ? activePhotoIndex : chosen ?? 0;
            const image = await measure(printRefs.current[measureIndex]);
            if (!alive.current || !foregroundRef.current) return;
            const url = latest.current.savedImageUrl ?? heroUri;
            if (url && image) { arrival?.begin(url, image, undefined, 'paper'); arrival?.resolve(url); }
          }
        }
        if (!alive.current || !foregroundRef.current) return;
        if (celebrationRef.current) useCelebrationStore.getState().finish(celebrationRef.current);
        boardHandedOff.current = true;
        setSealingActive(false);
        latest.current.onPinned?.({ firstImage });
      } finally {
        handOffInFlight.current = false;
      }
    })();
  };
  /** A skip, or a higher scene preempting this one, lands the ceremony on the settled board: no rise, no flight. */
  const settleNow = () => {
    skipRequested.current = true;
    if (!committedRef.current || boardHandedOff.current || !savedRef.current) return;
    boardRise.value = 0; setBeat('pinned');
    handOff(true);
  };
  useEffect(() => {
    if (beat !== 'pinned' || !foreground) return;
    const instant = skipRequested.current;
    const total = instant ? 0 : ceremonyDuration(CEREMONY.boardRiseMs, reduced);
    const elapsed = boardRiseStartedAt.current === null ? 0 : Date.now() - boardRiseStartedAt.current;
    const duration = instant || reduced ? 0 : Math.max(0, Math.min(boardRiseRemaining.current, total - elapsed));
    if (instant || reduced) { boardRise.value = 0; boardRiseRemaining.current = 0; }
    else { boardRiseStartedAt.current = Date.now(); boardRise.value = withTiming(0, { duration, easing: Easing.bezier(.7, 0, .2, 1) }); }
    const timer = setTimeout(() => { boardRiseStartedAt.current = null; boardRiseRemaining.current = 0; handOff(instant); }, duration);
    return () => {
      clearTimeout(timer);
      if (boardRiseStartedAt.current !== null) {
        const passed = Date.now() - boardRiseStartedAt.current;
        boardRiseRemaining.current = Math.max(0, boardRiseRemaining.current - passed);
        boardRiseStartedAt.current = null;
        cancelAnimation(boardRise);
      }
    };
  }, [beat, foreground]);
  const boardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: boardRise.value }] }));
  const stampStyle = useAnimatedStyle(() => ({ transform: [{ scale: stamp.value }], opacity: 1 - breath.value * .25 }));
  const rippleStyle = useAnimatedStyle(() => ({ opacity: reduced ? 0 : (1 - ripple.value) * .8, transform: [{ scale: .6 + ripple.value * 2.6 }] }));
  const wordsStyle = useAnimatedStyle(() => ({ opacity: 1 - wordExit.value, transform: [{ translateY: reduced ? 0 : -30 * wordExit.value }] }));

  // Ask reads top-down: copy, 28pt, frame (at most 30% of usable height), 32pt, buttons. The footer
  // pins to the bottom only when that stack would overlap it, and the frame shrinks to keep the gap.
  const askTop = insets.top + 60, askFrameY = askTop + askCopyH + 28;
  const askFooterLimit = height - insets.bottom - 12 - askFooterH;
  const askH = Math.max(96, Math.min(Math.min(width * .52, usable * .30 / 1.25) * 1.25, askFooterLimit - 32 - askFrameY));
  const askW = askH / 1.25, askFooterTop = Math.min(askFrameY + askH + 32, askFooterLimit);
  // DEFERRED: replaced by VisionEntrance (Oct 2026)
  // const addPreview = mode === 'add' && Boolean(props.previewImageUrl);
  // const example = visionDescriptionExample(anchorIntention, anchorCategory);
  const curateW = Math.min(ownPhoto && photos.length > 1 ? width - 72 : width * .77, usable * .52 * .8);
  const sealW = Math.min(width * .59, usable * .34 * .8), twoW = (width - 62) / 2;
  const curateY = insets.top + usable * .11, sealY = insets.top + usable * .055, keepY = curateY + usable * .04;
  // Keep: lift the hero so its caption strip clears the keyboard by 16pt.
  const lift = beat === 'keep' && keyboardH > 0 ? Math.max(0, keepY + curateW * 1.25 + 54 + 16 - (height - keyboardH)) : 0;
  const printPlacement = (index: number, stackPosition = index): PrintPlacement => {
    const hero = ownPhoto ? stackPosition === 0 : index === chosen;
    // The entrance owns Ask; these prints stay invisible until Develop begins.
    if (beat === 'ask' || beat === 'describe') return { x: (width - askW) / 2, y: askFrameY, width: askW, height: askH, rotation: 0, opacity: 0 };
    if (beat === 'keep') return { x: (width - curateW) / 2, y: hero || ownPhoto ? keepY : height + 80,
      width: curateW, height: curateW * 1.25 + 54, rotation: ownPhoto || hero ? 0 : 8, opacity: ownPhoto || hero ? 1 : 0 };
    if (beat === 'seal' || beat === 'pinned') return { x: (width - sealW) / 2 + (ownPhoto ? stackPosition * 5 : 0), y: sealY + stackPosition * (ownPhoto ? 5 : 0),
      width: sealW, height: sealW * 1.25 + 54, rotation: hero ? 0 : stackPosition % 2 ? 3 : -3, opacity: hero || (ownPhoto && stackPosition < 3) ? 1 : 0 };
    if (ownPhoto) return { x: (width - curateW) / 2, y: keepY, width: curateW, height: curateW * 1.25 + 54, rotation: 0, opacity: 1 };
    if (refineCandidate) return { x: (width - 126) / 2, y: insets.top + 38, width: 126, height: 164, rotation: 0, opacity: index === refineCandidate.sortOrder ? 1 : 0 };
    if (beat === 'choose' && displayedRound && choicePlacements[index]) return { ...choicePlacements[index], opacity: 1 };
    return { x: 24 + index * (twoW + 14), y: insets.top + usable * .33, width: twoW, height: twoW * 1.5,
      rotation: index === 0 ? -1.2 : 1.2, opacity: reading ? 0 : 1 };
  };
  const activePrintPlacement = printPlacement(activePhotoIndex, 0);
  const anchorSize = beat === 'seal' && !committed ? 128 : committed ? 78 : 48;
  // While the entrance plays its open it owns the big centre anchor; this one appears when the lift lands.
  const openPlaying = beat === 'ask' && !entrancePlayed.current && !reduced && !handedOff;
  const anchorPosition: PrintPlacement = { x: committed ? (width + sealW) / 2 - 62 : (width - anchorSize) / 2,
    y: committed ? sealY + sealW * 1.25 - 106 : beat === 'seal' ? insets.top + usable * .69 : insets.top + usable * .025,
    // Describe scrolls under a fixed mark, so the mark steps aside there and returns on Develop.
    width: anchorSize, height: anchorSize, opacity: beat === 'describe' || openPlaying || committed ? 0 : 1 };
  const fade = ceremonyDuration(CEREMONY.stageFadeMs, reduced);
  const status = reading ? copy.reading
    : waitBeat >= 3 ? copy.wait40 : waitBeat >= 2 ? copy.wait20 : state.ready.length === 1 ? copy.second : waitBeat >= 1 ? copy.developingImages : copy.composing;
  const showCaption = ownPhoto || ['keep', 'seal', 'pinned'].includes(beat);
  const limitReached = actions.generation.errorCode === 'VISION_GENERATION_LIMIT';
  const liftY = useSharedValue(0);
  useEffect(() => { liftY.value = withTiming(-lift + (stampComplete ? 4 : 0), { duration: reduced ? 0 : 250 }); }, [lift, reduced, stampComplete]);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: liftY.value }] }));
  // DEFERRED: replaced by VisionEntrance (Oct 2026). The old frame suggestion, and its vision_ceremony_suggestion_tapped event.
  // const suggest = () => {
  //   if (mode === 'add') AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: 'AI_GENERATED' });
  //   setDescription(example); setInputPath('words'); setBeat('describe'); void v2Haptics.selection();
  //   AnalyticsService.track('vision_ceremony_suggestion_tapped', { anchor_id: anchorId, mode: analyticsMode });
  // };
  const startDescribe = () => {
    if (mode === 'add') AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: 'AI_GENERATED' });
    setBeat('describe');
  };
  const back = () => {
    if (committedRef.current) { if (beat === 'pinned') onBack(); return; }
    if (beat === 'choose' && displayedRound && displayedRound.roundNumber > 0) {
      const previous = rounds.filter(round => round.roundNumber < displayedRound.roundNumber).pop();
      if (previous) { showRound(previous.id); return; }
    }
    // Adding to an existing board never replays the entrance: Back from a request the Add sheet prepared, or from regenerating one image, returns to the board.
    const leavesToBoard = mode === 'add' && (props.autoStart || props.regenerating);
    if (leavesToBoard && (beat === 'describe' || beat === 'develop' || beat === 'choose')) { onBack(); return; }
    if (beat === 'describe') { setBeat('ask'); } else if (beat === 'seal') setBeat('keep');
    else if (beat === 'keep' && !ownPhoto) { setChosen(null); setBeat('choose'); }
    else if (beat === 'develop' || beat === 'choose') setBeat('describe'); else onBack();
  };
  const link = (text: string, onPress: () => void, id?: string) => <Pressable key={text} testID={id} accessibilityRole="button" accessibilityLabel={text} onPress={onPress} style={styles.link}><Text style={styles.linkText}>{text}</Text></Pressable>;
  const primary = (text: string, onPress: () => void, ghost = false) => <Pressable testID={text === copy.keep ? 'vision-ceremony-keep' : text === copy.completeVision ? 'vision-complete-vision' : undefined} accessibilityRole="button" accessibilityLabel={text} onPress={() => { playCreationSound('uiTap'); onPress(); }}
    style={[styles.button, ghost && styles.ghost]}><Text style={[styles.buttonText, ghost && styles.ghostText]}>{text}</Text></Pressable>;

  return <View testID={testID} style={styles.stage}>
    <StatusBar barStyle="light-content" />
    {beat === 'pinned' ? <Animated.View pointerEvents="none" style={[styles.board, { height: height + 50 }, boardStyle]}><VisionTornEdge width={width} color={colors.canvas} /><View style={styles.boardFill} /></Animated.View> : null}
    {/* DEFERRED: replaced by VisionEntrance (Oct 2026). Add mode's preview print behind the empty frame (testID vision-ceremony-preview). */}
    {/* Prints and Anchor are siblings of the changing copy, so neither ever remounts at a beat boundary. */}
    {ownPhoto ? <VisionPhotoStack items={photos} activeId={activePhotoId ?? photos[0]?.key ?? ''} onActiveIdChange={id => { if (!committedRef.current) setActivePhotoId(id); }}
      interactive={(beat === 'develop' || beat === 'keep') && keyboardH === 0} cardWidth={curateW}
      hitTargetStyle={{ left: activePrintPlacement.x + 12, top: activePrintPlacement.y + 8,
        width: Math.max(0, activePrintPlacement.width - 24),
        height: Math.max(0, activePrintPlacement.height - CEREMONY.captionStripPts - 16) }}
      indicatorStyle={{ top: activePrintPlacement.y + activePrintPlacement.height + 4, bottom: undefined }}
      renderItem={({ item, index, stackPosition, active, visible }) => <VisionPrintSlot key={item.key} placement={printPlacement(index, beat === 'keep' || beat === 'develop' ? 0 : stackPosition)}
        zIndex={30} testID={`vision-ceremony-slot-${index}`}>
        <Animated.View style={[styles.fill, liftStyle, !visible && { opacity: 0 }]} pointerEvents={active && beat === 'keep' ? 'auto' : 'none'}>
          <VisionPrint uri={item.uri} developing={false} instant captionHint={beat === 'keep'} revealed={beat !== 'ask' && beat !== 'describe'}
            empty={beat === 'ask' || beat === 'describe'} active={foreground} showCaption={showCaption}
            caption={photoCaptions[item.key] ?? prefillVisionCaption(anchorIntention)} pinned={false}
            revealDelayMs={0} pressed={stampComplete} imageRef={node => { printRefs.current[index] = node; }}
            onRevealStart={() => setRevealStarted(true)} onImageError={uri => {
              setFailedImages(previous => new Set(previous).add(uri));
              setActivePhotoId(photos.find(photo => photo.uri === uri)?.key ?? activePhotoId);
              setBeat('keep');
            }} onDeveloped={value => { setDeveloped(previous => new Set(previous).add(value)); visionCelebrationTrace(ownPhoto ? 'photo settled' : 'print developed'); }}
            onChangeCaption={beat === 'keep' && active ? value => setPhotoCaptions(previous => ({ ...previous, [item.key]: value })) : undefined} reframe={reframe}
            onReframe={beat === 'keep' && active ? setReframe : undefined} testID={`vision-ceremony-print-${index}`} />
        </Animated.View>
      </VisionPrintSlot>} />
      : Array.from({ length: 2 }, (_, index) => {
        const item = state.slots[index];
        const uri = item?.imageUrl ?? undefined;
        return <VisionPrintSlot key={item?.assetId ?? `generated-print-${index}`} placement={printPlacement(index)} testID={`vision-ceremony-slot-${index}`}>
          <Animated.View style={[styles.fill, { zIndex: 1 }, liftStyle, beat === 'choose' && displayedRound && !refineCandidate ? { opacity: 0 } : undefined]} pointerEvents={index === chosen || beat === 'choose' ? 'auto' : 'none'}>
            <VisionPrint uri={uri} developing={beat === 'develop'} revealMs={2400} inkRevealMs={2400} revealed={beat !== 'ask' && beat !== 'describe' && !reading}
              empty={beat === 'ask' || beat === 'describe'} active={foreground} showCaption={showCaption && index === chosen} caption={caption} pinned={false}
              revealDelayMs={0} pressed={stampComplete} imageRef={node => { printRefs.current[index] = node; }} onRevealStart={() => setRevealStarted(true)}
              onImageError={value => { setFailedImages(previous => new Set(previous).add(value)); setBeat('develop'); }}
              retryToken={item ? imageRetryTokens[item.assetId ?? item.id] ?? 0 : 0}
              onDeveloped={value => { setDeveloped(previous => new Set(previous).add(value)); visionCelebrationTrace(ownPhoto ? 'photo settled' : 'print developed'); }}
              onChangeCaption={beat === 'keep' && index === chosen ? setCaption : undefined} reframe={reframe}
              onReframe={beat === 'keep' && index === chosen ? setReframe : undefined} testID={`vision-ceremony-print-${index}`} />
            {beat === 'choose' && item ? <Pressable testID={`scene-candidate-${item.id}`} accessibilityRole="imagebutton" accessibilityLabel={`Choose image ${index + 1}`}
              disabled={!item.imageUrl || !developed.has(item.imageUrl) || failedImages.has(item.imageUrl)} onPress={() => choose(index, item)} style={styles.fill} /> : null}
          </Animated.View>
        </VisionPrintSlot>;
      }).reverse()}
    {beat === 'ask' && !resumeVisible ? <VisionEntrance key="entrance" mode={mode} anchorId={anchorId} category={resolveAnchorCategory(anchorCategory)} anchorArt={anchorArt}
      previewImageUrl={props.previewImageUrl} previewCaption={props.previewCaption?.trim() || anchorIntention} firstRun={!entrancePlayed.current} active={foreground}
      notice={actions.notice} anchorTarget={anchorPosition} onAnchorHandoff={() => setHandedOff(true)} onBack={back}
      onWords={startDescribe} canAddImage={props.canAddImage} /> : null}
    {committed ? <Animated.View pointerEvents="none" testID="vision-seal-stamp-line" style={[{ position: 'absolute', zIndex: 42, left: (width - sealW) / 2 + 10, top: sealY + sealW * 1.25 + 12, width: sealW - 20, height: 1, backgroundColor: '#B08A4A' }, sealLineStyle]} /> : null}
    <VisionPrintSlot placement={anchorPosition} nodeRef={anchorRef} testID="vision-ceremony-anchor">
      <Animated.View style={[styles.mark, stampStyle]}>
        {committed ? <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} /> : null}
        <VisionSealHold active={beat === 'seal'} committed={committed} reduced={reduced} holdMs={CEREMONY.sealHoldMs} onCommit={commit}
          onBegin={() => { attempts.current += 1; if (!sealStarted.current) { sealStarted.current = true; AnalyticsService.track('vision_seal_started', { anchor_id: anchorId, mode: analyticsMode, path }); } }}
          onAbandon={progress => AnalyticsService.track('vision_seal_abandoned', { anchor_id: anchorId, progress: Math.round(progress * 100) / 100 })}>
          {anchorArt ? <CircularAnchorRenderer {...anchorArt} size={anchorSize} appearance="bare" testID="vision-ceremony-anchor-art" /> : null}
        </VisionSealHold>
      </Animated.View>
    </VisionPrintSlot>
    {beat !== 'describe' && beat !== 'ask' && !(beat === 'choose' && displayedRound) ? <Animated.View key={beat} pointerEvents="box-none" entering={FadeIn.duration(fade)} exiting={FadeOut.duration(fade)} style={styles.fill}>
      {!committed || (beat === 'pinned' && foreground) ? <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={back} style={[styles.back, { top: insets.top + 10 }]}><ArrowLeft size={20} color="#F4EDE0" /></Pressable> : null}
      {/* DEFERRED: replaced by VisionEntrance (Oct 2026). The old Ask copy, intention line, category eyebrow, footer and footnote:
      // {beat === 'ask' ? <>
      // <View onLayout={event => setAskCopyH(Math.round(event.nativeEvent.layout.height))} style={[styles.copy, { top: askTop }]}>
      // <View style={styles.eyebrowRow}>{mode === 'create' ? <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(anchorCategory) }]} /> : null}<Text style={styles.eyebrow}>{mode === 'create' ? categoryLabel(anchorCategory) : copy.add}</Text></View>
      // <Text numberOfLines={2} style={styles.intention}>“{anchorIntention}”</Text><Text accessibilityRole="header" style={[styles.title, { fontSize: 36, lineHeight: 38 }]}>{mode === 'create' ? copy.askCreate : copy.askAdd}</Text>
      // </View>
      // <View onLayout={event => setAskFooterH(Math.round(event.nativeEvent.layout.height))} style={[styles.footer, { top: askFooterTop }]}>{primary(copy.words, () => {
      // if (mode === 'add') AnalyticsService.track('vision_image_add_started', { anchor_id: anchorId, source_type: 'AI_GENERATED' });
      // setInputPath('words'); setBeat('describe');
      // })}
      // {primary(copy.ownPhoto, () => { void pick('library'); }, true)}{link(copy.camera, () => { void pick('camera'); })}<Text style={styles.note}>{copy.footnote}</Text>
      // {actions.notice ? <Text accessibilityLiveRegion="polite" style={styles.error}>{actions.notice}</Text> : null}
      // </View>
      // </> : null}
      */}
      {beat === 'develop' || beat === 'choose' ? <>
        {!ownPhoto ? <View style={[styles.copy, { top: insets.top + usable * .13 }]}><Text style={styles.eyebrow}>{copy.yourVision}</Text><Text accessibilityRole="header" style={styles.title}>{beat === 'choose' ? copy.choose : copy.future}</Text></View> : null}
        {!ownPhoto && beat === 'develop' ? <Animated.View style={[styles.words, { top: insets.top + usable * .31 }, wordsStyle]}><Text style={styles.wordText}>{words.map((word, i) => <Text key={i} style={{ opacity: i < litWords ? 1 : .18 }}>{word} </Text>)}</Text></Animated.View> : null}
        <View style={[styles.copy, { top: insets.top + usable * .7 }]}>
          {beat === 'develop' && !ownPhoto ? <><Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
            <Svg width={150} height={10} accessible={false}><Path d="M1 5 Q75 2 149 5" stroke="#F4EDE0" strokeWidth={1.3} strokeDasharray={150} strokeDashoffset={150 * (1 - (reading ? .25 : state.ready.length ? .8 : .55))} fill="none" /></Svg>
            {!ownPhoto ? <Text style={styles.note}>{copy.waitNote}</Text> : null}</> : null}
          {!ownPhoto && (state.phase === 'failed' || failedImages.size > 0) ? <><Text style={styles.status}>{copy.failed}</Text><Text style={styles.note}>{failedImages.size > 0 ? copy.unavailable : state.ready.length ? copy.failedPartial : copy.failedBody}</Text>
            {link(copy.retry, () => { void (failedImages.size > 0 ? retryFailedGeneratedImages() : retryGeneration()); })}{link(copy.edit, () => setBeat('describe'))}</> : null}
          {(actions.notice || actions.generation.error) && !(beat === 'choose' && limitReached) ? <Text accessibilityLiveRegion="polite" style={styles.error}>{actions.notice ?? actions.generation.error}</Text> : null}
        </View>
        {beat === 'choose' ? <View style={[styles.footer, { bottom: insets.bottom + 30 }]}>
          {/* TODO(limit): SCENE jobs do not expose remaining generations; never invent a count. */}
          {limitReached ? <Text testID="vision-ceremony-limit" accessibilityLiveRegion="polite" style={styles.note}>{actions.generation.error}</Text>
            : link(copy.neither, () => { void generate(descriptionRef.current, startPhoto ? null : undefined, startPhoto ?? undefined); })}
        </View> : null}
      </> : null}
      {beat === 'keep' ? <>
        <View style={[styles.copy, { top: insets.top + usable * .10 }]}><Text style={styles.eyebrow}>{copy.caption}</Text></View>
        {keyboardH === 0 ? <View style={[styles.footer, { bottom: insets.bottom + 20 }]}>
          {ownPhoto && failedImages.size > 0 ? <Text accessibilityLiveRegion="polite" style={styles.note}>{copy.unavailable}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {ownPhoto ? link(copy.replace, () => { void replaceCurrentPhoto(); }) : canChooseAnotherGenerated ? link(copy.both, () => { setChosen(null); setBeat('choose'); }) : null}
            {(!ownPhoto || failedImages.size === 0) ? <View style={{ flex: 1 }}>{primary(ownPhoto || !canChooseAnotherGenerated ? copy.completeVision : copy.keep, () => { setBeat('seal'); commit(); })}</View> : null}
          </View>
        </View> : null}
      </> : null}
      {beat === 'seal' || beat === 'pinned' ? <>
        <View style={[styles.copy, { top: insets.top + usable * .52 }]}>
          {stampComplete ? <Animated.Text entering={FadeIn.duration(220)} accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.title}>{copy.sealed}</Animated.Text> : !committed ? <Text style={styles.title}>{copy.hold}</Text> : null}
          {committed ? <VisionHairline pending={saving} label={copy.saving} testID="vision-ceremony-saving" /> : <Text style={styles.note}>{copy.commitment}</Text>}{saveError ? <><Text accessibilityLiveRegion="polite" style={styles.error}>{saveError}</Text>{link(copy.retry, () => { void save(); }, 'vision-ceremony-save-retry')}</> : null}</View>
        {!committed ? <Text style={[styles.press, { bottom: insets.bottom + 30 }]}>{copy.press}</Text> : null}
      </> : null}
    </Animated.View> : null}
    {resumeVisible ? <View style={[styles.fill, { zIndex: 45, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <VisionResumeCard session={session} anchorArt={anchorArt} onContinue={() => continueSession()} onKeep={continueSession} onStartDifferent={() => { void startDifferent(); }} />
      <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onBack} style={[styles.back, { top: insets.top + 10 }]}><ArrowLeft size={20} color="#F4EDE0" /></Pressable>
    </View> : null}
    {beat === 'choose' && displayedRound && !refineCandidate ? <Animated.View key={`round-${displayedRound.id}`} entering={reduced ? undefined : FadeIn.duration(fade)} style={[styles.fill, { zIndex: 45 }]}>
      <VisionConversationSelection anchorArt={anchorArt} round={displayedRound} rounds={rounds.length ? rounds : [displayedRound]} selectedCandidateId={session?.selectedCandidateId ?? null}
        inspectCandidateId={inspectCandidateId} onInspectClosed={() => setInspectCandidateId(null)}
        onSelect={(item, index) => choose(index, item, true)} onRefine={item => openRefine(item)} onSelectRound={showRound} onViewCandidate={viewExactCandidate}
        onBack={back} onAnother={() => {
          if (displayedRound.roundNumber === 0 && rounds.length <= 1) {
            void generate(session?.description || descriptionRef.current, null, null, references, { operation: references.length > 1 ? 'COMPOSE' : 'CREATE', sessionId: displayedRound.sessionId });
            return;
          }
          const available = displayedRound.candidates.filter(item => item.assetId && item.imageUrl && item.status === 'SUCCEEDED');
          const vary = (source: VisionGenerationCandidate) => { void generate(session?.description || descriptionRef.current, null, null, references, { operation: 'VARIATE', parentCandidateId: source.id, sessionId: displayedRound.sessionId }); };
          const source = available.find(item => item.id === session?.selectedCandidateId);
          if (source || available.length === 1) vary(source ?? available[0]);
          else if (available.length > 1) Alert.alert('Which image would you like to vary?', 'Choose the source for this new version.', [
            ...available.map(item => ({ text: `Option ${item.sortOrder + 1}`, onPress: () => vary(item) })),
            { text: 'Cancel', style: 'cancel' },
          ]);
          else actions.setNotice('These source images are unavailable. Go back to another version or start a different scene.');
        }}
        onPrintLayout={(index, rect) => setChoicePlacements(current => {
          const placement = { ...rect, rotation: index === 0 ? -1.2 : 1.2 };
          const prior = current[index];
          return prior && Math.abs(prior.x - rect.x) < 1 && Math.abs(prior.y - rect.y) < 1 && Math.abs(prior.width - rect.width) < 1 && Math.abs(prior.height - rect.height) < 1 ? current : { ...current, [index]: placement };
        })}
        onImageError={uri => { setFailedImages(previous => new Set(previous).add(uri)); actions.setNotice('One image could not load. Retry the image or choose another option.'); }}
        onRetry={failedImages.size > 0 ? () => { void retryFailedGeneratedImages(); } : undefined}
        busy={actions.starting} error={actions.notice ?? actions.generation.error} />
    </Animated.View> : null}
    <VisionRefineSheet visible={Boolean(refineCandidate && refineRound)} source={refineCandidate?.imageUrl && refineRound ? {
      candidateId: refineCandidate.id, imageUrl: refineCandidate.imageUrl, optionNumber: refineCandidate.sortOrder + 1, roundNumber: refineRound.roundNumber,
    } : null} references={references} onChangeReferences={changeReferences}
      initialPrompt={conversation?.draft.current?.draftPrompt ?? ''} onChangePrompt={draftPrompt => conversation?.saveDraft({ draftPrompt })}
      onClose={() => setRefineCandidateId(null)} loading={actions.starting} error={actions.notice ?? actions.generation.error}
      onSubmit={async instruction => {
        if (!refineCandidate || !refineRound) return false;
        const accepted = await generate(instruction, null, null, references, { operation: 'EDIT', sessionId: refineRound.sessionId, parentCandidateId: refineCandidate.id });
        if (accepted) { setRefineCandidateId(null); conversation?.saveDraft({ draftPrompt: '' }); }
        return accepted;
      }} />
    {ownPhoto && (actions.uploadingCount > 0 || props.photoUploading) && !committed ? <View pointerEvents="none" style={{ position: 'absolute', left: (width - 150) / 2, top: activePrintPlacement.y + 12, zIndex: 42 }}><VisionHairline pending label="Uploading your photos" /></View> : null}
    {fitRequest ? <View style={[styles.fill, { zIndex: 60 }]}><VisionPhotoFit photo={fitRequest.photo} size={fitRequest.size} onPremiumRequired={props.onPremiumRequired}
      onCancel={() => setFitRequest(null)}
      onConfirm={({ photo: fitted }) => { const original = fitRequest.photo; setFitRequest(null); applyPicked([{ ...original, uri: fitted.uri, mimeType: fitted.mimeType }]); }} /></View> : null}
    {picker.state ? <VisionPickerHolding anchorArt={anchorArt} retrying={picker.state === 'retry'} onRetry={picker.retry} onBack={picker.dismiss} /> : null}
    {beat === 'describe' ? <Animated.View entering={FadeIn.duration(fade)} exiting={FadeOut.duration(fade)} style={styles.fill}>
      <VisionMomentInput mode={mode} anchorId={anchorId} anchorIntention={anchorIntention} anchorCategory={anchorCategory}
        anchorArt={anchorArt} anchorImageUrl={props.anchorImageUrl} onChangeDescription={setDescriptionFromInput}
        initialDescription={descriptionRef.current} onBack={back} onSubmit={generate} startPhotoEnabled startPhoto={conversation ? null : startPhoto} onChangeStartPhoto={setStartPhoto}
        references={conversation ? references : undefined} onChangeReferences={changeReferences}
        onDraftChange={text => { descriptionRef.current = text; conversation?.saveDraft({ description: text }); }}
        onAddPhotos={source => { void pick(source); }} loading={!scopeReady || actions.starting} error={actions.notice ?? actions.generation.error}
        ceremony testID={mode === 'create' ? 'v2-vision-creation-flow-prompt' : 'v2-vision-add-scene'} textInputTestID={mode === 'add' ? 'vision-scene-input' : undefined} />
    </Animated.View> : null}
    {/* Only while a skippable scene is the active one: a tap lands the ceremony on its settled board. */}
    {celebrationSkippable ? <Pressable testID="vision-ceremony-skip" accessible accessibilityRole="button" accessibilityLabel="Skip"
      style={styles.fill} onPress={() => { useCelebrationStore.getState().skip(); }} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#14162B', overflow: 'hidden' }, fill: { ...StyleSheet.absoluteFill },
  copy: { position: 'absolute', left: 24, right: 24, alignItems: 'center', gap: 10 },
  title: { fontFamily: VISION_SERIF, fontSize: 30, lineHeight: 33, color: '#F4EDE0', textAlign: 'center' },
  intention: { fontFamily: VISION_SERIF_ITALIC, fontSize: 19, color: '#E9DFCC', textAlign: 'center' },
  eyebrow: { fontFamily: 'Inter-SemiBold', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: '#ADAABC', textAlign: 'center' },
  eyebrowRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, categoryDot: { width: 6, height: 6, borderRadius: 3 },
  back: { position: 'absolute', left: 18, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: '#F4EDE029' },
  footer: { position: 'absolute', left: 24, right: 24, gap: 8 },
  button: { height: 50, borderRadius: 28, backgroundColor: '#F4EDE0', justifyContent: 'center', alignItems: 'center' },
  buttonText: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#14162B' }, ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#F4EDE048' }, ghostText: { color: '#F4EDE0' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, linkText: { fontFamily: 'Inter-Medium', fontSize: 13, color: '#C4BDCF', textDecorationLine: 'underline', textAlign: 'center' },
  note: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, color: '#ADAABC', textAlign: 'center' },
  error: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#F4EDE0', textAlign: 'center', lineHeight: 18 },
  words: { position: 'absolute', left: 30, right: 30 }, wordText: { fontFamily: VISION_SERIF_ITALIC, fontSize: 25, lineHeight: 33, color: '#F4EDE0', textAlign: 'center' },
  status: { fontFamily: VISION_SERIF_ITALIC, fontSize: 21, color: '#F4EDE0', textAlign: 'center' },
  // The anchor art carries its own disc; no extra border or backing (it read as a stray ring on device).
  mark: { flex: 1, borderRadius: 100 },
  ripple: { ...StyleSheet.absoluteFill, borderRadius: 100, borderWidth: 1, borderColor: '#F4EDE0' },
  press: { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: 'Inter-SemiBold', fontSize: 11, letterSpacing: 2, color: '#ADAABC' },
  board: { position: 'absolute', left: 0, right: 0, zIndex: 10 }, boardFill: { flex: 1, backgroundColor: colors.canvas },
  suggestion: { ...StyleSheet.absoluteFill, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 10 },
  suggestionLabel: { fontFamily: 'Inter-SemiBold', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#ADAABC', textAlign: 'center' },
  suggestionText: { fontFamily: VISION_SERIF_ITALIC, fontSize: 17, lineHeight: 24, color: 'rgba(244,237,224,0.72)', textAlign: 'center' },
  preview: { position: 'absolute', padding: 8, borderRadius: 3, backgroundColor: '#F7F1E6', transform: [{ rotate: '-4deg' }],
    shadowColor: '#000', shadowOpacity: .5, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 8 },
  previewImage: { flex: 1, backgroundColor: '#121427' },
});
