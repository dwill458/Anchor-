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

  public getCostEstimate(numVariations: number = 2, tier: QualityTier = 'premium'): number {
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

    // 2. Get model configuration
    const modelConfig = MODEL_CONFIGS[tier];
    const prompt = this.createPrompt(intentionText, styleApproach, 0);

    // 3. Generate variations in batches of 2 (paid plan — no free-tier rate limit concerns).
    //    Two concurrent calls per batch cuts wall-clock time roughly in half vs sequential.
    //    Each variation gets its own prompt with a distinct compositional stance so the
    //    2 outputs are guaranteed to diverge visually within the same style.
    const INTER_BATCH_DELAY_MS = 2500;
    const variations: ImageVariation[] = [];
    const BATCH_SIZE = 2;
    for (let i = 0; i < numberOfVariations; i += BATCH_SIZE) {
      const indices = Array.from(
        { length: Math.min(BATCH_SIZE, numberOfVariations - i) },
        (_, k) => i + k
      );
      const batch = await Promise.all(
        indices.map(idx =>
          this.generateVariation(
            baseImageBuffer,
            this.createPrompt(intentionText, styleApproach, idx),
            idx,
            modelConfig
          )
        )
      );
      variations.push(...batch);

      if (i + BATCH_SIZE < numberOfVariations) {
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY_MS));
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

  private createPrompt(intention: string, style: string, variationIndex: number = 0): string {
    const archetypeBlock = this.getArchetypeMotifs(intention);
    const uniquenessBlock = this.buildUniquenessBlock(intention, style, variationIndex);

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
STRICT AVOIDANCE RULES — KEEP THESE OUT OR STRONGLY DE-EMPHASIZED:
✗ Text, words, letters, phrases, sentences, or any readable characters whatsoever
✗ Numbers, numerals, digits, or numeric symbols of any kind
✗ Currency: dollar signs ($), pound (£), euro (€), yen (¥), coins, coin stacks, banknotes, bills, cash, wallets, credit cards
✗ Financial: bank logos, charts, graphs, bar charts, pie charts, stock tickers, financial instruments
✗ Recognizable brand logos, watermarks, copyright symbols
✗ Clipart, icon-pack, sticker-style, emoji-style, or flat app-icon aesthetics
✗ Photorealistic photography as the dominant rendering mode — keep the image illustrative, engraved, painterly, or atmospheric
✗ Recognizable human faces, portraits, or literal people as the main subject
✗ Overly literal object depictions directly illustrating the intention in a blunt or front-and-center way
✓ Symbolic motifs are allowed when they are abstracted, ornamental, secondary, and integrated into the border, background, texture field, or negative space
✓ Objects such as keys, locks, chains, animals, tools, or weapons may appear only as subtle symbolic accents, not as the dominant subject
NO WORDS. NO NUMBERS. NO LETTERS. NO CURRENCY. NO FINANCIAL IMAGERY.`;

    const styleTemplates: Record<string, string> = {
      architectural_trace: `${structuralCore}

STYLE: Architectural trace — precision drafting, measured geometry, blueprint discipline
- Crisp drafting lines and grid logic, like an illuminated technical plan
- Subtle crosshairs, compass arcs, and engineered symmetry
- Clean technical elegance with restrained contrast and no ornamental drift

${archetypeBlock}
${hardBans}`,

      minimal_line: `${structuralCore}

STYLE: Precision fine-line engraving — LIGHT LINES ON DARK
- Background: deep black, dark charcoal, or very dark navy — rich and dark
- ALL sigil lines and strokes in pure white, silver, or a soft luminous light tone that contrasts sharply against the dark background
- Single-weight crisp strokes only; no fills, no gradients, no color washes, no heavy shading
- Decorative border motifs drawn from the archetypal theme — rendered as delicate fine-line engravings, not strictly hairline; they may have subtle weight and presence
- Aesthetic: museum-quality dark-ground engraving plate — restrained, precise, minimal luxury

${archetypeBlock}
${hardBans}`,

      lunar_etch: `${structuralCore}

STYLE: Lunar etch — moonlit silver engraving, quiet radiance, nocturnal contrast
- Pale metallic highlights and crescent glints on the sigil geometry
- Dark ground with silver etching and soft celestial restraint
- Refined, almost ritualistic contrast with a quiet luminous edge

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

STYLE: Sacred geometry — rich multi-system layering, vibrant color depth, mathematical wonder
- Multiple sacred geometry systems are VISIBLE and present in the background: Flower of Life, Metatron's Cube, Sri Yantra, Vesica Piscis, golden spiral, Seed of Life, Platonic solid projections — layer at least 2–3 systems together
- These patterns have real presence and color — they are NOT a faint underlayer; they carry visual weight and depth
- Rich, varied color palette across the entire composition: deep indigo, electric violet, warm gold, dusty rose, teal, amber, celestial blue — multiple hues coexist in layered harmony
- Each geometric layer rendered in a distinct color or opacity to create visual depth and separation
- Background geometry never competes with or distorts the main sigil structure — it exists behind and around it

${archetypeBlock}
${hardBans}`,

      gold_leaf: `${structuralCore}

STYLE: Illuminated gold — free-form gilding, precious metal atmosphere, living luminance
- Gold is the ruling element: liquid gold, scattered gold dust, gilded halos, and luminous gold-wash bloom
- Background can be any moody dark tone that serves the gold — aged parchment, deep charcoal, warm black, misty indigo, velvety midnight, burnt umber — no prescribed palette
- Gold is not confined to the sigil lines: let it bloom outward as scattered leaf fragments, ambient particles, and glowing atmospheric haze
- No mandatory border style — any decoration must feel organic to the composition, never imposed or Gothic-by-default
- Aesthetic: precious, luminous, alive — gold as light source, not just surface finish

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

      resonance_rings: `${structuralCore}

STYLE: Resonance rings — concentric pulse circles, waveform halos, radiating energy
- Layered rings of resonance extending from the sigil center
- Gentle rhythmic wave patterns in the background only
- Energy expressed as circles, echoes, and subtle vibration, not literal effects

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

STYLE: Celestial grid — celestial cartography, observatory schematic, singular astral instrument
- Treat the piece like a one-of-one astronomical chart or navigational device, never a stock zodiac wheel
- Grid logic may be radial, orthographic, spiral, quadrant-based, offset, or sector-divided depending on the intention and compositional signature
- Constellation-like star nodes should attach selectively to meaningful sigil intersections, not uniformly to every point
- Rings, arcs, chart marks, and coordinate lines must feel intentionally authored; avoid a default perfect circle unless the uniqueness signature specifically calls for it
- Deep navy, smoked indigo, obsidian blue, or near-black ground with metallic linework in antique gold, pale brass, or silver

${archetypeBlock}
${hardBans}`,
    };

    const stanceVariants = [
      `
COMPOSITIONAL STANCE — VARIATION A (CENTRED):
- The sigil is a fixed centre of gravity; treat it as the still point of the composition
- All decorative motifs and atmospheric elements cluster inward toward the sigil
- Background texture is densest close to the sigil and fades toward the outer edge
- Border and peripheral space are open and restrained — energy lives at the core
- Overall feeling: contained, focused, complete — a mandala at rest`,
      `
COMPOSITIONAL STANCE — VARIATION B (ASYMMETRICAL):
- The sigil is still structurally centered, but the surrounding system is biased to one side, one quadrant, or one arc
- Let the background architecture feel discovered rather than perfectly mirrored
- Concentrate chart markings, stars, and atmospheric weight in one directional sweep
- Preserve a strong pocket of negative space to prevent the composition from becoming a uniform wheel
- Overall feeling: distinct, authored, slightly off-axis — a map with a destination`,
      `
COMPOSITIONAL STANCE — VARIATION C (EXPANSIVE):
- The sigil is a point of emanation; treat it as a source radiating outward
- Background elements and motifs push toward the outer margins and periphery
- Texture and energy are most intense at the edges, quieter near the sigil centre
- The sigil sits in open negative space; surrounding field carries the weight
- Overall feeling: expansive, reaching, dynamic — a signal sent into open space`,
      `
COMPOSITIONAL STANCE — VARIATION D (CROPPED / MONUMENTAL):
- Treat the celestial framework like a larger instrument that extends beyond the canvas crop
- Show only portions of rings, arcs, or measuring bands so the world feels bigger than the frame
- Let one structural overlay become monumental while staying behind the sigil
- Use bold scale contrast: tiny star points against large chart geometry
- Overall feeling: monumental, cinematic, archival — a fragment of a much larger map`,
    ];
    const stanceBlock = stanceVariants[variationIndex % stanceVariants.length];

    const baseTemplate = styleTemplates[style] || styleTemplates.watercolor;
    return `${baseTemplate}
${uniquenessBlock}
${stanceBlock}`;
  }

  private buildUniquenessBlock(intention: string, style: string, variationIndex: number): string {
    const normalizedIntention = intention.trim().toLowerCase() || 'default';
    const fingerprint = `${style}::${normalizedIntention}::${variationIndex}`;
    const pick = (options: string[], salt: string): string => {
      const index = this.hashString(`${fingerprint}::${salt}`) % options.length;
      return options[index];
    };

    const globalCompositionAxes = {
      density: [
        'sparse and breathable, with only a few deliberate secondary marks',
        'moderately layered, with visible depth but clear hierarchy',
        'richly layered, with many subtle supporting marks that never overpower the sigil',
      ],
      focus: [
        'one dominant halo or zone of emphasis',
        'two unequal focal zones in visual tension',
        'a directional path that guides the eye through the image',
      ],
      ornament: [
        'micro-engraved border accents only',
        'ornament concentrated in one quadrant',
        'ornament dissolved into atmospheric texture instead of a hard border',
      ],
    };

    const density = pick(globalCompositionAxes.density, 'density');
    const focus = pick(globalCompositionAxes.focus, 'focus');
    const ornament = pick(globalCompositionAxes.ornament, 'ornament');

    if (style === 'celestial_grid') {
      const topology = pick(
        [
          'a polar astrolabe mesh with offset rings and latitude arcs',
          'an orthographic observatory chart with measured vertical and horizontal sectors',
          'a diagonal navigation lattice with slanted coordinate rails',
          'a spiral ephemeris map with widening orbital intervals',
          'a quadrant-based star atlas with broken perimeter arcs',
          'an eclipse-tracking field with overlapping elliptical orbit bands',
        ],
        'topology'
      );
      const frame = pick(
        [
          'a full chart circle with one interrupted outer ring',
          'a cropped upper-hemisphere chart that extends beyond the canvas edge',
          'an off-center observatory disc with a heavier lower quadrant',
          'stacked measuring bands and partial arcs instead of a single border ring',
          'a split-field composition with one major arc and one minor counter-arc',
        ],
        'frame'
      );
      const nodeBehavior = pick(
        [
          'few bright anchor stars connected by restrained line segments',
          'uneven star-node clusters that gather around only 2-3 structural intersections',
          'tiny dispersed star pins with one brighter guiding node',
          'constellation links that appear only along one directional sweep of the sigil',
          'paired star clusters with a deliberate empty region elsewhere',
        ],
        'nodes'
      );
      const metal = pick(
        [
          'antique gold over midnight blue',
          'pale brass over smoked navy',
          'silver-white linework over obsidian indigo',
          'aged champagne gold over near-black ultramarine',
        ],
        'metal'
      );
      const atmosphere = pick(
        [
          'quiet observatory dust and faint parchment haze',
          'cold nocturnal depth with restrained star bloom',
          'subtle eclipse-shadow gradients and dark-vignette restraint',
          'thin veils of cosmic mist behind the chart lines only',
        ],
        'atmosphere'
      );

      return `
UNIQUENESS MANDATE:
- This anchor must feel singular and non-repeatable, as if it belongs to one specific person and one specific celestial instrument
- Do NOT fall back to a generic centered zodiac wheel, uniform radial chart, or identical navy-and-gold circle used in prior anchors
- The intention and archetypal motifs must reshape the chart architecture itself, not merely decorate a standard background
- At least 3 visibly distinct differentiators must be present across grid topology, framing, star-node behavior, metallic treatment, and atmospheric field

CELESTIAL SIGNATURE FOR THIS RENDER:
- Grid topology: ${topology}
- Framing system: ${frame}
- Star-node behavior: ${nodeBehavior}
- Metallic treatment: ${metal}
- Atmospheric field: ${atmosphere}
- Density: ${density}
- Focal behavior: ${focus}`;
    }

    if (style === 'cosmic') {
      return `
UNIQUENESS MANDATE:
- Avoid making this a generic nebula poster with the sigil floating in the middle
- The sigil must interact with a specific cosmic event, field, or energy behavior shaped by the intention
- Ensure visible differentiation through at least 3 axes: nebula structure, light source, motion pattern, color temperature, and framing

COSMIC SIGNATURE FOR THIS RENDER:
- Nebula behavior: ${pick(
          [
            'spiraling around the sigil like a tidal galaxy',
            'splitting diagonally across the frame in opposing currents',
            'forming a quiet halo with distant bursts at the perimeter',
            'streaming behind the sigil as a comet-like wake',
          ],
          'nebula'
        )}
- Light source: ${pick(
          [
            'core radiance emerging from one sigil intersection',
            'backlit starlight flaring from behind the lower plane',
            'side-lit cosmic glow with one bright diagonal beam',
            'diffused auric bloom distributed across the surrounding field',
          ],
          'light'
        )}
- Color temperature: ${pick(
          [
            'cool blue-violet with amber accents',
            'midnight teal with pale gold heat',
            'indigo-black with electric cyan veins',
            'deep ultramarine with warm ember clouds',
          ],
          'color'
        )}
- Framing: ${pick(
          [
            'wide open negative space around the sigil',
            'one cropped orbital ring intersecting the frame',
            'an off-axis triangular energy field behind the sigil',
            'a layered deep-space field that pulls outward toward the edges',
          ],
          'frame'
        )}
- Density: ${density}
- Focal behavior: ${focus}`;
    }

    if (style === 'architectural_trace') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic blueprint plate or default centered drafting diagram
- The intention must influence the architecture of the measuring system, not just the symbol floating above it
- Differentiate this render through plan geometry, measurement language, paper atmosphere, and focal weighting

ARCHITECTURAL SIGNATURE FOR THIS RENDER:
- Drafting framework: ${pick(
          [
            'offset plan-view construction lines with one dominant axis',
            'compass-drawn arc system intersecting a restrained orthographic grid',
            'section-cut geometry with stacked horizontal datum lines',
            'survey-style guide rails with diagonal calibration marks',
          ],
          'framework'
        )}
- Measurement language: ${pick(
          [
            'crosshairs and indexing ticks concentrated near one quadrant',
            'broken radius marks and partial circles instead of a full instrument ring',
            'fine annotation-like indicators with no readable text',
            'elevation-style reference bands fading toward the margins',
          ],
          'measure'
        )}
- Surface atmosphere: ${pick(
          [
            'cool vellum glow over deep slate',
            'aged blueprint indigo with pale chalk lines',
            'smoked parchment with silver-white drafting strokes',
            'charcoal drafting board with quiet metallic highlights',
          ],
          'surface'
        )}
- Ornament placement: ${ornament}
- Density: ${density}`;
    }

    if (style === 'minimal_line') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic app-icon line drawing or a repetitive thin-outline treatment
- The restraint itself must feel intentional and individualized
- Differentiate this render through stroke hierarchy, negative space, contrast behavior, and edge emphasis

MINIMAL LINE SIGNATURE FOR THIS RENDER:
- Stroke behavior: ${pick(
          [
            'one continuous engraving logic with only a few decisive breaks',
            'slightly varied line weight at structural pivots only',
            'ultra-clean monoline with one emphasized terminal stroke',
            'hairline precision anchored by a single heavier axis',
          ],
          'stroke'
        )}
- Negative-space strategy: ${pick(
          [
            'broad open margins around the sigil',
            'one side intentionally quieter than the other',
            'a central pool of darkness with peripheral fine marks only',
            'tight crop near one edge with otherwise open surrounding space',
          ],
          'space'
        )}
- Contrast field: ${pick(
          [
            'bright silver-white strokes over velvet black',
            'soft moon-white lines over dark graphite',
            'cold platinum lines over near-black navy',
            'chalk-light lines over smoked charcoal',
          ],
          'contrast'
        )}
- Focal behavior: ${focus}
- Ornament placement: ${ornament}`;
    }

    if (style === 'lunar_etch') {
      return `
UNIQUENESS MANDATE:
- Avoid a default moon-glyph sticker treatment or a flat silver-on-black repeat
- The moonlit character should feel specific to this intention and composition
- Differentiate this render through lunar phase language, metallic bloom, darkness handling, and halo placement

LUNAR SIGNATURE FOR THIS RENDER:
- Lunar phase behavior: ${pick(
          [
            'crescent glints concentrated along one arc of the sigil',
            'a quiet gibbous halo implied behind the upper structure',
            'phase fragments distributed as micro-etchings near the border only',
            'an eclipse-like shadow bite shaping the surrounding atmosphere',
          ],
          'phase'
        )}
- Metallic bloom: ${pick(
          [
            'cool silver with faint blue iridescence',
            'pewter-white engraving with sharp moonlit edges',
            'platinum highlights with soft mercury sheen',
            'frosted silver radiance against matte darkness',
          ],
          'metal'
        )}
- Darkness treatment: ${pick(
          [
            'deep black void with one pocket of mist',
            'charcoal night field with subtle vignette falloff',
            'inky navy shadow with restrained reflective dust',
            'velvet midnight with selective silver haze',
          ],
          'darkness'
        )}
- Density: ${density}
- Focal behavior: ${focus}`;
    }

    if (style === 'watercolor') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic pastel wash behind a centered sigil
