import {
  CATEGORY_KEYWORDS,
  KEYWORD_SETS,
  detectCategoryFromText,
  resolveAnchorCategory,
  scoreCategoryFromText,
} from '../categoryDetection';
import { classifyToTier, classifyToTierPreliminary } from '../tierClassifier';
import { FOCUS_AREAS, focusAreaById, isSpecificFocus } from '@/constants/v2/focusAreas';
import { CATEGORY_TO_TIER, PlanetaryTier, type AnchorCategory } from '@/types';
import intentionCorpus from '../__fixtures__/intentions.json';

describe('detectCategoryFromText — permanent corpus', () => {
  it('contains at least 60 real-world intentions in the fixture corpus', () => {
    expect(intentionCorpus.length).toBeGreaterThanOrEqual(60);
  });

  it.each(
    intentionCorpus.map((entry) => [entry.intention, entry.expected as AnchorCategory] as const),
  )('classifies corpus intention "%s" as %s', (intention, expected) => {
    expect(detectCategoryFromText(intention)).toBe(expected);
  });
});

describe('detectCategoryFromText — refinement rules & spot-checks', () => {
  it('1. enforces the confidence margin rule (topScore >= 2 OR topScore - runnerUp >= 2)', () => {
    const longSingleHitIntention =
      'Even though the afternoon was long and we walked past a single office building on the corner of the street, everything else about the quiet Tuesday felt completely ordinary and unremarkable to everyone there';
    const words = longSingleHitIntention.trim().split(/\s+/);
    expect(words.length).toBeGreaterThanOrEqual(30);

    const scores = scoreCategoryFromText(longSingleHitIntention);
    expect(scores.career).toBe(1); // only "office"
    expect(detectCategoryFromText(longSingleHitIntention)).toBe('desire');
  });

  it('2. removes dead +0.25 desire framing weighting so framing words never interfere', () => {
    const scores = scoreCategoryFromText('I want to get healthier');
    expect(scores.desire).toBe(0);
    expect(scores.health).toBeGreaterThanOrEqual(2);
    expect(detectCategoryFromText('I want to get healthier')).toBe('health');

    const workStressScores = scoreCategoryFromText("I don't want to be stressed at work");
    expect(workStressScores.desire).toBe(0);
    expect(workStressScores.career).toBe(5);
    expect(workStressScores.health).toBe(1);
    expect(detectCategoryFromText("I don't want to be stressed at work")).toBe('career');
  });

  it('3. falls back to desire on exact ties instead of using an arbitrary tie-break order', () => {
    // 1-to-1 tie
    const tieOneScores = scoreCategoryFromText('work and money');
    expect(tieOneScores.career).toBe(1);
    expect(tieOneScores.abundance).toBe(1);
    expect(detectCategoryFromText('work and money')).toBe('desire');

    // >=2 exact tie (2-to-2 tie between career and abundance)
    const tieTwoText = 'Career promotion and wealth budget';
    const tieTwoScores = scoreCategoryFromText(tieTwoText);
    expect(tieTwoScores.career).toBe(2);
    expect(tieTwoScores.abundance).toBe(2);
    expect(detectCategoryFromText(tieTwoText)).toBe('desire');
  });

  it('4. maps onboarding "Something else" to custom end-to-end while classifier no-match returns desire', () => {
    const somethingElse = focusAreaById('something_else');
    expect(somethingElse.category).toBe('custom');
    expect(resolveAnchorCategory(somethingElse.category)).toBe('custom');
    expect(isSpecificFocus(somethingElse.category)).toBe(false);

    // Classifier no-match still returns desire
    expect(detectCategoryFromText('It happens')).toBe('desire');
    expect(detectCategoryFromText('')).toBe('desire');
  });

  it('6. matches explicit inflections without a fragile stemmer (stress, stresses, glass, running, creating)', () => {
    expect(KEYWORD_SETS.health.has('stress')).toBe(true);
    expect(KEYWORD_SETS.health.has('stresses')).toBe(true);
    expect(KEYWORD_SETS.health.has('stressed')).toBe(true);
    expect(KEYWORD_SETS.health.has('running')).toBe(true);
    expect(KEYWORD_SETS.creativity.has('creating')).toBe(true);

    // "glass" is not mangled into a false positive
    for (const category of Object.keys(CATEGORY_KEYWORDS) as AnchorCategory[]) {
      expect(KEYWORD_SETS[category].has('glass')).toBe(false);
    }
    expect(detectCategoryFromText('The clear glass on the wooden table reflects the morning light')).toBe('desire');
  });

  it('disambiguates known multi-word phrases accurately', () => {
    expect(detectCategoryFromText('run a marathon')).toBe('health');
    expect(detectCategoryFromText('run for office')).toBe('career');
    expect(detectCategoryFromText('pay off my credit card')).toBe('abundance');
    expect(detectCategoryFromText('save money each month')).toBe('abundance');
    expect(detectCategoryFromText('be present each day')).toBe('spirituality');
    expect(detectCategoryFromText('move abroad this year')).toBe('adventure');
  });
});

