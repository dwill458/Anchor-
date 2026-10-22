import { isSqlCipherNativeCohortAllowed, isSqlCipherStorageEnabled } from '../cohort';

describe('SQLCipher native cohort guard', () => {
  it('keeps the production package on legacy storage without the owner-pilot build flag', () => {
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.app', false, false)).toBe(false);
  });

  it('keeps the production package on legacy storage until migration activation is explicit', () => {
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.app', true, false)).toBe(false);
  });

  it('allows the production package only in the explicit owner-pilot activation binary', () => {
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.app', true, true)).toBe(true);
  });

  it('keeps the separately named synthetic lab, preview, and Expo 58 QA cohorts enabled', () => {
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.sqlcipherlab20261013', false, false)).toBe(true);
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.sqlcipherpreview20261015', false, false)).toBe(true);
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.expo58qa20261016', false, false)).toBe(true);
  });

  it('rejects unrelated packages even when the owner-pilot flag is present', () => {
    expect(isSqlCipherNativeCohortAllowed('com.anchorintentions.somewhereelse', true, true)).toBe(false);
    expect(isSqlCipherNativeCohortAllowed(null, true, true)).toBe(false);
  });

  it('does not route production persistence to SQLCipher until pilot and migration flags are both enabled', () => {
    expect(isSqlCipherStorageEnabled(false, true, false)).toBe(false);
    expect(isSqlCipherStorageEnabled(false, false, true)).toBe(false);
    expect(isSqlCipherStorageEnabled(false, true, true)).toBe(true);
    expect(isSqlCipherStorageEnabled(true, false, false)).toBe(true);
  });
});
