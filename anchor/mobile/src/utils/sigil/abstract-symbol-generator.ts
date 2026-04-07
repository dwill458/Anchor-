/**
 * TRUE Sigil Generator - Austin Osman Spare Method
 * 
 * This generator takes actual letter vector paths and merges them
 * through overlapping, rotating, and flipping to create abstract glyphs
 * where individual letters are completely unrecognizable.
 * 
 * Based on chaos magick methodology and real sigil examples.
 */

export type SigilVariant = 'dense' | 'balanced' | 'minimal';

export interface SigilGenerationResult {
    svg: string;
    variant: SigilVariant;
}

// Organic letter vector paths (hand-drawn style)
const LETTER_VECTORS: Record<string, string> = {
    A: 'M30 85 L50 15 L70 85 M40 60 L60 60',
    B: 'M25 15 L25 85 M25 15 Q60 15 60 35 Q60 50 25 50 Q60 50 60 70 Q60 85 25 85',
    C: 'M70 25 Q30 15 30 50 Q30 85 70 75',
    D: 'M25 15 L25 85 M25 15 Q75 20 75 50 Q75 80 25 85',
    E: 'M70 15 L25 15 L25 50 L60 50 M25 85 L70 85',
    F: 'M70 15 L25 15 L25 50 L60 50 M25 85 L25 50',
    G: 'M70 25 Q30 15 30 50 Q30 85 70 75 L70 55 L55 55',
    H: 'M25 15 L25 85 M75 15 L75 85 M25 50 L75 50',
    I: 'M50 15 L50 85 M35 15 L65 15 M35 85 L65 85',
    J: 'M65 15 L65 70 Q65 85 45 85 Q30 85 30 75',
    K: 'M25 15 L25 85 M75 15 L25 50 L75 85',
    L: 'M30 15 L30 85 L75 85',
    M: 'M25 85 L25 15 L50 50 L75 15 L75 85',
    N: 'M25 85 L25 15 L75 85 L75 15',
    O: 'M50 15 Q70 15 70 50 Q70 85 50 85 Q30 85 30 50 Q30 15 50 15',
    P: 'M25 15 L25 85 M25 15 Q70 20 70 40 Q70 60 25 55',
    Q: 'M50 15 Q70 15 70 50 Q70 85 50 85 Q30 85 30 50 Q30 15 50 15 M60 70 L75 90',
    R: 'M25 15 L25 85 M25 15 Q65 15 65 40 Q65 55 25 55 M50 55 L75 85',
    S: 'M70 25 Q35 15 35 35 Q35 50 65 50 Q65 75 35 75 Q30 75 30 70',
    T: 'M25 15 L75 15 M50 15 L50 85',
    U: 'M30 15 L30 70 Q30 85 50 85 Q70 85 70 70 L70 15',
    V: 'M30 15 L50 85 L70 15',
    W: 'M25 15 L35 85 L50 40 L65 85 L75 15',
    X: 'M25 15 L75 85 M75 15 L25 85',
    Y: 'M30 15 L50 50 L70 15 M50 50 L50 85',
    Z: 'M25 15 L75 15 L25 85 L75 85',
};

interface TransformConfig {
    rotation: number;
    scale: number;
    flipX: boolean;
    flipY: boolean;
    offsetX: number;
    offsetY: number;
    opacity: number;
}

/**
 * Seeded random for deterministic generation
 */
function seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

/**
 * Get transform configuration for a letter based on variant and position
 */
function getTransform(
    letter: string,
    index: number,
    totalLetters: number,
    variant: SigilVariant
): TransformConfig {
    const seed = index * 13 + letter.charCodeAt(0) * 7;

    // Variant-specific base configs
    const variantConfigs = {
        dense: {
            scaleRange: [0.7, 1.1],
            offsetRange: 25,
            opacityRange: [0.75, 0.95],
        },
        balanced: {
            scaleRange: [0.6, 0.95],
            offsetRange: 35,
            opacityRange: [0.7, 0.9],
        },
        minimal: {
            scaleRange: [0.5, 0.8],
            offsetRange: 45,
            opacityRange: [0.65, 0.85],
        },
    };

    const config = variantConfigs[variant];

    // Pseudo-random but deterministic transformations
    const rotation = (seededRandom(seed) * 360) % 360;
    const scaleMin = config.scaleRange[0];
    const scaleMax = config.scaleRange[1];
    const scale = scaleMin + seededRandom(seed + 1) * (scaleMax - scaleMin);
    const flipX = seededRandom(seed + 2) > 0.5;
    const flipY = seededRandom(seed + 3) > 0.5;

    // Create organic clustering around center
    const angle = (Math.PI * 2 * index) / totalLetters;
    const distance = config.offsetRange * seededRandom(seed + 4);
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;

    const opacity = config.opacityRange[0] +
        seededRandom(seed + 5) * (config.opacityRange[1] - config.opacityRange[0]);

    return {
        rotation,
        scale,
        flipX,
        flipY,
        offsetX,
        offsetY,
        opacity,
    };
}

/**
 * Create SVG transform string from config
 */
function createTransformString(
    transform: TransformConfig,
    centerX: number,
    centerY: number
): string {
    const parts: string[] = [];

    // Translate to position
    parts.push(`translate(${centerX + transform.offsetX}, ${centerY + transform.offsetY})`);

    // Rotate
    parts.push(`rotate(${transform.rotation}, 50, 50)`);

    // Scale (with flips)
    const scaleX = transform.flipX ? -transform.scale : transform.scale;
    const scaleY = transform.flipY ? -transform.scale : transform.scale;
    parts.push(`scale(${scaleX}, ${scaleY})`);

    // Translate to center point for rotation/scale
    parts.push('translate(-50, -50)');

    return parts.join(' ');
}

