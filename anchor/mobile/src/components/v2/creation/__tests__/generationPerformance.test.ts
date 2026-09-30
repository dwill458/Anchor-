import { ETCHING, etchingRevealDelay } from '../generationPerformance';
describe('generation presentation boundary', () => {
  it.each([0, 800, 4300, 4500, 4900, 8200, 24000])('finishes a stroke after an image arriving at %ims', (elapsed) => {
    const revealAt = elapsed + etchingRevealDelay(elapsed);
    expect(revealAt).toBeGreaterThanOrEqual(ETCHING.minimum);
    const phase = (revealAt - ETCHING.entrance) % ETCHING.cycle;
    expect(phase).toBeGreaterThanOrEqual(ETCHING.draw);
    expect(phase).toBeLessThan(ETCHING.cycle);
  });
});