- The pigment behavior should feel authored and tied to the intention
- Differentiate this render through wash direction, edge bloom, paper tone, and palette structure

WATERCOLOR SIGNATURE FOR THIS RENDER:
- Wash movement: ${pick(
          [
            'diagonal washes flowing across the frame',
            'a pooled bloom concentrated beneath the sigil',
            'soft circular diffusion radiating outward in uneven tides',
            'layered translucent bands moving from one edge toward the center',
          ],
          'wash'
        )}
- Edge behavior: ${pick(
          [
            'feathered pigment blooms at outer edges only',
            'dry-brush breaks around one side of the sigil',
            'soft tide lines with restrained granulation',
            'selective backruns creating organic depth away from the main strokes',
          ],
          'edge'
        )}
- Paper atmosphere: ${pick(
          [
            'warm cotton paper grain',
            'cool pressed paper texture',
            'ivory deckled-paper mood',
            'weathered watercolor sheet with subtle tooth',
          ],
          'paper'
        )}
- Palette logic: ${pick(
          [
            'two dominant jewel tones with one accent color',
            'muted nocturne palette with one bright bloom',
            'earth-and-water pairing with restrained gold hints',
            'cool spectrum with a single warm counterpoint',
          ],
          'palette'
        )}
- Density: ${density}`;
    }

    if (style === 'ink_brush') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic zen brush stamp or repetitive black-on-white symbol plate
- The brushwork must feel like a singular hand and breath pattern
- Differentiate this render through brush pressure, ink spread, paper emptiness, and directional motion

INK BRUSH SIGNATURE FOR THIS RENDER:
- Brush pressure: ${pick(
          [
            'heavy opening pressure tapering to fine exits',
            'dry-brush friction around select structural corners',
            'quiet, even pressure with one forceful accent stroke nearby',
            'bold saturated marks contrasted with ghosted peripheral traces',
          ],
          'pressure'
        )}
- Ink atmosphere: ${pick(
          [
            'dense sumi pools near the lower plane',
            'mist-like diluted ink drifting away from the form',
            'controlled feathering at one directional edge',
            'splintered dry texture in the outer field only',
          ],
          'ink'
        )}
- Empty-space strategy: ${pick(
          [
            'large untouched paper field above the sigil',
            'negative space opening on one side like a breath pause',
            'compressed lower composition with open upper air',
            'balanced void encircling the central structure',
          ],
          'void'
        )}
- Directional motion: ${focus}
- Ornament placement: ${ornament}`;
    }

    if (style === 'sacred_geometry') {
      return `
UNIQUENESS MANDATE:
- Avoid a stock flower-of-life poster or a single repeated geometry overlay
- This render must combine geometry systems in a way that feels specific to the sigil and intention
- Differentiate this render through system pairing, scale hierarchy, color coding, and spatial layering

SACRED GEOMETRY SIGNATURE FOR THIS RENDER:
- Primary geometry pairing: ${pick(
          [
            'Flower of Life with one dominant golden spiral',
            'Metatron-inspired lattice with Vesica intersections',
            'Sri Yantra depth field with concentric orbit geometry',
            'Seed-of-Life foundation with angular Platonic projections',
          ],
          'pairing'
        )}
- Scale hierarchy: ${pick(
          [
            'one monumental geometry system with smaller subordinate echoes',
            'foreground geometry tight around the sigil and larger forms beyond it',
            'layered small-to-large transitions from center to edge',
            'two competing geometry scales held in deliberate tension',
          ],
          'scale'
        )}
- Color separation: ${pick(
          [
            'indigo, amber, and teal as distinct layer families',
            'violet and gold dominance with cool blue separators',
            'dusty rose against deep cyan and muted brass',
            'multicolor jewel-tone bands with one neutral structural layer',
          ],
          'color'
        )}
- Spatial layering: ${pick(
          [
            'transparent overlaps with visible depth stacking',
            'one geometry system faded into the far background',
            'interleaved opacities creating a prismatic field',
            'a dense core with cleaner outer geometry bands',
          ],
          'layer'
        )}
- Density: ${density}`;
    }

    if (style === 'gold_leaf') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic gold sigil on black with uniform sparkle
