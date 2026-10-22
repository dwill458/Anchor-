import { chartTypography as typography } from './chartTypography';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Image as SvgImage, LinearGradient as SvgGradient, Mask, Rect, Stop } from 'react-native-svg';
import { colors, getCategoryColor } from '@/theme/v2';
import type { ChartMarker } from './ChartLandscape';
import { ROAD_TABLE, WORLD_LAYERS, getWorldBaseSize, getCameraTransform, getLayerParallax, getRoadParallax, getPointAtNormalizedDistance, getWaypointRoutePositions, getNodeVisualScale, worldToViewport, pickWaypoint, type WorldPoint, type CameraTransform, type WorldLayer } from './chartJourneyGeometry';

/* eslint-disable @typescript-eslint/no-var-requires */
const SOURCES = {
  sky: require('../../../assets/chart/world/runtime/chart_01_sky.jpg'),
  city: require('../../../assets/chart/world/runtime/chart_02_city.png'),
  midground: require('../../../assets/chart/world/runtime/chart_03_midground.png'),
  road: require('../../../assets/chart/world/runtime/chart_04_road.png'),
  foreground: require('../../../assets/chart/world/runtime/chart_05_foreground.png'),
};
/* eslint-enable @typescript-eslint/no-var-requires */
type Props = {
  width: number;
  height: number;
  progress?: SharedValue<number>;
  staticProgress?: number;
  markers?: readonly ChartMarker[];
  category?: string | null;
  inspectionBlend?: SharedValue<number>;
  selectedMarkerId?: string | null;
  nodeReveal?: SharedValue<number>;
  onMarkerPress?: (id: string) => void;
  onReady?: (ready: boolean) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};
type PlacedMarker = ChartMarker & { point: WorldPoint; routeProgress: number };

