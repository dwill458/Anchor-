import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ChartJourneyWorld } from '../ChartJourneyWorld';
import { WORLD_LAYERS } from '../chartJourneyGeometry';
import { toMetricView } from '@/adapters/v2/chart/chartV2Model';

const markers = [
  { id:'a',number:1,state:'completed' as const,accessibilityLabel:'First, reached' },
  { id:'b',number:2,state:'current' as const,accessibilityLabel:'Second, current' },
  { id:'c',number:3,state:'upcoming' as const,accessibilityLabel:'Third, ahead' },
];
function load(screen:ReturnType<typeof render>) {
  act(()=>{ WORLD_LAYERS.forEach(layer=>fireEvent(screen.getByTestId(`chart-world-layer-${layer.id}`,{includeHiddenElements:true}),'load')); });
}
it('waits for every layer and offers retry after a texture failure',()=>{
  const onReady=jest.fn();
  const screen=render(<ChartJourneyWorld width={393} height={480} markers={markers} onReady={onReady} />);
  expect(screen.getByTestId('chart-world-loading')).toBeTruthy();
  fireEvent(screen.getByTestId('chart-world-layer-city',{includeHiddenElements:true}),'error');
  expect(screen.getByTestId('chart-world-error')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Retry Chart scene'));
  load(screen);
  expect(screen.queryByTestId('chart-world-loading')).toBeNull();
  expect(onReady).toHaveBeenLastCalledWith(true);
});
it('future inspection does not advance the actual camera or rewrite the node status',()=>{
  const progress={value:.35} as never;
  const onPress=jest.fn();
  const screen=render(<ChartJourneyWorld width={393} height={480} markers={markers} progress={progress} selectedMarkerId="c" inspectionBlend={{value:1} as never} onMarkerPress={onPress}/>);
  load(screen);
  const target=screen.getByTestId('chart-world-hit-c');
  fireEvent.press(target,{nativeEvent:{}});
  expect(onPress).toHaveBeenCalledWith('c');
  expect((progress as {value:number}).value).toBe(.35);
  expect(target.props.accessibilityState.selected).toBe(false);
});
it('uses five layers and one node algorithm for twelve waypoints',()=>{
  const nodes=Array.from({length:12},(_,i)=>({...markers[i%3],id:`w${i}`,number:i+1}));
  const screen=render(<ChartJourneyWorld width={360} height={450} markers={nodes} onMarkerPress={()=>{}}/>);
  load(screen);
  expect(screen.getAllByTestId(/^chart-world-layer-/,{includeHiddenElements:true})).toHaveLength(5);
  expect(screen.getAllByTestId(/^chart-world-hit-/)).toHaveLength(12);
  expect(screen.getAllByTestId(/^chart-world-node-/,{includeHiddenElements:true})).toHaveLength(12);
});
it('retains baseline meaning and makes nonfinite metrics safe',()=>{
  expect(toMetricView({baseline:100,current:550,target:1000,label:null})?.fraction).toBe(.5);
  expect(toMetricView({baseline:100,current:-50,target:1000,label:null})?.fraction).toBe(0);
  expect(toMetricView({baseline:100,current:2000,target:1000,label:null})?.fraction).toBe(1);
  expect(toMetricView({baseline:null,current:NaN,target:1000,label:null})?.fraction).toBeNull();
  expect(toMetricView({baseline:null,current:5,target:Infinity,label:null})).toBeNull();
  expect(toMetricView({baseline:null,current:5,target:0,label:null})).toBeNull();
});
