import { getAvatarByIndex, getDefaultAvatar } from '../avatarUtils';

describe('avatarUtils', () => {
  describe('getAvatarByIndex', () => {
    it('returns a valid avatar asset reference for a valid index', () => {
      const avatar = getAvatarByIndex(0);
      expect(avatar).toBeDefined();
      expect(typeof avatar === 'number' || typeof avatar === 'object').toBe(true);
    });

    it('wraps around correctly using modulo arithmetic for out-of-bound positive indices', () => {
      const avatar0 = getAvatarByIndex(0);
      const avatar10 = getAvatarByIndex(10); // DEFAULT_AVATARS.length is 10
      expect(avatar10).toBe(avatar0);

      const avatar1 = getAvatarByIndex(1);
      const avatar11 = getAvatarByIndex(11);
      expect(avatar11).toBe(avatar1);
    });

    it('handles negative indices correctly by wrapping backwards', () => {
      const avatar9 = getAvatarByIndex(9);
      const avatarNeg1 = getAvatarByIndex(-1);
      expect(avatarNeg1).toBe(avatar9);

      const avatar0 = getAvatarByIndex(0);
      const avatarNeg10 = getAvatarByIndex(-10);
      expect(avatarNeg10).toBe(avatar0);
    });
  });

  describe('getDefaultAvatar', () => {
    it('returns a valid avatar asset reference based on userId first charCode', () => {
      const avatar1 = getDefaultAvatar('A'); // charCode(65) % 10 = 5
      const avatar2 = getDefaultAvatar('B'); // charCode(66) % 10 = 6
      expect(avatar1).toBe(getAvatarByIndex(5));
      expect(avatar2).toBe(getAvatarByIndex(6));
    });

    it('gracefully handles empty userId string by returning the first avatar', () => {
      const avatar = getDefaultAvatar('');
      expect(avatar).toBe(getAvatarByIndex(0));
    });
  });
});
