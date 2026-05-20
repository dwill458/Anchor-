import {
  detectFutureTense,
  detectNegation,
  detectGibberish,
  analyzeIntention,
  getGuidanceText,
} from '../intentionPatterns';

describe('intentionPatterns', () => {
  describe('detectFutureTense', () => {
    it('detects future tense phrases', () => {
      expect(detectFutureTense('I will focus on my breath')).toBe(true);
      expect(detectFutureTense("I'm going to start daily meditation")).toBe(true);
      expect(detectFutureTense('going to read more books')).toBe(true);
      expect(detectFutureTense('Someday I will travel')).toBe(true);
    });

    it('returns false for present/past tense intentions', () => {
      expect(detectFutureTense('I focus on my breath')).toBe(false);
      expect(detectFutureTense('I am meditating daily')).toBe(false);
    });
  });

  describe('detectNegation', () => {
    it('detects negation phrases', () => {
      expect(detectNegation("I don't check my phone")).toBe(true);
      expect(detectNegation('stop eating sugar')).toBe(true);
      expect(detectNegation("I won't procrastinate")).toBe(true);
      expect(detectNegation('I am not distracted')).toBe(true);
    });

    it('returns false when no negation is used', () => {
      expect(detectNegation('I focus on positive tasks')).toBe(false);
      expect(detectNegation('I start reading')).toBe(false);
    });
  });

  describe('detectGibberish', () => {
    it('returns false if text is too short (< 6 chars)', () => {
      expect(detectGibberish('abc')).toBe(false);
      expect(detectGibberish('a e i')).toBe(false);
    });

    it('returns false if there are no letters', () => {
      expect(detectGibberish('123456')).toBe(false);
      expect(detectGibberish('!@#$%^')).toBe(false);
    });

    it('returns false for normal english text', () => {
      expect(detectGibberish('I want to build a startup')).toBe(false);
      expect(detectGibberish('Centered state')).toBe(false);
    });

    it('returns true for strings matching vowel and unique letter thresholds (gibberish)', () => {
      // zzzzzz has 0 vowels (ratio 0 < 0.15), unique letters = 1 (ratio 1/6 = 0.16 < 0.5)
      expect(detectGibberish('zzzzzz')).toBe(true);
      // qwrqwrqwr has 0 vowels, unique letters = 3 (ratio 3/9 = 0.33 < 0.5)
      expect(detectGibberish('qwrqwrqwr')).toBe(true);
    });
  });

  describe('analyzeIntention', () => {
    it('returns correct guidance flags', () => {
      // Both
      const res1 = analyzeIntention("I will stop procrastination");
      expect(res1.hasFutureTense).toBe(true);
      expect(res1.hasNegation).toBe(true);
      expect(res1.shouldShowGuidance).toBe(true);

      // Future tense only
      const res2 = analyzeIntention("I will focus today");
      expect(res2.hasFutureTense).toBe(true);
      expect(res2.hasNegation).toBe(false);
      expect(res2.shouldShowGuidance).toBe(true);

      // Negation only
      const res3 = analyzeIntention("I don't check social media");
      expect(res3.hasFutureTense).toBe(false);
      expect(res3.hasNegation).toBe(true);
      expect(res3.shouldShowGuidance).toBe(true);

      // Neither
      const res4 = analyzeIntention("I breathe deeply");
      expect(res4.hasFutureTense).toBe(false);
      expect(res4.hasNegation).toBe(false);
      expect(res4.shouldShowGuidance).toBe(false);
    });
  });

  describe('getGuidanceText', () => {
    it('returns gibberish guidance if text is gibberish', () => {
      analyzeIntention('zzzzzz');
      const text = getGuidanceText(false, false);
      expect(text).toBe("That doesn't look like an intention. What do you actually want?");
    });

    it('returns both future and negation guidance', () => {
      analyzeIntention('I will stop');
      const text = getGuidanceText(true, true);
      expect(text).toBe('Try present tense & affirmative: "I choose…" or "I return…"');
    });

    it('returns future tense guidance', () => {
      analyzeIntention('I will start');
      const text = getGuidanceText(true, false);
      expect(text).toBe('Try present tense: "I choose…" "I am…" or "I return…"');
    });

    it('returns negation guidance', () => {
      analyzeIntention('stop this');
      const text = getGuidanceText(false, true);
      expect(text).toBe('Try affirmative: "I choose…" instead of "I don\'t…"');
    });

    it('returns empty string if no guidance needed', () => {
      analyzeIntention('I am centered');
      const text = getGuidanceText(false, false);
      expect(text).toBe('');
    });
  });
});
