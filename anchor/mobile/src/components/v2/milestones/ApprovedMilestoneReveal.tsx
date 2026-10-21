import React, { useId, useMemo } from 'react';
import Svg, { Circle, G, type GProps } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { APPROVED_MILESTONE_ASSETS, type SvgNode } from '@/milestones/approvedAssets';
import { SVG_COMPONENTS, namespaceSvgAttrs, ApprovedMilestoneSvg } from '@/milestones/approvedAssetsRenderer';
import { approvedMotion, approvedMotionDuration, stepMatches, stepStart, type MotionFamily, type MotionStep } from '@/milestones/approvedMotion';
import boundsData from '@/milestones/approvedMotionBounds.json';

const bounds = boundsData as Record<string, number[]>;
type SvgMatrix = [number, number, number, number, number, number];
// `matrix` is the native react-native-svg field used by extractTransform; G's public
// JS props expose `transform` instead. UI-thread updates target that native field directly.
const AnimatedG = Animated.createAnimatedComponent(G as React.ComponentType<GProps & { matrix?: SvgMatrix }>);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const animatedComponents = Object.fromEntries(Object.entries(SVG_COMPONENTS).map(([tag, component]) => [tag, Animated.createAnimatedComponent(component as React.ComponentType<Record<string, unknown>>)]));
const easing = {
  linear: Easing.linear, outCubic: Easing.bezierFn(0.33, 1, 0.68, 1),
  inOutCubic: Easing.bezierFn(0.65, 0, 0.35, 1), outQuint: Easing.bezierFn(0.22, 1, 0.36, 1),
  outExpo: Easing.bezierFn(0.16, 1, 0.3, 1),
};
type ScheduledStep = MotionStep & { delay: number; length?: number; drawable: boolean };

function unit(time: number, start: number, duration: number) {
  'worklet';
  return Math.max(0, Math.min(1, (time - start) / Math.max(1, duration)));
}
function keyValue(keys: number[], p: number) {
  'worklet';
  const position = p * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(position));
  return keys[i] + (keys[i + 1] - keys[i]) * (position - i);
}

function MotionNode({ node, children, steps, progress, duration, prefix }: {
  node: SvgNode; children: React.ReactNode; steps: ScheduledStep[]; progress: SharedValue<number>; duration: number; prefix: string;
}) {
  const Component = animatedComponents[node.tag];
  const attrs = namespaceSvgAttrs(node.attrs, prefix);
  const [cx, cy, base] = bounds[node.attrs.id] ?? [128, 128, 128];
  const authoredOpacity = Number(node.attrs.opacity ?? 1), authoredWidth = Number(node.attrs.strokeWidth ?? 1);
  const shapeProps = useAnimatedProps(() => {
    const props: { opacity: number; strokeDashoffset?: number; strokeWidth?: number } = { opacity: authoredOpacity };
    for (const step of steps) {
      const durationMs = step.dur ?? (step.keys as number[][] | undefined)?.at(-1)?.[0] ?? 1;
      const p = easing[step.ease as keyof typeof easing](unit(progress.value * duration, step.delay, durationMs));
      if (step.op === 'layerScale') continue;
      if (step.op === 'strokewidth') { props.strokeWidth = (step.from ?? 14) + (authoredWidth - (step.from ?? 14)) * p; continue; }
      if (step.op === 'fadeKeys') {
        const keys = step.keys as number[][];
        const total = keys[keys.length - 1][0];
        const time = p * total;
        let opacity = keys[keys.length - 1][1];
        for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) {
          opacity = keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * unit(time, keys[i - 1][0], keys[i][0] - keys[i - 1][0]); break;
        }
        props.opacity *= opacity;
      } else if (step.op === 'draw' && step.drawable) {
        props.strokeDashoffset = (step.length ?? 0) * (1 - p);
        props.opacity *= Math.min(1, p / 0.05);
      } else props.opacity *= p;
    }
    return props;
  });
  const groupProps = useAnimatedProps(() => {
    let sx = 1, sy = 1, x = 0, originX = cx, originY = cy;
    for (const step of steps) {
      const p = easing[step.ease as keyof typeof easing](unit(progress.value * duration, step.delay, step.dur ?? 1));
      if (step.op === 'pop' || step.op === 'radial') {
        sx *= (step.from ?? 0.5) + (1 - (step.from ?? 0.5)) * p; sy = sx;
        if (step.op === 'radial') { originX = 128; originY = 128; }
      } else if (step.op === 'raise') { sy *= 0.05 + 0.95 * p; originY = base; }
      else if (step.op === 'translateX') x += (step.from ?? 0) * (1 - p);
      else if (step.op === 'layerScale') { sx *= keyValue(step.keys as number[], p); sy = sx; originX = 128; originY = 128; }
    }
    // Matrix wrapper keeps the authored shape/group transform completely intact.
    return { matrix: [sx, 0, 0, sy, originX * (1 - sx) + x, originY * (1 - sy)] as SvgMatrix };
  });
  const draw = steps.find(s => s.op === 'draw' && s.drawable);
  return <AnimatedG animatedProps={groupProps}><Component {...attrs} {...(draw ? { strokeDasharray: [draw.length!, draw.length!] } : {})} animatedProps={shapeProps}>{children}</Component></AnimatedG>;
}

