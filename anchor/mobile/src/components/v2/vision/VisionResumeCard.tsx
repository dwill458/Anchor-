import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { typography } from '@/theme/v2';
import { visionRoundLabel, type VisionConversationSession } from '@/types/visionConversation';
import { VISION_SERIF } from './VisionPaperChrome';

export interface VisionResumeCardProps {
  session: VisionConversationSession;
  onContinue: () => void;
  onKeep: (candidateId: string) => void;
  onStartDifferent: () => void;
  testID?: string;
}

const GOLD = '#B08A4A';
const PAPER = '#F4EDE0';
const MUTED = '#C9C4D3';
const hasUsableImage = (candidate: VisionConversationSession['rounds'][number]['candidates'][number]) =>
  Boolean(candidate.assetId && candidate.imageUrl && candidate.status !== 'FAILED' && candidate.status !== 'PENDING');

/** A presentation-only return point for an unfinished, saved Vision scene. */
export const VisionResumeCard = memo(function VisionResumeCard({
  session, onContinue, onKeep, onStartDifferent, testID = 'vision-resume-card',
}: VisionResumeCardProps) {
  const { candidate, alternate, savedRounds } = useMemo(() => {
    const rounds = [...session.rounds].sort((left, right) => left.roundNumber - right.roundNumber);
    const all = rounds.flatMap(round => [...round.candidates]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(candidate => ({ candidate, round })));
    const saved = all.find(item => item.candidate.id === session.selectedCandidateId && hasUsableImage(item.candidate));
    const available = [...all].reverse().filter(item => hasUsableImage(item.candidate));
    const chosen = saved ?? available[0];
    return {
      candidate: chosen,
      alternate: chosen ? available.find(item => item.candidate.id !== chosen.candidate.id) : undefined,
      savedRounds: [...new Set(rounds.map(round => visionRoundLabel(round.roundNumber)))],
    };
  }, [session.rounds, session.selectedCandidateId]);

  const canKeep = Boolean(candidate && hasUsableImage(candidate.candidate));
  const stageLabel = candidate ? `Saved scene preview, ${candidate.candidate.id}` : 'Saved scene preview unavailable';

  return (
    <View testID={testID} style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.kicker}>YOUR VISION</Text>
        <Text accessibilityRole="header" style={styles.title}>Pick up where you left off</Text>
        <Text style={styles.subtitle}>Your scene and its versions are right where you left them.</Text>
      </View>

      <View testID={`${testID}-print-stack`} accessible accessibilityLabel={stageLabel} style={styles.stage}>
        {alternate?.candidate.imageUrl ? (
          <View pointerEvents="none" style={[styles.print, styles.backPrint]}>
            <Image source={{ uri: alternate.candidate.imageUrl }} resizeMode="cover" style={styles.printImage} />
          </View>
        ) : null}
        <View pointerEvents="none" style={[styles.print, styles.frontPrint]}>
          {candidate?.candidate.imageUrl ? <Image testID={`${testID}-selected-image`}
            source={{ uri: candidate.candidate.imageUrl }} resizeMode="cover" style={styles.printImage}
            accessibilityIgnoresInvertColors /> : <View testID={`${testID}-missing-image`} style={styles.missingImage} />}
        </View>
      </View>

      <Pressable testID={`${testID}-continue`} accessibilityRole="button"
        accessibilityLabel="Continue refining your scene" onPress={onContinue} style={({ pressed }) => [styles.continueCard, pressed && styles.pressed]}>
        <View style={styles.continueCopy}>
          <Text style={styles.continueTitle}>Continue refining your scene</Text>
          <Text style={styles.savedRounds}>{savedRounds.length ? `${savedRounds.join(' · ')} saved` : 'Saved scene'}</Text>
        </View>
        <ArrowRight size={22} color={GOLD} strokeWidth={2} />
      </Pressable>

      <View style={styles.actions}>
        <Pressable testID={`${testID}-keep`} accessibilityRole="button" accessibilityLabel="Keep this one"
          accessibilityState={{ disabled: !canKeep }} disabled={!canKeep}
          onPress={() => candidate && onKeep(candidate.candidate.id)} style={({ pressed }) => [styles.keepButton, !canKeep && styles.disabled, pressed && canKeep && styles.pressed]}>
          <Text style={styles.keepLabel}>Keep this one</Text>
        </Pressable>
        <Pressable testID={`${testID}-start-different`} accessibilityRole="button"
          accessibilityLabel="Start a different scene" onPress={onStartDifferent} hitSlop={4} style={styles.startDifferent}>
          <Text style={styles.startLabel}>Start a different scene</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 560, justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 18, paddingBottom: 16,
    backgroundColor: '#14162B' },
  header: { alignItems: 'center' },
  kicker: { marginBottom: 12, color: GOLD, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 18, letterSpacing: 2.2 },
  title: { color: PAPER, fontFamily: VISION_SERIF, fontSize: 36, lineHeight: 42, textAlign: 'center' },
  subtitle: { marginTop: 8, color: MUTED, fontFamily: typography.body, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  stage: { height: 250, alignItems: 'center', justifyContent: 'center' },
  print: { position: 'absolute', width: 190, height: 226, padding: 8, paddingBottom: 22, backgroundColor: PAPER,
    borderRadius: 3, shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  backPrint: { transform: [{ translateX: -28 }, { rotate: '-7deg' }], opacity: 0.5 },
  frontPrint: { transform: [{ translateX: 12 }, { rotate: '0deg' }] },
  printImage: { flex: 1, backgroundColor: '#1A1D36' },
  missingImage: { flex: 1, backgroundColor: '#1A1D36' },
  continueCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16,
    borderRadius: 24, borderWidth: 1, borderColor: 'rgba(176, 138, 74, 0.72)', backgroundColor: 'rgba(255,255,255,0.04)' },
  continueCopy: { flex: 1 },
  continueTitle: { color: PAPER, fontFamily: VISION_SERIF, fontSize: 25, lineHeight: 30 },
  savedRounds: { marginTop: 2, color: MUTED, fontFamily: typography.body, fontSize: 15, lineHeight: 21 },
  actions: { alignItems: 'stretch', gap: 14, marginTop: 22 },
  keepButton: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: PAPER },
  keepLabel: { color: '#14162B', fontFamily: typography.bodySemiBold, fontSize: 17, lineHeight: 23 },
  disabled: { opacity: 0.45 },
  startDifferent: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  startLabel: { color: MUTED, fontFamily: typography.bodyMedium, fontSize: 16, lineHeight: 22, textDecorationLine: 'underline' },
  pressed: { opacity: 0.82 },
});
