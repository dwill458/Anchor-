jest.mock('../ChartMapLand', () => ({ ChartMapLand: () => null, hasDecodedChartLandscape: () => false }));
jest.mock('../ChartMapWeather', () => ({ ChartMapWeather: () => null, weatherReadySync: () => false }));
jest.mock('../ChartWeatherHold', () => ({ ChartWeatherVeil: () => null, useCloudTiles: () => null }));
jest.mock('../ChartWeatherNativeVeil', () => ({ ChartWeatherNativeVeil: () => null }));
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { ChartMap } from '../ChartMap';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import { useChartMapAnimState } from '../useChartMapAnimState';

it('opens the interactive map if artwork and weather never report ready', () => {
  jest.useFakeTimers();
  const onShown = jest.fn();
  const Harness = () => {
    const anim = useChartMapAnimState({ closed: 1, flagIndex: 0 });
    return <ChartMap testID="stuck-map" width={390} height={700} table={buildRouteTable()} placement={waypointPlacement(2)} anim={anim} markers={[]} categoryColor="#a64f68" reducedMotion={false} arrived={false} clouds weather="living" onShown={onShown} onMarkerPress={jest.fn()} onMapPress={jest.fn()} />;
  };
  const screen = render(<Harness />);
  act(() => { jest.advanceTimersByTime(8000); });
  act(() => { jest.advanceTimersByTime(500); });
  expect(onShown).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('stuck-map-native-veil', { includeHiddenElements: true })).toBeNull();
  screen.unmount();
  jest.useRealTimers();
});
