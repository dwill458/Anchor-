import { dictationDisclosure, dictationFailure, mergeDictation, mergeDictationWithin } from '../visionDictation';

describe('mergeDictation', () => {
  it('adds speech after typed text instead of replacing it', () => {
    expect(mergeDictation('A bright kitchen', 'with my family')).toBe('A bright kitchen with my family');
    expect(mergeDictation('First line\n', 'second line')).toBe('First line\nsecond line');
  });
  it('uses the transcript alone for an empty field, and keeps the text when nothing was heard', () => {
    expect(mergeDictation('', '  hello   there ')).toBe('hello there');
    expect(mergeDictation('typed text', '   ')).toBe('typed text');
  });
  it('stays within the field limit', () => {
    expect(mergeDictationWithin('abc', 'defghij', 6)).toBe('abc de');
  });
});

describe('dictationFailure', () => {
  it('stays silent for silence and cancellation', () => {
    for (const code of ['no-speech', 'speech-timeout', 'aborted']) expect(dictationFailure(code).message).toBeNull();
  });
  it('points to Settings when access is denied, and always lets the person keep typing', () => {
    const denied = dictationFailure('not-allowed');
    expect(denied.settingsHelp).toBe(true);
    expect(denied.message).toMatch(/keep typing/);
    expect(dictationFailure('service-not-allowed').message).toMatch(/isn’t available on this device/);
    expect(dictationFailure('anything-else').message).toMatch(/text is safe/);
  });
});

describe('dictationDisclosure', () => {
  it('is honest about where audio can go', () => {
    expect(dictationDisclosure(false).body).toMatch(/Apple or Google/);
    expect(dictationDisclosure(true).body).toMatch(/on this device/);
    expect(dictationDisclosure(true).body).not.toMatch(/Apple or Google/);
  });
});
