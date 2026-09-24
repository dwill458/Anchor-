import React, { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Check, Circle, Compass, ImagePlus, LayoutTemplate, Mail } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { CircularAnchorRenderer, V2Button, V2IconButton, V2Screen } from '@/components/v2';
import { FIRST_RUN_DIRECTIONS, FIRST_RUN_FOCUS_SECONDS, type FirstRunDirection } from '@/constants/v2/firstRun';
import { useFirstRunStore, type FirstRunStep, type VisionChoice } from '@/stores/v2';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { AuthService } from '@/services/AuthService';
import { PracticeCompletionService } from '@/services/PracticeCompletionService';
import { AnalyticsService } from '@/services/AnalyticsService';
import type { Anchor } from '@/types';
import { colors, getCategoryColor, practiceColors, spacing, typography } from '@/theme/v2';
import { v2Haptics } from '@/hooks/v2';
import { V2CreationFlow, type CreationGenerationAdapter, type CreationSaveAdapter } from '@/components/v2/creation/V2CreationFlow';
import { generateExpressionCandidates } from '@/services/v2/creationPersistence';

/** The steps in which a first Anchor is being made — all of them the shared creation flow. */
const CREATING_STEPS: FirstRunStep[] = ['intention', 'formation', 'anchor', 'expression'];

const generateFirstExpression: CreationGenerationAdapter = ({ draft, generationAttempt, count }) =>
  generateExpressionCandidates({ draft, generationAttempt, count });

const backStep: Partial<Record<FirstRunStep, FirstRunStep>> = { intention: 'direction', formation: 'intention', anchor: 'formation', expression: 'anchor', vision: 'expression', focus: 'vision', auth: 'focus' };

function track(name: string, properties: Record<string, unknown> = {}) { AnalyticsService.track(name, properties); }

/**
 * Keeps the first Anchor on the device: there is no account yet. It is written to the account
 * with everything else when the user saves at the end of onboarding.
 */
const saveFirstAnchor: CreationSaveAdapter = async ({ draft }) => {
  if (!draft.structureSvg || !draft.distilledLetters?.length) throw Object.assign(new Error('The Anchor structure is not ready.'), { failure: 'server' });
  const anchorId = useFirstRunStore.getState().adoptCreation({
    intention: draft.normalizedIntention ?? draft.intention.trim(),
    category: draft.category,
    distilledLetters: draft.distilledLetters,
    anchorSvg: draft.structureSvg,
    expression: draft.expression,
    styleChoice: draft.expression === 'original' ? undefined : draft.styleChoice,
    enhancedImageUrl: draft.selectedCandidateIndex >= 0 ? draft.enhancedImageUrl : undefined,
  });
  return { anchorId };
};

