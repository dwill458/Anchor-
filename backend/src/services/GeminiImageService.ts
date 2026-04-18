/**
 * Gemini Image Service - Integration with Google's GenAI SDK
 *
 * Uses Gemini 3.1 Flash (Nano Banana 2) for standard enhancements and
 * Gemini 3 Pro for regenerations / 4K downloads.
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

export type QualityTier = 'draft' | 'premium' | 'pro_upgrade';

export interface EnhancedSigilResult {
  images: ImageVariation[];
  totalTimeSeconds: number;
  costUSD: number;
  prompt: string;
  negativePrompt: string;
  model: string;
  tier: QualityTier;
}

interface ModelConfig {
  modelId: string;
  displayName: string;
  costPerImage: number;
  estimatedTimeSeconds: number;
  useNanoBanana?: boolean;
}

// Flash model: used for all standard enhancements (paid default)
// Pro model: reserved for regenerations (attempt 3+) and 4K downloads
const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-3.1-flash-image-preview';
const PRO_MODEL = process.env.GEMINI_PRO_MODEL || 'gemini-3-pro-image-preview';

const MODEL_CONFIGS: Record<QualityTier, ModelConfig> = {
  draft: {
    modelId: FLASH_MODEL,
    displayName: 'Gemini Flash (standard)',
    costPerImage: 0.005,
    estimatedTimeSeconds: 3,
    useNanoBanana: true,
  },
  premium: {
    modelId: FLASH_MODEL,
    displayName: 'Gemini Flash (standard)',
    costPerImage: 0.005,
    estimatedTimeSeconds: 3,
    useNanoBanana: true,
  },
  pro_upgrade: {
    modelId: PRO_MODEL,
    displayName: 'Gemini Pro (regeneration / 4K)',
    costPerImage: 0.04,
    estimatedTimeSeconds: 8,
    useNanoBanana: true,
  },
};

const _STRUCTURAL_PRESERVATION_SYSTEM_INSTRUCTION = `You are a high-fidelity rendering engine. Your primary directive is to preserve the exact structural integrity of input images while enhancing them artistically.
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
      apiKeyLength: this.apiKey.length,
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

    // 4. Generate variations sequentially with a short delay between calls
    //    to avoid hitting Gemini's per-minute rate limits (free tier ≈ 2-10 RPM).
    const INTER_CALL_DELAY_MS = 2500;
    const variations: ImageVariation[] = [];
    for (let i = 0; i < numberOfVariations; i++) {
      const variation = await this.generateVariation(baseImageBuffer, prompt, i, modelConfig);
      variations.push(variation);

      if (i < numberOfVariations - 1) {
        await new Promise(resolve => setTimeout(resolve, INTER_CALL_DELAY_MS));
      }
    }

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
      negativePrompt:
        'text, words, letters, numbers, numerals, watermark, readable characters, dollar sign, currency symbols, coins, cash, banknotes, bank logos, charts, graphs, clipart, sticker, icon pack, photorealistic, human face, human figure, literal objects, blurry, low quality, distorted geometry, altered structure, warped lines',
      model: modelConfig.modelId,
      tier,
    };
  }

  private createPrompt(intention: string, style: string): string {
    const archetypeBlock = this.getArchetypeMotifs(intention);

    const structuralCore =
      intention && intention.trim()
        ? `SIGIL IDENTITY: This sigil embodies the intention "${intention}".

STRUCTURAL PRESERVATION — HIGHEST PRIORITY:
1. The input image defines the exact sigil geometry — preserve ALL lines, circles, and shapes EXACTLY as shown
2. Do NOT warp, melt, bend, rotate, skew, or alter any geometric element
3. Do NOT add text, labels, captions, words, letters, or numbers anywhere
4. The sigil geometry is immutable — treat it as a fixed engraving plate beneath all styling`
        : `SIGIL IDENTITY: A magical sigil for personal empowerment.

STRUCTURAL PRESERVATION — HIGHEST PRIORITY:
1. Preserve ALL lines, circles, and geometric forms EXACTLY as shown
2. Do NOT warp, melt, bend, or alter any element
3. No text, words, letters, or numbers of any kind`;

    const hardBans = `
ABSOLUTE PROHIBITIONS — DO NOT INCLUDE ANY OF THE FOLLOWING:
✗ Text, words, letters, phrases, sentences, or any readable characters whatsoever
✗ Numbers, numerals, digits, or numeric symbols of any kind
✗ Currency: dollar signs ($), pound (£), euro (€), yen (¥), coins, coin stacks, banknotes, bills, cash, wallets, credit cards
✗ Financial: bank logos, charts, graphs, bar charts, pie charts, stock tickers, financial instruments
✗ Literal depictions of objects directly named in the intention — no direct illustration
✗ Literal people, human faces, human figures, or recognizable portraits
✗ Clipart, icon packs, sticker-style imagery, flat vector icons, or emoji-style symbols
✗ Photorealistic photography — keep to illustration, engraving, or filigree aesthetic
✗ Brand logos, watermarks, copyright symbols
✗ Literal chains, literal keys, literal locks, literal weapons, literal animals as main subjects
NO WORDS. NO NUMBERS. NO LETTERS. NO CURRENCY. NO FINANCIAL IMAGERY.`;

    const styleTemplates: Record<string, string> = {
      minimal_line: `${structuralCore}

STYLE: Precision fine-line engraving — BLACK INK ON WHITE
- ALL lines and strokes must be pure BLACK — absolutely no gold, yellow, amber, cream, or colored strokes
- Background: white or off-white — no dark or colored backgrounds
- Single-weight hairline black strokes only; no fills, no gradients, no color washes, no shading
- Decorative motifs rendered as delicate black hairline filigree in borders only
- Aesthetic: museum-quality engraving plate — restrained, precise, minimal luxury

${archetypeBlock}
${hardBans}`,

      watercolor: `${structuralCore}

STYLE: Mystical watercolor — flowing organic washes, soft pigment bleeds, textured paper
- Color washes applied BEHIND and AROUND the sigil, never obscuring its geometry
- The sigil itself in sharp clean strokes above the watercolor layer
- Rich saturated jewel tones with natural pigment bleeding at edges

${archetypeBlock}
${hardBans}`,

      ink_brush: `${structuralCore}

STYLE: Sumi-e ink brush — bold black ink, zen minimalism, meaningful negative space
- The main sigil in authoritative black ink strokes
- Sparse negative space is intentional — restraint over decoration
- No color; only black ink on cream or white ground

${archetypeBlock}
${hardBans}`,

      sacred_geometry: `${structuralCore}

STYLE: Sacred geometry — golden ratio, Flower of Life, mathematical harmony
- Geometric background patterns (Metatron's Cube, Flower of Life) as faint underlayer only
- Precise measured linework; gold, deep blue, or dark purple palette
- Background geometry never competes with or distorts the main sigil

${archetypeBlock}
${hardBans}`,

      gold_leaf: `${structuralCore}

STYLE: Illuminated manuscript — gold leaf gilding, jewel-tone colors, Gothic filigree
- Rich gold leaf finish on the main sigil lines
- Deep jewel-tone background (ruby, sapphire, or emerald)
- Ornate border in Celtic or Gothic filigree style

${archetypeBlock}
${hardBans}`,

      cosmic: `${structuralCore}

STYLE: Cosmic space — deep nebulae, stellar atmosphere, luminous ethereal glow
- Deep space nebula color washes as the background atmosphere
- Glowing ethereal light emanating from the sigil center
- Stars and galactic dust as background texture only

${archetypeBlock}
${hardBans}`,

      obsidian_mono: `${structuralCore}

STYLE: Obsidian monochrome — deep black glass texture, cinematic high-contrast
- Near-black background with the sigil in white or silver luminescence
- Subtle glass-surface reflections on the sigil geometry
- Monochromatic; all motifs rendered in stark negative space

${archetypeBlock}
${hardBans}`,

      aurora_glow: `${structuralCore}

STYLE: Aurora borealis — atmospheric light curtains, shifting ethereal color
- Green, violet, and blue aurora light as the background atmosphere
- The sigil as a grounded geometric form anchored within the aurora light
- Soft gradual color transitions; no hard-edged overlays

${archetypeBlock}
${hardBans}`,

      ember_trace: `${structuralCore}

STYLE: Ember trace — glowing hot metal edges, forge and crucible aesthetic
- Deep black or charcoal background
- Sigil lines glow with molten amber-orange heat along their edges
- Cooling dark contrasts with ember-bright highlights on the geometry only

${archetypeBlock}
${hardBans}`,

      echo_chamber: `${structuralCore}

STYLE: Echo resonance — rhythmic ripple patterns, cyclical emanating energy
- Concentric ripple rings radiating outward from the sigil
- Subtle rhythmic layering of translucent rings in background only
- Monochromatic or near-monochromatic; resonance implied through pattern

${archetypeBlock}
${hardBans}`,

      monolith_ink: `${structuralCore}

STYLE: Monolith ink — heavy matte black linework, architectural permanence
- Bold authoritative matte-black strokes; no metallic sheen
- The sigil as a carved stone monument — gravity and permanence over ornament
- Minimal decorative elements; restraint is the aesthetic

${archetypeBlock}
${hardBans}`,

      celestial_grid: `${structuralCore}

STYLE: Celestial grid — star-chart precision, constellation map aesthetic
- Fine grid lines forming a celestial navigation background only
- Constellation-like star points at key intersections of the sigil geometry
- Deep navy or midnight blue ground with gold or silver line overlay

${archetypeBlock}
${hardBans}`,
    };

    return styleTemplates[style] || styleTemplates.watercolor;
  }

  /**
   * Extract archetypal motifs from intention text.
   * Returns motif directions that imply the intention through symbolism,
   * never through literal depiction. symbolicDistance is hardcoded to 2 (Archetypal).
   */
  private getArchetypeMotifs(intention: string): string {
    const ARCHETYPE_BUNDLES: Record<
      string,
      {
        planetary: string[];
        elemental: string[];
        geometry: string[];
        natural: string[];
      }
    > = {
      freedom: {
        planetary: ['Jupiter (expansion, boundless horizon)', 'Uranus (liberation, breakthrough)'],
        elemental: ['Air (wind, open breath, release)', 'Fire (ascending flame, rising will)'],
        geometry: [
          'outward-expanding open spiral',
          'open arc threshold form',
          'upward-pointing triangle',
        ],
        natural: [
          'soaring hawk silhouette as hairline filigree',
          'open horizon line as border accent',
        ],
      },
      prosperity: {
        planetary: [
          'Jupiter (growth, generative abundance)',
          'Venus (magnetism, attraction, value)',
        ],
        elemental: ['Earth (fertile soil, deep roots)', 'Water (flow, circulation, nourishment)'],
        geometry: [
          'hexagonal honeycomb cell pattern',
          'golden-ratio spiral',
          'expanding concentric rings',
        ],
        natural: [
          'wheat stalk as micro-engraved border element',
          'oak leaf cluster as corner filigree',
        ],
      },
      strength: {
        planetary: ['Mars (willpower, vital force)', 'Sun (radiance, sovereign vitality)'],
        elemental: ['Fire (inner forge flame)', 'Earth (bedrock, immovability)'],
        geometry: ['upward-pointing bold triangle', 'double-chevron form', 'strong hexagram'],
        natural: [
          'mountain peak silhouette as background texture',
          'deep root system as lower border',
        ],
      },
      love: {
        planetary: ['Venus (love, beauty, union)', 'Moon (emotional depth, receptivity)'],
        elemental: ['Water (feeling, flow, depth)', 'Fire (passion, warmth)'],
        geometry: [
          'vesica piscis interlocking circles',
          'torus knot outline',
          'two interlocked rings',
        ],
        natural: ['rose petal curve woven into filigree', 'vine tendril as border weave'],
      },
      health: {
        planetary: ['Sun (life-force, vitality, renewal)', 'Mercury (flow, regeneration)'],
        elemental: ['Water (healing, purification)', 'Air (breath, oxygenation)'],
        geometry: [
          'abstract caduceus double-spiral curve',
          'pulsing concentric ring',
          'double helix line form',
        ],
        natural: [
          'laurel branch as micro-engraved border',
          'leaf vein pattern as background texture',
        ],
      },
      clarity: {
        planetary: ['Mercury (intellect, perception, light)', 'Sun (illumination, revealed truth)'],
        elemental: ['Air (clear sight, lucid thought)', 'Fire (light of revelation)'],
        geometry: [
          'central radiant point with rays',
          'octagram precision form',
          'diamond lattice grid',
        ],
        natural: ['crystal prism facet as border accent', 'single quartz point as corner motif'],
      },
      creativity: {
        planetary: ['Mercury (expression, craft, transmission)', 'Moon (imagination, intuition)'],
        elemental: ['Fire (inspiration, generative spark)', 'Air (ideas in motion)'],
        geometry: [
          'spiral unfurling from center outward',
          'pentagon golden-ratio form',
          'starburst ray pattern',
        ],
        natural: [
          'feather quill silhouette as filigree element',
          'seed-burst as background micro-pattern',
        ],
      },
      peace: {
        planetary: ['Moon (stillness, reflection, rest)', 'Neptune (dissolution, unity, flow)'],
        elemental: ['Water (calm depths, serenity)', 'Earth (restful ground, stability)'],
        geometry: [
          'enso open-circle brush form',
          'equal-armed cross balanced',
          'gentle concentric arcs',
        ],
        natural: ['still pond ripple as background texture', 'lotus outline as border accent'],
      },
      growth: {
        planetary: ['Jupiter (expansion, reaching upward)', 'Sun (photosynthesis, light-seeking)'],
        elemental: ['Earth (soil, root, nourishment)', 'Water (flow, sustaining life)'],
        geometry: [
          'logarithmic growth spiral',
          'branching fractal abstract line form',
          'ascending stepped form',
        ],
        natural: ['sprouting tendril as border filigree', 'seed pod as corner micro-engraving'],
      },
      protection: {
        planetary: ['Saturn (boundary, structure, containment)', 'Mars (guardian force, defense)'],
        elemental: ['Earth (fortress solidity)', 'Fire (warding, boundary flame)'],
        geometry: [
          'nested concentric squares',
          'hexagonal shield grid',
          'triquetra knot interlace',
        ],
        natural: [
          'thorn branch abstracted as border element',
          'nautilus shell spiral as protective curve',
        ],
      },
      power: {
        planetary: ['Mars (vital force, driving energy)', 'Sun (sovereign radiance, authority)'],
        elemental: ['Fire (transformative energy)', 'Lightning as elemental force (abstract line)'],
        geometry: [
          'bold solar cross radiating spokes',
          'apex triangle pointing upward',
          'radiating mandala spokes',
        ],
        natural: ['lightning-path abstract curve', 'storm arc as border element'],
      },
      success: {
        planetary: [
          'Sun (achievement, recognition, harvest)',
          'Jupiter (reward, elevation, bounty)',
        ],
        elemental: ['Fire (ambition, summit-seeking)', 'Air (ascent, rising)'],
        geometry: [
          'ascending stepped pyramid form',
          'apex triangle geometry',
          'crown as geometric ring form',
        ],
        natural: [
          'laurel ring as border filigree',
          'mountain apex as background silhouette element',
        ],
      },
      stability: {
        planetary: [
          'Saturn (foundation, endurance, structure)',
          'Earth correspondence (permanence)',
        ],
        elemental: ['Earth (bedrock, ground)', 'Water (still deep lake, unshaken depth)'],
        geometry: [
          'equal-armed cross',
          'four-square anchoring grid',
          'downward-pointing triangle (earth element)',
        ],
        natural: [
          'deep root system abstracted as lower border',
          'stacked stone silhouette as background',
        ],
      },
    };

    const KEYWORD_TO_THEME: Record<string, string> = {
      free: 'freedom',
      freedom: 'freedom',
      liberat: 'freedom',
      unbounded: 'freedom',
      financ: 'prosperity',
      wealth: 'prosperity',
      money: 'prosperity',
      rich: 'prosperity',
      abundant: 'prosperity',
      abundance: 'prosperity',
      prosperous: 'prosperity',
      prosper: 'prosperity',
      strong: 'strength',
      strength: 'strength',
      gym: 'strength',
      fitness: 'strength',
      workout: 'strength',
      muscle: 'strength',
      love: 'love',
      romance: 'love',
      relationship: 'love',
      connect: 'love',
      heart: 'love',
      health: 'health',
      heal: 'health',
      wellness: 'health',
      vitality: 'health',
      recover: 'health',
      clarity: 'clarity',
      focus: 'clarity',
      clear: 'clarity',
      mind: 'clarity',
      sharp: 'clarity',
      creat: 'creativity',
      inspir: 'creativity',
      express: 'creativity',
      peace: 'peace',
      calm: 'peace',
      sereni: 'peace',
      tranquil: 'peace',
      grow: 'growth',
      growth: 'growth',
      transform: 'growth',
      evolve: 'growth',
      blossom: 'growth',
      protect: 'protection',
      boundary: 'protection',
      safe: 'protection',
      guard: 'protection',
      power: 'power',
      energy: 'power',
      force: 'power',
      success: 'success',
      achieve: 'success',
      career: 'success',
      accomplish: 'success',
      stable: 'stability',
      stability: 'stability',
      ground: 'stability',
      foundation: 'stability',
      anchor: 'stability',
    };

    if (!intention || intention.trim() === '') {
      return `ARCHETYPAL MOTIFS (woven subtly into border and background — never as dominant icons):
• Saturn (structure, grounding) — etched as fine border geometry
• Equal-armed cross — as background etched pattern
• Earth element (deep roots, bedrock) — implied in texture and weight
Integration: motifs appear only in filigree, border, and background texture — never as central clipart.`;
    }

    const lowerIntent = intention.toLowerCase();
    const foundThemes: string[] = [];
    const keywords = Object.keys(KEYWORD_TO_THEME).sort((a, b) => b.length - a.length);
    for (const kw of keywords) {
      if (lowerIntent.includes(kw)) {
        const theme = KEYWORD_TO_THEME[kw];
        if (!foundThemes.includes(theme)) {
          foundThemes.push(theme);
          if (foundThemes.length >= 2) break;
        }
      }
    }
    if (foundThemes.length === 0) foundThemes.push('peace');

    const motifLines: string[] = [];
    for (let t = 0; t < foundThemes.length; t++) {
      const bundle = ARCHETYPE_BUNDLES[foundThemes[t]];
      if (!bundle) continue;
      motifLines.push(`• ${bundle.planetary[0]} — woven into border filigree`);
      motifLines.push(
        `• ${bundle.geometry[t % bundle.geometry.length]} — etched as background pattern`
      );
      if (t === 0) {
        motifLines.push(
          `• ${bundle.elemental[0]} — implied in overall texture and compositional flow`
        );
        motifLines.push(`• ${bundle.natural[0]} — as micro-engraved accent only, never dominant`);
      }
    }
    if (foundThemes.length > 1) {
      const b1 = ARCHETYPE_BUNDLES[foundThemes[1]];
      if (b1) motifLines.push(`• ${b1.natural[0]} — subtle corner accent only`);
    }

    logger.debug('[GeminiImageService] Archetype motifs selected', {
      intention,
      themes: foundThemes,
      motifCount: motifLines.length,
    });

    return `ARCHETYPAL MOTIFS — symbolicDistance=2 (Archetypal): imply the intention through indirect symbolism, never depict it literally.
Integrate the following motifs ONLY into border filigree, background texture, and negative space. Do not place any motif as a central icon or dominant element.
${motifLines.join('\n')}
Integration rules:
- Every motif must feel like it was engraved into the background or woven into the border ring
- No motif should resemble clipart, a pasted sticker, or a recognizable literal object
- Treat motifs as texture qualities and engraving directions, not as placed images`;
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
      logger.info(
        `[GeminiImageService] Generating variation ${variationIndex + 1} with ${modelConfig.modelId} (Imagen)`
      );

      const response = await this.client.models.generateImages({
        model: modelConfig.modelId,
        prompt: `${prompt}\n\nIMPORTANT: Preserve the exact geometric structure and lines of the sigil design. Do not distort or warp the core shapes.`,
        config: {
          // numberOfImages: SDK accepts this at runtime; type def gap in some versions
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          numberOfImages: 1,
          aspectRatio: '1:1',
          includeRaiReason: true,
        },
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
      const base64Data =
        typeof imageBytes === 'string' ? imageBytes : Buffer.from(imageBytes).toString('base64');

      return {
        base64: base64Data,
        seed: Math.floor(Math.random() * 1000000),
        variationIndex: variationIndex + 1,
      };
    } catch (error: unknown) {
      const geminiError = this.parseError(error);

      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.generateVariation(
          baseImageBuffer,
          prompt,
          variationIndex,
          modelConfig,
          retryCount + 1
        );
      }

      logger.error(
        `[GeminiImageService] Failed to generate variation ${variationIndex + 1}: ${geminiError.message}`
      );
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
      logger.info(
        `[GeminiImageService] Generating variation ${variationIndex + 1} with Nano Banana (${modelConfig.modelId})`
      );

      const base64Image = baseImageBuffer.toString('base64');

      const CALL_TIMEOUT_MS = 60000; // 60s per individual API call
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new GeminiError(
                GeminiErrorType.NETWORK_ERROR,
                'Gemini API call timed out after 60s',
                true
              )
            ),
          CALL_TIMEOUT_MS
        )
      );

      const response = await Promise.race([
        this.client.models.generateContent({
          model: modelConfig.modelId,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${prompt}

REFERENCE IMAGE INSTRUCTION: The attached image shows the sigil structure that must be preserved. Keep the main lines, circles, and geometric shapes EXACTLY as shown. Add symbolic enhancements AROUND and BEHIND the sigil, not by altering its core geometry.`,
                },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['IMAGE'],
            imageConfig: {
              aspectRatio: '1:1',
            },
          },
        }),
        timeoutPromise,
      ]);

      const imageData = response.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        ?.find((part) => typeof part.inlineData?.data === 'string')
        ?.inlineData?.data;

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
    } catch (error: unknown) {
      const geminiError = this.parseError(error);

      if (geminiError.retryable && retryCount < maxRetries) {
        const waitTime = geminiError.retryAfterMs || Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.generateVariationWithNanoBanana(
          baseImageBuffer,
          prompt,
          variationIndex,
          modelConfig,
          retryCount + 1
        );
      }

      logger.error(
        `[GeminiImageService] Nano Banana failed for variation ${variationIndex + 1}: ${geminiError.message}`
      );
      throw geminiError;
    }
  }

  private parseError(error: unknown): GeminiError {
    const err = error as { message?: string; toString?: () => string };
    const message = err?.message || err?.toString?.() || 'Unknown error';

    if (
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('429')
    ) {
      return new GeminiError(GeminiErrorType.RATE_LIMIT, 'Rate limit exceeded.', true, 5000);
    }
    if (message.includes('safety') || message.includes('blocked')) {
      return new GeminiError(
        GeminiErrorType.SAFETY_FILTER,
        'Content blocked by safety filter',
        false
      );
    }
    if (message.includes('API key') || message.includes('401') || message.includes('403')) {
      return new GeminiError(GeminiErrorType.INVALID_API_KEY, 'Invalid or missing API Key', false);
    }
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('ECONNREFUSED')
    ) {
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
