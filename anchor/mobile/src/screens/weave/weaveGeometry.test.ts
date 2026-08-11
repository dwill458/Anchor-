import type { PracticeMode } from '@/types/practice';
import { buildWeaveGeometry } from './weaveGeometry';
import type { WeaveNode } from './weaveData';

const modes: PracticeMode[] = ['focus', 'visualize', 'deep_prime', 'release'];
const nodesByMode = (): Record<PracticeMode, WeaveNode[]> => ({
  focus: [{ id: 'focus-1', mode: 'focus', bucketIndex: 1, startDateKey: '2026-08-01', endDateKey: '2026-08-01', events: [], sessionCount: 3, durationSeconds: 180 }],
  visualize: [{ id: 'visualize-1', mode: 'visualize', bucketIndex: 2, startDateKey: '2026-08-02', endDateKey: '2026-08-02', events: [], sessionCount: 1, durationSeconds: 60 }],
  deep_prime: [], release: [],
});

describe('The Weave geometry', () => {
  it('derives crossing strands and variable node size from activity', () => {
    const geometry = buildWeaveGeometry({ modes, nodesByMode: nodesByMode(), bucketCount: 4, width: 350, height: 228 });

    expect(geometry.strands).toHaveLength(4);
    expect(geometry.strands[0].path).not.toEqual(geometry.strands[1].path);
    expect(geometry.strands[0].opacity).toBeGreaterThan(geometry.strands[3].opacity);
    expect(geometry.nodePositions['focus-1'].radius).toBeGreaterThan(geometry.nodePositions['visualize-1'].radius);
  });

  it('is deterministic for the same canonical nodes', () => {
    const args = { modes, nodesByMode: nodesByMode(), bucketCount: 4, width: 350, height: 228 };
    expect(buildWeaveGeometry(args)).toEqual(buildWeaveGeometry(args));
  });
});
