/**
 * Anchor App - Traditional Sigil Generator
 *
 * Generates visual sigils by combining distilled letter vectors.
 * Creates 3 variations with distinct artistic styles.
 *
 * @see Handoff Document Section 5.2
 */

import { DENSE_VECTORS, BALANCED_VECTORS, MINIMAL_VECTORS } from './letterVectors';

/**
 * Available sigil styles
 */
export type SigilVariant = 'dense' | 'balanced' | 'minimal';

/**
 * Result of the sigil generation process
 */
export interface SigilResult {
    /** Map of variant names to their SVG strings */
    svgs: {
        [key in SigilVariant]: string;
    };
    /** The letters used to generate the sigil */
    letters: string[];
}

/**
 * Configuration options for sigil generation
 */
interface GenerationConfig {
    strokeWidth: number;
    opacity: number;
    scale: number;
}

/**
 * Default configurations for each variant
 */
const VARIANT_CONFIGS: Record<SigilVariant, GenerationConfig> = {
    dense: {
        strokeWidth: 3,
        opacity: 0.8,
        scale: 1,
    },
    balanced: {
        strokeWidth: 2,
        opacity: 0.9,
        scale: 0.9,
    },
    minimal: {
        strokeWidth: 1.5,
        opacity: 1,
        scale: 0.8,
    },
};

/**
 * Get the appropriate letter vector set for a variant
 */
function getVectorSet(variant: SigilVariant): Record<string, string> {
    switch (variant) {
        case 'dense':
            return DENSE_VECTORS;
        case 'balanced':
            return BALANCED_VECTORS;
        case 'minimal':
            return MINIMAL_VECTORS;
    }
}

/**
 * Generates a traditional sigil from a set of letters.
 *
 * @param letters - Array of uppercase letters (e.g., from distillation)
 * @returns Object containing 3 SVG variations
 *
 * @example
 * const sigil = generateSigil(['A', 'B', 'C']);
 * // sigil.svgs.dense -> "<svg...>"
 */
export function generateSigil(letters: string[]): SigilResult {
    // Ensure valid input (check against all vector sets)
    const validLetters = letters
        .map((l) => l.toUpperCase())
        .filter((l) => BALANCED_VECTORS[l]); // Use any set for validation

    if (validLetters.length === 0) {
        throw new Error('No valid letters provided for sigil generation');
    }

    return {
        svgs: {
            dense: createSigilSvg(validLetters, 'dense'),
            balanced: createSigilSvg(validLetters, 'balanced'),
            minimal: createSigilSvg(validLetters, 'minimal'),
        },
        letters: validLetters,
    };
}

/**
 * Creates a single SVG string for a specific style with abstract merged glyphs
 * Following Austin Osman Spare's "technology of forgetting" - letters are overlaid,
 * rotated, and merged so they become unrecognizable abstract symbols.
 */
function createSigilSvg(letters: string[], variant: SigilVariant): string {
    const config = VARIANT_CONFIGS[variant];
    const vectorSet = getVectorSet(variant);
    const size = 200;
    const center = size / 2;

    // Create abstract compositions by overlaying and transforming letters
    const letterPaths: string[] = [];

    letters.forEach((letter, index) => {
        const pathData = vectorSet[letter];
        if (!pathData) return;

        // Apply pseudo-random but deterministic transformations
        // Use index and letter charCode for consistent randomness
        const seed = index + letter.charCodeAt(0);

        // Rotation: Each letter gets a unique rotation
        const rotation = ((seed * 37) % 360);

        // Scaling: Vary sizes to create visual hierarchy
        const scale = variant === 'dense' ?
            0.6 + ((seed % 5) * 0.1) :  // Dense: 0.6-1.0
            variant === 'balanced' ?
                0.5 + ((seed % 4) * 0.1) :  // Balanced: 0.5-0.8
                0.4 + ((seed % 3) * 0.1);   // Minimal: 0.4-0.6

        // Flipping: Some letters get mirrored
        const flipX = (seed % 3) === 0 ? -1 : 1;
        const flipY = (seed % 5) === 0 ? -1 : 1;

        // Offset from center: Create organic asymmetry
        const offsetX = variant === 'minimal' ?
            ((seed % 7) - 3) * 8 :  // Minimal: slight offset
            variant === 'balanced' ?
                ((seed % 11) - 5) * 5 :  // Balanced: moderate offset
                ((seed % 13) - 6) * 3;   // Dense: tight clustering

        const offsetY = variant === 'minimal' ?
            (((seed * 3) % 7) - 3) * 8 :
            variant === 'balanced' ?
                (((seed * 3) % 11) - 5) * 5 :
                (((seed * 3) % 13) - 6) * 3;

        // Build transform: translate to center with offset, rotate, scale, flip
        const transform = [
            `translate(${center + offsetX}, ${center + offsetY})`,
            `rotate(${rotation}, 0, 0)`,
            `scale(${scale * flipX * config.scale}, ${scale * flipY * config.scale})`,
            `translate(-50, -50)`
        ].join(' ');

        letterPaths.push(
            `<path d="${pathData}" stroke="currentColor" stroke-width="${config.strokeWidth}" fill="none" opacity="${config.opacity}" transform="${transform}" stroke-linecap="round" stroke-linejoin="round" />`
        );
    });

    // Add decorative elements based on variant
    let decorativeElements = '';

    if (variant === 'dense') {
        // Dense: Add connecting geometric shapes
        const numShapes = Math.min(letters.length, 4);
        for (let i = 0; i < numShapes; i++) {
            const angle = (Math.PI * 2 * i) / numShapes;
            const x1 = center + Math.cos(angle) * 30;
            const y1 = center + Math.sin(angle) * 30;
            const x2 = center + Math.cos(angle + Math.PI) * 30;
            const y2 = center + Math.sin(angle + Math.PI) * 30;
            decorativeElements += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="${config.strokeWidth * 0.5}" opacity="${config.opacity * 0.3}" />`;
        }
    } else if (variant === 'balanced') {
        // Balanced: Add circular elements
        decorativeElements = [
            `<circle cx="${center}" cy="${center}" r="20" stroke="currentColor" stroke-width="${config.strokeWidth * 0.5}" fill="none" opacity="${config.opacity * 0.3}" />`,
            `<circle cx="${center}" cy="${center}" r="40" stroke="currentColor" stroke-width="${config.strokeWidth * 0.3}" fill="none" opacity="${config.opacity * 0.2}" />`
        ].join('');
    }
    // Minimal: No decorative elements

    // Add outer containment circle (the "Anchor")
    const borderRadius = 90;
    const border = `<circle cx="${center}" cy="${center}" r="${borderRadius}" stroke="currentColor" stroke-width="${config.strokeWidth * 1.2}" fill="none" opacity="0.8" />`;

    // Combine all elements - decorative first (background), then letters, then border
    const allPaths = [
        decorativeElements,
        ...letterPaths,
        border,
    ].filter(Boolean).join('');

    // Wrap in SVG tag
    return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${allPaths}</svg>`;
}
