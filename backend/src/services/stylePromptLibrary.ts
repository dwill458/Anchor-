import { AI_STYLE_IDS, type AIStyle } from '../types';

export const VALID_AI_STYLES = AI_STYLE_IDS;
export type { AIStyle };

export type StyleCollection = 'core' | 'featured' | 'seasonal';

export type CompositionFamily =
  | 'CENTRED AXIS'
  | 'OFFSET FIELD'
  | 'DIRECTIONAL FLOW'
  | 'LOWER-ANCHORED'
  | 'DIAGONAL TENSION'
  | 'OPEN VOID';

export type VisualCategory =
  | 'Geometric'
  | 'Precision'
  | 'Luminous'
  | 'Organic'
  | 'Minimal'
  | 'Material';

export interface StylePromptDefinition {
  id: AIStyle;
  displayName: string;
  styleFamily: string;
  category: VisualCategory;
  collection: StyleCollection;
  description: string;
  paletteLane: string;
  compositionFamily: CompositionFamily;
  materialBehavior: string;
  styleNativeMotif: string;
  defaultDensity: 'sparse' | 'moderate' | 'rich';
  promptStyleBlock: string;
  negativePrompt: string;
  accentMotifs: string[];
}

interface IntentionSignal {
  theme: string;
  directionalBehavior: string;
  densityBehavior: string;
  focalBehavior: string;
  paletteBehavior: string;
  rhythmBehavior: string;
  motif: string;
}

export const GLOBAL_NEGATIVE_PROMPT =
  'text, words, letters, phrases, captions, numbers, numerals, readable characters, runes, fake writing, inscriptions, labels, currency symbols, dollar sign, coins, cash, banknotes, bank logos, charts, graphs, stock ticker, brand logos, watermark, copyright mark, clipart, sticker, icon pack, emoji, flat app icon, photorealistic human face, human figure, portrait, hands, literal scene, literal object illustration, distorted geometry, altered structure, altered shape, warped lines, broken geometry, melted lines, blurry, muddy, low quality, random artifacts, overcrowded ornament, altar, candle wax, fantasy clutter, religious iconography';

const STYLE_EXTRA_NEGATIVES: Partial<Record<AIStyle, string>> = {
  ink_brush: 'calligraphy letters, readable brush marks, decorative script',
  sacred_geometry: 'stock mandala poster, generic occult chart, overpowering mandala',
  prism_veil: 'neon rainbow effect, cheap holographic sticker, plastic iridescence',
  celestial_grid: 'zodiac signs, horoscope wheel, readable chart labels, astrology glyphs',
  architectural_trace: 'readable annotations, blueprint labels, technical numbers',
  resonance_rings: 'sonar UI, target reticle, radar screen',
};

