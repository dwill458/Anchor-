/**
 * Creation → permanent Chart weather hand-off ("Explore your Chart").
 *
 * The creation stage records where its cloud cover rests; the permanent Chart,
 * mounting with `entrance === 'reveal'`, starts from exactly that cover so the
 * last creation frame and the first Chart frame show the same weather. Drift
 * needs no hand-off: every weather surface reads the one shared clock
 * (ChartMapWeather `weatherClock`). Presentation only, in memory, never persisted.
 */
/**
 * coverArc: where the cloud cover rests (creation surveys leg 1, so the clouds stay parted along it).
 * DEFERRED: inkArc (creation's inked first leg). The ink is never handed off: the permanent Chart draws it from
 * real progress only, so the drawn route never retreats overnight.
 */
export type ChartWeatherHandoff = { coverArc: number; inkArc?: number };

let handoff: ChartWeatherHandoff | null = null;

export function setChartWeatherHandoff(value: ChartWeatherHandoff): void {
  handoff = value;
}

/** The most recent creation stage's resting weather (idempotent read). */
export function peekChartWeatherHandoff(): ChartWeatherHandoff | null {
  return handoff;
}

/** Test helper. */
export function resetChartWeatherHandoff(): void {
  handoff = null;
}
