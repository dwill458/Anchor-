/**
 * Google Vertex AI Service - Imagen 3 Integration (Smart Logic)
 * 
 * This version uses AI to automatically select symbols based on the user's intention.
 */

import { VertexAI } from '@google-cloud/vertexai';
import sharp from 'sharp';

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
  private vertexAI: any;
  private projectId: string;
  private location: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

    // Parse credentials if available, otherwise fallback to empty for ADC
    const credsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
    const credentials = credsJson && credsJson.trim() !== '' ? JSON.parse(credsJson) : undefined;

    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
      googleAuthOptions: credentials ? { credentials } : undefined
    });
  }

  /**
   * Check if service is configured
   */
  public isAvailable(): boolean {
    return !!this.projectId;
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

    // 1. Convert base sigil to PNG
    const baseImageBuffer = await this.svgToPng(baseSigilSvg);

    // 2. Create smart prompt (AI will auto-select symbols)
    const prompt = this.createSmartPrompt(intentionText, styleApproach);

    // 3. Generate all variations in parallel
    const variations = await Promise.all(
      Array.from({ length: numberOfVariations }, (_, i) =>
        this.generateVariation(baseImageBuffer, prompt, i)
      )
    );

    console.log(`✅ Generated ${variations.length} personalized variations`);

    return {
      images: variations,
      totalTimeSeconds: 30,
      costUSD: numberOfVariations * 0.02,
      prompt: prompt,
      negativePrompt: "text, watermark, blurry, low quality",
      model: 'imagegeneration@006'
    };
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
- If fitness/gym related: include weights, dumbbells, flames, muscle anatomy, lightning bolts
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

    const model = this.vertexAI.preview.getGenerativeModel({
      model: 'imagegeneration@006',
    });

    const request = {
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: baseImageBuffer.toString('base64')
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        temperature: 0.9,      // High creativity for unique variations
        topK: 40,
        topP: 0.95,
        candidateCount: 1,
      }
    };

    try {
      const result = await model.generateContent(request);
      const imageData = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!imageData) {
        throw new Error('No image data returned from Google API');
      }

      return {
        base64: imageData,
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
  public getCostEstimate(num: number = 4): number { return num * 0.02; }
  public getTimeEstimate() { return { min: 25, max: 40 }; }
}