export function V2FirstRunFlow() {
  const navigation = useNavigation<any>();
  const { draft, hydrated, setDirection, setVisionChoice, setStep, markFocusCompleted, markFocusRecorded, markAuthCompleted, markAnchorPersisted, complete } = useFirstRunStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (hydrated && draft.currentStep === 'complete') navigation.reset({ index: 0, routes: [{ name: 'V2DevelopmentHome' }] }); }, [draft.currentStep, hydrated, navigation]);
  useEffect(() => { if (hydrated && draft.currentStep === 'direction') track('v2_first_run_started'); }, [draft.currentStep, hydrated]);
  const go = (step: FirstRunStep) => { setError(null); setStep(step); };
  const back = () => { const target = backStep[draft.currentStep]; if (target) go(target); };
  if (!hydrated) return <V2Screen><View style={styles.center}><Text style={styles.body}>Restoring your first Anchor…</Text></View></V2Screen>;

  // The first Anchor is created by the same continuous flow as every later one: the words,
  // distillation, the square, the construction, expression and the two interpretations.
  if (CREATING_STEPS.includes(draft.currentStep)) {
    return (
      <V2CreationFlow
        saveAnchor={saveFirstAnchor}
        generateExpression={generateFirstExpression}
        onComplete={() => {
          v2Haptics.confirmation();
          track('v2_anchor_created', { category: useFirstRunStore.getState().draft.category });
          go('vision');
        }}
        onExit={() => go('direction')}
        onSignIn={() => navigation.navigate('V2Auth', { initialMode: 'signin' })}
      />
    );
  }

  const chrome = draft.currentStep !== 'direction' && draft.currentStep !== 'focus' && draft.currentStep !== 'auth' ? <V2IconButton icon={<ArrowLeft size={20} color={colors.text.primary} />} accessibilityLabel="Go back" onPress={back} /> : null;
  return <V2Screen scroll={draft.currentStep !== 'focus'} keyboardAvoiding={draft.currentStep === 'intention'} contentContainerStyle={styles.scroll} testID={`v2-first-run-${draft.currentStep}`}>
    {chrome ? <View style={styles.top}>{chrome}</View> : null}
    {draft.currentStep === 'direction' && <Direction onSignIn={() => navigation.navigate('V2Auth', { initialMode: 'signin' })} onSelect={(direction) => { v2Haptics.selection(); setDirection(direction); track('v2_direction_selected', { direction }); }} />}
    {draft.currentStep === 'vision' && <Vision choice={draft.visionChoice} onChoose={(choice) => { setVisionChoice(choice); track('v2_vision_choice', { choice }); }} onContinue={() => go('focus')} />}
    {draft.currentStep === 'focus' && <FirstFocus svg={draft.anchorSvg!} category={draft.category!} done={draft.firstFocusCompleted === true} onDone={() => { markFocusCompleted(); v2Haptics.completion(); track('v2_first_focus_completed'); go('auth'); }} />}
    {draft.currentStep === 'auth' && <SaveYourAnchor error={error} onError={setError} onComplete={async (method, email, password) => {
      try {
        track('v2_auth_started', { method });
        const result = method === 'google' ? await AuthService.signInWithGoogle({ hasCompletedOnboarding: true }) : method === 'apple' ? await AuthService.signInWithApple({ hasCompletedOnboarding: true }) : method === 'email_signin' ? await AuthService.signInWithEmail(email, password, { hasCompletedOnboarding: true }) : await AuthService.signUpWithEmail(email, password, undefined, { hasCompletedOnboarding: true });
        useAuthStore.getState().setSession(result.user, result.token);
        const localId = draft.anchorLocalId!;
        let anchor = useAnchorStore.getState().getAnchorById(localId);
        if (!anchor) {
          anchor = buildAnchor(draft, result.user.id);
          useAnchorStore.getState().addAnchor(anchor);
        }
        markAnchorPersisted();
        if (draft.firstFocusCompleted && !draft.focusCompletionRecorded) {
          await PracticeCompletionService.completePracticeSession({ sessionId: draft.focusSessionId!, accountId: result.user.id, anchorId: null, anchorLocalId: anchor.localId ?? anchor.id, anchorServerId: null, mode: 'focus', plannedDurationSeconds: FIRST_RUN_FOCUS_SECONDS, actualDurationSeconds: FIRST_RUN_FOCUS_SECONDS, startedAt: new Date(Date.now() - FIRST_RUN_FOCUS_SECONDS * 1000).toISOString(), source: 'practice_screen', guidanceVoice: 'none', backgroundAudio: 'off', metadata: { v2_first_run: true } });
          markFocusRecorded();
        }
        markAuthCompleted(); useAuthStore.getState().completeOnboarding(); complete(); track('v2_auth_completed', { method }); track('v2_first_run_completed');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Couldn’t save your Anchor. Try again.'); }
    }} />}
  </V2Screen>;
}

