import specification from './approvedMotionSpec.json';
import type { ApprovedMilestoneAsset } from './approvedAssets';

export type MotionFamily = keyof typeof specification.families;
export interface MotionStep {
  name: string; op: string; layer?: string; layerGroup?: string; match?: string; exclude?: string;
  start: number; dur?: number; stagger?: number; maxSpread?: number; idIndex?: string;
  from?: number; keys?: number[] | number[][]; ease: string; r0?: number; r1?: number;
}

/** Resolve approved per-emblem variations before handing immutable steps to the UI thread. */
export function approvedMotion(slug: string, family: MotionFamily) {
  const definition = specification.families[family];
  const variations = ('perMilestone' in definition ? definition.perMilestone : {}) as Record<string, Record<string, unknown>>;
  const variation = variations[slug] ?? {};
  const replacements = (variation.replace ?? {}) as Record<string, Partial<MotionStep>>;
  const steps = definition.steps.map(original => {
    const resolved: Record<string, unknown> = { ...original, ...replacements[original.name] };
    for (const key of Object.keys(resolved)) {
      const value = resolved[key];
      if (typeof value === 'string' && value.startsWith('$')) resolved[key] = variation[value.slice(1)];
    }
    return resolved as unknown as MotionStep;
  });
  steps.push(...((variation.extra ?? []) as MotionStep[]));
  return { duration: definition.duration, steps };
}

export function stepMatches(step: MotionStep, id: string, layer: string, isLayer = false) {
  if (step.layerGroup) return isLayer && layer === step.layerGroup;
  return !isLayer && step.layer === layer && (!step.match || new RegExp(step.match).test(id))
    && (!step.exclude || !new RegExp(step.exclude).test(id));
}

export function stepStart(step: MotionStep, id: string, index: number, count: number) {
  const stagger = step.maxSpread && count > 1 ? Math.min(step.stagger ?? 0, step.maxSpread / (count - 1)) : step.stagger ?? 0;
  const idIndex = step.idIndex ? Number(id.match(new RegExp(step.idIndex))?.[1] ?? 1) - 1 : index;
  return step.start + idIndex * stagger;
}

export const approvedReducedMotionDuration = specification.reducedMotion.duration;

/** The preview holds after the last staggered child, even if it exceeds the nominal family duration. */
export function approvedMotionDuration(asset: ApprovedMilestoneAsset): number {
  const plan = approvedMotion(asset.slug, asset.manifest.family as MotionFamily);
  let end = plan.duration;
  for (const step of plan.steps) {
    const duration = step.dur ?? (step.keys as number[][] | undefined)?.at(-1)?.[0] ?? 0;
    if (step.op === 'pulse' || step.layerGroup) { end = Math.max(end, step.start + duration); continue; }
    const layer = asset.manifest.layers.find(l => l.layer === step.layer);
    const children = layer?.children.filter(n => stepMatches(step, n.id ?? '', layer.layer)) ?? [];
    children.forEach((node, i) => { end = Math.max(end, stepStart(step, node.id ?? '', i, children.length) + duration); });
  }
  return end;
}
