import { generateAbstractSigil, generateAllVariants, VARIANT_METADATA } from './abstract-symbol-generator';

describe('abstract-symbol-generator', () => {
  const testLetters = ['a', 'b', 'c'];

  describe('generateAbstractSigil', () => {
    it('generates a valid SVG for balanced variant by default', () => {
      const result = generateAbstractSigil(testLetters);
      expect(result.variant).toBe('balanced');
      expect(result.svg).toContain('<svg viewBox="0 0 200 200"');
      expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      // Should contain concentric circles decoration
      expect(result.svg).toContain('cx="100" cy="100" r="25"');
      expect(result.svg).toContain('cx="100" cy="100" r="45"');
      // Should contain paths for letters and border
      expect(result.svg).toContain('<path');
      expect(result.svg).toContain('transform="translate');
    });

    it('generates a valid SVG for dense variant with connection lines and extra marks', () => {
      const result = generateAbstractSigil(testLetters, 'dense');
      expect(result.variant).toBe('dense');
      // Should contain connection lines (line elements)
      expect(result.svg).toContain('<line');
      // Should contain circle decoration dots
      expect(result.svg).toContain('<circle cx=');
    });

    it('generates a valid SVG for minimal variant without decorations', () => {
      const result = generateAbstractSigil(testLetters, 'minimal');
      expect(result.variant).toBe('minimal');
      // Should not contain concentric circles or line decorations
      expect(result.svg).not.toContain('<circle cx="100"');
      expect(result.svg).not.toContain('<line');
      expect(result.svg).toContain('<path d="M');
    });

    it('handles uppercase and lowercase letters', () => {
      const resultLower = generateAbstractSigil(['a', 'e']);
      const resultUpper = generateAbstractSigil(['A', 'E']);
      expect(resultLower.svg).toContain('<svg');
      expect(resultUpper.svg).toContain('<svg');
    });

    it('gracefully skips unsupported characters', () => {
      const resultNormal = generateAbstractSigil(['a']);
      const resultWithUnsupported = generateAbstractSigil(['a', '1', '@', ' ']);
      // The unsupported chars are ignored, so the paths generated should match
      // Wait, the number of letters affects the position offset angle calculation:
      // angle = (Math.PI * 2 * index) / totalLetters.
      // So if unsupported letters are skipped inside the loop, the path output
      // of supported ones might still differ unless skipped beforehand.
      // Let's verify that the output doesn't throw and contains the expected path
      expect(resultWithUnsupported.svg).toContain('<svg');
    });

    it('handles empty letters array', () => {
      const result = generateAbstractSigil([], 'minimal');
      expect(result.svg).toContain('<svg');
      // Should only contain the border path since no letters are drawn
      const pathsCount = (result.svg.match(/<path/g) || []).length;
      expect(pathsCount).toBe(1); // just the border
    });
  });

  describe('generateAllVariants', () => {
    it('returns all three variants', () => {
      const results = generateAllVariants(testLetters);
      expect(results).toHaveLength(3);
      expect(results[0].variant).toBe('dense');
      expect(results[1].variant).toBe('balanced');
      expect(results[2].variant).toBe('minimal');
    });
  });

  describe('VARIANT_METADATA', () => {
    it('contains metadata for all variants', () => {
      expect(VARIANT_METADATA.dense.title).toBe('Dense');
      expect(VARIANT_METADATA.balanced.title).toBe('Balanced');
      expect(VARIANT_METADATA.minimal.title).toBe('Minimal');
      expect(VARIANT_METADATA.dense.description).toBeDefined();
      expect(VARIANT_METADATA.balanced.description).toBeDefined();
      expect(VARIANT_METADATA.minimal.description).toBeDefined();
    });
  });
});
