/**
 * Dev-only stand-in for the signed-in profile, so screenshots show a generic identity.
 * No photo is used: a null photo falls back to the initial-letter avatar.
 */
export const DEV_MOCK_IDENTITY = {
  displayName: 'Alex Morgan',
  profilePictureUrl: null,
} as const;
