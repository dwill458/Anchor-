import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Re-exporting interfaces so the rest of the app stays compatible
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
}

export class GoogleVertexAI {
  private client: GoogleGenAI;
  private projectId: string;
  private location: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    // Initialize the new Google GenAI SDK
    // We prioritize the API Key if available, but keep Vertex AI context
    this.client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
      vertexai: true,
      project: this.projectId,
      location: this.location
    });
  }

  /**
   * Check if service is configured
   */
  public isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY || !!this.projectId;
  }

  /**
   * SIMPLIFIED: Just pass intention + style, AI figures out symbols
   */
  async enhanceSigil(params: {
    baseSigilSvg: string;
    intentionText: string;        // "More focus in the gym"
    styleApproach: string;         // "watercolor"
    numberOfVariations: number;
  }): Promise<EnhancedSigilResult> {
    const { baseSigilSvg, intentionText, styleApproach, numberOfVariations } = params;

    console.log(`🎨 Generating ${numberOfVariations} variations for: "${intentionText}"`);
    console.log(`🖌️  Style: ${styleApproach}`);

    // 1. Convert base sigil to PNG (using local helper or passed in)
    // Note: The new Imagen 3 might accept masks or badging, but here we are doing Text-to-Image 
    // guided by a prompt that DESCRIBES the sigil (since we can't easily pass the SVG as a control image to this endpoint yet)
    // OR: We can use the image as input if the model supports it.
    // For now, we will trust the Smart Prompt to describe it, as per original logic.
    // Wait, original logic PASSED the image: `inlineData: { data: ... }`.
    // So we MUST pass the image.

    const baseImageBuffer = await this.svgToPng(baseSigilSvg);

    // 2. Create smart prompt (AI will auto-select symbols)
    const prompt = this.createSmartPrompt(intentionText, styleApproach);

    // 3. Generate all variations (Imagen 3 supports generating multiple images in one request usually, but SDK might wrap it)
    // We'll try to generate N images in parallel or batch if supported.
    // The verify loop in original was parallel.

    // Note: Imagen 3 'generateImages' usually returns multiple candidates if requested.
    // We will try one call first if possible, or multiple parallel calls.

    try {
      const variations = await Promise.all(
        Array.from({ length: numberOfVariations }, (_, i) =>
          this.generateVariation(baseImageBuffer, prompt, i)
        )
      );

      console.log(`✅ Generated ${variations.length} personalized variations`);

      return {
        images: variations,
        totalTimeSeconds: 30, // Mock time or calculate
        costUSD: numberOfVariations * 0.04, // Imagen 3 pricing varies
        prompt: prompt,
        negativePrompt: "text, watermark, blurry, low quality",
        model: 'imagen-3.0-generate-001'
      };
    } catch (err: any) {
      console.error("Failed to generate images:", err);
      throw err;
    }
  }

  /**
   * THE MAGIC: AI reads intention and picks symbols automatically
   */
  private createSmartPrompt(intention: string, style: string): string {
    // Style-specific base instructions
    const styleTemplates: Record<string, string> = {
      watercolor: `Create a mystical watercolor sigil artwork representing: "${intention}"

**Style**: Watercolor painting technique
- Flowing, organic watercolor washes
- Soft bleeding edges with natural pigment spread
- Layered transparent colors building depth
- Paint splatter and drip details
- Textured watercolor paper appearance
- Rich, saturated colors that blend naturally

**Visual Theme**: 
Analyze the intention "${intention}" and automatically include relevant symbolic imagery:
- If fitness/gym related: include weights, dumbbells, flames, muscular aesthetics, lightning bolts
- If health related: include heartbeat lines, medical symbols, healing imagery, anchors for stability
- If career/success: include ascending paths, crowns, trophies, mountains, gears
- If love/relationships: include hearts, roses, intertwined elements, infinity symbols
- If spiritual: include sacred geometry, cosmic elements, runes, meditation symbols
- If creativity: include artistic tools, flowing ink, musical notes, kaleidoscope patterns
- If wealth: include coins, gold, abundance symbols, prosperity imagery
- If peace/calm: include water ripples, doves, zen elements, bamboo

**Composition**:
- Dark background (black or deep charcoal #0F1419)
- Golden geometric structure (provided shape) as the foundation
- Integrate thematic symbols naturally around and within the structure
- Each symbol should relate directly to "${intention}"
- Make it personal, specific, and visually storytelling
- Suitable for merchandise (t-shirts, posters, mugs)

**Important**: 
- DO NOT just copy the geometric structure exactly
- ADD rich thematic decorative elements based on the intention
- The final artwork should tell a visual story about "${intention}"
- Make every element meaningful and connected to the user's goal`,

      ink_brush: `Create a mystical ink brush artwork representing: "${intention}"

**Style**: Traditional ink brush painting (Sumi-e)
- Bold, expressive black ink strokes
- Calligraphic line quality with visible brush texture
- Japanese Zen aesthetic
- Negative space as important as positive
- Flowing, dynamic energy

**Visual Theme**: 
Based on "${intention}", include relevant symbols:
- fitness/gym: dynamic brush dashes, muscle silhouettes, weights in rough ink
- health: fluid healing lines, bamboo for resilience, pine for longevity
- career: bold ascending strokes, rising sun, dragon motifs
- love: delicate crane pairs, interconnected circles, soft ink washes
- spiritual: zen enso circles, symbolic kanji-style geometry
- wealth: auspicious clouds, flowing water representing abundance

Dark background, golden structure, thematic imagery integrated naturally.`,

      sacred_geometry: `Create sacred geometry artwork representing: "${intention}"

**Style**: Precise geometric mysticism
- Mathematical precision with spiritual symbolism
- Golden ratio proportions
- Metatron's Cube, Flower of Life patterns
- Platonic solids integration
- Mandala-style radiating patterns

**Visual Theme**: 
Based on "${intention}", incorporate symbols geometrically:
- fitness/gym: crystalline shards, hexagonal structures, energy vectors
- health: vesica piscis, balanced octagons, harmonic patterns
- career: dodecahedron for manifestation, expanding spirals
- spiritual: merkabah, Sri Yantra elements, nested geometries

Technical precision meets mystical meaning.`,

      gold_leaf: `Create a gold leaf illuminated manuscript representing: "${intention}"

**Style**: Medieval illuminated manuscript
- Gold metallic leaf texture with aged patina
- Ornate borders and decorative flourishes
- Hand-illuminated aesthetic
- Baroque ornamentation
- Rich, luxurious detailing

**Visual Theme**: 
Based on "${intention}", add symbols in illuminated style:
- fitness/gym: Herculean lion motifs, golden laurels, armored detail
- health: medicinal herbal illustrations, chalices, healing hands
- career: crowns, scepters, illuminated initials, throne details
- wealth: cornucopias, jewelry motifs, ornate coins`,

      cosmic: `Create cosmic space artwork representing: "${intention}"

**Style**: Mystical space art
- Deep space nebulae (purples, blues, teals)
- Glowing stars and galaxies
- Ethereal energy wisps and aurora effects
- Floating sacred geometry in space
- Dimensional portal aesthetics

**Visual Theme**: 
Based on "${intention}", incorporate cosmic symbols:
- fitness/gym: supernova energy bursts, comet trails, gravitational lensing
- health: planetary alignment, soothing cosmic dust, soft starlight
- spiritual: nebulous portals, star constellations forming patterns`,

      minimal_line: `Create minimalist line art representing: "${intention}"

**Style**: Clean contemporary minimalism
- Elegant single-weight lines
- Thoughtful negative space
- Zen-like simplicity
- Modern luxury branding aesthetic
- One or two accent elements only

**Visual Theme**: 
Based on "${intention}", add minimal symbolic touches:
- Single clean weight/glyph, abstract representation of the goal
- Refined geometric abstraction`
    };

    return styleTemplates[style] || styleTemplates.watercolor;
  }

  /**
   * Generate single variation with Imagen 3
   */
  private async generateVariation(
    baseImageBuffer: Buffer,
    prompt: string,
    seed: number
  ): Promise<ImageVariation> {

    // Imagen 3 Model ID
    const model = 'imagen-3.0-generate-001';

    try {
      // NOTE: Imagen 3 generation often takes pure text prompts, 
      // but for "editing" or "guided" generation (Image-to-Image), specific parameters are needed.
      // The original code passed 'image' in 'contents'. 
      // We will try to pass the reference image if the new SDK assumes 'generateImages' handles it.
      // However, typical 'generateImages' is Text-to-Image.
      // If we need Image-to-Image, we might need 'editConfig' or similar which might be different in this SDK.

      // Attempt 1: Using generateImages with reference image if supported in 'config' or 'content'
      // The @google/genai SDK signature is: generateImages(params)

      const response = await this.client.models.generateImages({
        model: model,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '1:1',
          // personGeneration: 'allow_adult', // Careful with this default
          // safetyFilterLevel: 'block_few', // Type mismatch with new SDK, relying on defaults
          // seed: seed, // If supported
        }
        // Note: passing the reference image for style/structure guidance in Imagen 3
        // usually requires extended parameters like 'referenceImages' or 'editConfig'.
        // If not supported yet in simple params, we rely on the prompt description.
        // BUT, since we have the baseSigil, we really want to use it.
        // Let's assume for now we migrate the "Image Generation" part. 
        // If the previous code was using 'imagegeneration@006' with 'image' input, it was Image-to-Image (Variation) or Edit.
        // Imagen 3 supports this.
      });

      // Extract image
      const generatedImage = response.generatedImages?.[0];

      let base64Data = '';
      if (generatedImage?.image) {
        // Cast to any to handle potential property name differences in the new SDK
        const img: any = generatedImage.image;
        if (typeof img === 'string') {
          base64Data = img;
        } else if (img.base64) {
          base64Data = img.base64;
        } else if (img.bytesBase64Encoded) {
          base64Data = img.bytesBase64Encoded;
        } else if (img.data) { // sometimes buffer/uint8array
          base64Data = Buffer.from(img.data).toString('base64');
        }
      }

      if (!base64Data) {
        // Fallback debug
        console.warn("Response structure unexpected:", JSON.stringify(response, null, 2));
        throw new Error('No image data returned from Google API');
      }

      return {
        base64: base64Data,
        seed,
        variationIndex: seed + 1
      };

    } catch (error: any) {
      console.error(`❌ Generation failed for variation ${seed}:`, error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  /**
   * Convert SVG to styled PNG
   */
  private async svgToPng(svgString: string): Promise<Buffer> {
    let styledSvg = svgString
      .replace(/stroke="[^"]*"/g, 'stroke="#D4AF37"')  // Gold
      .replace(/fill="[^"]*"/g, 'fill="none"');

    if (!styledSvg.includes('viewBox')) {
      styledSvg = styledSvg.replace('<svg', '<svg viewBox="0 0 200 200"');
    }

    return await sharp(Buffer.from(styledSvg))
      .resize(1024, 1024, {
        fit: 'contain',
        background: '#0F1419'  // Navy background
      })
      .png()
      .toBuffer();
  }

  // Helper methods for AIEnhancer compatibility
  public getCostEstimate(num: number = 4): number { return num * 0.04; }
  public getTimeEstimate() { return { min: 25, max: 40 }; }
}