- The gilding must feel materially distinct and compositionally specific
- Differentiate this render through gold texture, spread pattern, substrate, and glow behavior

GOLD LEAF SIGNATURE FOR THIS RENDER:
- Gold texture: ${pick(
          [
            'cracked antique leaf with irregular seams',
            'liquid gold bloom with soft pooled edges',
            'scattered leaf fragments with sharp reflective shards',
            'burnished matte gold interrupted by bright polished flashes',
          ],
          'gold'
        )}
- Spread pattern: ${pick(
          [
            'gold concentrated near the sigil with sparse outer dust',
            'one sweeping gilded plume crossing the field',
            'fragment trails leading toward one quadrant',
            'halo-like bloom behind the structure with minimal edge fallout',
          ],
          'spread'
        )}
- Substrate: ${pick(
          [
            'aged parchment umber',
            'velvet midnight indigo',
            'warm black mineral ground',
            'smoked charcoal with subtle paper fiber',
          ],
          'substrate'
        )}
- Glow behavior: ${pick(
          [
            'quiet inner radiance',
            'selective bright flares on a few edges only',
            'ambient metallic haze diffused outward',
            'one dominant luminous band with restrained surrounding shimmer',
          ],
          'glow'
        )}
- Focal behavior: ${focus}`;
    }

    if (style === 'obsidian_mono') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic black-glass sigil centered on a flat dark field
- The monochrome restraint should still produce clear individuality
- Differentiate this render through glass behavior, reflection placement, darkness depth, and contrast geometry

OBSIDIAN SIGNATURE FOR THIS RENDER:
- Glass behavior: ${pick(
          [
            'deep glossy obsidian with one controlled reflective plane',
            'matte-black volcanic glass with sparse specular edges',
            'smoked mirror texture with softened reflections',
            'fractured glass sheen implied in the outer field only',
          ],
          'glass'
        )}
- Reflection placement: ${pick(
          [
            'one diagonal reflection crossing behind the sigil',
            'low horizontal gleam near the base',
            'small peripheral glints with a dark untouched center',
            'upper-corner reflections fading into black',
          ],
          'reflection'
        )}
- Darkness depth: ${pick(
          [
            'layered charcoal-to-black gradients',
            'near-total black with one subtle smoky pocket',
            'cool obsidian depth with faint indigo undertones',
            'black-on-black separation through texture rather than color',
          ],
          'darkness'
        )}
- Contrast geometry: ${focus}
- Ornament placement: ${ornament}`;
    }

    if (style === 'aurora_glow') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic rainbow aurora behind a static centered sigil
