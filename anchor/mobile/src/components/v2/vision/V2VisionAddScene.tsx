import { useRef, useState } from 'react';
import { useV2VisionSceneGeneration, type VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionAnchorArt } from './VisionChrome';
import { useVisionImageArrival } from './VisionImageArrival';
import { VisionMomentInput } from './VisionMomentInput';
import { VisionTwoUpStage, type VisionTwoUpSelection } from './VisionTwoUpStage';

export const VISION_SCENE_MIN_CHARS = 6;
export const VISION_SCENE_MAX_CHARS = 400;

type Step = 'describe' | 'generating';

export type V2VisionAddSceneProps = {
  anchorId: string;
  anchorIntention: string;
  anchorCategory?: string | null;
  anchorArt?: VisionAnchorArt | null;
  anchorImageUrl?: string | null;
  existingTiles?: V2VisionTile[];
  onPremiumRequired?: () => void;
  onCancel: () => void;
  /** Puts the chosen image on the board. Resolves false when it could not be saved. */
  onAdd: (choice: { assetId: string; prompt: string }) => Promise<boolean>;
  testID?: string;
};

/**
 * "Add to your Vision": describe another moment from this future, two come back,
 * and tapping one places it on the board. The same language and the same two-to-one
 * choice as creating the Vision, so there is nothing new to learn.
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
  const arrival = useVisionImageArrival();
  const generation = useV2VisionSceneGeneration(anchorId, onPremiumRequired);
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const startingRef = useRef(false);

  const { job } = generation;
  const trimmed = description.trim();

  const handleGenerate = async (sceneDescription: string, appearanceReferenceId?: string | null) => {
    setDescription(sceneDescription);
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setNotice(null);
    try {
      if (await generation.start(sceneDescription, appearanceReferenceId)) setStep('generating');
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  };

  const handleSelect = async (candidate: VisionGenerationCandidate, selection: VisionTwoUpSelection) => {
    if (!candidate.assetId || saving) return;
    if (candidate.imageUrl && selection.image) {
      arrival?.begin(candidate.imageUrl, selection.image, anchorArt?.svg && selection.anchor
        ? { svg: anchorArt.svg, category: anchorArt.category ?? anchorCategory, rect: selection.anchor } : undefined);
    }
    setSaving(true);
    setNotice(null);
    try {
      const saved = await onAdd({ assetId: candidate.assetId, prompt: candidate.prompt || trimmed });
      if (!saved) { arrival?.cancel(); setNotice('The image could not be added to your Vision. Please try again.'); }
    } catch (cause) {
      arrival?.cancel();
      setNotice(cause instanceof Error ? cause.message : 'The image could not be added to your Vision.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'generating') {
    return (
      <VisionTwoUpStage
        anchorIntention={anchorIntention}
        anchorArt={anchorArt}
        job={job}
        busy={saving}
        error={notice ?? generation.error}
        onBack={() => setStep('describe')}
        onRetry={() => { void generation.retry(); }}
        onEditDescription={() => setStep('describe')}
        onSelect={(candidate, selection) => { void handleSelect(candidate, selection); }}
        testID={`${testID}-generating`}
      />
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
      previewImageUrl={existingTiles[0]?.imageUrl}
      onBack={onCancel}
      onSubmit={(desc, refId) => handleGenerate(desc, refId)}
      loading={starting}
      error={notice ?? generation.error}
      testID={testID}
      textInputTestID="vision-scene-input"
    />
  );
}