export const STYLE_PROMPT_LIBRARY: Record<AIStyle, StylePromptDefinition> = {
  architectural_trace: {
    id: 'architectural_trace',
    displayName: 'Architectural Trace',
    styleFamily: 'Precision / Structural',
    category: 'Geometric',
    collection: 'core',
    description: 'Precision drafting, measured geometry, schematic blueprint discipline.',
    paletteLane: 'smoked slate, silver-white, faint cyan, graphite',
    compositionFamily: 'CENTRED AXIS',
    materialBehavior: 'precision drafting ink, schematic grid logic, silver calibration ticks',
    styleNativeMotif:
      'machined calibration ticks, non-readable datum marks, and measured guide rails',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Precision drafting discipline and measured schematic logic. The anchor geometry remains crisp and untouched while calibration ticks, graphite guide rails, faint cyan grid guides, and silver-white drafting strokes form a restrained technical atmosphere. Avoid readable annotations, numbers, labels, or any diagram language that could be interpreted as text.',
    negativePrompt: getStyleNegativePrompt('architectural_trace'),
    accentMotifs: [
      'partial orthographic guide rails fading before they reach the geometry',
      'tiny non-readable calibration ticks near the margins',
      'soft graphite datum lines dissolved into smoked slate',
    ],
  },
  lunar_etch: {
    id: 'lunar_etch',
    displayName: 'Lunar Etch',
    styleFamily: 'Material / Precision',
    category: 'Material',
    collection: 'core',
    description: 'Precision silver engraving, quiet radiance, nocturnal contrast.',
    paletteLane: 'monochrome silver, indigo-black, cold titanium, soft blue-gray',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior:
      'milled silver etching, micro-particle dust, restrained cold metallic reflection',
    styleNativeMotif: 'silver dust fields, hairline edge highlights, and directional shadow',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Precision silver engraving with cold titanium highlights and indigo-black depth. The anchor geometry remains exact while restrained metallic bloom, fine metallic dust, soft blue-gray contrast, and off-axis lighting gather around it. Keep the quality atmospheric and milled; avoid literal moon icons or celestial wallpaper.',
    negativePrompt: getStyleNegativePrompt('lunar_etch'),
    accentMotifs: [
      'soft shadow falloff in one side field',
      'cold titanium dust clustering away from the center',
      'thin silver bloom along peripheral darkness',
    ],
  },
  resonance_rings: {
    id: 'resonance_rings',
    displayName: 'Resonance Rings',
    styleFamily: 'Waveform / Field',
    category: 'Luminous',
    collection: 'core',
    description: 'Concentric pulse circles, waveform halos, radiating energy.',
    paletteLane: 'amber-white on charcoal, optional teal-white on graphite',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'waveform rings, pulse field lines, harmonic interval spacing',
    styleNativeMotif: 'non-uniform waveform bands and measured acoustic field lines',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Concentric pulse arrays and waveform harmonics moving with controlled rhythm. The anchor geometry remains unchanged while amber-white or teal-white waveform rings pass behind and around it on charcoal graphite depth. Ring spacing should vary; avoid a generic radar target, sonar UI, or uniform pattern.',
    negativePrompt: getStyleNegativePrompt('resonance_rings'),
    accentMotifs: [
      'uneven harmonic rings with visible falloff',
      'thin waveform bands bending around negative space',
      'a soft pulse halo offset from the exact center',
    ],
  },
  watercolor: {
    id: 'watercolor',
    displayName: 'Watercolor',
    styleFamily: 'Organic / Pigment',
    category: 'Organic',
    collection: 'core',
    description: 'Flowing fluid pigment washes, soft dispersion bloom, textured cotton substrate.',
    paletteLane: 'mineral blue, oxblood, moss, plum, muted saffron',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment saturation, heavy cold-press cotton grain, wet-edge separation',
    styleNativeMotif: 'mineral pigment blooms, textured substrate grain, and soft fluid tides',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Flowing fluid pigment on heavy cotton substrate with mineral blue, oxblood, moss, plum, and muted saffron. The preserved anchor linework stays sharp and exact while pigment washes disperse behind it, bleed softly at the margins, and create asymmetrical spatial atmosphere. Avoid muddy washes that obscure or alter the geometry.',
    negativePrompt: getStyleNegativePrompt('watercolor'),
    accentMotifs: [
      'deckled substrate edge shadows',
      'granulated mineral pigment pools',
      'soft backrun blooms held outside the anchor linework',
    ],
  },
  ink_brush: {
    id: 'ink_brush',
    displayName: 'Ink Brush',
    styleFamily: 'Minimal / Precision',
    category: 'Minimal',
    collection: 'core',
    description: 'Carbon ink restraint, strong gesture, meaningful negative space.',
    paletteLane: 'carbon black ink, bone substrate, faint iron-red structural haze',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'dry carbon pressure, diluted ink wash, textured substrate grain',
    styleNativeMotif: 'dry carbon stroke pressure, diluted ink wash, and open negative space',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Carbon ink discipline with strong black pigment, bone substrate, faint iron-red accent haze, and meaningful negative space. The anchor geometry remains exact, as if the fixed linework has received high-density carbon ink texture without changing its path. Use dry stroke pressure, diluted wash, and substrate grain around the form; avoid calligraphy letters, decorative script, or loose redrawing.',
    negativePrompt: getStyleNegativePrompt('ink_brush'),
    accentMotifs: [
      'one dry-brush pressure field near the periphery',
      'diluted ink wash fading into open substrate void',
      'a faint iron-red atmospheric haze with no glyph or character shape',
    ],
  },
  gold_leaf: {
    id: 'gold_leaf',
    displayName: 'Gold Leaf',
    styleFamily: 'Material / Struck Alloy',
    category: 'Luminous',
    collection: 'core',
    description: 'Struck alloy seams, brushed gold highlights, structural depth.',
    paletteLane: 'antique gold accent, umber, soot-black, soft bronze',
    compositionFamily: 'CENTRED AXIS',
    materialBehavior: 'brushed-gold fracture, struck alloy seams, micro-particle metallic dust',
    styleNativeMotif: 'hairline gold fractures, struck alloy seams, and fine metallic dust',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Struck alloy and brushed gold seams, umber depth, soot-black contrast, and soft bronze warmth. The anchor geometry remains exact while hairline gold fractures, pressed metallic dust, and stable inner reflection create material depth. Gold functions strictly as an accent highlight or thin seam covering no more than 15% of the field. Avoid generic sparkle overlays, coins, currency, or ornamental frames.',
    negativePrompt: getStyleNegativePrompt('gold_leaf'),
    accentMotifs: [
      'irregular metallic seams that never cross the anchor lines',
      'soft bronze dust gathering near the central axis',
      'subtle oxidation shadows in the outer field',
    ],
  },
  cosmic: {
    id: 'cosmic',
    displayName: 'Cosmic',
    styleFamily: 'Field / Vector Array',
    category: 'Luminous',
    collection: 'core',
    description: 'Dimensional vector field, particle dust, deep atmospheric gradients.',
    paletteLane: 'midnight teal, deep violet, pale gold flare accent, particle white',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'vector field haze, particulate dust, layered dark gradients',
    styleNativeMotif:
      'vector field currents, particulate dust arrays, and deep diagonal atmospheric gradients',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Atmospheric depth with midnight teal, deep violet, pale gold flare accent, and particle-white dust. The anchor geometry is exact and untouched while energy fields, layered dark gradients, and a controlled diagonal pull create dimensional depth. Avoid planets, literal space scenes, astronauts, or poster wallpaper.',
    negativePrompt: getStyleNegativePrompt('cosmic'),
    accentMotifs: [
      'a diagonal particulate current behind the geometry',
      'deep violet gas fading into midnight teal depth',
      'one pale gold flare held at the periphery',
    ],
  },
  minimal_line: {
    id: 'minimal_line',
    displayName: 'Minimal Line',
    styleFamily: 'Precision / Minimal',
    category: 'Minimal',
    collection: 'core',
    description: 'Ultra-clean linework, spacious restraint, engineered precision.',
    paletteLane: 'platinum on dark graphite, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'machined vector line clarity, zero ornamental clutter',
    styleNativeMotif: 'open negative space, micro edge bevels, and clean linear tension',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Machined linework with spacious restraint, platinum on dark graphite or bone on charcoal, and faint silver edge clarity. The anchor geometry remains exact with zero ornamental clutter. Use negative space, engineering precision, and restrained edge emphasis; avoid app-icon treatment or decorative clutter.',
    negativePrompt: getStyleNegativePrompt('minimal_line'),
    accentMotifs: [
      'one quiet field of untouched negative space',
      'a faint silver edge highlight away from the center',
      'minimal peripheral alignment marks with no text quality',
    ],
  },
  obsidian_mono: {
    id: 'obsidian_mono',
    displayName: 'Obsidian Mono',
    styleFamily: 'Material / Monochrome',
    category: 'Material',
    collection: 'core',
    description: 'Black obsidian composite, graphite polish, reflective bevel highlights.',
    paletteLane: 'polished obsidian composite, graphite, silver edge, smoke gray',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior:
      'machined obsidian composite, reflective bevel highlights, dark shadow weight',
    styleNativeMotif: 'obsidian reflections, graphite polish, and low reflective shadow',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Polished obsidian composite, graphite, silver edge reflection, and smoke gray depth. The anchor geometry remains exact while reflective bevel highlights, dark composite depth, and lower-weighted shadow make the image feel grounded and protected. Avoid color noise, soft painterly treatment, or flat poster styling.',
    negativePrompt: getStyleNegativePrompt('obsidian_mono'),
    accentMotifs: [
      'a low horizontal reflection shelf beneath the field',
      'smoke gray separation in black-on-black depth',
      'small silver glints only at the outer edge perimeter',
    ],
  },
  aurora_glow: {
    id: 'aurora_glow',
    displayName: 'Aurora Glow',
    styleFamily: 'Atmospheric / Spectral',
    category: 'Luminous',
    collection: 'core',
    description: 'Blue-green spectral light, soft dispersion bloom, moving atmospheric field.',
    paletteLane: 'blue-green, cobalt, violet, rare gold hairline accents',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'spectral light ribbons, atmospheric gradient bloom, refracted field haze',
    styleNativeMotif: 'blue-green light ribbons, spectral haze, and atmospheric gradient bloom',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Blue-green spectral light with cobalt, violet, soft dispersion bloom, and rare gold hairline accents. The anchor geometry remains exact while light ribbons and haze move across and around the field. Keep the glow atmospheric and disciplined; avoid rainbow neon, hard-edged overlays, or literal landscape scenes.',
    negativePrompt: getStyleNegativePrompt('aurora_glow'),
    accentMotifs: [
      'soft vertical light curtains bending around negative space',
      'cobalt-violet spectral haze in the outer field',
      'rare gold flecks used only as restrained accents',
    ],
  },
  ember_trace: {
    id: 'ember_trace',
    displayName: 'Ember Trace',
    styleFamily: 'Material / Thermal',
    category: 'Material',
    collection: 'core',
    description: 'Coal-dark surface, copper heat, controlled thermal glow.',
    paletteLane: 'coal black, ember orange, copper red, ash gray',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'tempered linework, heated bevel edges, particulate ember dust',
    styleNativeMotif: 'heated bevel glow, ember dust, and scorched carbon gradients',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Coal-dark surface with ember orange, copper red, and ash gray heat. The anchor geometry remains exact while heated edges, tempered atmosphere, particulate ember dust, and disciplined diagonal force create controlled intensity. Avoid flames as literal objects, explosions, or molten distortion.',
    negativePrompt: getStyleNegativePrompt('ember_trace'),
    accentMotifs: [
      'copper-red heat concentrated along peripheral edge perimeter',
      'ash gray cooling fields behind the geometry',
      'a diagonal ember dust current with strong restraint',
    ],
  },
  monolith_ink: {
    id: 'monolith_ink',
    displayName: 'Monolith Ink',
    styleFamily: 'Material / Monumental',
    category: 'Geometric',
    collection: 'core',
    description: 'Heavy carbon ink, monumental weight, structural relief presence.',
    paletteLane: 'matte carbon, basalt gray, dusted bronze accent, muted bone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'basalt composite grain, dense carbon ink, machined relief shadow',
    styleNativeMotif:
      'basalt grain, dense carbon mass, structural relief shadow, and weighted base gravity',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Dense carbon ink with matte carbon black, basalt gray, dusted bronze accent, and muted bone. The anchor geometry remains exact while structural relief shadow, matte weight, mineral composite grain, and lower-anchored gravity create monumental stillness. Avoid decorative filigree or ornamental clutter.',
    negativePrompt: getStyleNegativePrompt('monolith_ink'),
    accentMotifs: [
      'a broad lower shadow shelf',
      'dusted bronze residue in composite grain',
      'quiet vertical mass implied behind the unchanged geometry',
    ],
  },
  celestial_grid: {
    id: 'celestial_grid',
    displayName: 'Celestial Grid',
    styleFamily: 'Precision / Astrometric',
    category: 'Geometric',
    collection: 'featured',
    description:
      'Measured astrometric geometry, coordinate vector lines, technical telemetry order.',
    paletteLane: 'midnight navy, pale cyan, soft violet, pinprick gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'coordinate plotting, telemetry markers, delicate vector arrays',
    styleNativeMotif:
      'telemetry plotting markers, navigational vector lines, and delicate coordinate grids',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Measured telemetry geometry with midnight navy, pale cyan, soft violet, and pinprick gold. The anchor geometry remains exact while navigational plotting, delicate coordinate grids, and asymmetrical telemetry marks orient the field. Avoid zodiac wheels, horoscope charts, astrology symbols, readable chart labels, or generic posters.',
    negativePrompt: getStyleNegativePrompt('celestial_grid'),
    accentMotifs: [
      'selective coordinate nodes away from the center',
      'partial astrometric arcs that do not create readable diagrams',
      'offset pale-cyan coordinate lines with no text or numbers',
    ],
  },
  echo_chamber: {
    id: 'echo_chamber',
    displayName: 'Echo Chamber',
    styleFamily: 'Acoustic / Field',
    category: 'Luminous',
    collection: 'featured',
    description: 'Repeating acoustic harmonics, chamber depth, layered signal dampening.',
    paletteLane: 'smoked violet, blue-gray, muted gold accent, shadow black',
    compositionFamily: 'CENTRED AXIS',
    materialBehavior: 'nested acoustic fields, soft echo bands, chamber depth',
    styleNativeMotif: 'nested acoustic fields, harmonic echo bands, and shadowed structural depth',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Layered acoustic depth with smoked violet, blue-gray, muted gold accent, and shadow black. The anchor geometry remains exact while nested echo bands and chamber-like depth repeat with controlled dampening around the central axis. Avoid wallpaper ripples, target graphics, or high-contrast UI rings.',
    negativePrompt: getStyleNegativePrompt('echo_chamber'),
    accentMotifs: [
      'elliptical echo bands with uneven fade',
      'blue-gray chamber depth behind the form',
      'muted gold signal accents used sparingly',
    ],
  },
  prism_veil: {
    id: 'prism_veil',
    displayName: 'Prism Veil',
    styleFamily: 'Optic / Refraction',
    category: 'Luminous',
    collection: 'featured',
    description: 'Optic refraction, chromatic dispersion, frosted acrylic translucency.',
    paletteLane: 'frosted acrylic, opal, pale cyan, lavender, faint gold accent',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'translucent optic veils, refracted bevels, chromatic dispersion',
    styleNativeMotif: 'refracted light shears and translucent optic layers',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Optic refraction, chromatic dispersion, and frosted acrylic translucency. The anchor geometry remains crisp and untouched while translucent color fields pass behind it. Use delicate refraction, pearl highlights, pale cyan edges, lavender haze, and faint gold glints. Avoid neon rainbow effects or cheap holographic stickers.',
    negativePrompt: getStyleNegativePrompt('prism_veil'),
    accentMotifs: [
      'translucent veil layers crossing only the surrounding field',
      'opal refraction bloom kept soft and secondary',
      'pale cyan edge glints that never become new geometry',
    ],
  },
  verdigris_relic: {
    id: 'verdigris_relic',
    displayName: 'Verdigris Relic',
    styleFamily: 'Material / Oxidized Alloy',
    category: 'Material',
    collection: 'featured',
    description: 'Oxidized copper alloy, mineral patina, precision-etched relief surface.',
    paletteLane: 'oxidized teal, aged bronze, carbon ash, dark slate',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'oxidized copper alloy, patina blooms, precision-etched relief surface',
    styleNativeMotif: 'oxidized copper patina blooms and micro-textured alloy relief',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Oxidized copper alloy with mineral patina, bronze, carbon ash, and dark slate. The anchor geometry remains exact while aged alloy, precision etching, and verdigris blooms create material permanence. Keep it refined and grounded; avoid coins, antique junk, fake inscriptions, or literal artifacts.',
    negativePrompt: getStyleNegativePrompt('verdigris_relic'),
    accentMotifs: [
      'patina bloom clusters weighted toward the lower field',
      'worn bronze edge catches away from the geometry center',
      'dark slate grain and carbon mineral dust',
    ],
  },
  solar_halo: {
    id: 'solar_halo',
    displayName: 'Solar Halo',
    styleFamily: 'Atmospheric / Radiant',
    category: 'Luminous',
    collection: 'seasonal',
    description: 'Thermal radiance, disciplined brightness, haloed clarity.',
    paletteLane: 'ivory, saffron, pale brass accent, pale amber, smoke gray',
    compositionFamily: 'CENTRED AXIS',
    materialBehavior: 'thermal radiant halos, warm dispersion haze, brushed brass highlights',
    styleNativeMotif: 'radiant thermal rings, disciplined brass highlights, and warm halo haze',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Disciplined thermal radiance with ivory, saffron, pale brass accents, pale amber, and smoke gray. The anchor geometry remains exact while soft radiant rings, warm atmospheric haze, and disciplined brightness clarify the central axis. Avoid literal suns, landscapes, flames, or overwhelming golden poster treatment.',
    negativePrompt: getStyleNegativePrompt('solar_halo'),
    accentMotifs: [
      'soft brass rings fading before they touch the geometry',
      'pale amber haze concentrated near the central axis',
      'smoke-muted outer warmth for contrast',
    ],
  },
  tideglass: {
    id: 'tideglass',
    displayName: 'Tideglass',
    styleFamily: 'Material / Frosted Silicate',
    category: 'Organic',
    collection: 'seasonal',
    description: 'Frosted silicate translucency, fluid mineral wash, soft edge boundaries.',
    paletteLane: 'seafoam, slate blue, soft aqua, mineral gray',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'frosted silicate translucency, saline haze, eroded-edge softness',
    styleNativeMotif: 'frosted silicate planes, saline haze, and fluid mineral wash',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Frosted silicate translucency with seafoam, slate blue, soft aqua, and mineral gray. The anchor geometry remains exact while tumbled matte glass texture, saline haze, soft boundary edges, and directional flow create fluid clarity. Avoid beaches, shells, waves as objects, or watery blur that softens the linework.',
    negativePrompt: getStyleNegativePrompt('tideglass'),
    accentMotifs: [
      'translucent silicate planes behind the geometry',
      'saline haze along one directional edge',
      'mineral gray tide lines kept abstract and secondary',
    ],
  },
  sacred_geometry: {
    id: 'sacred_geometry',
    displayName: 'Sacred Geometry',
    styleFamily: 'Geometric / Mathematical',
    category: 'Geometric',
    collection: 'seasonal',
    description:
      'Layered harmonic mathematical systems, transparent vector overlays, structural depth.',
    paletteLane: 'indigo, teal, dusty rose, muted brass accent, slate blue',
    compositionFamily: 'CENTRED AXIS',
    materialBehavior:
      'layered harmonic geometry, transparent vector overlays, mathematical precision',
    styleNativeMotif: 'transparent vector overlays and secondary geometric projection systems',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Layered harmonic mathematical systems with indigo, teal, dusty rose, muted brass accents, and slate blue. The anchor geometry remains exact while transparent overlaps and precise secondary geometric projections create spatial depth. Keep this disciplined and architectural; do not overpower the anchor geometry or force a mandala template.',
    negativePrompt: getStyleNegativePrompt('sacred_geometry'),
    accentMotifs: [
      'transparent vector systems with clear hierarchy',
      'muted brass construction arcs behind the geometry',
      'slate blue overlap fields kept airy and precise',
    ],
  },
  velvet_ember: {
    id: 'velvet_ember',
    displayName: 'Velvet Ember',
    styleFamily: 'Material / Precision Alloy',
    category: 'Material',
    collection: 'seasonal',
    description: 'Matte dark depth, brushed copper thermal glints, controlled contrast.',
    paletteLane: 'matte burgundy-black, brushed copper, warm amber accent, soot violet',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'matte tactile darkness, copper thermal glints, soft smoke depth',
    styleNativeMotif: 'matte carbon texture, brushed copper thermal glints, and soft smoke depth',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Matte dark depth with burgundy-black, brushed copper, warm amber accents, and soot violet. The anchor geometry remains exact while luxury material depth, copper thermal glints, smoky diagonal tension, and controlled focus shape the surrounding field. Avoid fashion objects, jewelry literalism, flames, or oversaturated red glow.',
    negativePrompt: getStyleNegativePrompt('velvet_ember'),
    accentMotifs: [
      'copper thermal glints embedded in matte darkness',
      'soot-violet smoke following a diagonal current',
      'warm amber depth held behind the fixed geometry',
    ],
  },
};

