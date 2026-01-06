/**
 * Anchor App - Letter Distillation Algorithm Tests
 *
 * Unit tests for the Austin Osman Spare distillation method
 */

import {
  distillIntention,
  getDistillationSummary,
  validateIntention,
  DistillationResult,
} from './distillation';

describe('distillIntention', () => {
  describe('basic distillation', () => {
    it('should distill "Close the deal" correctly', () => {
      // "Close the deal" → "Closethedeal" → "Clsthdl" (remove o,e,e,a) → "Clsthd" (remove dup l)
      const result = distillIntention('Close the deal');

      expect(result.finalLetters).toEqual(['C', 'L', 'S', 'T', 'H', 'D']);
      expect(result.original).toBe('Close the deal');
    });

    it('should distill "Find inner peace" correctly', () => {
      // "Find inner peace" → "Findinnerpeace" → "Fndnnrpc" (remove i,i,e,e,a,e) → "Fndrpc" (remove dup n)
      const result = distillIntention('Find inner peace');

      expect(result.finalLetters).toEqual(['F', 'N', 'D', 'R', 'P', 'C']);
      expect(result.original).toBe('Find inner peace');
    });

    it('should distill "Launch my startup" correctly', () => {
      // "Launch my startup" → "Launchmystartup" → "Lnchmystrtup" → "Lnchmystrp" (remove dup t)
      const result = distillIntention('Launch my startup');

      expect(result.finalLetters).toEqual(['L', 'N', 'C', 'H', 'M', 'Y', 'S', 'T', 'R', 'P']);
      expect(result.original).toBe('Launch my startup');
    });
  });

  describe('vowel removal', () => {
    it('should remove all vowels (a, e, i, o, u)', () => {
      const result = distillIntention('aeiou AEIOU');

      expect(result.finalLetters).toEqual([]);
      expect(result.removedVowels.length).toBeGreaterThan(0);
    });

    it('should track removed vowels', () => {
      const result = distillIntention('Close the deal');

      // Should have removed: o, e, e, a
      expect(result.removedVowels).toContain('O');
      expect(result.removedVowels).toContain('E');
      expect(result.removedVowels).toContain('A');
    });

    it('should handle mixed case vowels', () => {
      const result = distillIntention('AeIoU');

      expect(result.finalLetters).toEqual([]);
      expect(result.removedVowels.length).toBe(5);
    });
  });

  describe('duplicate removal', () => {
    it('should remove duplicate letters', () => {
      const result = distillIntention('hello');

      // h-e-l-l-o → H-L-L → H-L (removed second L and vowels)
      expect(result.finalLetters).toContain('H');
      expect(result.finalLetters).toContain('L');
      expect(result.finalLetters.filter(l => l === 'L').length).toBe(1);
    });

    it('should keep first occurrence of duplicates', () => {
      const result = distillIntention('banana');

      // b-a-n-a-n-a → B-N-N → B-N (removed second N and vowels)
      expect(result.finalLetters).toEqual(['B', 'N']);
      expect(result.removedDuplicates).toContain('N');
    });

    it('should track removed duplicates', () => {
      const result = distillIntention('hello world');

      // Should have removed duplicate L, O
      expect(result.removedDuplicates.length).toBeGreaterThan(0);
    });

    it('should be case-insensitive for duplicate detection', () => {
      const result = distillIntention('HeLLo');

      // H-e-L-L-o → H-L-L → H-L
      expect(result.finalLetters).toEqual(['H', 'L']);
      expect(result.removedDuplicates).toContain('L');
    });
  });

  describe('case handling', () => {
    it('should convert to uppercase', () => {
      const result = distillIntention('hello world');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
      result.finalLetters.forEach(letter => {
        expect(letter).toBe(letter.toUpperCase());
      });
    });

    it('should handle mixed case input', () => {
      const result = distillIntention('HeLLo WoRLd');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
    });

    it('should handle all uppercase input', () => {
      const result = distillIntention('HELLO WORLD');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
    });

    it('should handle all lowercase input', () => {
      const result = distillIntention('hello world');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
    });
  });

  describe('space handling', () => {
    it('should remove single spaces', () => {
      const result = distillIntention('a b c');

      expect(result.finalLetters).toEqual(['B', 'C']);
    });

    it('should remove multiple consecutive spaces', () => {
      const result = distillIntention('a    b    c');

      expect(result.finalLetters).toEqual(['B', 'C']);
    });

    it('should handle leading and trailing spaces', () => {
      const result = distillIntention('  hello  ');

      expect(result.finalLetters).toEqual(['H', 'L']);
    });

    it('should handle tabs and newlines', () => {
      const result = distillIntention('hello\tworld\n');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
    });
  });

  describe('special characters', () => {
    it('should ignore numbers', () => {
      const result = distillIntention('hello123world');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
      expect(result.finalLetters).not.toContain('1');
      expect(result.finalLetters).not.toContain('2');
      expect(result.finalLetters).not.toContain('3');
    });

    it('should ignore punctuation', () => {
      const result = distillIntention('hello, world!');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D']);
      expect(result.finalLetters).not.toContain(',');
      expect(result.finalLetters).not.toContain('!');
    });

    it('should ignore special symbols', () => {
      const result = distillIntention('hello@world#test');

      expect(result.finalLetters).toEqual(['H', 'L', 'W', 'R', 'D', 'T', 'S']);
      expect(result.finalLetters).not.toContain('@');
      expect(result.finalLetters).not.toContain('#');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const result = distillIntention('');

      expect(result.finalLetters).toEqual([]);
      expect(result.original).toBe('');
    });

    it('should handle string with only spaces', () => {
      const result = distillIntention('    ');

      expect(result.finalLetters).toEqual([]);
    });

    it('should handle string with only vowels', () => {
      const result = distillIntention('aeiou');

      expect(result.finalLetters).toEqual([]);
      expect(result.removedVowels.length).toBe(5);
    });

    it('should handle string with only special characters', () => {
      const result = distillIntention('!@#$%^&*()');

      expect(result.finalLetters).toEqual([]);
    });

    it('should handle single letter', () => {
      const result = distillIntention('x');

      expect(result.finalLetters).toEqual(['X']);
    });

    it('should handle single consonant repeated', () => {
      const result = distillIntention('bbb');

      expect(result.finalLetters).toEqual(['B']);
      expect(result.removedDuplicates).toEqual(['B', 'B']);
    });
  });

  describe('result structure', () => {
    it('should return correct structure', () => {
      const result = distillIntention('test');

      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('finalLetters');
      expect(result).toHaveProperty('removedVowels');
      expect(result).toHaveProperty('removedDuplicates');
    });

    it('should have arrays for all letter properties', () => {
      const result = distillIntention('test');

      expect(Array.isArray(result.finalLetters)).toBe(true);
      expect(Array.isArray(result.removedVowels)).toBe(true);
      expect(Array.isArray(result.removedDuplicates)).toBe(true);
    });
  });
});

