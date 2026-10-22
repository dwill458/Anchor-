import { reloadCurrentApp } from '../reloadCurrentApp';

describe('reloadCurrentApp', () => {
  it('uses the development runtime reload without checking for updates', async () => {
    const reloadDevelopment = jest.fn();
    const reloadProduction = jest.fn().mockResolvedValue(undefined);

    await reloadCurrentApp(true, reloadDevelopment, reloadProduction);

    expect(reloadDevelopment).toHaveBeenCalledTimes(1);
    expect(reloadProduction).not.toHaveBeenCalled();
  });

  it('uses the installed production bundle and propagates reload failures', async () => {
    const error = new Error('restart unavailable');
    const reloadDevelopment = jest.fn();
    const reloadProduction = jest.fn().mockRejectedValue(error);

    await expect(reloadCurrentApp(false, reloadDevelopment, reloadProduction)).rejects.toBe(error);

    expect(reloadDevelopment).not.toHaveBeenCalled();
    expect(reloadProduction).toHaveBeenCalledTimes(1);
  });
});