- The aurora must have a distinctive atmospheric motion and anchoring logic
- Differentiate this render through curtain direction, hue dominance, light diffusion, and horizon feel

AURORA SIGNATURE FOR THIS RENDER:
- Curtain movement: ${pick(
          [
            'vertical light curtains bending around one side of the sigil',
            'diagonal aurora sweep crossing the full frame',
            'arched polar glow gathering above the sigil',
            'split-stream aurora currents moving in opposite directions',
          ],
          'curtain'
        )}
- Hue dominance: ${pick(
          [
            'green-violet dominance with blue restraint',
            'icy cyan and indigo with a subtle magenta countertone',
            'blue-green glow with rare gold spill',
            'violet-heavy aurora with cold white highlights',
          ],
          'hue'
        )}
- Light diffusion: ${pick(
          [
            'soft atmospheric veils',
            'sharper luminous ribbons at one edge only',
            'fog-like color bloom across the outer field',
            'layered translucent curtains with visible separation',
          ],
          'diffusion'
        )}
- Horizon handling: ${pick(
          [
            'no visible horizon, only sky depth',
            'a low dark grounding band beneath the form',
            'subtle eclipse-like base shadow',
            'one peripheral darkness shelf anchoring the color',
          ],
          'horizon'
        )}
- Density: ${density}`;
    }

    if (style === 'ember_trace') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic orange glow effect on a black sigil
- The heat signature must feel materially specific and intention-shaped
- Differentiate this render through heat distribution, cooling pattern, spark field, and forge atmosphere

EMBER SIGNATURE FOR THIS RENDER:
- Heat distribution: ${pick(
          [
            'brightest heat concentrated at a few intersections only',
            'one directional heat gradient running across the sigil',
            'inner-core heat with cooler outer traces',
            'edge-glow intensifying along one lower segment',
          ],
          'heat'
        )}
- Cooling pattern: ${pick(
          [
            'rapid blackened cooling around the brightest edges',
            'deep iron tones fading into ember orange',
            'smoky ash halos around hot points',
            'charred matte field with tiny residual heat veins',
          ],
          'cooling'
        )}
- Spark field: ${pick(
          [
            'few drifting sparks near one quadrant',
            'forge dust suspended close to the structure',
            'scattered cinder trails leading outward',
            'minimal spark activity with one bright particulate cluster',
          ],
          'sparks'
        )}
- Forge atmosphere: ${pick(
          [
            'smoky crucible darkness',
            'clean black void with radiant heat shimmer',
            'industrial soot haze held behind the sigil',
            'volcanic darkness with faint metallic residue',
          ],
          'forge'
        )}
- Focal behavior: ${focus}`;
    }

    if (style === 'resonance_rings') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic sonar-circle template repeating behind every sigil
