import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { Image as NativeImage } from 'react-native';
import { Skia, Path as SkiaPath, ImageShader, drawAsImage, useImage } from '@shopify/react-native-skia';
import { ChartMap } from '../ChartMap';
import { warmChartMapResources, hasDecodedChartLandscape } from '../ChartMapLand';
import { buildRouteTable, waypointPlacement } from '../chartMapGeometry';
import { useChartMapAnimState } from '../useChartMapAnimState';

afterEach(() => jest.restoreAllMocks());

it('shares pending decode, fog, grain and cloud work, then opens the warm map with art and landmarks together', async () => {
  let resolveData!: (data: object) => void;
  const data = new Promise<object>(resolve => { resolveData = resolve; });
  const fromURI = jest.fn(() => data);
  const decode = jest.fn(() => ({ width: () => 1704, height: () => 2360 }));
  jest.spyOn(NativeImage, 'resolveAssetSource').mockReturnValue({ uri: 'file:///chart-landscape-master.webp' } as never);
  Object.assign(Skia.Data, { fromURI });
  Object.assign(Skia.Image, { MakeImageFromEncoded: decode });
  (useImage as jest.Mock).mockReturnValue(null);
  const table = buildRouteTable();
  const placement = waypointPlacement(3);
  warmChartMapResources(table, 360, 400);
  warmChartMapResources(table, 360, 400);
  function Map() {
    const anim = useChartMapAnimState({ revealArc: 400 });
    return <ChartMap width={360} height={400} table={table} placement={placement} anim={anim}
      markers={[{ id: 'w1', index: 0, number: 1, title: 'First', state: 'current', selected: true, accessibilityLabel: 'First waypoint' }]}
      categoryColor="#A64F68" reducedMotion arrived={false} onMarkerPress={jest.fn()} onMapPress={jest.fn()} />;
  }
  const cold = render(<Map />);
  expect(cold.queryByTestId('chart-map-marker-0')).toBeNull();
  expect(JSON.stringify(cold.toJSON())).not.toContain('M-15,-15 L15,15');
  await act(async () => { resolveData({}); await data; });
  await waitFor(() => expect(hasDecodedChartLandscape()).toBe(true));
  cold.unmount();
  const warm = render(<Map />);
  expect(warm.getByTestId('chart-map-marker-0')).toBeTruthy();
  expect(hasDecodedChartLandscape()).toBe(true);
  expect(fromURI).toHaveBeenCalledTimes(1);
  expect(decode).toHaveBeenCalledTimes(1);
  // One grain image plus the three living-weather cloud tiles, built once however many callers warm them.
  expect(drawAsImage).toHaveBeenCalledTimes(4);
  expect(Skia.Image.MakeImage).toHaveBeenCalledTimes(3);
  expect(warm.UNSAFE_getAllByType(SkiaPath).some(node => node.props.path === 'M-15,-15 L15,15')).toBe(true);
  expect(warm.UNSAFE_getAllByType(ImageShader).some(node => node.props.image?.width() === 1704)).toBe(true);
  expect(fromURI).toHaveBeenCalledTimes(1);
  expect(drawAsImage).toHaveBeenCalledTimes(4);
  warm.unmount();
});
