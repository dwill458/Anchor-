import React, { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { engravingStart, getMasterAsset, type EmblemPath, type MasterAsset } from '@/milestones/masterAssets';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export interface MasterEmblemProps {
  milestoneId: string;
  size: number;
  state: 'locked' | 'earned' | 'revealing';
  animated?: boolean;
  progress?: SharedValue<number>;
  reducedMotion?: boolean;
}
const INK = '#142630', GOLD = '#B88A3C', IVORY = '#F5EEDD', EMBOSS = '#A9A294';

function EngravedPath({ shape, progress, index, goldId, family }: { shape: EmblemPath; progress: SharedValue<number>; index: number; goldId: string; family: MasterAsset['family'] }) {
  const start = engravingStart(shape, index, family);
  const props = useAnimatedProps(() => {
    const p = Math.max(0, Math.min(1, (progress.value - start) / (1 - start)));
    return { strokeDashoffset: shape.length * (1 - p), opacity: p, fillOpacity: shape.fill ? p : 0 };
  });
  return <AnimatedPath d={shape.d} stroke={shape.layer === 'engraving' ? INK : GOLD} strokeWidth={shape.width}
    fill={shape.fill === 'gold' ? `url(#${goldId})` : shape.fill === 'ink' ? INK : shape.fill === 'ivory' ? IVORY : 'none'}
    strokeDasharray={[shape.length, shape.length]} strokeLinecap="round" strokeLinejoin="round" animatedProps={props} />;
}

function Aperture({ progress, id }: { progress: SharedValue<number>; id: string }) {
  const props = useAnimatedProps(() => ({ r: 8 + 46 * progress.value }));
  return <Defs><ClipPath id={id}><AnimatedCircle cx={60} cy={60} animatedProps={props} /></ClipPath></Defs>;
}

/** Static geometry and UI-thread drawing share exactly the same paths. No effects, timers or audio here. */
export const MasterEmblem = React.memo(function MasterEmblem({ milestoneId, size, state, animated = false, progress, reducedMotion = false }: MasterEmblemProps) {
  const asset = getMasterAsset(milestoneId);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  if (!asset) return null;
  const goldId = `gold${uid}`, plateId = `plate${uid}`, locked = state === 'locked';
  const aperture = asset.family === 'vision' && animated && progress && !reducedMotion && state === 'revealing';
  return <Svg width={size} height={size} viewBox="0 0 120 120" testID={`master-emblem-${milestoneId}-${state}`}>
    <Defs>
      <LinearGradient id={goldId} x1="15%" y1="0%" x2="85%" y2="100%">
        <Stop offset="0" stopColor="#8C6027" /><Stop offset="0.3" stopColor="#F7D995" />
        <Stop offset="0.52" stopColor="#D4AA56" /><Stop offset="0.78" stopColor="#A47430" /><Stop offset="1" stopColor="#704919" />
      </LinearGradient>
      <RadialGradient id={plateId} cx="38%" cy="28%" r="76%">
        <Stop offset="0" stopColor="#FFFBF1" /><Stop offset="0.72" stopColor={IVORY} /><Stop offset="1" stopColor="#E5D8BD" />
      </RadialGradient>
    </Defs>
    <Circle testID="emblem-material" cx={60} cy={60} r={52} fill={locked ? '#EEE9DF' : `url(#${plateId})`} stroke={locked ? '#CFC8B9' : '#CEB987'} strokeWidth={0.65} />
    <Circle testID="emblem-bevel" cx={60} cy={60} r={50} fill="none" stroke={locked ? '#D8D1C4' : '#FCF5E4'} strokeWidth={0.65} />
    {aperture ? <Aperture progress={progress!} id={`aperture${uid}`} /> : null}
    <G clipPath={aperture ? `url(#aperture${uid})` : undefined}>
    {asset.paths.map((shape, index) => animated && progress && !reducedMotion && state === 'revealing'
      ? <EngravedPath key={shape.id} shape={shape} index={index} progress={progress} goldId={goldId} family={asset.family} />
      : <G key={shape.id}>
          {locked ? <Path d={shape.d} transform="translate(0 .65)" fill="none" stroke="#FFFCF5" strokeWidth={shape.width + 0.45} /> : null}
          <Path d={shape.d} stroke={locked ? EMBOSS : shape.layer === 'engraving' ? INK : GOLD} strokeWidth={shape.width}
            fill={locked ? 'none' : shape.fill === 'gold' ? `url(#${goldId})` : shape.fill === 'ink' ? INK : shape.fill === 'ivory' ? IVORY : 'none'}
            strokeLinecap="round" strokeLinejoin="round" />
        </G>)}
    </G>
  </Svg>;
});

type NamedEmblemProps = Omit<MasterEmblemProps, 'milestoneId'>;
export const FullStrengthEmblem = (props: NamedEmblemProps) => <MasterEmblem {...props} milestoneId="strength.full" />;
export const FirstPracticeEmblem = (props: NamedEmblemProps) => <MasterEmblem {...props} milestoneId="commitment.practices.1" />;
export const GoalReachedEmblem = (props: NamedEmblemProps) => <MasterEmblem {...props} milestoneId="journey.goal" />;
export const FirstGlimpseEmblem = (props: NamedEmblemProps) => <MasterEmblem {...props} milestoneId="vision.first" />;