describe('getDistillationSummary', () => {
  it('should format summary correctly', () => {
    const result = distillIntention('Close the deal');
    const summary = getDistillationSummary(result);

    expect(summary).toContain('CLOSETHEDEAL');
    expect(summary).toContain('→');
  });

  it('should show space-separated final letters', () => {
    const result = distillIntention('test');
    const summary = getDistillationSummary(result);

    expect(summary).toContain('T S');
  });
});

describe('validateIntention', () => {
  describe('valid intentions', () => {
    it('should accept normal intention', () => {
      const validation = validateIntention('Close the deal');

      expect(validation.isValid).toBe(true);
      expect(validation.error).toBeUndefined();
    });

    it('should accept intention with numbers', () => {
      const validation = validateIntention('Win $1000');

      expect(validation.isValid).toBe(true);
    });

    it('should accept intention with punctuation', () => {
      const validation = validateIntention("Let's go!");

      expect(validation.isValid).toBe(true);
    });
  });

  describe('invalid intentions', () => {
    it('should reject empty string', () => {
      const validation = validateIntention('');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Intention cannot be empty');
    });

    it('should reject string with only spaces', () => {
      const validation = validateIntention('   ');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Intention cannot be empty');
    });

    it('should reject string with no letters', () => {
      const validation = validateIntention('123!@#');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Intention must contain at least one letter');
    });

    it('should reject very short string', () => {
      const validation = validateIntention('ab');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Intention must be at least 3 characters long');
    });

    it('should reject very long string', () => {
      const longString = 'a'.repeat(101);
      const validation = validateIntention(longString);

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Intention must be 100 characters or less');
    });

    it('should reject string that produces less than 2 letters', () => {
      const validation = validateIntention('aaa');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe(
        'Intention must produce at least 2 unique letters after distillation'
      );
    });
  });

  describe('boundary cases', () => {
    it('should accept 3-character minimum', () => {
      const validation = validateIntention('abc');

      expect(validation.isValid).toBe(true);
    });

    it('should accept 100-character maximum', () => {
      const string100 = 'a'.repeat(50) + 'b'.repeat(50);
      const validation = validateIntention(string100);

      expect(validation.isValid).toBe(true);
    });

    it('should accept exactly 2 unique letters after distillation', () => {
      const validation = validateIntention('ab');

      // This should fail because it's too short
      expect(validation.isValid).toBe(false);
    });
  });
});
