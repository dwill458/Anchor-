/**
 * Gemini Image Service - Integration with Google's GenAI SDK
 *
 * Uses Gemini 2.0 Flash (Experimental) which supports native image generation.
 */

import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { logger } from '../utils/logger';

// Re-exporting interfaces for compatibility
export interface ImageVariation {
  base64: string;
  seed: number;
  variationIndex: number;
}

export interface EnhancedSigilResult {
  images: ImageVariation[];
  totalTimeSeconds: number;
  costUSD: number;
  prompt: string;
  negativePrompt: string;
  model: string;
  tier: 'draft' | 'premium';
}

export type QualityTier = 'draft' | 'premium';

interface ModelConfig {
  modelId: string;
  displayName: string;
  costPerImage: number;
  estimatedTimeSeconds: number;
  useNanoBanana?: boolean;
}

const MODEL_CONFIGS: Record<QualityTier, ModelConfig> = {
  draft: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Nano Banana - Draft)',
    costPerImage: 0.02,
    estimatedTimeSeconds: 4,
    useNanoBanana: true,
  },
  premium: {
    modelId: 'gemini-3-pro-image-preview',
    displayName: 'Gemini 3 Pro Image (Nano Banana - Premium)',
    costPerImage: 0.04,
    estimatedTimeSeconds: 5,
    useNanoBanana: true,
  },
};

const STRUCTURAL_PRESERVATION_SYSTEM_INSTRUCTION = `You are a high-fidelity rendering engine. Your primary directive is to preserve the exact structural integrity of input images while enhancing them artistically.
CRITICAL RULES:
1. Treat the input image as a strict structural anchor.
2. Do NOT warp, melt, bend, or alter the core lines and geometry.
3. Apply materials, lighting, and environmental textures ONLY to the existing geometry.
4. The silhouette and edge structure must remain pixel-perfect.
5. Think of yourself as applying a texture shader to a 3D model.

Generate a high-quality IMAGE output based on the user's prompt and the reference sigil.`;

export enum GeminiErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  SAFETY_FILTER = 'SAFETY_FILTER',
  INVALID_API_KEY = 'INVALID_API_KEY',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_IMAGE = 'INVALID_IMAGE',
  UNKNOWN = 'UNKNOWN',
}