function Pulse({ progress, duration, step }: { progress: SharedValue<number>; duration: number; step: MotionStep }) {
  const animatedProps = useAnimatedProps(() => {
    const p = easing.outCubic(unit(progress.value * duration, step.start, step.dur!));
    return { r: step.r0! + (step.r1! - step.r0!) * p, opacity: p < 0.18 ? p / 0.18 * 0.7 : (1 - p) / 0.82 * 0.7 };
  });
  return <AnimatedCircle cx={128} cy={128} fill="none" stroke="#E6C877" strokeWidth={2.2} animatedProps={animatedProps} />;
}

/** Approved authored geometry; one shared UI-thread clock, finite operations, no frame callbacks. */
export function ApprovedMilestoneReveal({ definitionId, size, progress, reducedMotion = false, testID }: {
  definitionId: string; size: number; progress: SharedValue<number>; reducedMotion?: boolean; testID?: string;
}) {
  const asset = APPROVED_MILESTONE_ASSETS[definitionId];
  const prefix = `reveal${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const plan = useMemo(() => asset ? { ...approvedMotion(asset.slug, asset.manifest.family as MotionFamily), duration: approvedMotionDuration(asset) } : undefined, [asset]);
  if (!asset || !plan) return null;
  if (reducedMotion) return <ApprovedMilestoneSvg definitionId={definitionId} state="earned" size={size} testID={testID} />;
  const render = (node: SvgNode, layer = '', siblings: SvgNode[] = []): React.ReactNode => {
    const Component = SVG_COMPONENTS[node.tag];
    if (!Component) return null;
    const isLayer = asset.manifest.layers.some(l => l.id === node.attrs.id);
    const nextLayer = isLayer ? node.attrs.id.split('__')[1] : layer;
    const steps = plan.steps.filter(s => stepMatches(s, node.attrs.id ?? '', nextLayer, isLayer)).map(s => {
      const matching = siblings.filter(n => stepMatches(s, n.attrs.id ?? '', nextLayer, isLayer));
      const manifestNode = asset.manifest.layers.find(l => l.layer === nextLayer)?.children.find(n => n.id === node.attrs.id);
      return { ...s, delay: stepStart(s, node.attrs.id ?? '', matching.indexOf(node), matching.length),
        length: manifestNode?.pathLength, drawable: Boolean(manifestNode?.pathLength && !manifestNode.filled && !manifestNode.dashed && node.tag !== 'g') };
    });
    const children = node.children.map((child, i) => <React.Fragment key={child.attrs.id ?? i}>{render(child, nextLayer, node.children)}</React.Fragment>);
    return steps.length ? <MotionNode node={node} steps={steps} progress={progress} duration={plan.duration} prefix={prefix}>{children}</MotionNode>
      : <Component {...namespaceSvgAttrs(node.attrs, prefix)}>{children}</Component>;
  };
  return <Svg width={size} height={size} viewBox="0 0 256 256" testID={testID ?? `approved-reveal-${definitionId}`}>
    {asset.earned.children.map((node, i) => <React.Fragment key={node.attrs.id ?? i}>{render(node, '', asset.earned.children)}</React.Fragment>)}
    {plan.steps.filter(s => s.op === 'pulse').map(s => <Pulse key={s.name} progress={progress} duration={plan.duration} step={s} />)}
  </Svg>;
}
