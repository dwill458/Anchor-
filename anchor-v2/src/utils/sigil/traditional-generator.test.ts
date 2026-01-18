/**
 * Anchor App - Traditional Sigil Generator Tests (TRUE Sigil / Kamea Method)
 */

import { generateTrueSigil, generateAllVariants } from './traditional-generator';

describe('TRUE Sigil Generator', () => {
    it('should generate a valid result for balanced variant', () => {
        const letters = ['A', 'B', 'C'];
        const result = generateTrueSigil(letters, 'balanced');

        expect(result.variant).toBe('balanced');
        expect(result.svg).toContain('<svg');
        expect(result.svg).toContain('viewBox="0 0 100 100"');
        expect(result.svg).toContain('<path');
        expect(result.svg).toContain('stroke="currentColor"');
        expect(result.svg).toContain('id="ink-bleed"');
    });

    it('should generate all 3 variants correctly', () => {
        const letters = ['T', 'E', 'S', 'T'];
        const results = generateAllVariants(letters);

        expect(results).toHaveLength(3);
        expect(results.some(r => r.variant === 'dense')).toBe(true);
        expect(results.some(r => r.variant === 'balanced')).toBe(true);
        expect(results.some(r => r.variant === 'minimal')).toBe(true);
    });

    it('should apply specific stroke widths for variants', () => {
        const letters = ['H', 'E', 'L', 'L', 'O'];
        const dense = generateTrueSigil(letters, 'dense');
        const balanced = generateTrueSigil(letters, 'balanced');

        expect(dense.svg).toContain('stroke-width="3"');
        expect(balanced.svg).toContain('stroke-width="2"');
    });

    it('should include border for dense/balanced but not minimal', () => {
        const letters = ['X'];
        const dense = generateTrueSigil(letters, 'dense');
        const minimal = generateTrueSigil(letters, 'minimal');

        // Dense has border path + main path (plus maybe others like double ring)
        expect((dense.svg.match(/<path/g) || []).length).toBeGreaterThanOrEqual(2);

        // Minimal has no border, only the main path
        expect((minimal.svg.match(/<path/g) || []).length).toBe(1);
    });

    it('should include markers for balanced but not minimal', () => {
        const letters = ['A', 'Z'];
        const balanced = generateTrueSigil(letters, 'balanced');
        const minimal = generateTrueSigil(letters, 'minimal');

        expect(balanced.svg).toContain('marker-start="url(#dot-start)"');
        expect(balanced.svg).toContain('marker-end="url(#bar-end)"');
        expect(minimal.svg).not.toContain('marker-start');
        expect(minimal.svg).not.toContain('marker-end');
    });

    it('should handle empty or invalid input gracefully (processIntent adds fallback)', () => {
        // processIntent maps unknown/empty to 5 (Center of grid)
        const result = generateTrueSigil([], 'balanced');
        expect(result.svg).toContain('<path'); // Should still have a path (likely a single point M ... L ...)
    });
});
