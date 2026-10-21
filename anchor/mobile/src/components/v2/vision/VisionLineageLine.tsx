import { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Eye } from 'lucide-react-native';
import { typography } from '@/theme/v2';
import { visionRoundLabel, type VisionConversationRound } from '@/types/visionConversation';
import { VISION_SERIF_ITALIC } from './VisionPaperChrome';

export interface VisionLineageLineProps {
  rounds: readonly VisionConversationRound[];
  selectedRoundId: string | null;
  selectedCandidateId?: string | null;
  onViewCandidate: (candidateId: string) => void;
  compact?: boolean;
  testID?: string;
}

const GOLD = '#B08A4A';
const PAPER = '#F4EDE0';

function candidateOption(round: VisionConversationRound, candidateId: string | null | undefined) {
  if (!candidateId) return undefined;
  const ordered = [...round.candidates].sort((left, right) => left.sortOrder - right.sortOrder);
  const index = ordered.findIndex(candidate => candidate.id === candidateId);
  return index < 0 ? undefined : index + 1;
}

function candidateLabel(round: VisionConversationRound, candidateId: string | null | undefined) {
  const option = candidateOption(round, candidateId);
  return `${visionRoundLabel(round.roundNumber)}${option ? ` · Option ${option}` : ''}`;
}

/** Displays the actual candidate ancestry for the viewed round. */
export const VisionLineageLine = memo(function VisionLineageLine({
  rounds, selectedRoundId, selectedCandidateId, onViewCandidate, compact = false, testID = 'vision-lineage-line',
}: VisionLineageLineProps) {
  const { path, sourceRound, sourceCandidate, viewedRound } = useMemo(() => {
    const roundsById = new Map(rounds.map(round => [round.id, round]));
    const candidateOwners = new Map<string, VisionConversationRound>();
    rounds.forEach(round => round.candidates.forEach(candidate => candidateOwners.set(candidate.id, round)));
    const selected = roundsById.get(selectedRoundId ?? '');

    const buildPath = (start: VisionConversationRound, startCandidateId: string | null) => {
      const result: Array<{ round: VisionConversationRound; candidateId: string | null }> = [];
      const visitedRounds = new Set<string>();
      let cursor: VisionConversationRound | undefined = start;
      let candidateId = startCandidateId;
      while (cursor && !visitedRounds.has(cursor.id)) {
        visitedRounds.add(cursor.id);
        result.push({ round: cursor, candidateId });
        const parentCandidateId = cursor.parentCandidateId;
        if (!parentCandidateId) break;
        const owner = candidateOwners.get(parentCandidateId);
        if (!owner?.candidates.some(candidate => candidate.id === parentCandidateId)) break;
        cursor = owner;
        candidateId = parentCandidateId;
      }
      return result.reverse();
    };

    const viewedCandidateRound = selectedCandidateId ? candidateOwners.get(selectedCandidateId) : undefined;
    const savedSelectionPath = viewedCandidateRound && selectedCandidateId
      ? buildPath(viewedCandidateRound, selectedCandidateId)
      : [];
    const followsViewedRound = Boolean(selected && savedSelectionPath.some(entry => entry.round.id === selected.id));
    const selectedCandidateOnViewedRound = selected && selectedCandidateId
      && selected.candidates.some(candidate => candidate.id === selectedCandidateId)
      ? selectedCandidateId : null;
    const path = selected
      ? followsViewedRound
        ? savedSelectionPath
        : buildPath(selected, selectedCandidateOnViewedRound)
      : [];

    const parentCandidate = selected?.parentCandidateId
      ? candidateOwners.get(selected.parentCandidateId)?.candidates.find(candidate => candidate.id === selected.parentCandidateId)
      : undefined;
    const sourceRound = parentCandidate ? candidateOwners.get(parentCandidate.id) : undefined;
    return { path, sourceRound, sourceCandidate: parentCandidate, viewedRound: selected };
  }, [rounds, selectedRoundId, selectedCandidateId]);

  if (!path.length) return null;
  const pathLabel = path.map(entry => candidateLabel(entry.round, entry.candidateId)).join(' → ');

  return (
    <View testID={testID} style={[styles.root, compact && styles.compactRoot]}>
      <View style={[styles.pathRow, compact && styles.compactPathRow]} accessibilityRole="text" accessibilityLabel={`Your path: ${pathLabel}`}>
        <Text style={styles.kicker}>YOUR PATH</Text>
        <Text testID={`${testID}-path`} style={[styles.path, compact && styles.compactPath]}>
          {path.map((entry, index) => <Text key={entry.round.id} style={entry.round.id === selectedRoundId ? styles.current : undefined}>
            {index > 0 ? ' → ' : ''}{candidateLabel(entry.round, entry.candidateId)}
          </Text>)}
        </Text>
      </View>
      {sourceRound && sourceCandidate ? (
        <View style={styles.source}>
          <View testID={`${testID}-thumbnail-frame`} style={styles.thumbnailFrame}>
            {sourceCandidate.imageUrl ? <Image testID={`${testID}-source-thumbnail`} source={{ uri: sourceCandidate.imageUrl }}
              resizeMode="cover" style={styles.thumbnail} accessibilityIgnoresInvertColors /> : null}
          </View>
          <View style={styles.sourceCopy}>
            <Text style={styles.sourceLabel} numberOfLines={1}>Based on {candidateLabel(sourceRound, sourceCandidate.id)}</Text>
            {viewedRound?.description.trim() ? <Text style={styles.instruction} numberOfLines={2}>“{viewedRound.description}”</Text> : null}
          </View>
          <Pressable testID={`${testID}-view-source`} accessibilityRole="button"
            accessibilityLabel={`View ${candidateLabel(sourceRound, sourceCandidate.id)}`}
            onPress={() => onViewCandidate(sourceCandidate.id)} hitSlop={5} style={styles.viewButton}>
            <Eye size={15} color={GOLD} strokeWidth={2} />
            <Text style={styles.viewLabel}>View</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { width: '100%', gap: 12 },
  compactRoot: { gap: 8 },
  pathRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', columnGap: 6 },
  compactPathRow: { flexWrap: 'nowrap', alignItems: 'flex-start', justifyContent: 'center', columnGap: 5 },
  kicker: { color: GOLD, fontFamily: typography.bodySemiBold, fontSize: 11, lineHeight: 16, letterSpacing: 1.3 },
  path: { color: '#C9C4D3', fontFamily: typography.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  compactPath: { flex: 1, flexShrink: 1, fontSize: 13, lineHeight: 19 },
  current: { color: PAPER, fontFamily: typography.bodySemiBold },
  source: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 9,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(244, 237, 224, 0.22)', backgroundColor: 'rgba(244, 237, 224, 0.07)' },
  thumbnailFrame: { width: 44, height: 52, padding: 3, borderRadius: 3, backgroundColor: PAPER, overflow: 'hidden' },
  thumbnail: { flex: 1, backgroundColor: '#1A1D36' },
  sourceCopy: { flex: 1, gap: 1 },
  sourceLabel: { color: PAPER, fontFamily: typography.bodySemiBold, fontSize: 13, lineHeight: 18 },
  instruction: { color: '#C9C4D3', fontFamily: VISION_SERIF_ITALIC, fontSize: 13, lineHeight: 17 },
  viewButton: { minWidth: 44, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  viewLabel: { color: GOLD, fontFamily: typography.bodySemiBold, fontSize: 13, textDecorationLine: 'underline' },
});
