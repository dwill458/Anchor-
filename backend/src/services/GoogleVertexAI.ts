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

    let credentials;

    // 1. Try environment variable JSON (explicit override)
    const credsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
    if (credsJson && credsJson.trim() !== '') {
      try {
        credentials = JSON.parse(credsJson);
      } catch (error: any) {
        console.warn('⚠️ GOOGLE_CLOUD_CREDENTIALS_JSON is set but invalid JSON. Ignoring.', error.message);
      }
    }

    // 2. Try local file (service-account.json) - Easier for local dev
    if (!credentials) {
      if (typeof process !== 'undefined' && process.cwd) {
        const fs = require('fs');
        const path = require('path');
        const keyFilePath = path.join(process.cwd(), 'service-account.json');

        if (fs.existsSync(keyFilePath)) {
          try {
            const keyFileContent = fs.readFileSync(keyFilePath, 'utf-8');
            credentials = JSON.parse(keyFileContent);
            console.log('✅ Loaded Google Cloud credentials from service-account.json');
          } catch (error: any) {
            console.error('❌ Found service-account.json but failed to parse it:', error.message);
          }
        }
      }
    }

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
      model: 'imagen-3.0-generate-001'
    };
  }

  /**
   * THE WINNING PROMPT - Based on your successful Gemini test
   */
  /**
   * THE FORCEFUL PROMPT - Designed to force style transfer
   */
  private createSmartPrompt(intention: string, style: string): string {
    const styleInstructions: Record<string, string> = {
      watercolor: 'Make this look like a watercolor painting. Use soft, translucent washes of color with bleeding edges. Add paint splatter and paper texture. The lines should look like painted brushstrokes, not digital lines.',
      ink_brush: 'Make this look like a traditional Japanese Sumi-e ink painting. Use bold, expressive black ink strokes with visible bristle texture. Add ink splatters and rice paper texture.',
      sacred_geometry: 'Make this look like a glowing sacred geometry diagram. The lines should be made of thin, precise light beams. Add a subtle hexagonal grid background and lens flare effects.',
      gold_leaf: 'Make this look like a medieval illuminated manuscript. The lines should be raised gold leaf with a metallic shine and aged patina. Add ornate filigree details around the edges.',
      cosmic: 'Make this look like a nebula in deep space. The lines should be made of stardust and glowing gas. Add stars and lens flares in the background.',
      minimal_line: 'Make this look like a high-end luxury brand logo. Use ultra-thin, precise lines in matte black or gold. Keep it extremely clean and minimal with plenty of negative space.'
    };

    const coreInstruction = styleInstructions[style] || styleInstructions.watercolor;

    return `${coreInstruction} 
    
    IMPORTANT:
    - This is a magical sigil representing "${intention}".
    - Completely transform the texture and material of the image.
    - Do NOT just copy the input image. Evolve it into a piece of art.
    - Keep the general shape of the symbol, but make it look fully hand-crafted in the requested style.`;
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
      model: 'imagen-3.0-generate-001',
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
