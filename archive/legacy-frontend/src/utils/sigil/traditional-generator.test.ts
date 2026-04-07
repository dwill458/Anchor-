/**
 * Anchor App - Traditional Sigil Generator Tests
 */

import { generateSigil } from './traditional-generator';

describe('generateSigil', () => {
    it('should generate SVGs for valid input', () => {
        const letters = ['A', 'B', 'C'];
        const result = generateSigil(letters);

        expect(result.letters).toEqual(['A', 'B', 'C']);
        expect(result.svgs.dense).toBeDefined();
        expect(result.svgs.balanced).toBeDefined();
        expect(result.svgs.minimal).toBeDefined();
    });

    it('should return valid SVG strings', () => {
        const result = generateSigil(['X']);

        const svg = result.svgs.dense;
        expect(svg).toContain('<svg');
        expect(svg).toContain('viewBox="0 0 200 200"');
        expect(svg).toContain('<path');
        expect(svg).toContain('stroke="currentColor"');
    });

    it('should include all input letters in the SVG', () => {
        // 3 letters -> 3 paths
        const result = generateSigil(['A', 'B', 'C']);
        const svg = result.svgs.dense;

        const pathCount = (svg.match(/<path/g) || []).length;
        expect(pathCount).toBe(3);
    });

    it('should apply different visual properties for variants', () => {
        const result = generateSigil(['A']);

        // Dense should have stroke-width 3
        expect(result.svgs.dense).toContain('stroke-width="3"');

        // Minimal should have stroke-width 1.5
        expect(result.svgs.minimal).toContain('stroke-width="1.5"');
    });

    it('should ignore invalid characters', () => {
        // only A is valid
        const result = generateSigil(['A', '1', '@']);

        expect(result.letters).toEqual(['A']);
        const pathCount = (result.svgs.dense.match(/<path/g) || []).length;
        expect(pathCount).toBe(1);
    });

    it('should throw error if no valid letters provided', () => {
        expect(() => generateSigil([])).toThrow();
        expect(() => generateSigil(['1', '@'])).toThrow();
    });
});
