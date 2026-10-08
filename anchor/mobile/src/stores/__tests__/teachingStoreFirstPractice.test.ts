import { useTeachingStore } from '@/stores/teachingStore';

describe('teachingStore hasSeenFirstPracticeScene', () => {
  it('defaults to false', () => {
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(false);
  });

  it('is filled with false when persisted state from before the flag is migrated', () => {
    const migrate = useTeachingStore.persist.getOptions().migrate!;
    const migrated = migrate(
      { userFlags: { hasCreatedFirstAnchor: true, hasSeenFirstAnchorArrival: true } },
      1,
    ) as { userFlags: Record<string, boolean> };
    expect(migrated.userFlags.hasSeenFirstPracticeScene).toBe(false);
    expect(migrated.userFlags.hasCreatedFirstAnchor).toBe(true);
    expect(migrated.userFlags.hasSeenFirstAnchorArrival).toBe(true);
  });

  it('keeps a stored true value through migration', () => {
    const migrate = useTeachingStore.persist.getOptions().migrate!;
    const migrated = migrate({ userFlags: { hasSeenFirstPracticeScene: true } }, 2) as {
      userFlags: Record<string, boolean>;
    };
    expect(migrated.userFlags.hasSeenFirstPracticeScene).toBe(true);
  });

  it('setUserFlag writes the flag once', () => {
    useTeachingStore.getState().setUserFlag('hasSeenFirstPracticeScene', true);
    expect(useTeachingStore.getState().userFlags.hasSeenFirstPracticeScene).toBe(true);
    useTeachingStore.getState().reset();
  });
});