- The resonance field must express a specific pulse logic for this intention
- Differentiate this render through ring spacing, wave clarity, pulse origin, and luminosity pattern

RESONANCE SIGNATURE FOR THIS RENDER:
- Ring spacing: ${pick(
          [
            'tight inner rings opening into wider outer intervals',
            'irregular pulse gaps suggesting changing intensity',
            'few monumental rings with small harmonic echoes',
            'layered micro-rings near one focal zone and broader rings elsewhere',
          ],
          'spacing'
        )}
- Wave clarity: ${pick(
          [
            'crisp concentric circles with soft peripheral fade',
            'slightly blurred echoes around a sharp core',
            'thin luminous lines with intermittent breaks',
            'transparent layered rings building depth rather than brightness',
          ],
          'clarity'
        )}
- Pulse origin: ${pick(
          [
            'centered on one sigil intersection',
            'slightly offset from center for directional tension',
            'emerging from beneath the lower half of the sigil',
            'distributed across two unequal resonance nodes',
          ],
          'origin'
        )}
- Luminosity pattern: ${pick(
          [
            'silver-white pulses on deep black',
            'soft blue resonance with pale violet traces',
            'amber-white echo lines over charcoal',
            'cool monochrome with one brighter inner ring',
          ],
          'light'
        )}
