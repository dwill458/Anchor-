// The postinstall helper is intentionally CommonJS because npm invokes it
// before Metro/TypeScript is available.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { replaceExact } = require('../../scripts/apply-eas-android-patches');

describe('EAS Android exact patching', () => {
  const before = 'original native snippet';
  const after = 'replacement native snippet';

  it('patches an unpatched input', () => {
    expect(replaceExact(before, before, after, 'fixture')).toBe(after);
  });

  it('accepts an already-patched input without changing it', () => {
    expect(replaceExact(after, before, after, 'fixture')).toBe(after);
  });

  it('recognizes a patch-package result with Windows line endings', () => {
    const windowsPatched = 'replacement\r\nnative\r\nsnippet';
    expect(
      replaceExact(windowsPatched, 'original\nnative\nsnippet', 'replacement\nnative\nsnippet', 'fixture')
    ).toBe(windowsPatched);
  });

  it('is safe when invoked twice', () => {
    const once = replaceExact(before, before, after, 'fixture');
    expect(replaceExact(once, before, after, 'fixture')).toBe(after);
  });

  it('fails with an actionable error for an unknown dependency version', () => {
    expect(() => replaceExact('unexpected', before, after, 'fixture')).toThrow(
      'Expected snippet not found for fixture'
    );
  });
});
