jest.mock('expo-application', () => ({ applicationId: 'com.anchorintentions.expo58qa20261016' }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { sqlCipherLab: true } } } }));
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { traceStabilizationStage } from '../stabilizationDiagnostics';

describe('isolated stabilization diagnostics', () => {
  const previousFlag = process.env.EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS = '1';
    (Application as { applicationId: string }).applicationId = 'com.anchorintentions.expo58qa20261016';
    Constants.expoConfig!.extra!.sqlCipherLab = true;
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS;
    else process.env.EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS = previousFlag;
  });

  it.each(['com.anchorintentions.app', 'com.anchorintentions.sqlcipherpreview20261015'])('does not emit in %s', async applicationId => {
    (Application as { applicationId: string }).applicationId = applicationId;
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const receipt = Promise.resolve('durable');
    expect(traceStabilizationStage('focus.receipt', () => receipt)).toBe(receipt);
    await receipt;
    expect(log).not.toHaveBeenCalled();
  });
  it.each(['flag', 'manifest'])('requires the %s opt-in', async gate => {
    if (gate === 'flag') delete process.env.EXPO_PUBLIC_ANCHOR_STABILIZATION_DIAGNOSTICS;
    else Constants.expoConfig!.extra!.sqlCipherLab = false;
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const receipt = Promise.resolve();
    expect(traceStabilizationStage('focus.receipt', () => receipt)).toBe(receipt);
    await receipt;
    expect(log).not.toHaveBeenCalled();
  });
  it('marks a pending receipt without settling it early and preserves its value', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    let commit!: (value: string) => void;
    const pending = new Promise<string>(resolve => { commit = resolve; });
    const receipt = traceStabilizationStage('canonical.commit', () => pending);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('"phase":"begin"');
    commit('committed');
    await expect(receipt).resolves.toBe('committed');
    expect(log.mock.calls[1][0]).toContain('"phase":"resolved"');
    expect(log.mock.calls.flat().join('')).not.toContain('committed');
  });
  it('preserves the original rejection without logging its private message', async () => {
    const log = jest.spyOn(console, 'info').mockImplementation(() => {});
    const error = new Error('PRIVATE SYNTHETIC VALUE');
    await expect(traceStabilizationStage('canonical.commit', () => Promise.reject(error))).rejects.toBe(error);
    expect(log.mock.calls[1][0]).toContain('"phase":"rejected"');
    expect(log.mock.calls.flat().join('')).not.toContain(error.message);
  });
  it('cannot turn a successful commit into failure when logging throws', async () => {
    jest.spyOn(console, 'info').mockImplementation(() => { throw new Error('diagnostic sink failed'); });
    await expect(traceStabilizationStage('canonical.commit', () => Promise.resolve(42))).resolves.toBe(42);
  });
});
