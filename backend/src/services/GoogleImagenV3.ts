import { GoogleAuth } from 'google-auth-library';
import sharp from 'sharp';

interface EnhanceSigilParams {
    baseSigilSvg: string;
    intentionText: string;
    styleApproach: string;
    numberOfVariations?: number;
}

interface GeneratedVariation {
    base64: string;
    imageUrl?: string;
    seed: number;
    variationIndex: number;
}

export class GoogleImagenV3 {
    private projectId: string;
    private location: string;
    private auth: GoogleAuth;

    public isAvailable(): boolean {
        return !!this.projectId;
    }

    constructor() {
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
        this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

        let credentials;

        // 1. Try environment variable JSON
        const credsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
        if (credsJson && credsJson.trim() !== '') {
            try {
                credentials = JSON.parse(credsJson);
            } catch (e) {
                console.warn('Invalid GOOGLE_CLOUD_CREDENTIALS_JSON, ignoring.');
            }
        }

        // 2. Try local file (service-account.json)
        if (!credentials) {
            try {
                const fs = require('fs');
                const path = require('path');
                const keyFilePath = path.join(process.cwd(), 'service-account.json');
                if (fs.existsSync(keyFilePath)) {
                    credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));
                    console.log('✅ Loaded credentials from service-account.json');
                }
            } catch (e) {
                // Ignore file errors
            }
        }

        this.auth = new GoogleAuth({
            credentials, // undefined triggers ADC (gcloud auth login)
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
    }

    /**
     * Main enhancement method
     */
    async enhanceSigil(params: EnhanceSigilParams): Promise<{
        images: GeneratedVariation[];
        totalTimeSeconds: number;
        costUSD: number;
    }> {
        const {
            baseSigilSvg,
            intentionText,
            styleApproach,
            numberOfVariations = 4
        } = params;

        console.log(`🎨 Enhancing sigil for: "${intentionText}"`);
        console.log(`🖌️  Style: ${styleApproach}`);
        console.log(`🔢 Generating ${numberOfVariations} variations`);

        const startTime = Date.now();

        // Step 1: Prepare Image AND Mask
        // We need:
        // 1. Base Image: The visual guide (Gold lines on loose dark bg)
        // 2. Mask Image: 0=Change (Background), 255=Keep (Lines) - Wait, in Vertex AI:
        //    Black (0) = Protected/Keep
        //    White (255) = Inpaint/Edit
        const { baseImage, maskImage } = await this.prepareImageAndMask(baseSigilSvg);

        // Step 2: Create the winning prompt
        const prompt = this.createPrompt(intentionText, styleApproach);

        console.log('📝 Prompt:', prompt);

        // Step 3: Generate all variations in parallel
        const variations = await Promise.all(
            Array.from({ length: numberOfVariations }, (_, i) =>
                this.generateVariation(baseImage, maskImage, prompt, i)
            )
        );

        const totalTime = (Date.now() - startTime) / 1000;

        console.log(`✅ Generated ${variations.length} variations in ${totalTime}s`);

        return {
            images: variations,
            totalTimeSeconds: Math.round(totalTime),
            costUSD: numberOfVariations * 0.02 // $0.02 per image
        };
    }

    /**
     * THE WINNING PROMPT - Based on your successful Gemini test
     */
    private createPrompt(intention: string, style: string): string {
        // Map style names to art descriptions
        const styleDescriptions: Record<string, string> = {
            watercolor: 'watercolor',
            ink_brush: 'ink brush painting',
            sacred_geometry: 'sacred geometry',
            gold_leaf: 'gold leaf illuminated manuscript',
            cosmic: 'cosmic space art',
            minimal_line: 'minimalist line art'
        };

        const styleDesc = styleDescriptions[style] || 'watercolor';

        // THE MAGIC PROMPT: Detailed and symbolic (COMPREHENSIVE MAPPING)
        const symbols: Record<string, string> = {
            // Physical & Strength
            gym: 'barbells, dumbbells, flames, muscular aesthetics, powerlifting anatomy, lightning bolts',
            strength: 'flexed muscles, iron weights, fire bursts, lions, oak trees, power symbols',

            // Stability & Grounding
            grounded: 'deep roots, tree trunks, mountains, anchors, solid foundations, earth elements, rocks, stable base',
            stability: 'balanced stones, pillars, foundations, sturdy oak, mountain peaks, anchors, geometric stability',
            foundation: 'stone foundations, pillars, bedrock, architectural base, supporting columns, earth layers',

            // Protection & Boundaries
            boundaries: 'chains, locks, shields, protective barriers, fortress walls, celtic knots, thorned vines',
            protection: 'shields, armor, guardian animals, protective circles, defensive walls, safe harbor',

            // Health & Healing
            health: 'healing light, organic growth, anchors for stability, heartbeat patterns, herbal motifs',
            healing: 'gentle light, flowing water, medicinal herbs, restoration symbols, soft energy',

            // Mental & Focus
            focus: 'geometric clarity, centered energy, laser-like precision, intricate mandalas, concentrated beams',
            clarity: 'clear crystals, sharp lines, focused light, lens flares, precision geometry',
            mind: 'brain patterns, neural networks, thought waves, consciousness symbols, mental clarity',

            // Success & Achievement
            success: 'crowns, ascending paths, mountain peaks, golden trophies, victory laurels, rising arrows',
            achievement: 'medals, awards, summit peaks, podiums, triumph symbols, accomplishment badges',

            // Relationships & Love
            relationship: 'intertwined elements, hearts, blossoms, infinity knots, paired symbols, connection bonds',
            love: 'roses, hearts, cupid imagery, romantic vines, paired doves, infinity loops',

            // Spiritual & Mystical
            spiritual: 'runes, cosmic portals, meditation glyphs, auras of light, sacred geometry, chakra symbols',
            magic: 'mystical runes, spell circles, ethereal wisps, magical glyphs, arcane symbols',

            // Prosperity & Abundance
            prosperity: 'gold coins, cornucopia, overflowing vessels, harvest abundance, wealth symbols, flowing rivers',
            wealth: 'gold bullion, gem stones, treasure chests, golden rays, prosperity coins',
            abundance: 'cornucopia, bountiful harvest, flowing water, multiplying symbols, full baskets',

            // Peace & Calm
            peace: 'doves, olive branches, calm waters, zen circles, soft clouds, tranquil scenes',
            calm: 'still water, gentle waves, soft light, floating feathers, peaceful meditation',
            serenity: 'lotus flowers, meditation symbols, balanced stones, tranquil ponds, zen gardens',

            // Creativity & Inspiration
            creativity: 'paintbrushes, flowing ink, musical notes, artistic tools, color bursts, creative spirals',
            inspiration: 'light bulbs, shooting stars, divine rays, muse symbols, spark of genius',

            // Growth & Transformation
            growth: 'sprouting seeds, growing vines, expanding spirals, ascending paths, blooming flowers',
            transformation: 'butterfly metamorphosis, phoenix rising, evolving forms, alchemical symbols',

            // Confidence & Power
            confidence: 'standing lion, raised sword, bold flames, strong pillars, empowered stance',
            power: 'lightning bolts, radiating energy, powerful animals, explosive force, dominant presence'
        };

        // Auto-detect theme from intention (EXPANDED KEYWORD MATCHING)
        const lowerIntention = intention.toLowerCase();
        let selectedSymbols = 'mystical ornaments, ornate filigree, floating sacred geometry, celestial energy';

        // Prioritize more specific matches first
        if (lowerIntention.includes('grounded') || lowerIntention.includes('ground')) selectedSymbols = symbols.grounded;
        else if (lowerIntention.includes('stability') || lowerIntention.includes('stable')) selectedSymbols = symbols.stability;
        else if (lowerIntention.includes('foundation') || lowerIntention.includes('foundational')) selectedSymbols = symbols.foundation;
        else if (lowerIntention.includes('boundaries') || lowerIntention.includes('boundary')) selectedSymbols = symbols.boundaries;
        else if (lowerIntention.includes('protection') || lowerIntention.includes('protect')) selectedSymbols = symbols.protection;
        else if (lowerIntention.includes('gym') || lowerIntention.includes('fitness') || lowerIntention.includes('workout')) selectedSymbols = symbols.gym;
        else if (lowerIntention.includes('strength') || lowerIntention.includes('strong')) selectedSymbols = symbols.strength;
        else if (lowerIntention.includes('health') || lowerIntention.includes('healthy')) selectedSymbols = symbols.health;
        else if (lowerIntention.includes('healing') || lowerIntention.includes('heal')) selectedSymbols = symbols.healing;
        else if (lowerIntention.includes('focus') || lowerIntention.includes('focused') || lowerIntention.includes('concentration')) selectedSymbols = symbols.focus;
        else if (lowerIntention.includes('clarity') || lowerIntention.includes('clear')) selectedSymbols = symbols.clarity;
        else if (lowerIntention.includes('mind') || lowerIntention.includes('mental')) selectedSymbols = symbols.mind;
        else if (lowerIntention.includes('success') || lowerIntention.includes('successful')) selectedSymbols = symbols.success;
        else if (lowerIntention.includes('achievement') || lowerIntention.includes('achieve')) selectedSymbols = symbols.achievement;
        else if (lowerIntention.includes('money') || lowerIntention.includes('career') || lowerIntention.includes('job')) selectedSymbols = symbols.success;
        else if (lowerIntention.includes('love') || lowerIntention.includes('romance') || lowerIntention.includes('romantic')) selectedSymbols = symbols.love;
        else if (lowerIntention.includes('relationship') || lowerIntention.includes('connection')) selectedSymbols = symbols.relationship;
        else if (lowerIntention.includes('spirit') || lowerIntention.includes('spiritual')) selectedSymbols = symbols.spiritual;
        else if (lowerIntention.includes('magic') || lowerIntention.includes('magical')) selectedSymbols = symbols.magic;
        else if (lowerIntention.includes('prosperity') || lowerIntention.includes('prosperous')) selectedSymbols = symbols.prosperity;
        else if (lowerIntention.includes('wealth') || lowerIntention.includes('wealthy') || lowerIntention.includes('rich')) selectedSymbols = symbols.wealth;
        else if (lowerIntention.includes('abundance') || lowerIntention.includes('abundant')) selectedSymbols = symbols.abundance;
        else if (lowerIntention.includes('peace') || lowerIntention.includes('peaceful')) selectedSymbols = symbols.peace;
        else if (lowerIntention.includes('calm') || lowerIntention.includes('calming')) selectedSymbols = symbols.calm;
        else if (lowerIntention.includes('serenity') || lowerIntention.includes('serene')) selectedSymbols = symbols.serenity;
        else if (lowerIntention.includes('creativity') || lowerIntention.includes('creative')) selectedSymbols = symbols.creativity;
        else if (lowerIntention.includes('inspiration') || lowerIntention.includes('inspire')) selectedSymbols = symbols.inspiration;
        else if (lowerIntention.includes('growth') || lowerIntention.includes('grow')) selectedSymbols = symbols.growth;
        else if (lowerIntention.includes('transformation') || lowerIntention.includes('transform') || lowerIntention.includes('change')) selectedSymbols = symbols.transformation;
        else if (lowerIntention.includes('confidence') || lowerIntention.includes('confident')) selectedSymbols = symbols.confidence;
        else if (lowerIntention.includes('power') || lowerIntention.includes('powerful')) selectedSymbols = symbols.power;

        return `Create a high-quality ${styleDesc} artwork based on this sigil which represents "${intention}". 
        Integrate ${selectedSymbols} around and through the structure. 
        Style: ${styleDesc} with rich textures, hand-painted details, and mystical lighting. 
        Maintain the main golden structure foundation exactly.`;
    }

    /**
     * Generate single variation using Imagen 3 EDIT mode with MASK
     */
    private async generateVariation(
        baseImageBuffer: Buffer,
        maskImageBuffer: Buffer,
        prompt: string,
        variationIndex: number
    ): Promise<GeneratedVariation> {

        // Get access token
        const client = await this.auth.getClient();
        const token = await client.getAccessToken();

        if (!token.token) {
            throw new Error('Failed to get OAuth token');
        }

        // Imagen 3 Edit endpoint
        const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/imagen-3.0-generate-001:predict`;

        // Request payload for VARIATION / STYLE TRANSFER mode (No Mask)
        const requestBody = {
            instances: [{
                prompt: prompt,
                image: {
                    bytesBase64Encoded: baseImageBuffer.toString('base64')
                }
            }],
            parameters: {
                // Creative settings
                sampleCount: 1,
                // aspectRatio: '1:1', // Aspect ratio not allowed when image is provided

                // Quality
                safetyFilterLevel: 'block_few',
                personGeneration: 'allow_adult',

                // Higher randomness for distinct variations
                seed: Math.floor(Math.random() * 1000000) + variationIndex,

                // Output format
                outputOptions: {
                    mimeType: 'image/png',
                    compressionQuality: 90
                }
            }
        };

        console.log(`🔄 Generating variation ${variationIndex + 1}...`);

        try {
            // Use axios for broaded compatibility or check if fetch is on global
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Imagen API error (${response.status}): ${errorText}`);
            }

            const result: any = await response.json();

            // Extract image data
            const prediction = result.predictions?.[0];
            if (!prediction?.bytesBase64Encoded) {
                throw new Error('No image data in response');
            }

            console.log(`✅ Variation ${variationIndex + 1} generated`);

            return {
                base64: prediction.bytesBase64Encoded,
                seed: 42 + variationIndex,
                variationIndex: variationIndex + 1
            };

        } catch (error: any) {
            console.error(`❌ Failed to generate variation ${variationIndex + 1}:`, error);
            throw error;
        }
    }

    /**
     * Prepare Base Image and Mask
     */
    private async prepareImageAndMask(svgString: string): Promise<{ baseImage: Buffer, maskImage: Buffer }> {
        console.log('🔄 Preparing Base Image and Mask...');

        let cleanSvg = svgString;
        if (!cleanSvg.includes('viewBox')) {
            cleanSvg = cleanSvg.replace('<svg', '<svg viewBox="0 0 200 200"');
        }

        // 1. Base Image: Gold Lines on Transparent (or dark)
        // We actually want the base to be what we KEEP.
        const baseSvg = cleanSvg
            .replace(/stroke="[^"]*"/g, 'stroke="#D4AF37"')
            .replace(/fill="[^"]*"/g, 'fill="none"')
            .replace(/stroke-width="[^"]*"/g, 'stroke-width="5"'); // Thicker for better visibility

        const baseImage = await sharp(Buffer.from(baseSvg))
            .resize(1024, 1024, { fit: 'contain', background: { r: 15, g: 20, b: 25, alpha: 1 } })
            .png()
            .toBuffer();

        // 2. Mask Image:
        // Black (0) = Protected (The Lines)
        // White (255) = Editable (The Background)
        // We render lines as BLACK on a WHITE background.
        const maskSvg = cleanSvg
            .replace(/stroke="[^"]*"/g, 'stroke="#000000"') // Black lines (protected)
            .replace(/fill="[^"]*"/g, 'fill="none"')
            .replace(/stroke-width="[^"]*"/g, 'stroke-width="5"'); // Match thickness

        const maskImage = await sharp(Buffer.from(maskSvg))
            .resize(1024, 1024, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } }) // White bg (editable)
            .png()
            .toBuffer();

        console.log('✅ Image and Mask prepared');

        return { baseImage, maskImage };
    }
    // Helper methods for AIEnhancer compatibility
    public getCostEstimate(num: number = 4): number { return num * 0.02; }
    public getTimeEstimate() { return { min: 10, max: 20 }; }
}

export default GoogleImagenV3;
