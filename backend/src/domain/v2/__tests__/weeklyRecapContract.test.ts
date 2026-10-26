/**
 * Contract fixture shared with the mobile app. The same JSON lives at
 * anchor/mobile/src/adapters/v2/weeklyRecap/__fixtures__/weeklyRecapV2.sample.json; the mobile suite validates it with
 * the client's runtime guard. If the composer's output changes, regenerate both:
 *   UPDATE_RECAP_FIXTURE=1 npx jest src/domain/v2/__tests__/weeklyRecapContract
 */
import fs from 'fs';
import path from 'path';
import { composeWeeklyRecap, RecapSource } from '../weeklyRecap';

const at = (iso: string) => new Date(iso);
const source: RecapSource = {
  userId: 'user-1', weekKey: '2026-10-12', timeZone: 'America/New_York', now: at('2026-10-21T18:00:00Z'), phase: 'FINAL', provenance: 'LIVE', hasAnyHistory: true,
  practices: ['2026-10-12', '2026-10-13', '2026-10-15'].map((k, i) => ({ id: `p${i}`, anchorId: 'a1', localDateKey: k, mode: i === 1 ? 'visualize' : 'focus', completedAt: at(`${k}T15:00:00Z`) })),
  priorPracticeAt: null,
  waypoints: [{ id: 'w2', courseId: 'c1', anchorId: 'a1', title: 'Finish the first draft', reachedAt: at('2026-10-16T14:00:00Z') }],
  courses: [{ id: 'c1', anchorId: 'a1', destination: 'Publish my book', waypointTotal: 4, waypointsReached: 2, finalWaypointId: 'w4', completedAt: null, routeScope: 'DESTINATION' }],
  moves: [
    { id: 'm1', courseId: 'c1', waypointId: 'w2', anchorId: 'a1', title: 'Outline chapter 3', completedAt: at('2026-10-14T14:00:00Z') },
    { id: 'm2', courseId: 'c1', waypointId: 'w3', anchorId: 'a1', title: 'Email an editor', completedAt: at('2026-10-15T14:00:00Z') },
  ],
  completions: [], releases: [],
  milestones: [{ id: 'ms1', anchorId: 'a1', definitionId: 'journey.waypoint.first', earnedAt: at('2026-10-16T14:00:00Z'), sourceEntityId: 'w2' }],
  visions: [],
  anchors: [{ id: 'a1', intention: 'Write and publish my book', categoryKey: 'creativity', isReleased: false }, { id: 'a2', intention: 'Learn piano', categoryKey: 'learning', isReleased: false }],
  failedDomains: [],
};

describe('WeeklyRecapV2 contract fixture', () => {
  const file = path.join(__dirname, '__fixtures__', 'weeklyRecapV2.sample.json');
  const actual = JSON.parse(JSON.stringify(composeWeeklyRecap(source)));
  it('matches the committed fixture the mobile app validates against', () => {
    if (process.env.UPDATE_RECAP_FIXTURE) fs.writeFileSync(file, JSON.stringify(actual, null, 2) + '\n');
    expect(actual).toEqual(JSON.parse(fs.readFileSync(file, 'utf8')));
  });
  it('exercises the interesting paths', () => {
    expect(actual.hero.kind).toBe('WAYPOINT_REACHED');
    expect(actual.hero.movesCompleted).toBe(1);
    expect(actual.hero.labels).toEqual(['First waypoint']);
    expect(actual.highlights.map((h: any) => h.kind)).toEqual(['MOVES_PROGRESS']);
    expect(actual.status).toBe('FINAL');
  });
});
