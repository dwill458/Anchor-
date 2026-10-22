import React, { useLayoutEffect, useMemo } from 'react';
import { ChartMap } from '../map/ChartMap';
import type { ChartMapMarker } from '../map/chartMapContracts';
import { buildRouteTable, waypointPlacement } from '../map/chartMapGeometry';
import { useChartMapAnimState } from '../map/useChartMapAnimState';
import type { IntroSequenceProgress } from '../map/chartMapSequences';

type Props = {
  width: number;
  categoryColor: string;
  category?: string | null;
  /** 'empty': the bare map with no route drawn. 'arrived': the whole route drawn, fog cleared, anchor glyph in place. */
  mode: 'empty' | 'arrived';
  /** Number of waypoints the placement is built for (markers are supplied separately). */
  waypointCount: number;
  markers?: ChartMapMarker[];
  reducedMotion: boolean;
  /** Optional animated ink/camera/route presentation for the creation opening. */
  introProgress?: IntroSequenceProgress;
  introBaseVisible?: boolean;
  onMapPress?: () => void;
  onArtReady?: (ready: boolean) => void;
  onIntroSurfaceSized?: () => void;
  testID?: string;
};

const NOOP = () => undefined;

/**
 * A non-interactive, fully settled map for surfaces that only show a state
 * (a Chart with no waypoints yet, a destination that was reached). No
 * sequences run here; the shared values are set once.
 */
export function ChartStaticMap({ width, categoryColor, category, mode, waypointCount, markers = [], reducedMotion, introProgress, introBaseVisible, onMapPress, onArtReady, onIntroSurfaceSized, testID }: Props) {
  const table = useMemo(() => buildRouteTable(), []);
  const placement = useMemo(() => waypointPlacement(Math.max(1, waypointCount)), [waypointCount]);
  const anim = useChartMapAnimState({ revealArc: mode === 'arrived' ? table.total : 0 });

  useLayoutEffect(() => {
    anim.mapOpacity.value = 1;
    anim.flagOpacity.value = 0;
    if (mode === 'arrived') {
      anim.revealArc.value = table.total;
      anim.fog.value = 1;
      anim.glyph.value = 1;
      anim.goldDot.value = 1;
    } else {
      anim.revealArc.value = 0;
    }
  }, [anim, mode, table]);

  return (
    <ChartMap
      testID={testID}
      width={width}
      table={table}
      placement={placement}
      anim={anim}
      markers={markers}
      categoryColor={categoryColor}
      category={category ?? undefined}
      interactive={false}
      reducedMotion={reducedMotion}
      arrived={mode === 'arrived'}
      introProgress={introProgress}
      introBaseVisible={introBaseVisible}
      onMapArtReady={onArtReady}
      onIntroSurfaceSized={onIntroSurfaceSized}
      onMarkerPress={NOOP}
      onMapPress={onMapPress ?? NOOP}
    />
  );
}
