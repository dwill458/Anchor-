const mockArrivals: Array<{kind:string;duration?:number;delay?:number}> = [];
jest.mock('react-native-reanimated', () => {
  const actual = require('@/__tests__/mocks/reactNativeReanimated').default;
  const build = (kind:string) => ({ duration: (duration:number) => {
    const spec = { kind, duration, delay: 0 };
    const chain = { delay: (delay:number) => { spec.delay=delay; mockArrivals?.push(spec); return chain; }, reduceMotion: () => chain, easing: () => chain };
    return chain;
  } });
  return { __esModule:true, ...actual, FadeIn:build('fade'), FadeInDown:build('row') };
});
import React from 'react';
import { render } from '@testing-library/react-native';
import { ChartCourseReviewScreen } from '../ChartCourseReviewScreen';
import type { DraftWaypoint } from '../ChartRouteEditor';

const waypoints:DraftWaypoint[] = ['a','b','c'].map(key => ({ key,title:`Waypoint ${key}`,rationale:null,kind:'MILESTONE',metricLabel:null,metricTarget:null,metricBaseline:null }));
const common = { destination:'A meaningful destination',oneMove:'Begin today',onOneMoveChange:jest.fn(),onWaypointsChange:jest.fn(),saving:false,canConfirm:true,onAdjust:jest.fn(),onConfirm:jest.fn(),topInset:24 };

describe('Review staged arrival', () => {
  beforeEach(() => { mockArrivals.length=0; });
  it('stages intro, destination, and rows once, never replaying on edit, reorder or add', () => {
    const screen=render(<ChartCourseReviewScreen {...common} waypoints={waypoints} proposalKey="a" reducedMotion={false} />);
    expect(mockArrivals).toEqual([
      {kind:'fade',duration:220,delay:700}, {kind:'fade',duration:220,delay:920},
      {kind:'row',duration:360,delay:1140}, {kind:'row',duration:360,delay:1210}, {kind:'row',duration:360,delay:1280},
    ]);
    const changed = [waypoints[1],{...waypoints[0],title:'Renamed'},waypoints[2],{...waypoints[0],key:'new'}];
    screen.rerender(<ChartCourseReviewScreen {...common} oneMove="Edit" waypoints={changed} proposalKey="a" reducedMotion={false} />);
    expect(mockArrivals).toHaveLength(5);
    screen.rerender(<ChartCourseReviewScreen {...common} waypoints={waypoints} proposalKey="b" reducedMotion={false} />);
    expect(mockArrivals).toHaveLength(10);
  });

  it('does not replay when Adjust is cancelled and the same proposal mounts again', () => {
    const enteredProposals={current:new Set<string|number>()};
    const enteredWaypointKeys={current:new Set<string>()};
    const props={...common,waypoints,enteredProposals,enteredWaypointKeys,proposalKey:'a',reducedMotion:false};
    const first=render(<ChartCourseReviewScreen {...props} />);
    expect(mockArrivals).toHaveLength(5);
    first.unmount();
    render(<ChartCourseReviewScreen {...props} />);
    expect(mockArrivals).toHaveLength(5);
  });

  it('uses no entrance animations under reduced motion', () => {
    render(<ChartCourseReviewScreen {...common} waypoints={waypoints} reducedMotion />);
    expect(mockArrivals).toEqual([]);
  });
});