/** One camera for all registered art. Nodes use precisely the road's secondary offset. */
export const ChartJourneyWorld = memo(function ChartJourneyWorld({ width, height, progress, staticProgress = 0, markers = [], category, inspectionBlend, selectedMarkerId, nodeReveal, onMarkerPress, onReady, accessibilityLabel, testID = 'chart-journey-world', style }: Props) {
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ready = loaded.size === WORLD_LAYERS.length && !failed;
  const { width:baseWidth,height:baseHeight } = getWorldBaseSize({width,height});
  const accent = getCategoryColor(category);
  const nodes = useMemo<PlacedMarker[]>(() => {
    const positions = getWaypointRoutePositions(markers.length);
    return markers.map((marker, i) => ({ ...marker, routeProgress: positions[i], point: getPointAtNormalizedDistance(positions[i]) }));
  }, [markers]);
  const selected = nodes.find(node => node.id === selectedMarkerId);
  const selectedProgress = selected && selected.state !== 'upcoming' ? selected.routeProgress : null;
  const rail = useDerivedValue(() => {
    const actual = progress ? progress.value : staticProgress;
    return selectedProgress === null ? actual : actual+(selectedProgress-actual)*(inspectionBlend?.value ?? 0);
  }, [staticProgress, selectedProgress]);
  const camera = useDerivedValue(() => getCameraTransform(rail.value, { width, height }, ROAD_TABLE), [width, height]);
  const worldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: camera.value.left+(camera.value.width-baseWidth)/2 },
      { translateY: camera.value.top+(camera.value.height-baseHeight)/2 },
      { scale: camera.value.scale },
    ],
  }), [baseWidth, baseHeight]);
  const onLoad = useCallback((id: string) => {
    setLoaded(previous => {
      const next = new Set(previous); next.add(id); return next;
    });
  }, []);
  React.useEffect(() => { onReady?.(ready); }, [onReady, ready]);
  const retry = () => { setLoaded(new Set()); setFailed(false); setAttempt(value => value+1); };
  const selectAt = (event: GestureResponderEvent, fallback?: PlacedMarker) => {
    if (!onMarkerPress || !ready) return;
    // A screen-reader activation has no reliable touch coordinates.
    if (fallback && !Number.isFinite(event?.nativeEvent?.locationX)) { onMarkerPress(fallback.id); return; }
    const transform = camera.value, offset = getRoadParallax(rail.value);
    const projected = nodes.map(node => ({ id:node.id, ...worldToViewport(node.point, transform, offset), current:node.state === 'current' }));
    const origin = fallback ? worldToViewport(fallback.point, transform, offset) : { x:24,y:24 };
    const id = pickWaypoint(event.nativeEvent.locationX+origin.x-24, event.nativeEvent.locationY+origin.y-24, projected);
    if (id) onMarkerPress(id);
  };
  return (
    <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.viewport, { width, height }, style]}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity:ready ? 1 : 0 }]}>
        <Animated.View style={[{ width:baseWidth,height:baseHeight }, worldStyle]}>
          {[WORLD_LAYERS[0], WORLD_LAYERS[2], WORLD_LAYERS[1], WORLD_LAYERS[3]].map(layer => <WorldLayerImage key={`${layer.id}:${attempt}`} layer={layer} width={baseWidth} height={baseHeight} rail={rail} onLoad={() => onLoad(layer.id)} onError={() => setFailed(true)} />)}
        </Animated.View>
        {/* Noncurrent markers sit beneath the foreground, whose identical camera is composited over them. */}
        {nodes.filter(node => node.state !== 'current').map((node, i) => <WorldNode key={node.id} node={node} camera={camera} rail={rail} count={nodes.length} currentIndex={nodes.findIndex(n => n.state === 'current')} index={nodes.indexOf(node)} accent={accent} reveal={nodeReveal} />)}
        <Animated.View style={[StyleSheet.absoluteFill, styles.foregroundPass]}>
          <Animated.View style={[{ width:baseWidth,height:baseHeight }, worldStyle]}>
            <WorldLayerImage key={`foreground:${attempt}`} layer={WORLD_LAYERS[4]} width={baseWidth} height={baseHeight} rail={rail} onLoad={() => onLoad('foreground')} onError={() => setFailed(true)} />
          </Animated.View>
        </Animated.View>
        {nodes.filter(node => node.state === 'current').map(node => <WorldNode key={node.id} node={node} camera={camera} rail={rail} count={nodes.length} currentIndex={nodes.indexOf(node)} index={nodes.indexOf(node)} accent={accent} reveal={nodeReveal} />)}
        <LinearGradient colors={['rgba(8,15,22,.18)','transparent','rgba(8,15,22,.35)']} locations={[0,.5,1]} style={StyleSheet.absoluteFill} />
      </View>
      {ready ? <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {nodes.map(node => <NodeHitTarget key={node.id} node={node} camera={camera} rail={rail} onPress={onMarkerPress ? event => selectAt(event,node) : undefined} />)}
      </View> : null}
      {!ready ? <View style={styles.loading} testID={failed ? 'chart-world-error' : 'chart-world-loading'}>
        {failed ? <><Text style={styles.loadText}>Your Chart scene could not be loaded.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Chart scene" onPress={retry} style={styles.retry}><Text style={styles.loadText}>Retry</Text></Pressable></> : <ActivityIndicator color="#F2E6CB" accessibilityLabel="Loading Chart scene" />}
      </View> : null}
    </View>
  );
});

