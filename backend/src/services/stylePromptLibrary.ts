import { AI_STYLE_IDS, type AIStyle } from '../types';

export const VALID_AI_STYLES = AI_STYLE_IDS;
export type { AIStyle };

export type StyleCollection = 'core' | 'featured' | 'seasonal';

export type CompositionFamily =
  | 'CENTRED STILLPOINT'
  | 'OFFSET FIELD'
  | 'DIRECTIONAL FLOW'
  | 'LOWER-ANCHORED'
  | 'DIAGONAL TENSION'
  | 'OPEN VOID';

export type VisualCategory =
  | 'Geometric'
  | 'Mystic'
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
  'text, words, letters, phrases, captions, numbers, numerals, readable characters, runes, fake writing, inscriptions, labels, currency symbols, dollar sign, coins, cash, banknotes, bank logos, charts, graphs, stock ticker, brand logos, watermark, copyright mark, clipart, sticker, icon pack, emoji, flat app icon, photorealistic human face, human figure, portrait, hands, literal scene, literal object illustration, distorted geometry, altered structure, altered shape, warped lines, broken sigil, melted sigil, blurry, muddy, low quality, random artifacts, overcrowded ornament';

const STYLE_EXTRA_NEGATIVES: Partial<Record<AIStyle, string>> = {
  ink_brush: 'calligraphy letters, readable brush marks, decorative script',
  sacred_geometry: 'stock sacred geometry poster, overpowering mandala, generic occult chart',
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
    description: 'Precision drafting, measured geometry, blueprint discipline.',
    paletteLane: 'smoked parchment, silver-white, faint cyan, graphite',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'etched drafting ink, blueprint grid logic, silver calibration marks',
    styleNativeMotif:
      'drafting calibration ticks, non-readable survey marks, and measured guide rails',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Precision drafting discipline and measured blueprint logic. The sigil remains crisp and untouched while calibration marks, graphite guide rails, faint cyan grid ghosts, and silver-white etched drafting strokes form a restrained technical atmosphere. Avoid readable annotations, numbers, labels, or any diagram language that could be interpreted as text.',
    negativePrompt: getStyleNegativePrompt('architectural_trace'),
    accentMotifs: [
      'partial orthographic guide rails fading before they reach the sigil',
      'tiny non-readable calibration ticks near the margins',
      'soft graphite datum lines dissolved into smoked parchment',
    ],
  },
  lunar_etch: {
    id: 'lunar_etch',
    displayName: 'Lunar Etch',
    styleFamily: 'Atmospheric / Luminous',
    category: 'Mystic',
    collection: 'core',
    description: 'Moonlit silver engraving, quiet radiance, nocturnal contrast.',
    paletteLane: 'moon-silver, indigo-black, cold pearl, soft blue-white',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'silver etching, lunar dust, restrained metallic bloom',
    styleNativeMotif: 'moon-silver dust fields and quiet crescent-like edge light',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Moonlit silver engraving with cold pearl highlights and indigo-black depth. The sigil remains exact while restrained metallic bloom, lunar dust, soft blue-white haze, and off-axis nocturnal contrast gather around it. Avoid large moon icons or literal celestial objects; keep the lunar quality atmospheric and etched.',
    negativePrompt: getStyleNegativePrompt('lunar_etch'),
    accentMotifs: [
      'soft eclipse-like shadow falloff in one side field',
      'cold pearl dust clustering away from the center',
      'thin silver bloom along peripheral darkness',
    ],
  },
  resonance_rings: {
    id: 'resonance_rings',
    displayName: 'Resonance Rings',
    styleFamily: 'Resonance / Field',
    category: 'Luminous',
    collection: 'core',
    description: 'Concentric pulse circles, waveform halos, radiating energy.',
    paletteLane: 'amber-white on charcoal, optional teal-white on graphite',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'echo rings, pulse halos, acoustic field lines',
    styleNativeMotif: 'non-uniform pulse halos and abstract acoustic field lines',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Concentric pulse circles and waveform halos moving with controlled rhythm. The sigil remains unchanged while amber-white or teal-white echo rings pass behind and around it on charcoal graphite depth. Ring spacing should vary; avoid a generic sonar target, radar UI, or uniform wallpaper pattern.',
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
    styleFamily: 'Organic / Painterly',
    category: 'Organic',
    collection: 'core',
    description: 'Flowing pigment washes, soft bloom, textured paper.',
    paletteLane: 'mineral blue, oxblood, moss, plum, muted saffron',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'pigment bleed, deckled paper, wet edge blooms',
    styleNativeMotif: 'pigment blooms, deckled paper grain, and soft wet-edge tides',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Flowing watercolor on textured paper with mineral blue, oxblood, moss, plum, and muted saffron. The preserved sigil stays sharp and exact while pigment washes bloom behind it, bleed softly at the edges, and create asymmetrical paper atmosphere. Avoid muddy washes or loose paint that obscures or redraws the sigil.',
    negativePrompt: getStyleNegativePrompt('watercolor'),
    accentMotifs: [
      'deckled paper edge shadows',
      'granulated mineral pigment pools',
      'soft backrun blooms held outside the sigil geometry',
    ],
  },
  ink_brush: {
    id: 'ink_brush',
    displayName: 'Ink Brush',
    styleFamily: 'Organic / Minimal',
    category: 'Minimal',
    collection: 'core',
    description: 'Sumi-e ink restraint, strong gesture, meaningful negative space.',
    paletteLane: 'black ink, bone paper, faint iron-red seal haze',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'dry brush pressure, diluted ink mist, paper grain',
    styleNativeMotif: 'dry brush pressure, diluted ink mist, and untouched paper void',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Sumi-e restraint with strong black ink, bone paper, faint iron-red seal haze, and meaningful negative space. The sigil geometry remains exact, as if the fixed linework has received ink texture without changing its path. Use dry brush pressure, diluted mist, and paper grain around the form; avoid readable calligraphy, letters, or loose gestural redrawing.',
    negativePrompt: getStyleNegativePrompt('ink_brush'),
    accentMotifs: [
      'one dry-brush pressure field near the periphery',
      'diluted ink mist fading into open paper',
      'a faint iron-red atmospheric haze with no mark or character shape',
    ],
  },
  gold_leaf: {
    id: 'gold_leaf',
    displayName: 'Gold Leaf',
    styleFamily: 'Material / Precious',
    category: 'Luminous',
    collection: 'core',
    description: 'Gilded finish, antique glow, precious surface depth.',
    paletteLane: 'antique gold, umber, soot-black, soft bronze',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'torn gold leaf, gilded cracks, subtle metallic dust',
    styleNativeMotif: 'torn gold leaf seams, gilded cracks, and antique metallic dust',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Antique gold leaf, umber depth, soot-black contrast, and soft bronze warmth. The sigil remains exact while torn gilding, fine cracks, metallic dust, and stable inner glow create precious surface depth. Avoid generic sparkle overlays, coins, currency, or ornamental frames that compete with the sigil.',
    negativePrompt: getStyleNegativePrompt('gold_leaf'),
    accentMotifs: [
      'irregular leaf seams that never cross the sigil lines',
      'soft bronze dust gathering near the stillpoint',
      'subtle tarnish shadows in the outer field',
    ],
  },
  cosmic: {
    id: 'cosmic',
    displayName: 'Cosmic',
    styleFamily: 'Atmospheric / Expansive',
    category: 'Mystic',
    collection: 'core',
    description: 'Deep-space atmosphere, luminous dust, celestial depth.',
    paletteLane: 'midnight teal, violet gas, pale gold flare, star-white',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'nebular haze, star dust, layered dark gradients',
    styleNativeMotif: 'nebular haze, star-dust fields, and deep diagonal atmospheric currents',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Deep-space atmosphere with midnight teal, violet gas, pale gold flare, and star-white dust. The sigil is exact and untouched while nebular haze, layered dark gradients, and a controlled diagonal pull create celestial depth. Avoid planets, literal space scenes, astronauts, or poster-like cosmic wallpaper.',
    negativePrompt: getStyleNegativePrompt('cosmic'),
    accentMotifs: [
      'a diagonal star-dust current behind the sigil',
      'violet gas fading into midnight teal depth',
      'one pale gold flare held at the periphery',
    ],
  },
  minimal_line: {
    id: 'minimal_line',
    displayName: 'Minimal Line',
    styleFamily: 'Precision / Minimal',
    category: 'Minimal',
    collection: 'core',
    description: 'Ultra-clean linework, spacious restraint, quiet precision.',
    paletteLane: 'platinum on black navy, bone on charcoal, faint silver',
    compositionFamily: 'OPEN VOID',
    materialBehavior: 'clean vector-like line clarity, almost no ornament',
    styleNativeMotif: 'bare negative space, micro edge highlights, and clean line tension',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Ultra-clean linework with spacious restraint, platinum on black navy or bone on charcoal, and faint silver edge clarity. The sigil geometry remains exact with almost no ornament. Use negative space, quiet precision, and restrained edge emphasis; avoid app-icon treatment or decorative clutter.',
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
    description: 'Black glass, graphite polish, reflective shadow.',
    paletteLane: 'black glass, graphite, silver edge, smoke gray',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'polished obsidian, glossy edge highlights, dark reflection',
    styleNativeMotif: 'black-glass reflections, graphite polish, and low reflective shadow',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Polished obsidian, graphite, silver edge light, and smoke gray reflection. The sigil remains exact while glossy highlights, black glass depth, and lower-weighted reflection make the image feel protected and grounded. Avoid color noise, soft painterly treatment, or flat monochrome poster styling.',
    negativePrompt: getStyleNegativePrompt('obsidian_mono'),
    accentMotifs: [
      'a low horizontal reflection shelf beneath the field',
      'smoke gray separation in black-on-black depth',
      'small silver glints only at the outer edge behavior',
    ],
  },
  aurora_glow: {
    id: 'aurora_glow',
    displayName: 'Aurora Glow',
    styleFamily: 'Atmospheric / Luminous',
    category: 'Luminous',
    collection: 'core',
    description: 'Blue-green aurora light, soft spectral bloom, moving atmosphere.',
    paletteLane: 'blue-green, cobalt, violet, rare gold accents',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'light ribbons, soft atmospheric bloom, spectral haze',
    styleNativeMotif: 'blue-green light ribbons, spectral haze, and soft atmospheric bloom',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Blue-green aurora light with cobalt, violet, soft spectral bloom, and rare gold accents. The sigil remains exact while light ribbons and haze move across and around the field. Keep the glow atmospheric and elegant; avoid rainbow neon, hard-edged overlays, or literal landscape scenes.',
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
    styleFamily: 'Material / Heat',
    category: 'Material',
    collection: 'core',
    description: 'Coal-dark surface, copper heat, controlled ember glow.',
    paletteLane: 'coal black, ember orange, copper red, ash gray',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'scorched linework, heated edges, ember dust',
    styleNativeMotif: 'heated edge glow, ember dust, and scorched ash gradients',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Coal-dark surface with ember orange, copper red, and ash gray heat. The sigil geometry remains exact while heated edges, scorched atmosphere, ember dust, and disciplined diagonal force create controlled intensity. Avoid flames as literal objects, explosions, or messy molten distortion.',
    negativePrompt: getStyleNegativePrompt('ember_trace'),
    accentMotifs: [
      'copper-red heat concentrated along peripheral edge behavior',
      'ash gray cooling fields behind the sigil',
      'a diagonal ember dust current with strong restraint',
    ],
  },
  monolith_ink: {
    id: 'monolith_ink',
    displayName: 'Monolith Ink',
    styleFamily: 'Material / Structural',
    category: 'Geometric',
    collection: 'core',
    description: 'Heavy stone ink, monumental stillness, carved presence.',
    paletteLane: 'ash black, stone gray, dusted bronze, muted bone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'stone grain, heavy ink, carved shadow',
    styleNativeMotif: 'stone grain, heavy ink mass, carved shadow, and weighted base pressure',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Heavy stone ink with ash black, stone gray, dusted bronze, and muted bone. The sigil remains exact while carved shadow, matte weight, mineral grain, and lower-anchored gravity create monumental stillness. Avoid soft brushiness, decorative filigree, or ornamental clutter.',
    negativePrompt: getStyleNegativePrompt('monolith_ink'),
    accentMotifs: [
      'a broad lower shadow shelf',
      'dusted bronze residue in stone grain',
      'quiet vertical mass implied behind the unchanged sigil',
    ],
  },
  celestial_grid: {
    id: 'celestial_grid',
    displayName: 'Celestial Grid',
    styleFamily: 'Precision / Celestial',
    category: 'Geometric',
    collection: 'featured',
    description: 'Observatory geometry, star-map lines, measured cosmic order.',
    paletteLane: 'midnight navy, pale cyan, soft violet, pinprick gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'star-map plotting, observatory marks, delicate grid constellations',
    styleNativeMotif:
      'observatory plotting marks, star-map lines, and delicate constellation grids',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Measured observatory geometry with midnight navy, pale cyan, soft violet, and pinprick gold. The sigil remains exact while star-map plotting, delicate grid constellations, and asymmetrical navigation marks orient the field. Avoid zodiac wheels, astrology symbols, readable chart labels, or generic celestial posters.',
    negativePrompt: getStyleNegativePrompt('celestial_grid'),
    accentMotifs: [
      'selective star-node clusters away from the center',
      'partial observatory arcs that do not create readable diagrams',
      'offset pale-cyan coordinate lines with no text or numbers',
    ],
  },
  echo_chamber: {
    id: 'echo_chamber',
    displayName: 'Echo Chamber',
    styleFamily: 'Resonance / Field',
    category: 'Luminous',
    collection: 'featured',
    description: 'Repeating echoes, inner-room acoustics, layered signal.',
    paletteLane: 'smoked violet, blue-gray, muted gold, shadow black',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'nested acoustic fields, soft echo bands, chamber depth',
    styleNativeMotif: 'nested acoustic fields, soft echo bands, and shadowed chamber depth',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Layered acoustic depth with smoked violet, blue-gray, muted gold, and shadow black. The sigil remains exact while nested echo bands and chamber-like depth repeat softly around the stillpoint. Avoid wallpaper ripples, hard target graphics, or high-contrast UI rings.',
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
    styleFamily: 'Organic / Light',
    category: 'Luminous',
    collection: 'featured',
    description: 'Iridescent refraction, glasslike hush, spectral layering.',
    paletteLane: 'pearl, opal, pale cyan, lavender, faint gold',
    compositionFamily: 'OFFSET FIELD',
    materialBehavior: 'translucent veils, refracted edges, prism bloom',
    styleNativeMotif: 'refracted light shards and translucent veil layers',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Iridescent refracted light, spectral layering, and glasslike hush. The sigil remains crisp and untouched while translucent color fields pass behind it. Use delicate refraction, pearl highlights, pale cyan edges, lavender haze, and faint gold glints. Avoid neon rainbow effects or cheap holographic stickers.',
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
    styleFamily: 'Material / Ancient',
    category: 'Material',
    collection: 'featured',
    description: 'Oxidized copper, mineral patina, archaeological elegance.',
    paletteLane: 'oxidized teal, bronze, ash, dark stone',
    compositionFamily: 'LOWER-ANCHORED',
    materialBehavior: 'aged copper, patina blooms, worn engraved surface',
    styleNativeMotif: 'oxidized copper patina blooms and worn archaeological surface grain',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Oxidized copper with mineral patina, bronze, ash, and dark stone. The sigil remains exact while aged copper, worn engraving, and verdigris blooms create archaeological elegance. Keep it refined and grounded; avoid coins, relic icons, fake inscriptions, or literal artifacts.',
    negativePrompt: getStyleNegativePrompt('verdigris_relic'),
    accentMotifs: [
      'patina bloom clusters weighted toward the lower field',
      'worn bronze edge catches away from the sigil center',
      'dark stone grain and ash mineral dust',
    ],
  },
  solar_halo: {
    id: 'solar_halo',
    displayName: 'Solar Halo',
    styleFamily: 'Atmospheric / Radiant',
    category: 'Luminous',
    collection: 'seasonal',
    description: 'Sun-warmed radiance, disciplined brightness, haloed clarity.',
    paletteLane: 'ivory, saffron, brass, pale amber, smoke',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'soft solar rings, warm haze, brass light',
    styleNativeMotif: 'soft solar rings, disciplined brass light, and warm halo haze',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Sun-warmed radiance with ivory, saffron, brass, pale amber, and smoke. The sigil remains exact while soft solar rings, warm haze, and disciplined brightness clarify the stillpoint. Avoid literal suns, landscapes, flames, or overwhelming golden poster treatment.',
    negativePrompt: getStyleNegativePrompt('solar_halo'),
    accentMotifs: [
      'soft brass rings fading before they touch the sigil',
      'pale amber haze concentrated near the stillpoint',
      'smoke-muted outer warmth for contrast',
    ],
  },
  tideglass: {
    id: 'tideglass',
    displayName: 'Tideglass',
    styleFamily: 'Organic / Coastal',
    category: 'Organic',
    collection: 'seasonal',
    description: 'Sea-glass translucency, mineral wash, tidal softness.',
    paletteLane: 'seafoam, slate blue, soft aqua, mineral gray',
    compositionFamily: 'DIRECTIONAL FLOW',
    materialBehavior: 'translucent washed glass, salt haze, tide-soft edges',
    styleNativeMotif: 'sea-glass translucency, salt haze, and tide-soft mineral wash',
    defaultDensity: 'sparse',
    promptStyleBlock:
      'Sea-glass translucency with seafoam, slate blue, soft aqua, and mineral gray. The sigil remains exact while washed glass, salt haze, tide-soft edges, and directional flow create adaptive calm. Avoid literal beaches, shells, waves as objects, or watery blur that softens the sigil geometry.',
    negativePrompt: getStyleNegativePrompt('tideglass'),
    accentMotifs: [
      'translucent sea-glass planes behind the sigil',
      'salt haze along one directional edge',
      'mineral gray tide lines kept abstract and secondary',
    ],
  },
  sacred_geometry: {
    id: 'sacred_geometry',
    displayName: 'Sacred Geometry',
    styleFamily: 'Geometric / Collector',
    category: 'Mystic',
    collection: 'seasonal',
    description: 'Layered mathematical symbolism, luminous geometric depth.',
    paletteLane: 'indigo, teal, dusty rose, muted brass, celestial blue',
    compositionFamily: 'CENTRED STILLPOINT',
    materialBehavior: 'layered geometric systems, transparent overlaps, precise geometry',
    styleNativeMotif: 'transparent mathematical overlays and precise secondary geometry systems',
    defaultDensity: 'rich',
    promptStyleBlock:
      'Tasteful layered mathematical symbolism with indigo, teal, dusty rose, muted brass, and celestial blue. The sigil remains exact while transparent overlaps and precise secondary geometry create luminous depth. Keep this less generic than stock sacred-geometry posters; do not overpower the sigil or force a mandala-like template.',
    negativePrompt: getStyleNegativePrompt('sacred_geometry'),
    accentMotifs: [
      'transparent geometry systems with clear hierarchy',
      'muted brass construction arcs behind the sigil',
      'celestial blue overlap fields kept airy and precise',
    ],
  },
  velvet_ember: {
    id: 'velvet_ember',
    displayName: 'Velvet Ember',
    styleFamily: 'Material / Luxury',
    category: 'Material',
    collection: 'seasonal',
    description: 'Velvet darkness, warm ember glow, soft luxury depth.',
    paletteLane: 'burgundy-black, copper, warm amber, soot violet',
    compositionFamily: 'DIAGONAL TENSION',
    materialBehavior: 'velvet texture, ember glints, soft smoky depth',
    styleNativeMotif: 'velvet texture, copper ember glints, and soft smoky depth',
    defaultDensity: 'moderate',
    promptStyleBlock:
      'Velvet darkness with burgundy-black, copper, warm amber, and soot violet. The sigil remains exact while soft luxury depth, ember glints, smoky diagonal tension, and controlled magnetism shape the surrounding field. Avoid fashion objects, jewelry literalism, flames, or over-saturated red glow.',
    negativePrompt: getStyleNegativePrompt('velvet_ember'),
    accentMotifs: [
      'copper ember glints embedded in velvet darkness',
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
      'study',
      'attention',
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
      'brave',
      'bold',
      'power',
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
      'wealth',
      'money',
      'receive',
      'expand',
    ],
    directionalBehavior: 'expanding arcs and layered outward growth',
    densityBehavior: 'rich but ordered supporting detail',
    focalBehavior: 'glowing center with branching peripheral accents',
    paletteBehavior:
      'fertile greens, gold, teal, warm earth, or luminous amber without currency imagery',
    rhythmBehavior: 'organic expansion, gradual bloom',
    motif:
      'abstract branching density and expanding arcs, never coins, cash, baskets, or financial symbols',
  },
  {
    theme: 'Healing / peace',
    keywords: [
      'healing',
      'heal',
      'health',
      'peace',
      'calm',
      'serenity',
      'rest',
      'soften',
      'recover',
    ],
    directionalBehavior: 'soft circular settling or downward calm',
    densityBehavior: 'spacious field with gentle detail',
    focalBehavior: 'softened center with less hard contrast',
    paletteBehavior: 'cool blues, pale green, silver, ivory, or soft violet where compatible',
    rhythmBehavior: 'slow, quiet, breathing motion',
    motif:
      'settling haze and softened edge rhythm, never medical symbols, bodies, or literal nature icons',
  },
  {
    theme: 'Love / relationship',
    keywords: [
      'love',
      'relationship',
      'romance',
      'partner',
      'connection',
      'intimacy',
      'family',
      'belong',
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
      'safe',
      'boundary',
      'boundaries',
      'stable',
      'stability',
      'ground',
      'foundation',
      'endure',
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
    keywords: ['create', 'creative', 'creativity', 'art', 'voice', 'express', 'inspire', 'imagine'],
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
  focalBehavior: 'the preserved sigil remains the dominant focal point',
  paletteBehavior:
    'the selected style palette remains primary with a restrained accent temperature shift',
  rhythmBehavior: 'steady, composed, and non-literal',
  motif: 'abstract atmospheric emphasis shaped by the wording, never literal illustration',
};

const COMPOSITION_VARIANTS: Record<CompositionFamily, string[]> = {
  'CENTRED STILLPOINT': [
    'Hold the sigil as a stable center while light, texture, and density settle toward it.',
    'Keep the sigil central, but vary halo weight and peripheral spacing so the render does not feel templated.',
    'Build a calm inner field and let outer detail fade with measured restraint.',
    'Use a clear central stillpoint with one subtle asymmetry in light or material behavior.',
  ],
  'OFFSET FIELD': [
    'Keep the sigil geometry unchanged while the supporting field is biased toward one side or quadrant.',
    'Use asymmetrical density and open counter-space so the image feels spatially authored.',
    'Let the surrounding material drift off-center while the sigil remains structurally stable.',
    'Create one dominant off-axis field of light, texture, or atmosphere behind the sigil.',
  ],
  'DIRECTIONAL FLOW': [
    'Move atmosphere across or around the preserved sigil with a clear directional current.',
    'Use flowing density that passes behind the sigil without dragging, bending, or changing it.',
    'Let light or texture travel from one edge of the frame toward another with controlled rhythm.',
    'Create a visible path through the background field while the sigil stays exact and calm.',
  ],
  'LOWER-ANCHORED': [
    'Weight the image low in the frame with grounded shadow, material depth, or base pressure.',
    'Let the lower field feel rooted while the upper field has more breathing room.',
    'Use a quiet base of density beneath the preserved sigil without turning it into a literal pedestal.',
    'Make the composition feel settled and rooted through shadow and material gravity.',
  ],
  'DIAGONAL TENSION': [
    'Introduce controlled diagonal force through light, haze, texture, or density behind the sigil.',
    'Let one diagonal current cut through the surrounding field without touching the sigil geometry.',
    'Balance a strong diagonal atmosphere with enough negative space to preserve clarity.',
    'Use diagonal pressure as emotional movement, not as a new symbol or scene.',
  ],
  'OPEN VOID': [
    'Make negative space a major part of the design, with very restrained secondary detail.',
    'Let the sigil breathe in open space while texture appears only where it strengthens focus.',
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

  return `SIGIL IDENTITY:
This sigil embodies the intention "${cleanIntention}".

STRUCTURAL PRESERVATION — ABSOLUTE PRIORITY:

1. The input image defines the exact sigil geometry. Preserve ALL lines, circles, intersections, and shapes exactly as shown.
2. Do NOT warp, melt, bend, rotate, skew, redraw, simplify, or reinterpret the sigil geometry.
3. Do NOT add text, labels, captions, letters, words, numbers, runes, glyph alphabets, or readable symbols anywhere.
4. The sigil geometry is immutable. Treat it as a fixed engraved plate beneath all styling.
5. Styling may influence atmosphere, texture, framing, lighting, color, density, ornament, and peripheral composition only. Never alter the preserved sigil structure.

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
Use 2 to 3 subtle symbolic motifs maximum.

Motif structure:

* Style-native motif tied to the style family: ${style.styleNativeMotif}
* Intention-responsive motif: ${signal.motif}
* Optional accent motif: ${accentMotif}

Motifs may appear as:

* engraved border accents
* background texture
* negative-space shaping
* light behavior
* atmospheric clustering
* secondary field geometry
* material imperfections
* peripheral marks

Motifs must be abstract, ornamental, and secondary.
Do not place motifs as central icons.
Do not repeat the same Mercury / Air / prism motif set in every style.
Each style should have its own motif logic.

COMPOSITIONAL FAMILY:
${style.compositionFamily}

Use this composition family intentionally.
${compositionVariant}
Do not default every render to the same centered mystical-poster composition.

Composition families:

* CENTRED STILLPOINT: sigil feels stable, complete, and central
* OFFSET FIELD: supporting energy is asymmetrical and spatially interesting
* DIRECTIONAL FLOW: atmosphere moves across or around the sigil
* LOWER-ANCHORED: image feels grounded, weighted, and rooted
* DIAGONAL TENSION: energy cuts through the composition with controlled force
* OPEN VOID: negative space is a major part of the design

COLOR + MATERIAL LOGIC:
Palette lane: ${style.paletteLane}
Material behavior: ${style.materialBehavior}

Use a distinct palette lane for this style.
The Anchor brand palette should guide taste, not imprison the artwork.
Allow richer variation in hue, substrate, glow, haze, bloom, and secondary accents where appropriate.

UNIQUENESS MANDATE:
This render must feel specific to:

* this sigil
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
Avoid stock mystical poster aesthetics.
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
✗ Distorted, warped, changed, broken, or redrawn sigil geometry
✗ Overcrowded ornament that competes with the sigil
✗ Low-quality blur, muddy details, random artifacts

Allowed:
✓ Subtle symbolic implication
✓ Abstract atmospheric cues
✓ Non-literal emotional tone
✓ Style-native ornament
✓ Intention-reactive density and emphasis
✓ Background and border detail that never alters the sigil

FINAL ART DIRECTION:
Create a finished image where the sigil remains exact and untouched, while the surrounding world feels uniquely shaped by the selected style and the emotional signal of the intention.`;
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
