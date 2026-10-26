import { ASK_REVEAL, askReveal, askRevealEnergy, charDelay } from '../askReveal';

const punctuationCases: [string, string | undefined, number][] = [
  ['a', 'b', 24], [',', ' ', 109], [';', ' ', 144], [':', ' ', 144], ['—', ' ', 144], ['–', ' ', 144],
  ['.', ' ', 254], ['!', undefined, 254], ['?', '\n', 254], ['…', undefined, 254],
  ['.', '5', 24], ['.', 'g', 24], [' ', 'b', 0], ['\t', 'b', 0], ['\n', '\n', 300],
];

describe('Ask character reveal timing', () => {
  beforeEach(() => askReveal.reset());

  it('uses the approved 24 ms cadence, 9 ms floor and 9 second cap', () => {
    expect(ASK_REVEAL).toEqual({ msPerChar: 24, minMsPerChar: 9, capMs: 9000 });
  });

  it.each(punctuationCases)('waits correctly after %j before %j', (char, next, delay) => {
    expect(charDelay(char, next)).toBe(delay);
  });

  it('stores character progress across pause and finish without resetting the key', () => {
    askReveal.begin('reply');
    askReveal.setCount('reply', 7);
    askReveal.pause('reply');
    expect(askReveal.count('reply')).toBe(7);
    expect(askReveal.isDone('reply')).toBe(false);
    askReveal.begin('reply');
    askReveal.finish('reply');
    expect(askReveal.count('reply')).toBe(7);
    expect(askReveal.isActive('reply')).toBe(false);
    expect(askReveal.isDone('reply')).toBe(true);
  });

  it('exposes the shared word pulse and resets it with reveal state', () => {
    expect(askRevealEnergy.value).toBe(0);
    expect(typeof askReveal.bump).toBe('function');
    askReveal.bump();
    askReveal.reset();
    expect(askRevealEnergy.value).toBe(0);
  });
});
