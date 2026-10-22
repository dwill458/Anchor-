import { getChartIntroSeen } from './chartIntroSeen';
import { CHART_INTRO_TIMING } from './chartMotion';
import { MAP_H, MAP_W } from './map/chartMapContracts';
import { buildRouteTable } from './map/chartMapGeometry';
import { prepareChartMapIntroArt } from './map/ChartMapLand';

/** Intro map height for a viewport width. The creation flow and every prefetch caller must agree on it. */
export function chartIntroMapHeight(width: number): number {
  return width * MAP_H / MAP_W;
}

/**
 * Starts the work the Chart intro needs before the person can reach it: decode the land art, compile the
 * shaders, build the fog field and grain for this width, and prime the per-account seen flag. Everything lands in
 * the module caches the intro reads from, so the intro's own call returns from cache.
 */
export function prefetchChartIntro(width: number): Promise<boolean> {
  const table = buildRouteTable();
  const seen = getChartIntroSeen().catch(() => false);
  const art = prepareChartMapIntroArt(table, width, chartIntroMapHeight(width)).catch(() => false);
  return Promise.all([seen, art]).then(([, decoded]) => decoded);
}

/**
 * True while the cold preparation cover may still hold the paper. Past CHART_INTRO_TIMING.coverMax the cover drops
 * and the intro takes its reduced path, so an empty body never shows longer than the cap.
 */
export function chartIntroCoverHeld(elapsedMs: number, ready: boolean): boolean {
  return !ready && elapsedMs < CHART_INTRO_TIMING.coverMax;
}