export const LAUNCH_STYLE_LIBRARY = VALID_AI_STYLES.map(id => STYLE_PROMPT_LIBRARY[id]);

export const CORE_STYLE_IDS = VALID_AI_STYLES.filter(
  id => STYLE_PROMPT_LIBRARY[id].collection === 'core'
) as AIStyle[];

export const FEATURED_STYLE_IDS = VALID_AI_STYLES.filter(
  id => STYLE_PROMPT_LIBRARY[id].collection === 'featured'
) as AIStyle[];

export const SEASONAL_STYLE_IDS = VALID_AI_STYLES.filter(
  id => STYLE_PROMPT_LIBRARY[id].collection === 'seasonal'
) as AIStyle[];

const INTENTION_SIGNALS: Array<IntentionSignal & { keywords: string[] }> = [
  {
    theme: 'Focus / discipline',
    keywords: [
      'focus',
      'discipline',
      'disciplined',
      'steady',
      'clarity',
      'concentrate',
      'concentration',
      'study',
      'attention',
      'habit',
      'habits',
      'routine',
      'execution',
      'execute',
      'finish',
      'complete',
      'completion',
      'drive',
      'flow state',
      'deep work',
      'prioritize',
      'mastery',
      'precision',
      'relentless',
    ],
    directionalBehavior: 'converging motion toward one stable focal zone',
    densityBehavior: 'restrained outer field, denser inner concentration',
    focalBehavior: 'one calm dominant center with minimal competition',
    paletteBehavior: 'cool restrained base with one controlled warm accent',
    rhythmBehavior: 'even, measured, unbroken',
    motif: 'converging field pressure and measured spacing, never a literal eye, tool, or diagram',
  },
  {
    theme: 'Confidence / courage',
    keywords: [
      'confidence',
      'confident',
      'courage',
      'courageous',
      'brave',
      'bold',
      'power',
      'powerful',
      'worthy',
      'fearless',
      'success',
      'successful',
      'achieve',
      'achievement',
      'strong',
      'strength',
      'gym',
      'fitness',
      'workout',
      'train',
      'training',
      'lift',
      'athletic',
      'win',
      'winning',
      'lead',
      'leadership',
      'stand tall',
      'unstoppable',
      'conviction',
      'sovereign',
      'command',
      'resilient',
    ],
    directionalBehavior: 'upward lift or outward expansion',
    densityBehavior: 'stronger central field with open surrounding space',
    focalBehavior: 'brighter center, firmer edges',
    paletteBehavior: 'warmer accents, gold, ember, brass, or sunlit tones where the style permits',
    rhythmBehavior: 'steady rising pulse',
    motif:
      'upward light pressure and firmer edge emphasis, never a literal figure, weapon, crown, or trophy',
  },
  {
    theme: 'Abundance / growth',
    keywords: [
      'abundance',
      'abundant',
      'growth',
      'grow',
      'prosper',
      'prosperity',
      'wealth',
      'wealthy',
      'money',
      'financial',
      'expand',
      'expansion',
      'scale',
      'scaling',
      'career',
      'revenue',
      'opportunity',
      'build',
      'building',
      'invest',
      'investment',
      'multiply',
      'progress',
      'generate',
      'generative',
      'momentum',
      'receive',
      'reach',
    ],
    directionalBehavior: 'expanding arcs and layered outward growth',
    densityBehavior: 'rich but ordered supporting detail',
    focalBehavior: 'glowing center with branching peripheral accents',
    paletteBehavior:
      'mineral greens, gold accent, teal, warm earth, or luminous amber without currency imagery',
    rhythmBehavior: 'organic expansion, gradual bloom',
    motif:
      'abstract branching density and expanding arcs, never coins, cash, baskets, or financial symbols',
  },
  {
    theme: 'Recovery / reset',
    keywords: [
      'recovery',
      'recover',
      'reset',
      'heal',
      'healing',
      'health',
      'healthy',
      'rest',
      'restore',
      'restoration',
      'calm',
      'peace',
      'serenity',
      'unwind',
      'recharge',
      'sleep',
      'breathe',
      'stillness',
      'steady',
      'decompress',
      'balance',
      'soothe',
      'soften',
      'regenerate',
      'ease',
      'quiet',
    ],
    directionalBehavior: 'downward settling and balanced horizontal stabilization',
    densityBehavior: 'spacious field with gentle, uncluttered detail',
    focalBehavior: 'stabilized center with softened contrast',
    paletteBehavior: 'cool slate blues, mineral green, silver, ivory, or muted charcoal',
    rhythmBehavior: 'measured, quiet, and grounded',
    motif:
      'settling atmospheric depth and clean stabilizing lines, never medical crosses, figures, or literal nature icons',
  },
  {
    theme: 'Love / relationship',
    keywords: [
      'love',
      'relationship',
      'relationships',
      'romance',
      'romantic',
      'partner',
      'partnership',
      'connection',
      'intimacy',
      'family',
      'belong',
      'belonging',
      'friendship',
      'friends',
      'bond',
      'bonding',
      'empathy',
      'compassion',
      'community',
      'trust',
      'together',
      'warmth',
      'devotion',
      'care',
    ],
    directionalBehavior: 'converging paired movement or gentle orbital flow',
    densityBehavior: 'balanced left/right fields with soft connection points',
    focalBehavior: 'warm shared center',
    paletteBehavior: 'rose, copper, cream, plum, or soft gold within the selected style lane',
    rhythmBehavior: 'gentle pulse, intimate warmth',
    motif:
      'paired atmospheric balance and connection points, never hearts, faces, hands, or paired figures',
  },
  {
    theme: 'Protection / stability',
    keywords: [
      'protect',
      'protection',
      'safe',
      'safety',
      'boundary',
      'boundaries',
      'stable',
      'stability',
      'ground',
      'grounded',
      'grounding',
      'foundation',
      'bedrock',
      'endure',
      'endurance',
      'resilience',
      'shield',
      'fortify',
      'anchor',
      'guard',
      'defense',
      'solid',
      'unshakable',
      'rooted',
    ],
    directionalBehavior: 'downward settling and perimeter containment',
    densityBehavior: 'weighted base with quiet protective outer space',
    focalBehavior: 'firm center with guarded edges',
    paletteBehavior: 'graphite, stone, smoke, blue-black, bronze, or muted bone',
    rhythmBehavior: 'slow, grounded, resistant to disruption',
    motif:
      'subtle perimeter pressure and grounded shadow weight, never shields, walls, locks, or chains',
  },
  {
    theme: 'Creativity / expression',
    keywords: [
      'create',
      'creative',
      'creativity',
      'art',
      'artist',
      'voice',
      'express',
      'expression',
      'expressive',
      'inspire',
      'inspiration',
      'imagine',
      'imagination',
      'craft',
      'craftsmanship',
      'write',
      'writing',
      'author',
      'design',
      'invent',
      'innovation',
      'original',
      'make',
      'vision',
      'story',
      'composer',
    ],
    directionalBehavior: 'curving emergence and asymmetric outward motion',
    densityBehavior: 'varied clusters balanced by open space',
    focalBehavior: 'lively secondary emphasis without stealing from the sigil',
    paletteBehavior: 'a wider secondary hue range with one restrained spark of warmth',
    rhythmBehavior: 'syncopated, expressive, still controlled',
    motif:
      'asymmetric emergence and textured variation, never tools, musical notes, or literal art objects',
  },
];

