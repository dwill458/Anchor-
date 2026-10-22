/** Approved artwork is presentation data, never an eligibility registry. */
export interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
}

export interface ApprovedManifestChild {
  id: string | null;
  tag: string;
  filled: boolean;
  dashed: boolean;
  pathLength?: number;
}

export interface ApprovedMilestoneAsset {
  slug: string;
  earned: SvgNode;
  locked: SvgNode;
  sourceSha256: Record<'earned' | 'locked', string>;
  manifest: {
    family: string;
    viewBox: string;
    layers: { layer: string; id: string; children: ApprovedManifestChild[] }[];
  };
}

export { APPROVED_MILESTONE_ASSETS } from './approvedAssets.generated';
