import { advanceSeal, nearSealStart, sealPath } from '../sealGeometry';
const path = sealPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 100, 1);
describe('ordered seal tracing', () => {
  it('requires the beginning of the guide', () => {
    expect(nearSealStart(path, { x: 10, y: 5 })).toBe(true);
    expect(nearSealStart(path, { x: 100, y: 100 })).toBe(false);
  });
  it('does not jump to later segments or accept distant touches', () => {
    expect(advanceSeal(path, 20, { x: 20, y: 100 })).toBe(20);
    expect(advanceSeal(path, 20, { x: 45, y: 29 })).toBe(20);
    expect(advanceSeal(path, 0, { x: 100, y: 0 })).toBe(0);
  });
  it('stays monotonic and allows tolerance while following each segment', () => {
    let distance = advanceSeal(path, 0, { x: 40, y: 20 });
    expect(distance).toBe(40);
    expect(advanceSeal(path, distance, { x: 10, y: 0 })).toBe(40);
    distance = advanceSeal(path, distance, { x: 80, y: 0 });
    distance = advanceSeal(path, distance, { x: 95, y: 0 });
    expect(distance).toBe(100);
    for (const touch of [{ x: 100, y: 40 }, { x: 100, y: 80 }, { x: 100, y: 100 }, { x: 60, y: 100 }, { x: 20, y: 100 }, { x: 0, y: 100 }]) distance = advanceSeal(path, distance, touch);
    expect(distance).toBe(path.total);
  });
  it('maps the guide into the existing artwork square', () => {
    const mapped = sealPath([{ x: 0, y: 0 }, { x: 100, y: 100 }], 200, 0.72);
    expect(mapped.points).toEqual([{ x: 28.000000000000004, y: 28.000000000000004 }, { x: 172, y: 172 }]);
  });
});
