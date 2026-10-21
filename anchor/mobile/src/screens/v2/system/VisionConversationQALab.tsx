import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { VisionMomentInput } from '@/components/v2/vision/VisionMomentInput';
import { VisionRefineSheet } from '@/components/v2/vision/VisionRefineSheet';
import { VisionConversationSelection } from '@/components/v2/vision/VisionConversationSelection';
import { VisionResumeCard } from '@/components/v2/vision/VisionResumeCard';
import { VisionAddSceneSheet, type AddSceneRequest } from '@/components/v2/vision/VisionAddSceneSheet';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { VisionPrint } from '@/components/v2/vision/ceremony/VisionPrint';
import type { VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { VisionConversationRound, VisionConversationSession, VisionReferenceAttachment } from '@/types/visionConversation';
import { colors, typography } from '@/theme/v2';

type Identity = { anchorArt: any; anchorIntention: string; anchorCategory: string };
type Props = { surface: string; identity: Identity; onClose: () => void };

const imageSources = [
  require('@/assets/vision/vision-future-desk.jpg'),
  require('@/assets/vision/vision-future-window-wide.jpg'),
  require('@/assets/vision/vision-future-family.jpg'),
  require('@/assets/vision/vision-future-home.jpg'),
  require('@/assets/vision/vision-future-studio.jpg'),
  require('@/assets/vision/vision-future-movement.jpg'),
];
const imageUri = (index: number) => {
  const resolved = Image.resolveAssetSource(imageSources[index % imageSources.length]);
  if (!resolved?.uri) throw new Error('Missing bundled conversation QA image.');
  return resolved.uri;
};

const candidates: VisionGenerationCandidate[] = [
  { id: 'original-a', assetId: 'asset-original-a', role: 'vision', prompt: 'Warm window light at a family table', sortOrder: 0, imageUrl: imageUri(0), status: 'SUCCEEDED' },
  { id: 'original-b', assetId: 'asset-original-b', role: 'vision', prompt: 'A quiet desk facing the ocean', sortOrder: 1, imageUrl: imageUri(1), status: 'SUCCEEDED' },
  { id: 'version-1-a', assetId: 'asset-version-1-a', role: 'vision', prompt: 'Keep the table, soften the morning light', sortOrder: 0, imageUrl: imageUri(2), status: 'SUCCEEDED' },
  { id: 'version-1-b', assetId: 'asset-version-1-b', role: 'vision', prompt: 'Add more room around the table', sortOrder: 1, imageUrl: imageUri(3), status: 'SUCCEEDED' },
  { id: 'version-2-a', assetId: 'asset-version-2-a', role: 'vision', prompt: 'More natural light through the window', sortOrder: 0, imageUrl: imageUri(4), status: 'SUCCEEDED' },
  { id: 'version-2-b', assetId: 'asset-version-2-b', role: 'vision', prompt: 'A calmer, wider composition', sortOrder: 1, imageUrl: imageUri(5), status: 'SUCCEEDED' },
  { id: 'version-3-a', assetId: 'asset-version-3-a', role: 'vision', prompt: 'Keep the home, open the view', sortOrder: 0, imageUrl: imageUri(1), status: 'SUCCEEDED' },
  { id: 'version-3-b', assetId: 'asset-version-3-b', role: 'vision', prompt: 'A softer evening palette', sortOrder: 1, imageUrl: imageUri(3), status: 'SUCCEEDED' },
];

const referenceFixtures: VisionReferenceAttachment[] = imageSources.slice(0, 5).map((_, index) => ({
  id: `qa-reference-${index + 1}`,
  assetId: `asset-reference-${index + 1}`,
  uri: imageUri(index),
  mimeType: 'image/jpeg',
  role: (['place', 'identity', 'object', 'inspiration', 'place'] as const)[index],
  label: ['The room I want to keep', 'The people I love', 'The old table', 'Soft morning light', 'A wider view'][index],
}));
const addSheetRestoreDraft: AddSceneRequest = {
  description: 'At the end of the day, we gather around the old table and share stories in the warm light.',
  photo: null,
  references: referenceFixtures,
};
const reference = referenceFixtures[0]!;

function makeRound(id: string, roundNumber: number, candidateIds: string[], parentCandidateId: string | null, instruction: string): VisionConversationRound {
  const jobCandidates = candidateIds.map(candidateId => candidates.find(candidate => candidate.id === candidateId)!);
  return {
    id, kind: 'SCENE', visionId: 'qa-vision', anchorId: 'qa-anchor', setNumber: 1, retryCount: 0,
    status: 'COMPLETE', stage: 'complete', error: null, candidates: jobCandidates,
    sessionId: 'qa-session', roundNumber, operation: roundNumber === 0 ? 'CREATE' : 'EDIT', parentCandidateId,
    description: instruction,
    references: referenceFixtures.slice(0, 3).map(item => ({ assetId: item.assetId!, role: item.role, imageUrl: item.uri, label: item.label })),
  };
}

const rounds: VisionConversationRound[] = [
  makeRound('round-original', 0, ['original-a', 'original-b'], null, 'A slow morning at home with room to enjoy breakfast with my family.'),
  makeRound('round-one', 1, ['version-1-a', 'version-1-b'], 'original-a', 'Keep the table, soften the morning light.'),
  makeRound('round-two', 2, ['version-2-a', 'version-2-b'], 'version-1-a', 'Bring more natural light through the window.'),
  makeRound('round-three', 3, ['version-3-a', 'version-3-b'], 'version-2-b', 'Open the view while keeping the room calm and familiar.'),
];

const sceneDescription = 'A slow morning at home. The work is meaningful, and there is time to enjoy breakfast with my family.';
const selectedSurface = (surface: string) => surface.toLowerCase();

/** Dev-only fixture lab. It mounts real conversation components and keeps every action local. */
export function VisionConversationQALab({ surface, identity, onClose }: Props) {
  const initial = selectedSurface(surface);
  const [activeSurface, setActiveSurface] = useState(initial);
  const [description, setDescription] = useState(initial === 'a2'
    ? 'A clear, easy morning at home. Keep our familiar table, bring in the light, and leave space for three details that make this place ours.'
    : initial === 'a3'
      ? 'Later scene: dinner is finished, the room is quiet, and five familiar details still make this feel like our home.'
      : initial === 'a4' ? sceneDescription
        : initial === 'c1' ? 'Keep the room familiar and let the morning light feel warmer.'
          : initial === 'c2' ? 'Preserve the people and objects in these references, then soften the evening light.' : '');
  const [referencesState, setReferences] = useState<VisionReferenceAttachment[]>(
    initial === 'a2' || initial === 'c1' ? referenceFixtures.slice(0, 3)
      : initial === 'a3' || initial === 'c2' ? referenceFixtures : [],
  );
  const [selectedRoundId, setSelectedRoundId] = useState(() => initial === 'd1' || initial === 'c3' ? 'round-one' : initial === 'd2b' ? 'round-two' : initial === 'd-overflow' ? 'round-three' : 'round-original');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(() => initial === 'c2' ? 'original-a' : initial === 'c3' ? 'version-1-a' : initial === 'd2b' ? 'version-2-b' : initial.startsWith('d') ? 'version-2-b' : null);
  const [refineSource, setRefineSource] = useState<{ candidateId: string; imageUrl: string; optionNumber: number; roundNumber: number } | null>(() => {
    if (initial !== 'b1' && initial !== 'b2' && initial !== 'c3') return null;
    const round = initial === 'b1' ? rounds[0] : initial === 'b2' ? rounds[2] : rounds[1];
    const candidate = round.candidates[0];
    return { candidateId: candidate.id, imageUrl: candidate.imageUrl!, optionNumber: candidate.sortOrder + 1, roundNumber: round.roundNumber };
  });
  const [prompt, setPrompt] = useState(initial === 'b2' ? 'Let the room feel softer, without changing the view.' : initial === 'c3' ? 'Keep the room, but open the morning light.' : '');
  const [notice, setNotice] = useState('');
  const conversationRounds = useMemo(() => {
    const referenceCount = activeSurface === 'c2' ? 5 : 3;
    const withSurfaceReferences = activeSurface === 'c1' || activeSurface === 'c2'
      ? rounds.map(round => round.id === 'round-original' ? { ...round, references: referenceFixtures.slice(0, referenceCount).map(item => ({ assetId: item.assetId!, role: item.role, imageUrl: item.uri, label: item.label })) } : round)
      : rounds;
    return activeSurface === 'd2a' || activeSurface === 'd2b' ? withSurfaceReferences.slice(0, 3) : withSurfaceReferences;
  }, [activeSurface]);
  const currentRound = useMemo(() => conversationRounds.find(round => round.id === selectedRoundId) ?? conversationRounds[0], [conversationRounds, selectedRoundId]);
  const session: VisionConversationSession = useMemo(() => ({
    id: 'qa-session', anchorId: 'qa-anchor', visionId: 'qa-vision', status: 'ACTIVE', description: sceneDescription,
    draftPrompt: '', selectedCandidateId: 'version-3-a', viewedRoundId: 'round-original',
    references: referenceFixtures.slice(0, 3).map(item => ({ assetId: item.assetId!, role: item.role, imageUrl: item.uri, label: item.label })),
    rounds, expiresAt: '2026-10-22T00:00:00.000Z',
  }), []);

  if (activeSurface === 'conversation-add-sheet') return <View style={styles.addSheetStage}>
    <VisionAddSceneSheet visible onClose={onClose} anchorIntention={identity.anchorIntention} restoreDraft={addSheetRestoreDraft}
      onSubmit={request => setNotice(`Saved locally: ${request.description}`)}
      onAddOwnPhoto={source => setNotice(`Photo picker action: ${source} (local QA only).`)}
      onAddNote={() => setNotice('Note composer action (local QA only).')} testID="vision-conversation-qa-add-sheet" />
    {notice ? <Text style={styles.addSheetNotice}>{notice}</Text> : null}
  </View>;

  if (activeSurface.startsWith('a')) {
    const hasReferences = activeSurface === 'a2' || activeSurface === 'a3';
    return <VisionMomentInput
      {...identity} anchorId="qa-anchor" mode={activeSurface === 'a3' ? 'add' : 'create'} description={description} onChangeDescription={setDescription}
      initialDescription={description} onBack={onClose} onSubmit={async () => { setNotice('Description saved in this local QA fixture.'); return true; }}
      startPhotoEnabled references={hasReferences ? referencesState : undefined}
      onChangeReferences={hasReferences ? setReferences : undefined}
      previewImageUrl={activeSurface === 'a3' ? imageUri(0) : undefined} startPhoto={null}
      onChangeStartPhoto={() => undefined} testID="vision-conversation-qa-input" textInputTestID="vision-conversation-qa-text-input" />;
  }

  if (activeSurface === 'c1' || activeSurface === 'c2') return <View style={styles.refineStage}>
    <View style={styles.singleSourcePrint}>
      <VisionPrint uri={imageUri(2)} developing={false} revealed instant silent showCaption caption="Version 1 · Option 1"
        pinned={false} testID="vision-conversation-qa-source-print" />
    </View>
    <VisionRefineSheet visible source={{ candidateId: 'version-1-a', imageUrl: imageUri(2), optionNumber: 1, roundNumber: 1 }}
      references={referencesState} onChangeReferences={setReferences} initialPrompt={description} onChangePrompt={setDescription}
      onClose={onClose} onSubmit={instruction => { setNotice(`Refine instruction saved locally: ${instruction}`); return true; }} />
  </View>;

  if (activeSurface === 'e1') return <View style={styles.resumeStage}>
    <View style={styles.resumeMark}>
      {identity.anchorArt ? <CircularAnchorRenderer {...identity.anchorArt} size={44} appearance="paper" testID="conversation-qa-resume-anchor" /> : null}
    </View>
    <VisionResumeCard session={session} onContinue={() => { setSelectedRoundId('round-two'); setActiveSurface('d2b'); }}
      onKeep={candidateId => setNotice(`Kept ${candidateId} in the local fixture.`)} onStartDifferent={() => { setDescription(''); setActiveSurface('a1'); }} />
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
  </View>;

  const isVersion = activeSurface.startsWith('d');
  const round = isVersion ? conversationRounds.find(item => item.id === selectedRoundId) ?? conversationRounds[0] : currentRound;
  const selectedForRound = activeSurface === 'd2a' ? 'version-2-b' : activeSurface === 'd2b' ? 'version-2-b' : selectedCandidateId;
  const isSelectionSurface = activeSurface.startsWith('c') || isVersion || activeSurface === 'b1' || activeSurface === 'b2';
  if (!isSelectionSurface) return <View style={styles.resumeStage}><Text style={styles.notice}>Unknown conversation surface: {surface}</Text></View>;

  return <View style={styles.selectionStage}>
    <VisionConversationSelection
      round={round} rounds={conversationRounds} anchorArt={identity.anchorArt} selectedCandidateId={selectedForRound}
      onInspectClosed={() => setActiveSurface('c2')}
      onSelect={candidate => { setSelectedCandidateId(candidate.id); setNotice(`Selected ${candidate.id} in the local fixture.`); }}
      onRefine={candidate => {
        const candidateRound = conversationRounds.find(item => item.candidates.some(option => option.id === candidate.id)) ?? round;
        setRefineSource({ candidateId: candidate.id, imageUrl: candidate.imageUrl!, optionNumber: candidate.sortOrder + 1, roundNumber: candidateRound.roundNumber });
      }}
      onSelectRound={id => setSelectedRoundId(id)}
      onViewCandidate={id => { setSelectedCandidateId(id); const owner = conversationRounds.find(item => item.candidates.some(candidate => candidate.id === id)); if (owner) setSelectedRoundId(owner.id); }}
      onAnother={() => setNotice('Another variation would use the selected print as its source.')}
      onBack={onClose} onPrintLayout={() => undefined} />
    <VisionRefineSheet visible={Boolean(refineSource)} source={refineSource} references={referencesState.length ? referencesState : [reference]}
      onChangeReferences={setReferences} initialPrompt={prompt} onChangePrompt={setPrompt} onClose={() => setRefineSource(null)}
      onSubmit={instruction => { setNotice(`Refine instruction saved locally: ${instruction}`); setRefineSource(null); return true; }} />
    {notice ? <Pressable accessibilityRole="button" onPress={() => setNotice('')} style={styles.noticeButton}><Text style={styles.notice}>{notice}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  selectionStage: { flex: 1, backgroundColor: colors.ink.base },
  addSheetStage: { flex: 1, backgroundColor: colors.ink.base },
  addSheetNotice: { position: 'absolute', left: 18, right: 18, bottom: 18, zIndex: 100, color: colors.paper, ...typography.bodySM, textAlign: 'center' },
  resumeStage: { flex: 1, backgroundColor: '#14162B', justifyContent: 'center' },
  resumeMark: { alignItems: 'center', paddingBottom: 10 },
  refineStage: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#14162B' },
  singleSourcePrint: { width: 230, height: 280, padding: 8, paddingBottom: 32, backgroundColor: '#F4EDE0', borderRadius: 3 },
  noticeButton: { position: 'absolute', left: 18, right: 18, bottom: 24, padding: 12, backgroundColor: '#14162B', borderRadius: 8 },
  notice: { color: colors.paper, ...typography.bodySM, textAlign: 'center' },
});
