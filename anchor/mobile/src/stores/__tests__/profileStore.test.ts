import { useProfileStore } from '../profileStore';
import type { User } from '@/types';

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.getState().resetProfile();
  });

  it('initializes with empty profile', () => {
    const state = useProfileStore.getState();
    expect(state.ownerUserId).toBeNull();
    expect(state.name).toBe('');
    expect(state.photo).toBeNull();
  });

  it('syncs profile from user including profilePictureUrl', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'deontrez@example.com',
      displayName: 'Deontrez Williams',
      profilePictureUrl: 'https://r2.anchor.app/profiles/user-123/picture.jpg',
      hasCompletedOnboarding: true,
      isComped: false,
      subscriptionStatus: 'active',
      totalAnchorsCreated: 5,
      totalActivations: 10,
      currentStreak: 2,
      longestStreak: 4,
      createdAt: new Date('2026-05-01'),
    };

    useProfileStore.getState().syncFromUser(mockUser);

    const state = useProfileStore.getState();
    expect(state.ownerUserId).toBe('user-123');
    expect(state.name).toBe('Deontrez Williams');
    expect(state.photo).toBe('https://r2.anchor.app/profiles/user-123/picture.jpg');
  });

  it('preserves local photo if user profilePictureUrl is missing and owner matches', () => {
    useProfileStore.getState().updateProfile({
      ownerUserId: 'user-123',
      name: 'Deontrez',
      photo: 'file:///data/user/0/app/profile-media/user-123-12345.jpg',
    });

    const mockUser: User = {
      id: 'user-123',
      email: 'deontrez@example.com',
      displayName: 'Deontrez',
      hasCompletedOnboarding: true,
      isComped: false,
      subscriptionStatus: 'active',
      totalAnchorsCreated: 5,
      totalActivations: 10,
      currentStreak: 2,
      longestStreak: 4,
      createdAt: new Date('2026-05-01'),
    };

    useProfileStore.getState().syncFromUser(mockUser);

    const state = useProfileStore.getState();
    expect(state.photo).toBe('file:///data/user/0/app/profile-media/user-123-12345.jpg');
  });

  it('syncs new photo when user profilePictureUrl is updated', () => {
    const mockUser1: User = {
      id: 'user-123',
      email: 'deontrez@example.com',
      displayName: 'Deontrez',
      hasCompletedOnboarding: true,
      isComped: false,
      subscriptionStatus: 'active',
      totalAnchorsCreated: 5,
      totalActivations: 10,
      currentStreak: 2,
      longestStreak: 4,
      createdAt: new Date('2026-05-01'),
    };

    useProfileStore.getState().syncFromUser(mockUser1);
    expect(useProfileStore.getState().photo).toBeNull();

    const mockUser2: User = {
      ...mockUser1,
      profilePictureUrl: 'https://r2.anchor.app/profiles/user-123/picture.jpg',
    };

    useProfileStore.getState().syncFromUser(mockUser2);
    expect(useProfileStore.getState().photo).toBe('https://r2.anchor.app/profiles/user-123/picture.jpg');
  });
});