describe('resolveAnchorCategory', () => {
  it.each([
    'desire', 'health', 'career', 'relationships', 'creativity', 'spirituality',
    'abundance', 'family', 'learning', 'adventure', 'custom',
  ])('keeps the persisted category %s', (category) => {
    expect(resolveAnchorCategory(category)).toBe(category);
    expect(resolveAnchorCategory(category.toUpperCase())).toBe(category);
  });

  it('maps older spellings and never guesses from nothing', () => {
    expect(resolveAnchorCategory('healing')).toBe('health');
    expect(resolveAnchorCategory('Career_Success')).toBe('career');
    expect(resolveAnchorCategory('something-new')).toBe('custom');
    expect(resolveAnchorCategory(undefined)).toBe('custom');
    expect(resolveAnchorCategory(null)).toBe('custom');
    expect(resolveAnchorCategory(42)).toBe('custom');
  });

  it('preserves all FOCUS_AREAS categories through resolveAnchorCategory', () => {
    for (const area of FOCUS_AREAS) {
      expect(resolveAnchorCategory(area.category)).toBe(area.category);
    }
  });
});

describe('classifyToTier — AI tier classifier precedence rule', () => {
  it('uses authoritative CATEGORY_TO_TIER and never calls the AI endpoint for specific categories', async () => {
    const mockAiFetcher = jest.fn().mockResolvedValue({ tier: PlanetaryTier.VENUS, confidenceScore: 0.99 });

    const prelim = classifyToTierPreliminary('I run a marathon', 'health');
    expect(prelim.isCustomFallback).toBe(false);
    expect(prelim.tier).toBe(CATEGORY_TO_TIER.health);

    const result = await classifyToTier('I run a marathon', 'health', mockAiFetcher);
    expect(mockAiFetcher).not.toHaveBeenCalled();
    expect(result.tier).toBe(PlanetaryTier.MARS);
    expect(result.category).toBe('health');
    expect(result.isCustomFallback).toBe(false);
  });

  it('calls the AI tier classifier ONLY when the resolved category is a fallback (desire or custom)', async () => {
    const mockAiFetcher = jest.fn().mockResolvedValue({ tier: PlanetaryTier.JUPITER, confidenceScore: 0.91 });

    const desireResult = await classifyToTier('It happens', 'desire', mockAiFetcher);
    expect(mockAiFetcher).toHaveBeenCalledTimes(1);
    expect(mockAiFetcher).toHaveBeenCalledWith('It happens', 'desire');
    expect(desireResult.tier).toBe(PlanetaryTier.JUPITER);
    expect(desireResult.isCustomFallback).toBe(true);

    const customResult = await classifyToTier('My own personal intention', 'custom', mockAiFetcher);
    expect(mockAiFetcher).toHaveBeenCalledTimes(2);
    expect(mockAiFetcher).toHaveBeenLastCalledWith('My own personal intention', 'custom');
    expect(customResult.tier).toBe(PlanetaryTier.JUPITER);
    expect(customResult.isCustomFallback).toBe(true);
  });
});