- Density: ${density}`;
    }

    if (style === 'echo_chamber') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic ripple wallpaper behind the sigil
- The echo field must feel like a distinct chamber with unique acoustic behavior
- Differentiate this render through ripple distortion, chamber depth, fade pattern, and tonal restraint

ECHO SIGNATURE FOR THIS RENDER:
- Ripple distortion: ${pick(
          [
            'clean ripples bending around one side of the sigil',
            'slightly elliptical echoes rather than perfect circles',
            'compressed lower ripples with open upper air',
            'directional ripple shear moving toward one edge',
          ],
          'ripple'
        )}
- Chamber depth: ${pick(
          [
            'near-field echoes with a dark distant background',
            'stacked translucent rings fading into a shallow void',
            'deep chamber darkness with only a few visible echo planes',
            'misty layered space suggesting sound traveling through fog',
          ],
          'depth'
        )}
- Fade pattern: ${pick(
          [
            'quick falloff after the first few rings',
            'slow long-tail resonance to the margins',
            'broken fade with quiet pockets of silence',
            'one side fading faster than the other',
          ],
          'fade'
        )}
- Tonal restraint: ${pick(
          [
            'near-monochrome graphite and white',
            'cold silver-blue with minimal variance',
            'smoked charcoal with pale pearl lines',
            'black-and-bone contrast with subdued glow',
          ],
          'tone'
        )}
- Focal behavior: ${focus}`;
    }

    if (style === 'monolith_ink') {
      return `
UNIQUENESS MANDATE:
- Avoid a generic heavy black sigil stamped onto a blank surface
- The mass and permanence should feel singular, not repetitive
- Differentiate this render through monument scale, material feel, shadow mass, and surrounding emptiness

MONOLITH SIGNATURE FOR THIS RENDER:
- Monument scale: ${pick(
          [
            'the sigil feels carved into a towering slab beyond the frame',
            'a compact but extremely weighty central monument',
            'one oversized structural plane dominating the composition',
            'stacked stone-like mass implied behind the preserved linework',
          ],
          'scale'
        )}
- Material feel: ${pick(
          [
            'dry volcanic stone',
            'ink-black basalt with faint chisel grain',
            'matte mineral surface with subtle dust',
            'blackened concrete monolith with quiet texture',
          ],
          'material'
        )}
- Shadow mass: ${pick(
          [
            'a deep shadow shelf beneath the form',
            'broad side-shadow weighting one edge',
            'near-total darkness swallowing the outer field',
            'layered matte blacks separated by faint ambient lift',
          ],
          'shadow'
        )}
- Empty-space strategy: ${pick(
          [
            'vast negative space around the monument',
            'tight crop against one margin with open opposite space',
            'low composition with towering emptiness above',
            'symmetrical stillness with a dark breathing border',
          ],
          'space'
        )}
- Density: ${density}`;
    }

    return `
UNIQUENESS MANDATE:
- This anchor must avoid looking like a template reuse of other ${style} renders
- The intention should alter composition, emphasis, and secondary motifs, not just the caption or a minor accent
- Differentiate this render through density, focal behavior, and ornament placement

COMPOSITION SIGNATURE:
- Density: ${density}
- Focal behavior: ${focus}
- Ornament placement: ${ornament}`;
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
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
        ?.flatMap(candidate => candidate.content?.parts ?? [])
        ?.find(part => typeof part.inlineData?.data === 'string')?.inlineData?.data;

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
