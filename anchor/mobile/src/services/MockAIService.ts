/**
 * Mock AI Service
 *
 * Provides realistic mock data for AI features when the backend is unreachable.
 * This ensures the UI flow can be tested without a running server or API keys.
 */

import { AnchorCategory } from '@/types';

export interface AnalysisResult {
    intentionText: string;
    keywords: string[];
    themes: string[];
    selectedSymbols: Array<{
        id: string;
        name: string;
        category: string;
        description: string;
        unicode?: string;
    }>;
    aesthetic: string;
    explanation: string;
}

export interface GenerationResult {
    variations: string[];
    prompt: string;
}

/**
 * Mock Analysis Data
 */
export const mockAnalyzeIntention = async (intentionText: string): Promise<AnalysisResult> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
        intentionText,
        keywords: ['growth', 'resilience', 'manifestation', 'power'],
        themes: ['Earth Element', 'Solar Energy', 'Sacred Geometry'],
        selectedSymbols: [
            {
                id: 'sym_1',
                name: 'Seed of Life',
                category: 'Alignment Patterns',
                description: 'Represents the seven stages of creation and the potential for new beginnings.',
                unicode: '⚛️',
            },
            {
                id: 'sym_2',
                name: 'Solar Seal',
                category: 'Achievement Seals',
                description: 'Channels the vitality and willpower of the sun to fuel your intention.',
                unicode: '☀️',
            },
            {
                id: 'sym_3',
                name: 'Fehu',
                category: 'Resonance Glyphs',
                description: 'Ancient rune associated with mobile wealth, energy, and new possibilities.',
                unicode: 'ᚠ',
            },
        ],
        aesthetic: 'Ornate and Golden',
        explanation:
            'To manifest your intention for growth, we combine the generative potential of the Seed of Life with the active energy of the Solar Seal. The Fehu rune grounds this in tangible reality.',
    };
};

/**
 * Mock Generation Data
 */
export const mockGenerateVariations = async (): Promise<GenerationResult> => {
    // Simulate longer generation time
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return {
        prompt: 'A golden intricate sigil combining the Seed of Life and Solar Seal, glowing on a dark nebula background, high definition, 8k.',
        variations: [
            'https://api.dicebear.com/7.x/shapes/svg?seed=anchor1&backgroundColor=1a1a1d&shape1Color=d4af37',
            'https://api.dicebear.com/7.x/shapes/svg?seed=anchor2&backgroundColor=1a1a1d&shape1Color=d4af37',
            'https://api.dicebear.com/7.x/shapes/svg?seed=anchor3&backgroundColor=1a1a1d&shape1Color=d4af37',
            'https://api.dicebear.com/7.x/shapes/svg?seed=anchor4&backgroundColor=1a1a1d&shape1Color=d4af37',
        ],
    };
};
