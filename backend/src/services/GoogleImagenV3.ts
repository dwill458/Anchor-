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

    constructor() {
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
        this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

        const credentials = JSON.parse(
            process.env.GOOGLE_CLOUD_CREDENTIALS_JSON || '{}'
        );

        this.auth = new GoogleAuth({
            credentials,
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

        // THE MAGIC PROMPT: Detailed and symbolic
        const symbols: Record<string, string> = {
            gym: 'barbells, dumbbells, flames, muscular aesthetics, powerlifting anatomy, lightning bolts',
            health: 'healing light, organic growth, anchors for stability, heartbeat patterns, herbal motifs',
            focus: 'geometric clarity, centered energy, laser-like precision, intricate mandalas',
            success: 'crowns, ascending paths, mountain peaks, golden trophies, trophies',
            relationship: 'intertwined elements, hearts, blossoms, infinity knots',
            spiritual: 'runes, cosmic portals, meditation glyphs, auras of light'
        };

        // Auto-detect a theme from intention
        const lowerIntention = intention.toLowerCase();
        let selectedSymbols = 'mystical ornaments, ornate filigree, floating sacred geometry, celestial energy';

        if (lowerIntention.includes('gym') || lowerIntention.includes('fitness') || lowerIntention.includes('workout')) selectedSymbols = symbols.gym;
        else if (lowerIntention.includes('health') || lowerIntention.includes('healing')) selectedSymbols = symbols.health;
        else if (lowerIntention.includes('focus') || lowerIntention.includes('mind')) selectedSymbols = symbols.focus;
        else if (lowerIntention.includes('success') || lowerIntention.includes('money') || lowerIntention.includes('career')) selectedSymbols = symbols.success;
        else if (lowerIntention.includes('love') || lowerIntention.includes('relationship')) selectedSymbols = symbols.relationship;
        else if (lowerIntention.includes('spirit') || lowerIntention.includes('magic')) selectedSymbols = symbols.spiritual;

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
        const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/imagegeneration@006:predict`;

        // Request payload for EDIT mode with MASK
        const requestBody = {
            instances: [{
                prompt: prompt,
                image: {
                    bytesBase64Encoded: baseImageBuffer.toString('base64')
                },
                mask: {
                    image: {
                        bytesBase64Encoded: maskImageBuffer.toString('base64')
                    }
                }
            }],
            parameters: {
                // IMPROVED: Mask-based editing
                editConfig: {
                    editMode: 'INPAINTING_INSERT',
                    // maskMode: 'MASK_MODE_USER_PROVIDED', // Implicit when mask is provided
                    guidanceScale: 12,               // Strong adherence to the prompt's theme
                    numberOfImages: 1
                },

                // Creative settings
                sampleCount: 1,
                aspectRatio: '1:1',

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
}

export default GoogleImagenV3;
