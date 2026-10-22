import { ETCHING, etchingSample, registerEtchingCycle, requestEtchingCut, acknowledgeEtchingCut } from '../generationPerformance';
describe('generation performance', () => {
  it('etches and holds a full stroke before the next cycle', () => {
    expect(etchingSample(0)).toEqual({ progress: 0, finished: false });
    expect(etchingSample(ETCHING.entrance + ETCHING.draw / 2)).toEqual({ progress: 0.5, finished: false });
    expect(etchingSample(ETCHING.entrance + ETCHING.draw + 100)).toEqual({ progress: 1, finished: true });
    expect(etchingSample(ETCHING.entrance + ETCHING.cycle)).toEqual({ progress: 0, finished: false });
  });
  it('waits for the UI thread to acknowledge its finished stroke', async () => {
    const ready = jest.fn(); const released = jest.fn();
    const unregister = registerEtchingCycle('visible', ready);
    const pending = requestEtchingCut('visible').then(released);
    await Promise.resolve(); expect(ready).toHaveBeenCalledTimes(1); expect(released).not.toHaveBeenCalled();
    acknowledgeEtchingCut('visible'); await pending; expect(released).toHaveBeenCalledTimes(1); unregister();
  });
  it('keeps a result when the user leaves the animation while it is waiting', async () => {
    const unregister = registerEtchingCycle('leaving', jest.fn());
    const pending = requestEtchingCut('leaving'); unregister(); await pending;
    await expect(requestEtchingCut('offscreen')).resolves.toBeUndefined();
  });
});