function Direction({ onSelect, onSignIn }: { onSelect: (direction: FirstRunDirection) => void; onSignIn: () => void }) { return <View style={styles.flow}><View style={styles.entryHeader}><Text style={styles.eyebrow}>YOUR FIRST ANCHOR</Text><Pressable accessibilityRole="button" accessibilityLabel="Sign in to an existing Anchor account" onPress={onSignIn} hitSlop={8}><Text style={styles.signInLink}>Sign in</Text></Pressable></View><Text style={styles.display}>What are you moving toward?</Text><Text style={styles.body}>Start broad. We’ll shape the direction next.</Text><View style={styles.directionGrid}>{FIRST_RUN_DIRECTIONS.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.title}. ${item.subtitle}`} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.direction, { borderLeftColor: getCategoryColor(item.accentCategory) }, pressed && styles.pressed]}><Text style={styles.directionTitle}>{item.title}</Text><Text style={styles.directionBody}>{item.subtitle}</Text></Pressable>)}</View></View>; }
function Vision({ choice, onChoose, onContinue }: { choice?: VisionChoice; onChoose: (value: VisionChoice) => void; onContinue: () => void }) { const options: Array<{ id: VisionChoice; icon: React.ReactNode; title: string; body: string }> = [{ id: 'create_now', icon: <ImagePlus size={20} color={colors.text.primary} />, title: 'Add a Vision', body: 'Connect this Anchor to a future picture' }, { id: 'chart_only', icon: <LayoutTemplate size={20} color={colors.text.primary} />, title: 'Continue with Chart', body: 'Start with its wider context instead' }, { id: 'vision_and_chart', icon: <Compass size={20} color={colors.text.primary} />, title: 'Vision and Chart', body: 'Keep both next steps ready' }, { id: 'skip_for_now', icon: <Circle size={20} color={colors.text.secondary} />, title: 'Anchor only for now', body: 'You can add either later' }]; return <View style={styles.flow}><Text style={styles.eyebrow}>WHAT’S NEXT</Text><Text style={styles.display}>Give it a future, or keep it simple.</Text><Text style={styles.body}>Your Anchor is already complete.</Text><View style={styles.visionOptions}>{options.map((item) => <Pressable key={item.id} accessibilityRole="radio" accessibilityState={{ selected: choice === item.id }} onPress={() => onChoose(item.id)} style={[styles.visionOption, choice === item.id && styles.selectedNeutral]}>{item.icon}<View style={styles.flex}><Text style={styles.directionTitle}>{item.title}</Text><Text style={styles.directionBody}>{item.body}</Text></View>{choice === item.id ? <Check size={18} color={colors.semantic.success} /> : null}</Pressable>)}</View><V2Button size="large" disabled={!choice} onPress={onContinue}>Continue to Focus</V2Button></View>; }
function FirstFocus({ svg, category, done, onDone }: { svg: string; category: string; done: boolean; onDone: () => void }) { const [remaining, setRemaining] = useState(FIRST_RUN_FOCUS_SECONDS); const [running, setRunning] = useState(false); useEffect(() => { if (!running || remaining <= 0) return; const timer = setInterval(() => setRemaining((seconds) => seconds - 1), 1000); return () => clearInterval(timer); }, [remaining, running]); useEffect(() => { if (running && remaining <= 0) { setRunning(false); } }, [remaining, running]); useEffect(() => { const listener = AppState.addEventListener('change', (state) => { if (state !== 'active') setRunning(false); }); return () => listener.remove(); }, []); return <View style={[styles.flow, styles.focusFlow]}><Text style={[styles.eyebrow, { color: practiceColors.focus }]}>FIRST FOCUS</Text><Text style={styles.display}>{done || remaining <= 0 ? 'You used it.' : 'Stay with your Anchor.'}</Text><Text style={[styles.timer, { color: practiceColors.focus }]} accessibilityLiveRegion="polite">0:{String(Math.max(remaining, 0)).padStart(2, '0')}</Text><CircularAnchorRenderer svg={svg} category={category} size="hero" accessibilityLabel="Anchor for your first Focus" />{remaining > 0 ? <V2Button size="large" onPress={() => { setRunning((value) => !value); if (!running) track('v2_first_focus_started'); }}>{running ? 'Pause' : 'Begin Focus'}</V2Button> : <V2Button size="large" onPress={onDone}>Save this Anchor</V2Button>}</View>; }
function SaveYourAnchor({ error, onError, onComplete }: { error: string | null; onError: (value: string | null) => void; onComplete: (method: 'google' | 'apple' | 'email_signup' | 'email_signin', email: string, password: string) => Promise<void> }) { const [busy, setBusy] = useState(false); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [signingIn, setSigningIn] = useState(false); const run = async (method: 'google' | 'apple' | 'email_signup' | 'email_signin') => { if (method.startsWith('email') && (!email.includes('@') || password.length < 6)) { onError('Enter an email and a password with at least 6 characters.'); return; } onError(null); setBusy(true); try { await onComplete(method, email, password); } finally { setBusy(false); } }; return <View style={[styles.flow, styles.authFlow]}><Text style={styles.eyebrow}>SAVE YOUR ANCHOR</Text><Text style={styles.display}>Keep what you just made.</Text><Text style={styles.body}>Your Anchor and first Focus are ready to travel with you.</Text><View style={styles.authButtons}>{Platform.OS === 'ios' ? <V2Button variant="secondary" loading={busy} onPress={() => void run('apple')}>Continue with Apple</V2Button> : null}<V2Button variant="secondary" loading={busy} onPress={() => void run('google')}>Continue with Google</V2Button><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor={colors.text.disabled} accessibilityLabel="Email address" style={styles.authInput} /><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor={colors.text.disabled} accessibilityLabel="Password" style={styles.authInput} /><V2Button loading={busy} onPress={() => void run(signingIn ? 'email_signin' : 'email_signup')} iconLeft={<Mail size={18} color={colors.text.inverse} />}>{signingIn ? 'Sign in with email' : 'Create account with email'}</V2Button><V2Button variant="tertiary" onPress={() => setSigningIn((value) => !value)}>{signingIn ? 'Need an account? Sign up' : 'Already have an account? Sign in'}</V2Button></View>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Text style={styles.counter}>Creating an account keeps you on Free. No trial starts here.</Text></View>; }
function buildAnchor(draft: ReturnType<typeof useFirstRunStore.getState>['draft'], userId: string): Anchor { const now = new Date(); return { id: draft.anchorLocalId!, localId: draft.anchorLocalId!, userId, intentionText: draft.intention!, category: draft.category!, classifierMeta: { v2Expression: draft.expression === 'cutpaper' ? 'cut_paper' : draft.expression, ...(draft.styleChoice ? { v2StyleChoice: draft.styleChoice } : {}) }, ...(draft.enhancedImageUrl ? { enhancedImageUrl: draft.enhancedImageUrl } : {}), distilledLetters: draft.distilledLetters!, baseSigilSvg: draft.anchorSvg!, structureVariant: draft.structure!, planetaryTier: undefined, isCharged: false, activationCount: 0, chargeCount: 0, threadStrength: 0, createdAt: now, updatedAt: now }; }
const styles = StyleSheet.create({ scroll: { flexGrow: 1, paddingTop: spacing[4], gap: spacing[4] }, top: { alignSelf: 'flex-start' }, flow: { flex: 1, gap: spacing[4], paddingBottom: spacing[6] }, entryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, signInLink: { ...typography.labelMD, color: colors.text.primary, textDecorationLine: 'underline' }, heroFlow: { justifyContent: 'space-between', alignItems: 'center' }, focusFlow: { justifyContent: 'space-around', alignItems: 'center', paddingVertical: spacing[7] }, authFlow: { justifyContent: 'center' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, eyebrow: { ...typography.labelSM, color: colors.text.secondary }, display: { ...typography.displayMedium, color: colors.text.primary }, body: { ...typography.bodyLG, color: colors.text.secondary }, directionGrid: { gap: spacing[2] }, direction: { minHeight: 66, borderWidth: 1, borderColor: colors.border.subtle, borderLeftWidth: 4, borderRadius: 12, padding: spacing[3], justifyContent: 'center' }, directionTitle: { ...typography.headingSM, color: colors.text.primary }, directionBody: { ...typography.bodySM, color: colors.text.secondary }, pressed: { opacity: 0.72 }, writingSurface: { minHeight: 190, padding: spacing[4] }, input: { ...typography.headingMD, color: colors.text.primary, minHeight: 150, textAlignVertical: 'top' }, counter: { ...typography.caption, color: colors.text.secondary, textAlign: 'right' }, error: { ...typography.bodySM, color: colors.semantic.error }, formation: { alignItems: 'center', gap: spacing[4], paddingVertical: spacing[7] }, formationOriginal: { ...typography.bodyLG, color: colors.text.primary, textAlign: 'center', fontStyle: 'italic' }, formationStage: { ...typography.labelSM, color: colors.text.secondary, textAlign: 'center' }, rule: { width: 48, height: 1, backgroundColor: colors.border.strong }, letters: { ...typography.headingXL, color: colors.text.primary, textAlign: 'center', letterSpacing: 2 }, lettersResolving: { opacity: 0.62 }, anchorHero: { paddingVertical: spacing[7] }, expressionHero: { alignItems: 'center', paddingVertical: spacing[3] }, structureLock: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center' }, expressionOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }, expression: { width: '48%', minHeight: 142, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 12, padding: spacing[2], gap: spacing[1] }, expressionArtwork: { alignSelf: 'center' }, expressionMonoline: { opacity: 0.58, transform: [{ scale: 0.92 }] }, expressionFoil: { opacity: 0.92 }, expressionEmbossed: { opacity: 0.7, transform: [{ translateY: 1 }] }, expressionEtched: { opacity: 0.72 }, expressionInk: { opacity: 1, transform: [{ scale: 1.03 }] }, expressionHalo: { shadowColor: '#8B5CF6', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }, expressionGlass: { opacity: 0.55 }, expressionRadiant: { shadowColor: '#F28A2E', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }, expressionOrganic: { transform: [{ rotate: '-1deg' }] }, expressionWoven: { opacity: 0.8 }, expressionCutPaper: { transform: [{ translateY: -2 }], shadowColor: '#171717', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } }, visionOptions: { gap: spacing[2] }, visionOption: { flexDirection: 'row', alignItems: 'center', minHeight: 70, gap: spacing[3], padding: spacing[3], borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 12 }, selectedNeutral: { backgroundColor: colors.grouped, borderColor: colors.border.strong }, flex: { flex: 1 }, timer: { ...typography.numericLarge }, authButtons: { gap: spacing[3], marginTop: spacing[4] }, authInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border.default, borderRadius: 10, paddingHorizontal: spacing[3], color: colors.text.primary, ...typography.bodyMD } });