function WorldLayerImage({ layer, width, height, rail, onLoad, onError }: { layer:WorldLayer; width:number; height:number; rail:SharedValue<number>; onLoad?:()=>void; onError?:()=>void }) {
  const style = useAnimatedStyle(() => {
    const offset = getLayerParallax(rail.value, layer.parallax);
    return { transform:[{ translateX:offset.x*width },{ translateY:offset.y*height }] };
  });
  // The supplied city includes a separate water patch. Feather its perimeter into the
  // continuous midground water, retaining the skyline and original source alpha.
  if (layer.id === 'city') return <Animated.View style={[{position:'absolute',left:layer.rect.x*width,top:layer.rect.y*height,width:width*layer.rect.scale,height:height*layer.rect.scale},style]}>
    <Image testID="chart-world-layer-city" source={SOURCES.city} onLoad={onLoad} onError={onError} style={{position:'absolute',width:1,height:1,opacity:0}} />
    <Svg width={width*layer.rect.scale} height={height*layer.rect.scale}>
      <Defs>
        <SvgGradient id="citySides" x1="0%" y1="0%" x2="100%" y2="0%"><Stop offset={0} stopColor="white" stopOpacity={0}/><Stop offset={.06} stopColor="white"/><Stop offset={.94} stopColor="white"/><Stop offset={1} stopColor="white" stopOpacity={0}/></SvgGradient>
        <SvgGradient id="cityWater" x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset={0} stopColor="white"/><Stop offset={.58} stopColor="white"/><Stop offset={.69} stopColor="white" stopOpacity={0}/><Stop offset={1} stopColor="white" stopOpacity={0}/></SvgGradient>
        <Mask id="citySideMask" x="0" y="0" width={width*layer.rect.scale} height={height*layer.rect.scale} maskUnits="userSpaceOnUse" maskType="alpha"><Rect width="100%" height="100%" fill="url(#citySides)"/></Mask>
        <Mask id="cityWaterMask" x="0" y="0" width={width*layer.rect.scale} height={height*layer.rect.scale} maskUnits="userSpaceOnUse" maskType="alpha"><Rect width={width*layer.rect.scale} height={height*layer.rect.scale} fill="url(#cityWater)" mask="url(#citySideMask)"/></Mask>
      </Defs>
      <SvgImage href={SOURCES.city} width={width*layer.rect.scale} height={height*layer.rect.scale} preserveAspectRatio="none" mask="url(#cityWaterMask)"/>
    </Svg>
  </Animated.View>;
  return <Animated.View style={[StyleSheet.absoluteFill, style]}>
    <Image testID={`chart-world-layer-${layer.id}`} source={SOURCES[layer.id]} resizeMode="stretch" fadeDuration={0} onLoad={onLoad} onError={onError}
      accessibilityIgnoresInvertColors style={{ position:'absolute', left:layer.rect.x*width,top:layer.rect.y*height,width:width*layer.rect.scale,height:height*layer.rect.scale }} />
  </Animated.View>;
}
function useNodeStyle(node:PlacedMarker, camera:SharedValue<CameraTransform>, rail:SharedValue<number>, size:number) {
  return useAnimatedStyle(() => {
    const point = worldToViewport(node.point,camera.value,getRoadParallax(rail.value));
    return { transform:[{ translateX:point.x-size/2 },{ translateY:point.y-size/2 }] };
  });
}
function WorldNode({ node,camera,rail,count,currentIndex,index,accent,reveal }: { node:PlacedMarker; camera:SharedValue<CameraTransform>; rail:SharedValue<number>; count:number; currentIndex:number; index:number; accent:string; reveal?:SharedValue<number> }) {
  const important = count <= 8 || Math.abs(index-currentIndex)<=1;
  const current = node.state === 'current';
  const diameter = (current ? 30 : 23)*getNodeVisualScale(node.point.depth);
  const style = useNodeStyle(node,camera,rail,diameter);
  const revealStyle = useAnimatedStyle(() => ({ opacity:(important ? 1 : .4)*Math.max(0,Math.min(1,(reveal?.value ?? 1)*count-index)) }));
  return <Animated.View testID={`chart-world-node-${node.id}`} style={[styles.node,{ width:diameter,height:diameter,borderRadius:diameter/2,borderColor:current ? accent : '#E8DDC8',borderWidth:current ? 2 : 1,backgroundColor:node.state === 'completed' ? '#E8DDC8' : '#111C27' },style,revealStyle]}>
    {important ? <Text style={{ ...typography.labelSM,fontSize:Math.max(8,diameter*.4),lineHeight:Math.max(10,diameter*.5),color:node.state === 'completed' ? '#15212C' : '#F2E6CB' }}>{node.state === 'completed' ? '✓' : node.number}</Text> : null}
  </Animated.View>;
}
function NodeHitTarget({ node,camera,rail,onPress }: { node:PlacedMarker; camera:SharedValue<CameraTransform>; rail:SharedValue<number>; onPress?: (event:GestureResponderEvent)=>void }) {
  const style = useNodeStyle(node,camera,rail,48);
  if (!onPress) return <Animated.View style={[styles.hit,style]} accessible accessibilityRole="text" accessibilityLabel={node.accessibilityLabel} pointerEvents="none" />;
  return <Animated.View style={[styles.hit,style]} pointerEvents="box-none"><Pressable testID={`chart-world-hit-${node.id}`} accessibilityRole="button" accessibilityLabel={node.accessibilityLabel} accessibilityState={{ selected:node.state === 'current' }} onPress={onPress} style={StyleSheet.absoluteFill} /></Animated.View>;
}
const styles = StyleSheet.create({
  viewport:{ overflow:'hidden',backgroundColor:colors.ink.base },
  foregroundPass:{ overflow:'hidden' },
  node:{ position:'absolute',left:0,top:0,alignItems:'center',justifyContent:'center' },
  hit:{ position:'absolute',left:0,top:0,width:48,height:48 },
  loading:{ ...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',gap:12 },
  loadText:{ ...typography.bodySM,color:'#F2E6CB' },
  retry:{ minHeight:48,paddingHorizontal:24,justifyContent:'center' },
});
