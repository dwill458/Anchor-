const originalDebugValue = process.env.EXPO_PUBLIC_SFX_DEBUG;

afterEach(() => {
  if (originalDebugValue === undefined) delete process.env.EXPO_PUBLIC_SFX_DEBUG;
  else process.env.EXPO_PUBLIC_SFX_DEBUG = originalDebugValue;
  jest.resetModules();
});

it('keeps only the last 500 timestamped lines when enabled', () => {
  process.env.EXPO_PUBLIC_SFX_DEBUG = '1';
  const { clearSfxLog, getSfxLog, sfxLog } = require('../sfxLog') as typeof import('../sfxLog');

  for (let index = 0; index <= 500; index += 1) sfxLog(`line-${index}`);

  const lines = getSfxLog();
  expect(lines).toHaveLength(500);
  expect(lines[0]).toMatch(/^\[SFX\] \+\d+ms line-1$/);
  expect(lines[499]).toMatch(/^\[SFX\] \+\d+ms line-500$/);
  clearSfxLog();
  expect(getSfxLog()).toEqual([]);
});

it('does not record or expose lines when disabled', () => {
  process.env.EXPO_PUBLIC_SFX_DEBUG = '0';
  const { getSfxLog, sfxLog } = require('../sfxLog') as typeof import('../sfxLog');

  sfxLog('hidden');
  expect(getSfxLog()).toEqual([]);
});
