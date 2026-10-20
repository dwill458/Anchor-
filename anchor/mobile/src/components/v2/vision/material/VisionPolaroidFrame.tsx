import { memo } from 'react';
import { VisionMaterialSurface } from './VisionMaterialSurface';
import type { VisionPolaroidVariant } from '@/assets/vision/materials/manifest';

/** Real paper border with an alpha aperture. The photograph and editable caption stay independent. */
export const VisionPolaroidFrame = memo(function VisionPolaroidFrame({ variant = 'classic', testID }: { variant?: VisionPolaroidVariant; testID?: string }) {
  return <VisionMaterialSurface material={`polaroid-${variant}`} testID={testID} />;
});
