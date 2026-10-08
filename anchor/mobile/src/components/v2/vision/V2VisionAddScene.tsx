import { VisionCeremony } from './ceremony/VisionCeremony';
import { useRef, useState } from 'react';
import { uploadVisionPhoto, useV2VisionSceneGeneration, type UploadAssetResult, type VisionGenerationCandidate } from '@/hooks/v2/vision';
import type { V2VisionTile } from '@/adapters/v2/vision';
import type { VisionAnchorArt } from './VisionChrome';
import { useVisionImageArrival } from './VisionImageArrival';
import { VisionMomentInput, type VisionInputPath, type VisionStartPhoto } from './VisionMomentInput';
import { visionPhotoSceneDescription } from './visionGuidance';
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
  /** Lets a moment start from the person's own photo. Without it the screen is the words screen alone. */
  onUploadAsset?: (input: { base64Image: string; mimeType: string }) => Promise<UploadAssetResult>;
  onCancel: () => void;
  /** Puts the chosen image on the board. Resolves false when it could not be saved. */
  onAdd: (choice: { assetId: string; prompt: string; caption?: string }) => Promise<boolean>;
  testID?: string;
};

/**
 * "Add to your Vision": describe another moment from this future, two come back,
 * and tapping one places it on the board. The same language and the same two-to-one
 * choice as creating the Vision, so there is nothing new to learn.
 */
// DEFERRED: describe/two-up rendering and immediate selection save replaced by VisionCeremony.
function DeferredVisionAddScene({
  anchorId,
  anchorIntention,
  anchorCategory,
  anchorArt,
  anchorImageUrl,
  existingTiles = [],
  onPremiumRequired,
  onUploadAsset,
  onCancel,
  onAdd,
  testID = 'v2-vision-add-scene',
}: V2VisionAddSceneProps) {
  const arrival = useVisionImageArrival();
  const generation = useV2VisionSceneGeneration(anchorId, onPremiumRequired);
  const [step, setStep] = useState<Step>('describe');
  const [description, setDescription] = useState('');
  const [inputPath, setInputPath] = useState<VisionInputPath>('photo');
  const [startPhoto, setStartPhoto] = useState<VisionStartPhoto | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const startingRef = useRef(false);

  const { job } = generation;
  const trimmed = description.trim();

  const handleGenerate = async (sceneDescription: string, appearanceReferenceId?: string | null, photo?: VisionStartPhoto | null) => {
    setDescription(sceneDescription);
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    setNotice(null);
    try {
      if (photo && onUploadAsset) {
        const uploaded = await uploadVisionPhoto(photo, onUploadAsset);
        if (!uploaded.ok) { setNotice(uploaded.message); return; }
        const text = visionPhotoSceneDescription(sceneDescription, anchorIntention, VISION_SCENE_MAX_CHARS, VISION_SCENE_MIN_CHARS);
        if (await generation.start(text, null, uploaded.assetId)) setStep('generating');
        return;
      }
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
        ? { svg: anchorArt.svg, imageUrl: anchorArt.imageUrl, expression: anchorArt.expression, category: anchorArt.category ?? anchorCategory, rect: selection.anchor } : undefined);
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
      onSubmit={(desc, refId, photo) => handleGenerate(desc, refId, photo)}
      startPhotoEnabled={Boolean(onUploadAsset)}
      startPhoto={startPhoto}
      onChangeStartPhoto={setStartPhoto}
      inputPath={inputPath}
      onChangeInputPath={setInputPath}
      loading={starting}
      error={notice ?? generation.error}
      testID={testID}
      textInputTestID="vision-scene-input"
    />
  );
}

export function V2VisionAddScene(props: V2VisionAddSceneProps) {
  return <VisionCeremony {...props} mode="add" startAt="ask" onBack={props.onCancel}
    onUploadAsset={props.onUploadAsset ?? (async () => ({ ok: false, message: 'Unable to upload your photo.' }))}
    onAssemble={async ({ selectedAssets }) => {
      const asset = selectedAssets[0];
      return asset ? props.onAdd({ assetId: asset.assetId, prompt: asset.prompt, caption: asset.caption }) : false;
    }} />;
}
