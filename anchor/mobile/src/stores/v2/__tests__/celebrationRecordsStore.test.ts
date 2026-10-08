import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AnchorCelebrationRecord,
  CELEBRATION_RECORDS_STORAGE_KEY,
  celebrationRecordsReady,
  useCelebrationRecordsStore,
} from '../celebrationRecordsStore';

const storage = AsyncStorage as unknown as { getItem: jest.Mock; setItem: jest.Mock };

const DATE_A = '2026-01-02T03:04:05.000Z';
const DATE_B = '2026-02-10T08:00:00.000Z';

const records = () => useCelebrationRecordsStore.getState().records;

beforeEach(() => {
  jest.clearAllMocks();
  useCelebrationRecordsStore.setState({ records: {}, hydrated: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('celebrationRecordsStore: hydration', () => {
  it('refuses to write any stage before the stored record is read, and says repeat so nothing replays full', () => {
    useCelebrationRecordsStore.setState({ hydrated: false });
    expect(useCelebrationRecordsStore.getState().recordStage('a1', 'established', DATE_A)).toBe('repeat');
    expect(records()).toEqual({});
  });

  it('refuses to write Full Strength before the stored record is read', () => {
    useCelebrationRecordsStore.setState({ hydrated: false });
    expect(useCelebrationRecordsStore.getState().recordFullStrength('a1', DATE_A)).toBe('repeat');
    expect(records()).toEqual({});
  });

  it('writes once hydrated', () => {
    expect(useCelebrationRecordsStore.getState().recordStage('a1', 'established', DATE_A)).toBe('first');
    expect(records().a1.stages.established).toBe(DATE_A);
  });
});

describe('celebrationRecordsStore: stages', () => {
  it('the first time a stage is reached it is first, and the real date is stored', () => {
    expect(useCelebrationRecordsStore.getState().recordStage('a1', 'building', DATE_A)).toBe('first');
    expect(records().a1).toEqual({ stages: { building: DATE_A } });
  });

  it('a stage reached again is repeat, and the original date is kept', () => {
    useCelebrationRecordsStore.getState().recordStage('a1', 'building', DATE_A);
    expect(useCelebrationRecordsStore.getState().recordStage('a1', 'building', DATE_B)).toBe('repeat');
    expect(records().a1.stages.building).toBe(DATE_A);
  });

  it('each stage is recorded separately', () => {
    useCelebrationRecordsStore.getState().recordStage('a1', 'building', DATE_A);
    expect(useCelebrationRecordsStore.getState().recordStage('a1', 'established', DATE_B)).toBe('first');
    expect(records().a1.stages).toEqual({ building: DATE_A, established: DATE_B });
  });

  it('stamps the current time when no date is given', () => {
    jest.useFakeTimers({ now: new Date(DATE_B) });
    useCelebrationRecordsStore.getState().recordStage('a1', 'integrated');
    expect(records().a1.stages.integrated).toBe(DATE_B);
  });
});

describe('celebrationRecordsStore: Full Strength', () => {
  it('the first time Full Strength is reached it is first, and the date is stored', () => {
    expect(useCelebrationRecordsStore.getState().recordFullStrength('a1', DATE_A)).toBe('first');
    expect(records().a1.fullStrengthAt).toBe(DATE_A);
    expect(records().a1.fullStrengthLastAt).toBeUndefined();
  });

  it('after decay it is repeat: the first date is kept and only the last date moves', () => {
    useCelebrationRecordsStore.getState().recordFullStrength('a1', DATE_A);
    expect(useCelebrationRecordsStore.getState().recordFullStrength('a1', DATE_B)).toBe('repeat');
    expect(records().a1.fullStrengthAt).toBe(DATE_A);
    expect(records().a1.fullStrengthLastAt).toBe(DATE_B);
  });

  it('keeps stage records when Full Strength is recorded for the same Anchor', () => {
    useCelebrationRecordsStore.getState().recordStage('a1', 'reinforced', DATE_A);
    useCelebrationRecordsStore.getState().recordFullStrength('a1', DATE_B);
    expect(records().a1).toEqual({ stages: { reinforced: DATE_A }, fullStrengthAt: DATE_B });
  });
});

describe('celebrationRecordsStore: per Anchor', () => {
  it('records are kept per Anchor, so one Anchor never consumes another Anchor\'s first celebration', () => {
    useCelebrationRecordsStore.getState().recordStage('a1', 'established', DATE_A);
    expect(useCelebrationRecordsStore.getState().recordStage('a2', 'established', DATE_B)).toBe('first');
    expect(useCelebrationRecordsStore.getState().recordFullStrength('a2', DATE_B)).toBe('first');
    expect(records().a1).toEqual({ stages: { established: DATE_A } });
    expect(records().a2.stages.established).toBe(DATE_B);
  });

  it('getRecord returns the stored record for an Anchor, or undefined', () => {
    useCelebrationRecordsStore.getState().recordStage('a1', 'building', DATE_A);
    expect(useCelebrationRecordsStore.getState().getRecord('a1')).toEqual({ stages: { building: DATE_A } });
    expect(useCelebrationRecordsStore.getState().getRecord('missing')).toBeUndefined();
  });
});

describe('celebrationRecordsStore: persistence', () => {
  it('persists records only, under its own key, in the versioned shape', async () => {
    expect(CELEBRATION_RECORDS_STORAGE_KEY).toBe('@anchor/v2/celebration-records');
    useCelebrationRecordsStore.getState().recordStage('a1', 'established', DATE_A);
    await new Promise((resolve) => setImmediate(resolve));

    const lastWrite = storage.setItem.mock.calls.at(-1);
    expect(lastWrite).toBeDefined();
    expect(lastWrite![0]).toBe(CELEBRATION_RECORDS_STORAGE_KEY);
    expect(JSON.parse(lastWrite![1])).toEqual({
      state: { records: { a1: { stages: { established: DATE_A } } } },
      version: 1,
    });
  });

  it('the merge keeps every stored Anchor and lets the session record win on a shared Anchor', () => {
    const persist = useCelebrationRecordsStore.persist;
    const merge = persist.getOptions().merge!;
    const current = { ...useCelebrationRecordsStore.getState(), records: { a1: { stages: { established: DATE_B } } } };
    const merged = merge(
      { records: { a1: { stages: { building: DATE_A } }, a2: { stages: { building: DATE_A }, fullStrengthAt: DATE_A } } },
      current,
    ) as { records: Record<string, AnchorCelebrationRecord> };

    expect(merged.records.a1).toEqual({ stages: { established: DATE_B } });
    expect(merged.records.a2).toEqual({ stages: { building: DATE_A }, fullStrengthAt: DATE_A });
  });

  it('the merge tolerates a missing stored record', () => {
    const merge = useCelebrationRecordsStore.persist.getOptions().merge!;
    const current = { ...useCelebrationRecordsStore.getState(), records: {} };
    expect(merge(undefined, current) as typeof current).toMatchObject({ records: {} });
  });
});

describe('celebrationRecordsReady', () => {
  it('resolves true at once when the records are already hydrated', async () => {
    await expect(celebrationRecordsReady()).resolves.toBe(true);
  });

  it('resolves true when hydration lands before the timeout', async () => {
    useCelebrationRecordsStore.setState({ hydrated: false });
    const ready = celebrationRecordsReady(800);
    useCelebrationRecordsStore.setState({ hydrated: true });
    await expect(ready).resolves.toBe(true);
  });

  it('resolves false after the timeout when hydration never lands, so a slow read cannot hold a scene', async () => {
    jest.useFakeTimers();
    useCelebrationRecordsStore.setState({ hydrated: false });
    const ready = celebrationRecordsReady(800);
    let settled: boolean | undefined;
    void ready.then((value) => { settled = value; });

    jest.advanceTimersByTime(799);
    await Promise.resolve();
    expect(settled).toBeUndefined();

    jest.advanceTimersByTime(1);
    await expect(ready).resolves.toBe(false);
  });
});
