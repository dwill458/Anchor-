import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useVisionConversation } from '@/hooks/v2/vision/useVisionConversation';
import { VisionAddSceneSheet, type AddSceneRequest } from './VisionAddSceneSheet';

const DRAFT_LOAD_GRACE_MS = 600;

type Props = ComponentProps<typeof VisionAddSceneSheet> & { anchorId: string; onResume: () => void };

/** Keeps the existing board sheet while recovering owner-scoped scene drafts and history. */
export function VisionAddSceneEntry(props: Props) {
  const owner = useAuthStore(state => state.user?.id ?? 'anonymous');
  return <ScopedEntry key={`${owner}:${props.anchorId}`} {...props} />;
}

function ScopedEntry({ anchorId, onResume, ...props }: Props) {
  const conversation = useVisionConversation(anchorId);
  const [restored, setRestored] = useState<AddSceneRequest | null>(null);
  const hydrated = useRef(false);
  const offeredResume = useRef(false);
  const returningToDraft = useRef(false);
  if (!props.visible) returningToDraft.current = false;
  else if (props.restoreDraft) returningToDraft.current = true;
  // A busy device store must not hold the sheet shut: after a short wait it opens, and a resumable session found later still hands off.
  const [patient, setPatient] = useState(false);
  useEffect(() => {
    if (!props.visible) { setPatient(false); return undefined; }
    const timer = setTimeout(() => setPatient(true), DRAFT_LOAD_GRACE_MS);
    return () => clearTimeout(timer);
  }, [props.visible]);
  const resumable = !returningToDraft.current && Boolean(conversation.session && (conversation.session.rounds.length || conversation.session.description.trim()));
  useEffect(() => {
    if (!conversation.loaded || hydrated.current) return;
    hydrated.current = true;
    const draft = conversation.draft.current;
    if (draft && !draft.pendingSeal) setRestored({ description: draft.description, photo: null, references: draft.references });
  }, [conversation.loaded]);
  useEffect(() => {
    if (!props.visible) { offeredResume.current = false; return; }
    if (conversation.loaded && resumable && !offeredResume.current) {
      offeredResume.current = true; props.onClose(); onResume();
    }
  }, [props.visible, conversation.loaded, resumable, props.onClose, onResume]);
  const saveDraft = useCallback((request: AddSceneRequest) => {
    conversation.saveDraft({ description: request.description, references: request.references ?? (request.photo ? [{
      id: `legacy:${request.photo.uri}`, ...request.photo, role: 'inspiration',
    }] : []) });
    props.onDraftChange?.(request);
  }, [conversation.saveDraft, props.onDraftChange]);
  return <VisionAddSceneSheet {...props} visible={props.visible && (conversation.loaded || patient) && !resumable}
    restoreDraft={props.restoreDraft ?? restored} onDraftRestored={() => { setRestored(null); props.onDraftRestored?.(); }}
    onDraftChange={saveDraft} onSubmit={request => {
      saveDraft(request);
      const next = returningToDraft.current && conversation.session ? { ...request, sessionId: conversation.session.id } : request;
      // Enter generation in the same interaction as dismissing the sheet. The
      // new ceremony receives the full request directly; local/server draft
      // persistence can finish without exposing the board between screens.
      props.onSubmit(next);
      void conversation.flushDraft().catch(() => undefined);
    }} />;
}
