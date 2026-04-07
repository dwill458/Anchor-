import { StorageService } from '../StorageService';

describe('StorageService', () => {
  beforeEach(() => {
    StorageService.setMockEnabled(true);
  });

  afterEach(() => {
    StorageService.setMockEnabled(false);
  });

  it('stores and retrieves values', async () => {
    await StorageService.setItem('anchor:test', { value: 123 });
    const result = await StorageService.getItem<{ value: number }>('anchor:test');

    expect(result).toEqual({ value: 123 });
  });

  it('removes values', async () => {
    await StorageService.setItem('anchor:delete', 'value');
    await StorageService.removeItem('anchor:delete');

    const result = await StorageService.getItem<string>('anchor:delete');
    expect(result).toBeNull();
  });

  it('supports multiSet and multiGet', async () => {
    await StorageService.multiSet([
      ['anchor:a', 1],
      ['anchor:b', 'two'],
    ]);

    const values = await StorageService.multiGet<unknown>(['anchor:a', 'anchor:b', 'anchor:c']);

    expect(values).toEqual([
      ['anchor:a', 1],
      ['anchor:b', 'two'],
      ['anchor:c', null],
    ]);
  });
});