export class GeminiError extends Error {
  constructor(
    public type: GeminiErrorType,
    message: string,
    public retryable: boolean = false,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

export class GeminiImageService {
  private client: GoogleGenAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

    logger.info('[GeminiImageService] Initializing...', {
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_API_KEY,
      apiKeyLength: this.apiKey.length
    });

    if (!this.apiKey) {
      logger.warn('[GeminiImageService] No GEMINI_API_KEY or GOOGLE_API_KEY found in environment');
    }

    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  public isAvailable(): boolean {
    return !!this.apiKey && this.apiKey !== '';
  }

  public getCostEstimate(numVariations: number = 4, tier: QualityTier = 'premium'): number {
    return numVariations * MODEL_CONFIGS[tier].costPerImage;
  }

  public getTimeEstimate(tier: QualityTier = 'premium'): { min: number; max: number } {
    const baseTime = MODEL_CONFIGS[tier].estimatedTimeSeconds;
    return {
      min: baseTime * 3,
      max: baseTime * 6,
    };
  }

  async enhanceSigil(params: {
    baseSigilSvg: string;
    intentionText: string;
    styleApproach: string;
    numberOfVariations: number;
    tier?: QualityTier;
  }): Promise<EnhancedSigilResult> {
    const {
      baseSigilSvg,
      intentionText,
      styleApproach,
      numberOfVariations,
      tier = 'premium',
    } = params;

    if (!this.isAvailable()) {
      throw new GeminiError(
        GeminiErrorType.INVALID_API_KEY,
        'GEMINI_API_KEY not configured.',
        false
      );
    }

    logger.info(`[GeminiImageService] Generating ${numberOfVariations} variations`, {
      intention: intentionText,
      style: styleApproach,
      tier,
    });

    const startTime = Date.now();

    // 1. Convert SVG to PNG
    const baseImageBuffer = await this.svgToPng(baseSigilSvg);

    // 2. Create intention-aware prompt
    const prompt = this.createPrompt(intentionText, styleApproach);

    // 3. Get model configuration
    const modelConfig = MODEL_CONFIGS[tier];

    // 4. Generate all variations in parallel
    const variations = await Promise.all(
      Array.from({ length: numberOfVariations }, (_, i) =>
        this.generateVariation(baseImageBuffer, prompt, i, modelConfig)
      )
    );

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    logger.info(`[GeminiImageService] Successfully generated ${variations.length} variations`, {
      totalTime,
      tier,
    });

    return {
      images: variations,
      totalTimeSeconds: totalTime,
      costUSD: this.getCostEstimate(numberOfVariations, tier),
      prompt: prompt,
      negativePrompt: 'text, watermark, blurry, low quality, distorted geometry, altered structure',
      model: modelConfig.modelId,
      tier,
    };
  }

  private createPrompt(intention: string, style: string): string {
    // Get intention-specific symbols
    const symbolInstructions = this.getIntentionSymbols(intention);

    // Base instruction for structural preservation and symbol enhancement
    const baseInstruction = intention && intention.trim()
      ? `This is a magical sigil representing: "${intention}".

CRITICAL RULES:
1. PRESERVE the exact geometric structure of the sigil - the main lines, circles, and shapes must remain EXACTLY as shown
2. ENHANCE the sigil by adding corresponding symbolic elements around and within it that relate to "${intention}"
3. Add relevant icons, symbols, and decorative elements that reinforce the sigil's meaning
4. The core sigil shape is SACRED and must not be distorted, warped, or altered

${symbolInstructions}

Add symbols that correspond to "${intention}" while keeping the main sigil structure intact.`
      : `This is a magical sigil for personal empowerment.

CRITICAL RULES:
1. PRESERVE the exact geometric structure of the sigil - the main lines, circles, and shapes must remain EXACTLY as shown
2. ENHANCE the sigil by adding mystical decorative elements around it
3. Add magical symbols, sacred geometry patterns, and ethereal decorations
4. The core sigil shape is SACRED and must not be distorted, warped, or altered

Add mystical enhancement elements while keeping the main sigil structure intact.`;

    const styleTemplates: Record<string, string> = {
      watercolor: `${baseInstruction}

STYLE: Mystical watercolor artwork
- Flowing organic color washes behind and around the sigil
- Soft edges on decorative elements, sharp edges on the main sigil
- Rich pigment bleeds and textured paper appearance
- The symbolic elements should flow naturally in watercolor style`,

      ink_brush: `${baseInstruction}

STYLE: Traditional ink brush artwork (Sumi-e)
- Bold black ink strokes for the main sigil
- Symbolic elements rendered in brush stroke style
- Zen minimalism with meaningful negative space
- Occasional red seal stamps as accents`,

      sacred_geometry: `${baseInstruction}

STYLE: Sacred geometry artwork
- Golden ratio proportions in decorative elements
- Metatron's Cube, Flower of Life patterns as backgrounds
- Precise geometric lines and mathematical harmony
- Symbolic elements integrated through geometric forms`,

      gold_leaf: `${baseInstruction}

STYLE: Illuminated manuscript / Gold leaf artwork
- Rich gold leaf gilding on the main sigil
- Ornate medieval-style borders with symbolic elements
- Deep jewel-tone colors (ruby, sapphire, emerald)
- Intricate Celtic or Gothic decorative motifs`,

      cosmic: `${baseInstruction}

STYLE: Cosmic space artwork
- Deep space nebulae and stellar backgrounds
- Glowing ethereal energy emanating from the sigil
- Celestial symbolic elements (stars, moons, planets)
- Luminous, mystical atmosphere`,

      minimal_line: `${baseInstruction}

STYLE: Minimalist line art
- Clean single-weight lines for the sigil
- Subtle symbolic elements in negative space
- Modern luxury aesthetic with restraint
- Elegant simplicity with meaningful details`,
    };

    return styleTemplates[style] || styleTemplates.watercolor;
  }

  /**
   * Map intention text to specific symbolic elements
   * Returns instruction string for adding relevant symbols
   */
  private getIntentionSymbols(intention: string): string {
    if (!intention || intention.trim() === '') {
      return '';
    }

    const lowerIntent = intention.toLowerCase();

    // Comprehensive keyword → symbol mapping
    const symbolMap: Record<string, string> = {
      // Physical & Strength
      gym: 'SYMBOLS TO ADD: dumbbells, barbells, flames, phoenix rising, flexed muscles, lightning bolts, iron weights, fire bursts',
      fitness: 'SYMBOLS TO ADD: dumbbells, barbells, flames, phoenix rising, flexed muscles, lightning bolts, iron weights',
      workout: 'SYMBOLS TO ADD: dumbbells, barbells, flames, muscular anatomy, powerlifting weights, energy bolts',
      strength: 'SYMBOLS TO ADD: flexed muscles, iron weights, fire bursts, lions, oak trees, power symbols, lightning',
      strong: 'SYMBOLS TO ADD: flexed muscles, iron weights, fire bursts, lions, oak trees, power symbols',
      muscle: 'SYMBOLS TO ADD: anatomical muscles, barbells, protein shakes, gym equipment, fire, power',

      // Protection & Boundaries
      boundaries: 'SYMBOLS TO ADD: chains, locks, thorns, shields, fortress walls, celtic knots, protective barriers, fences',
      boundary: 'SYMBOLS TO ADD: chains, locks, thorns, shields, fortress walls, celtic knots, protective barriers',
      protection: 'SYMBOLS TO ADD: shields, armor, guardian animals, protective circles, defensive walls, helmets',
      protect: 'SYMBOLS TO ADD: shields, armor, guardian animals, protective circles, defensive walls',
      safe: 'SYMBOLS TO ADD: shields, locks, guardian figures, protective barriers, safe boxes, fortress walls',
      safety: 'SYMBOLS TO ADD: shields, locks, guardian figures, protective barriers, safe boxes, fortress walls',

      // Stability & Grounding
      grounded: 'SYMBOLS TO ADD: deep roots, tree trunks, mountains, anchors, solid foundations, earth elements',
      ground: 'SYMBOLS TO ADD: deep roots, tree trunks, mountains, anchors, solid foundations, earth elements',
      stability: 'SYMBOLS TO ADD: balanced stones, pillars, foundations, sturdy oak, mountain peaks, anchors',
      stable: 'SYMBOLS TO ADD: balanced stones, pillars, foundations, sturdy oak, mountain peaks, anchors',

      // Relationships & Love
      love: 'SYMBOLS TO ADD: hearts, roses, doves, cupid arrows, romantic vines, paired doves, infinity loops',
      romance: 'SYMBOLS TO ADD: hearts, roses, doves, cupid imagery, romantic vines, paired doves, infinity loops',
      relationship: 'SYMBOLS TO ADD: intertwined elements, hearts, blossoms, infinity knots, paired symbols, rings',
      connection: 'SYMBOLS TO ADD: intertwined elements, hearts, infinity knots, paired symbols, linked chains',

      // Prosperity & Abundance
      wealth: 'SYMBOLS TO ADD: gold coins, gem stones, treasure chests, golden rays, prosperity coins, crowns',
      money: 'SYMBOLS TO ADD: currency symbols, flowing coins, gold reserves, financial prosperity, dollar signs',
      prosperity: 'SYMBOLS TO ADD: gold coins, cornucopia, overflowing vessels, harvest abundance, wealth symbols',
      abundance: 'SYMBOLS TO ADD: cornucopia, bountiful harvest, flowing water, multiplying symbols, full baskets',
      rich: 'SYMBOLS TO ADD: gold bullion, gem stones, treasure chests, golden rays, prosperity coins',

      // Success & Achievement
      success: 'SYMBOLS TO ADD: crowns, ascending paths, mountain peaks, golden trophies, victory laurels, medals',
      career: 'SYMBOLS TO ADD: ascending ladders, briefcases, professional symbols, success markers, stars',
      achievement: 'SYMBOLS TO ADD: medals, awards, summit peaks, podiums, triumph symbols, accomplishment badges',

      // Peace & Calm
      peace: 'SYMBOLS TO ADD: doves, olive branches, calm waters, zen circles, soft clouds, tranquil lotus',
      calm: 'SYMBOLS TO ADD: still water, gentle waves, soft light, floating feathers, peaceful meditation poses',
      serenity: 'SYMBOLS TO ADD: lotus flowers, meditation symbols, balanced stones, tranquil ponds, zen gardens',
      anxiety: 'SYMBOLS TO ADD: calming waves, peaceful clouds, meditation poses, zen circles, soothing light',

      // Mental & Focus
      focus: 'SYMBOLS TO ADD: geometric clarity, centered energy, laser beams, intricate mandalas, sharp crystals',
      clarity: 'SYMBOLS TO ADD: clear crystals, sharp lines, focused light, lens flares, precision geometry',
      mind: 'SYMBOLS TO ADD: brain patterns, neural networks, thought waves, consciousness symbols, third eye',
      concentration: 'SYMBOLS TO ADD: geometric clarity, centered energy, focused light, meditation symbols',

      // Creativity & Inspiration
      creativity: 'SYMBOLS TO ADD: paintbrushes, flowing ink, musical notes, artistic tools, color bursts, palettes',
      creative: 'SYMBOLS TO ADD: paintbrushes, flowing ink, musical notes, artistic tools, color bursts',
      inspiration: 'SYMBOLS TO ADD: light bulbs, shooting stars, divine rays, muse symbols, spark of genius',

      // Health & Healing
      health: 'SYMBOLS TO ADD: healing light, organic growth, heartbeat patterns, herbal motifs, vitality spirals',
      healing: 'SYMBOLS TO ADD: gentle light, flowing water, medicinal herbs, caduceus, restoration symbols',
      wellness: 'SYMBOLS TO ADD: healing herbs, balanced elements, vitality symbols, healthy heart, natural growth',

      // Growth & Transformation
      growth: 'SYMBOLS TO ADD: sprouting seeds, growing vines, expanding spirals, ascending paths, blooming flowers',
      transformation: 'SYMBOLS TO ADD: butterfly metamorphosis, phoenix rising, evolving forms, alchemical symbols',
      change: 'SYMBOLS TO ADD: butterfly wings, phoenix, evolving forms, transformation spirals, new growth',

      // Confidence & Power
      confidence: 'SYMBOLS TO ADD: standing lion, raised sword, bold flames, strong pillars, empowered stance, crowns',
      power: 'SYMBOLS TO ADD: lightning bolts, radiating energy, powerful animals, explosive force, scepters',
      strength: 'SYMBOLS TO ADD: clenched fist, heavy iron chains, stone pillars, bull or lion head, muscular forms, mountain peaks',
      gym: 'SYMBOLS TO ADD: iron weights, dumbbells, kettlebells, anatomical muscle patterns, victory laurels, power lightning',
      fitness: 'SYMBOLS TO ADD: pulse lines, anatomical geometry, vitality spirals, movement lines, energetic aura',
    };

    // Find matching keywords (prioritize longer/more specific matches first)
    const keywords = Object.keys(symbolMap).sort((a, b) => b.length - a.length);

    for (const keyword of keywords) {
      if (lowerIntent.includes(keyword)) {
        return symbolMap[keyword];
      }
    }

    // Fallback: return intention-based instruction
    return `SYMBOLS TO ADD: Add symbolic elements that represent "${intention}" - choose relevant mystical imagery, icons, and decorative elements that reinforce this intention.`;
  }

  private async generateVariation(
    baseImageBuffer: Buffer,
    prompt: string,
    variationIndex: number,
    modelConfig: ModelConfig,
    retryCount: number = 0
  ): Promise<ImageVariation> {
    // Route to Nano Banana if configured
    if (modelConfig.useNanoBanana) {
      return this.generateVariationWithNanoBanana(
        baseImageBuffer,
        prompt,
        variationIndex,
        modelConfig,
        retryCount
      );
    }

    // Fallback to Imagen (legacy)
    const maxRetries = 3;

    try {
      logger.info(`[GeminiImageService] Generating variation ${variationIndex + 1} with ${modelConfig.modelId} (Imagen)`);

      const response = await this.client.models.generateImages({
        model: modelConfig.modelId,
        prompt: `${prompt}\n\nIMPORTANT: Preserve the exact geometric structure and lines of the sigil design. Do not distort or warp the core shapes.`,
        config: {
          numberOfImages: 1,
          aspectRatio: '1:1',
          includeRaiReason: true,
        }
      });

      const generatedImage = response.generatedImages?.[0];

      if (!generatedImage?.image?.imageBytes) {
        throw new GeminiError(
          GeminiErrorType.INVALID_IMAGE,
          'No image data returned from Imagen API',
          true
        );
      }

      const imageBytes = generatedImage.image.imageBytes;
      const base64Data = typeof imageBytes === 'string' ? imageBytes : Buffer.from(imageBytes).toString('base64');

      return {
        base64: base64Data,
        seed: Math.floor(Math.random() * 1000000),
        variationIndex: variationIndex + 1,
      };

    } catch (error: any) {
      const geminiError = this.parseError(error);

      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.generateVariation(baseImageBuffer, prompt, variationIndex, modelConfig, retryCount + 1);
      }

      logger.error(`[GeminiImageService] Failed to generate variation ${variationIndex + 1}: ${geminiError.message}`);
      throw geminiError;
    }
  }

  private async generateVariationWithNanoBanana(
    baseImageBuffer: Buffer,
    prompt: string,
    variationIndex: number,
    modelConfig: ModelConfig,
    retryCount: number = 0
  ): Promise<ImageVariation> {
    const maxRetries = 3;

    try {
      logger.info(`[GeminiImageService] Generating variation ${variationIndex + 1} with Nano Banana (${modelConfig.modelId})`);

      const base64Image = baseImageBuffer.toString('base64');

      const response = await this.client.models.generateContent({
        model: modelConfig.modelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${prompt}

REFERENCE IMAGE INSTRUCTION: The attached image shows the sigil structure that must be preserved. Keep the main lines, circles, and geometric shapes EXACTLY as shown. Add symbolic enhancements AROUND and BEHIND the sigil, not by altering its core geometry.`
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: base64Image
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: '1:1'
          }
        }
      });

      // Extract image from response
      const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!imageData) {
        throw new GeminiError(
          GeminiErrorType.INVALID_IMAGE,
          'No image data in Nano Banana response',
          true
        );
      }

      return {
        base64: imageData,
        seed: Math.floor(Math.random() * 1000000),
        variationIndex: variationIndex + 1,
      };

    } catch (error: any) {
      const geminiError = this.parseError(error);

      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.generateVariationWithNanoBanana(
          baseImageBuffer,
          prompt,
          variationIndex,
          modelConfig,
          retryCount + 1
        );
      }

      logger.error(`[GeminiImageService] Nano Banana failed for variation ${variationIndex + 1}: ${geminiError.message}`);
      throw geminiError;
    }
  }

  private parseError(error: any): GeminiError {
    const message = error?.message || error?.toString() || 'Unknown error';

    if (message.includes('rate limit') || message.includes('quota exceeded') || message.includes('429')) {
      return new GeminiError(GeminiErrorType.RATE_LIMIT, 'Rate limit exceeded.', true, 5000);
    }
    if (message.includes('safety') || message.includes('blocked')) {
      return new GeminiError(GeminiErrorType.SAFETY_FILTER, 'Content blocked by safety filter', false);
    }
    if (message.includes('API key') || message.includes('401') || message.includes('403')) {
      return new GeminiError(GeminiErrorType.INVALID_API_KEY, 'Invalid or missing API Key', false);
    }
    if (message.includes('network') || message.includes('timeout') || message.includes('ECONNREFUSED')) {
      return new GeminiError(GeminiErrorType.NETWORK_ERROR, 'Network error', true, 5000);
    }

    return new GeminiError(GeminiErrorType.UNKNOWN, message, false);
  }

  private async svgToPng(svgString: string): Promise<Buffer> {
    let styledSvg = svgString
      .replace(/stroke="[^"]*"/g, 'stroke="#D4AF37"')
      .replace(/fill="[^"]*"/g, 'fill="none"');

    if (!styledSvg.includes('viewBox')) {
      styledSvg = styledSvg.replace('<svg', '<svg viewBox="0 0 200 200"');
    }

    try {
      return await sharp(Buffer.from(styledSvg))
        .resize(1024, 1024, {
          fit: 'contain',
          background: '#0F1419',
        })
        .png()
        .toBuffer();
    } catch (error) {
      throw new GeminiError(GeminiErrorType.INVALID_IMAGE, 'Failed to convert SVG to PNG', false);
    }
  }
}