/**
 * Create decorative elements based on variant
 */
function createDecorations(
    letters: string[],
    variant: SigilVariant,
    size: number
): string {
    const center = { x: size / 2, y: size / 2 };
    const decorations: string[] = [];

    if (variant === 'dense') {
        // Add connection lines between overlapped letters
        const numConnections = Math.min(letters.length, 5);
        for (let i = 0; i < numConnections; i++) {
            const angle1 = (Math.PI * 2 * i) / numConnections;
            const angle2 = (Math.PI * 2 * ((i + 2) % numConnections)) / numConnections;
            const radius = 40;

            const x1 = center.x + Math.cos(angle1) * radius;
            const y1 = center.y + Math.sin(angle1) * radius;
            const x2 = center.x + Math.cos(angle2) * radius;
            const y2 = center.y + Math.sin(angle2) * radius;

            decorations.push(
                `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5" opacity="0.3" />`
            );
        }

        // Add small decorative marks
        const cardinalPoints = [
            { x: center.x, y: center.y - 75 }, // Top
            { x: center.x + 75, y: center.y }, // Right
            { x: center.x, y: center.y + 75 }, // Bottom
            { x: center.x - 75, y: center.y }, // Left
        ];

        cardinalPoints.forEach((point, idx) => {
            if (idx % 2 === 0) {
                // Plus sign
                decorations.push(
                    `<line x1="${point.x - 5}" y1="${point.y}" x2="${point.x + 5}" y2="${point.y}" stroke="currentColor" stroke-width="2" opacity="0.4" />`,
                    `<line x1="${point.x}" y1="${point.y - 5}" x2="${point.x}" y2="${point.y + 5}" stroke="currentColor" stroke-width="2" opacity="0.4" />`
                );
            } else {
                // Dot
                decorations.push(
                    `<circle cx="${point.x}" cy="${point.y}" r="3" fill="currentColor" opacity="0.4" />`
                );
            }
        });
    } else if (variant === 'balanced') {
        // Add concentric circles
        decorations.push(
            `<circle cx="${center.x}" cy="${center.y}" r="25" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.25" />`,
            `<circle cx="${center.x}" cy="${center.y}" r="45" stroke="currentColor" stroke-width="1" fill="none" opacity="0.15" />`
        );
    }
    // Minimal has no decorations

    return decorations.join('');
}

/**
 * Create irregular hand-drawn border
 */
function createBorder(
    centerX: number,
    centerY: number,
    baseRadius: number,
    variant: SigilVariant
): string {
    const numPoints = 36;
    const variation = variant === 'dense' ? 6 : variant === 'balanced' ? 5 : 4;
    const strokeWidth = variant === 'dense' ? 3 : variant === 'balanced' ? 2.5 : 2;

    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
        const angle = (Math.PI * 2 * i) / numPoints;
        const seed = i * 17 + 42;
        const radiusVar = (seededRandom(seed) - 0.5) * variation * 2;
        const radius = baseRadius + radiusVar;

        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        points.push({ x, y });
    }

    // Create smooth curve through points
    let pathData = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        const controlX = (current.x + next.x) / 2;
        const controlY = (current.y + next.y) / 2;
        pathData += ` Q ${current.x} ${current.y} ${controlX} ${controlY}`;
    }

    pathData += ' Z';

    return `<path d="${pathData}" stroke="currentColor" stroke-width="${strokeWidth}" fill="none" opacity="0.85" stroke-linecap="round" />`;
}

/**
 * Generate TRUE sigil from letters (Renamed to match Interface)
 */
export function generateAbstractSigil(
    letters: string[],
    variant: SigilVariant = 'balanced'
): SigilGenerationResult {
    const size = 200;
    const center = { x: size / 2, y: size / 2 };

    // Generate overlapped letter paths
    const letterPaths: string[] = [];

    letters.forEach((letter, index) => {
        const path = LETTER_VECTORS[letter.toUpperCase()];
        if (!path) return;

        const transform = getTransform(letter, index, letters.length, variant);
        const transformString = createTransformString(transform, center.x, center.y);

        const strokeWidth = variant === 'dense' ? 2.5 : variant === 'balanced' ? 2 : 1.5;

        letterPaths.push(
            `<path d="${path}" stroke="currentColor" stroke-width="${strokeWidth}" fill="none" opacity="${transform.opacity}" transform="${transformString}" stroke-linecap="round" stroke-linejoin="round" />`
        );
    });

    // Create decorations
    const decorations = createDecorations(letters, variant, size);

    // Create border
    const border = createBorder(center.x, center.y, 95, variant);

    // Assemble SVG
    const svg = `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${decorations}${letterPaths.join('')}${border}</svg>`;

    return {
        svg,
        variant,
    };
}

/**
 * Generate all three variants
 */
export function generateAllVariants(letters: string[]): SigilGenerationResult[] {
    return [
        generateAbstractSigil(letters, 'dense'),
        generateAbstractSigil(letters, 'balanced'),
        generateAbstractSigil(letters, 'minimal'),
    ];
}

/**
 * Variant metadata for UI
 */
export const VARIANT_METADATA = {
    dense: {
        title: 'Dense',
        description: 'Bold overlapping with strong geometric energy',
    },
    balanced: {
        title: 'Balanced',
        description: 'Harmonious merge with flowing connections',
    },
    minimal: {
        title: 'Minimal',
        description: 'Clean transformation with subtle presence',
    },
};
