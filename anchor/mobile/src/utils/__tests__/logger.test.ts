import { logger } from '@/utils/logger';
import { useSettingsStore } from '@/stores/settingsStore';

describe('logger', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    useSettingsStore.setState({ debugLoggingEnabled: false });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('does not emit logs when debug logging is disabled', () => {
    logger.info('hidden message');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('emits logs when debug logging is enabled in settings', () => {
    useSettingsStore.setState({ debugLoggingEnabled: true });
    logger.info('visible message', { foo: 'bar' });

    expect(logSpy).toHaveBeenCalledWith('[INFO] visible message', { foo: 'bar' });
  });
});
