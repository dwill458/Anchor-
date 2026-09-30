import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useV2ReduceMotion } from '@/hooks/v2';
import { useV2VisionSceneGeneration, type VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionAnchorArt } from './VisionChrome';
import { VisionMomentInput } from './VisionMomentInput';
import { VisionGenerationBoard } from './VisionGenerationBoard';
import { VisionCandidateSelection } from './VisionCandidateSelection';

export const VISION_SCENE_MIN_CHARS = 6;
export const VISION_SCENE_MAX_CHARS = 400;

type Step = 'describe' | 'generating' | 'choose';

export type V2VisionAddSceneProps = {
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  existingTiles?: V2VisionTile[];
  onPremiumRequired?: () => void;
  onCancel: () => void;
  /** Adds the chosen image to the board. Resolves false when it could not be saved. */
  onAdd: (choice: { assetId: string; prompt: string }) => Promise<boolean>;
  testID?: string;
};

/**
 * "Add to your Vision": the user describes another future moment around their Anchor.
 * Shares the input architecture with initial creation, renders generation directly
 * on their existing physical board, and transitions to candidate perspective selection.
 */
export function V2VisionAddScene({
  anchorId,
  anchorIntention,
  anchorCategory,
  anchorArt,
  anchorImageUrl,
  existingTiles = [],
  onPremiumRequired,
  onCancel,
  onAdd,
  testID = 'v2-vision-add-scene',
}: V2VisionAddSceneProps) {
  const reduceMotion = useV2ReduceMotion();
  const generation = useV2VisionSceneGeneration(anchorId, onPremiumRequired);
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const startingRef = useRef(false);

  const { job } = generation;
  const candidates = useMemo(() => job?.candidates ?? [], [job?.candidates]);
  const trimmed = description.trim();

  // Job status transitions
  useEffect(() => {
    if (!job) return;
    if (['QUEUED', 'RUNNING', 'PARTIAL'].includes(job.status)) setStep('generating');
    else if (job.status === 'FAILED') setStep(current => (current === 'choose' ? current : 'generating'));
  }, [job?.id, job?.status]);

  // Complete job with candidate images moves to choose step
  const complete = job?.status === 'COMPLETE' && candidates.some(c => Boolean(c.imageUrl));
  useEffect(() => {
    if (!complete || step !== 'generating') return;
    const timer = setTimeout(() => setStep('choose'), reduceMotion ? 300 : 1200);
    return () => clearTimeout(timer);
  }, [complete, reduceMotion, step]);

  const handleGenerate = async (sceneDescription: string, appearanceReferenceId?: string | null) => {
    setDescription(sceneDescription);
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setNotice(null);
    try {
      if (await generation.start(sceneDescription, appearanceReferenceId)) {
        setStep('generating');
      }
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleAddSelected = async (candidate: VisionGenerationCandidate) => {
    if (!candidate.assetId || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await onAdd({ assetId: candidate.assetId, prompt: candidate.prompt || trimmed });
      if (!saved) setNotice('The image could not be added to your Vision. Please try again.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'The image could not be added to your Vision.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'generating') {
    return (
      <View testID={`${testID}-generating`} style={{ flex: 1 }}>
        <VisionGenerationBoard
          mode="add"
          anchorIntention={anchorIntention}
          anchorCategory={anchorCategory}
          anchorArt={anchorArt}
          anchorImageUrl={anchorImageUrl}
          job={job}
          existingTiles={existingTiles}
          onBack={onCancel}
          onRetry={() => { void generation.retry(); }}
          onEditDescription={() => setStep('describe')}
          onReadyToSelect={() => setStep('choose')}
          testID="v2-vision-add-scene-board"
        />
      </View>
    );
  }

  if (step === 'choose') {
    return (
      <View testID={`${testID}-choose`} style={{ flex: 1 }}>
        <VisionCandidateSelection
          anchorIntention={anchorIntention}
          anchorCategory={anchorCategory}
          anchorArt={anchorArt}
          anchorImageUrl={anchorImageUrl}
          candidates={candidates}
          onBack={() => setStep('describe')}
          onConfirm={handleAddSelected}
          onRegenerate={() => { void handleGenerate(trimmed); }}
          isSaving={saving}
          testID="v2-vision-add-scene-selection"
        />
      </View>
    );
  }

  return (
    <VisionMomentInput
      mode="add"
      anchorId={anchorId}
      anchorIntention={anchorIntention}
      anchorCategory={anchorCategory}
      anchorArt={anchorArt}
      anchorImageUrl={anchorImageUrl}
      initialDescription={description}
      onBack={onCancel}
      onSubmit={(desc, refId) => handleGenerate(desc, refId)}
      loading={starting}
      error={notice ?? generation.error}
      testID={testID}
      textInputTestID="vision-scene-input"
    />
  );
}