const DEFAULT_INTENTION_SIGNAL: IntentionSignal = {
  theme: 'General intention',
  directionalBehavior: 'subtle inward organization with a quiet outward release',
  densityBehavior: 'moderate supporting detail with clear hierarchy',
  focalBehavior: 'the preserved anchor geometry remains the dominant focal point',
  paletteBehavior:
    'the selected style palette remains primary with a restrained accent temperature shift',
  rhythmBehavior: 'steady, composed, and non-literal',
  motif: 'abstract atmospheric emphasis shaped by the wording, never literal illustration',
};

const COMPOSITION_VARIANTS: Record<CompositionFamily, string[]> = {
  'CENTRED AXIS': [
    'Hold the anchor on a stable central axis while light, texture, and density settle toward it.',
    'Keep the anchor central, but vary accent weight and peripheral spacing so the render does not feel templated.',
    'Build a calm inner field and let outer detail fade with measured restraint.',
    'Use a clear central axis with one subtle asymmetry in light or material behavior.',
  ],
  'OFFSET FIELD': [
    'Keep the anchor geometry unchanged while the supporting field is biased toward one side or quadrant.',
    'Use asymmetrical density and open counter-space so the image feels spatially authored.',
    'Let the surrounding material drift off-center while the anchor geometry remains structurally stable.',
    'Create one dominant off-axis field of light, texture, or atmosphere behind the anchor geometry.',
  ],
  'DIRECTIONAL FLOW': [
    'Move atmosphere across or around the preserved anchor linework with a clear directional current.',
    'Use flowing density that passes behind the anchor without dragging, bending, or changing it.',
    'Let light or texture travel from one edge of the frame toward another with controlled rhythm.',
    'Create a visible path through the background field while the anchor stays exact and calm.',
  ],
  'LOWER-ANCHORED': [
    'Weight the image low in the frame with grounded shadow, material depth, or base pressure.',
    'Let the lower field feel rooted while the upper field has more breathing room.',
    'Use a quiet base of density beneath the preserved anchor geometry without turning it into a literal pedestal.',
    'Make the composition feel settled and rooted through shadow and material gravity.',
  ],
  'DIAGONAL TENSION': [
    'Introduce controlled diagonal force through light, haze, texture, or density behind the anchor geometry.',
    'Let one diagonal current cut through the surrounding field without touching the anchor geometry.',
    'Balance a strong diagonal atmosphere with enough negative space to preserve clarity.',
    'Use diagonal pressure as dynamic movement, not as a new symbol or scene.',
  ],
  'OPEN VOID': [
    'Make negative space a major part of the design, with very restrained secondary detail.',
    'Let the anchor linework breathe in open space while texture appears only where it strengthens focus.',
    'Use emptiness, spacing, and quiet edge treatment as the main visual language.',
    'Avoid filling the frame; the absence of ornament should feel intentional and refined.',
  ],
};

export function getStyleNegativePrompt(style: string): string {
  const extra = Object.prototype.hasOwnProperty.call(STYLE_EXTRA_NEGATIVES, style)
    ? STYLE_EXTRA_NEGATIVES[style as AIStyle]
    : undefined;
  return extra ? `${GLOBAL_NEGATIVE_PROMPT}, ${extra}` : GLOBAL_NEGATIVE_PROMPT;
}

export function getStylePromptDefinition(style: string): StylePromptDefinition {
  const styleId = Object.prototype.hasOwnProperty.call(STYLE_PROMPT_LIBRARY, style)
    ? (style as AIStyle)
    : 'watercolor';
  return STYLE_PROMPT_LIBRARY[styleId];
}

export function deriveIntentionSignal(intention: string): IntentionSignal {
  const normalized = normalizeIntention(intention).toLowerCase();
  if (!normalized) return DEFAULT_INTENTION_SIGNAL;

  for (const signal of INTENTION_SIGNALS) {
    if (signal.keywords.some(keyword => containsKeyword(normalized, keyword))) {
      const { keywords: _keywords, ...rest } = signal;
      return rest;
    }
  }

  return DEFAULT_INTENTION_SIGNAL;
}

export function buildStylePrompt(
  intention: string,
  styleId: string,
  variationIndex: number = 0
): string {
  const style = getStylePromptDefinition(styleId);
  const signal = deriveIntentionSignal(intention);
  const cleanIntention = normalizeIntention(intention) || 'personal intention';
  const safeVariationIndex = Number.isFinite(variationIndex) ? Math.trunc(variationIndex) : 0;
  const compositionNotes = COMPOSITION_VARIANTS[style.compositionFamily];
  const compositionVariant =
    compositionNotes[positiveModulo(safeVariationIndex, compositionNotes.length)];
  const accentMotif = pickStable(
    style.accentMotifs,
    `${style.id}:${cleanIntention}:${safeVariationIndex}:accent`
  );

  return `ANCHOR GEOMETRY IDENTITY:
This anchor embodies the intention "${cleanIntention}".

STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY:

1. The input image defines the exact anchor geometry. Preserve ALL lines, circles, intersections, and shapes exactly as shown.
2. Do NOT warp, melt, bend, rotate, skew, redraw, simplify, or reinterpret the anchor geometry.
3. Do NOT add text, labels, captions, letters, words, numbers, runes, glyph alphabets, or readable symbols anywhere.
4. The anchor geometry is immutable. Treat it as a fixed engraved plate beneath all styling.
5. Styling may influence atmosphere, texture, framing, lighting, color, density, ornament, and peripheral composition only. Never alter the preserved anchor structure.

STYLE IDENTITY:
${style.displayName} — ${style.description}

STYLE FAMILY:
${style.styleFamily}

VISUAL CATEGORY:
${style.category}

STYLE-SPECIFIC ART DIRECTION:
${style.promptStyleBlock}

STYLE SIGNATURE FOR THIS RENDER:
- Palette lane: ${style.paletteLane}
- Material behavior: ${style.materialBehavior}
- Style-native motif: ${style.styleNativeMotif}
- Default density: ${style.defaultDensity}
- Composition variation: ${compositionVariant}

INTENTION SIGNAL LAYER — SUBTLE, NON-LITERAL, STYLE-AWARE:
Translate the intention into visual behavior without depicting it as a literal object or scene.

The intention may influence:

* directional behavior
* density distribution
* focal emphasis
* palette temperature
* atmospheric rhythm
* edge behavior
* spacing and visual tension

For the intention "${cleanIntention}", use:

* Directional behavior: ${signal.directionalBehavior}
* Density behavior: ${signal.densityBehavior}
* Focal emphasis: ${signal.focalBehavior}
* Palette behavior: ${signal.paletteBehavior}
* Atmospheric rhythm: ${signal.rhythmBehavior}

Important:
Do not illustrate the intention directly.
Do not create a literal scene.
Do not add people, text, objects, symbols, or readable imagery to explain the intention.
The intention should be felt through the image's pressure, color, density, spacing, and movement.

SYMBOLIC MOTIFS — FLEXIBLE, NOT UNIFORM:
Use 2 to 3 subtle abstract motifs maximum.

Motif structure:

* Style-native motif tied to the style family: ${style.styleNativeMotif}
* Intention-responsive motif: ${signal.motif}
* Optional accent motif: ${accentMotif}

Motifs may appear as:

* precision border accents
* background texture
* negative-space shaping
* light behavior
* atmospheric clustering
* secondary field geometry
* material imperfections
* peripheral markers

Motifs must be abstract, ornamental, and secondary.
Do not place motifs as central icons.
Each style should have its own motif logic.

COMPOSITIONAL FAMILY:
${style.compositionFamily}

Use this composition family intentionally.
${compositionVariant}
Do not default every render to the same centered generic composition.

Composition families:

* CENTRED AXIS: anchor geometry feels stable, complete, and central on a fixed axis
* OFFSET FIELD: supporting energy is asymmetrical and spatially authored
* DIRECTIONAL FLOW: atmosphere moves across or around the anchor geometry
* LOWER-ANCHORED: image feels grounded, weighted, and rooted
* DIAGONAL TENSION: energy cuts through the composition with controlled force
* OPEN VOID: negative space is a major part of the design

COLOR + MATERIAL LOGIC:
Palette lane: ${style.paletteLane}
Material behavior: ${style.materialBehavior}

GOLD ACCENT CONSTRAINT:
Gold or warm-metallic tones must not dominate more than ~15% of the visual field. Gold functions strictly as a thin structural highlight, edge bevel, or seam — never a wash, fill, or dominant surface treatment.

Use a distinct palette lane for this style.
The Anchor brand palette should guide taste, not imprison the artwork.
Allow richer variation in hue, substrate, glow, haze, bloom, and secondary accents where appropriate.

UNIQUENESS MANDATE:
This render must feel specific to:

* this anchor
* this intention
* this selected style

Differentiate each render through at least 3 of these axes:

* composition
* palette
* density
* texture
* material behavior
* light behavior
* framing
* atmospheric depth
* edge treatment
* visual rhythm

Avoid generic wallpaper treatment.
Avoid stock fantasy poster aesthetics.
Avoid making every style feel like the same symbol placed over a different background.

STRICT AVOIDANCE RULES:
✗ Text, words, letters, phrases, captions, numbers, numerals, readable characters
✗ Runes, alphabets, fake writing, inscriptions, labels, diagrams with readable markings
✗ Currency symbols, coins, cash, banknotes, wallets, cards, bank imagery
✗ Charts, graphs, stock tickers, financial imagery
✗ Brand logos, watermarks, copyright marks
✗ Clipart, stickers, icon-pack aesthetics, emoji-style art
✗ Flat app-icon treatment
✗ Dominant human figures, faces, portraits, hands, bodies
✗ Literal front-and-center scene illustration of the intention
✗ Distorted, warped, changed, broken, or redrawn anchor geometry
✗ Overcrowded ornament that competes with the anchor geometry
✗ Low-quality blur, muddy details, random artifacts
✗ Religious iconography, candles, fantasy clutter, or literal scene objects

Allowed:
✓ Subtle abstract implication
✓ Abstract atmospheric cues
✓ Non-literal emotional tone
✓ Style-native ornament
✓ Intention-reactive density and emphasis
✓ Background and border detail that never alters the anchor geometry

FINAL ART DIRECTION:
Create a finished image where the anchor geometry remains exact and untouched, while the surrounding world feels uniquely shaped by the selected style and the emotional signal of the intention.`;
}

function normalizeIntention(intention: string): string {
  return intention
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function containsKeyword(value: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escapedKeyword}([^a-z0-9]|$)`, 'i').test(value);
}

function pickStable<T>(options: T[], seed: string): T {
  return options[hashString(seed) % options.length];
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
