import { distillIntention } from './distillation';
import { generateAllVariants } from './traditional-generator';

const SAMPLE_INTENTIONS = [
  'Lead with clarity today',
  'Stay grounded during conflict',
  'Move forward with confidence',
  'Respond calmly under pressure',
  'Honor my boundaries',
  'Trust my decisions',
];

function buildUniqueIntention(index: number): string {
  const suffixA = String.fromCharCode(65 + (index % 26));
  const suffixB = String.fromCharCode(65 + (Math.floor(index / 26) % 26));
  return `${SAMPLE_INTENTIONS[index % SAMPLE_INTENTIONS.length]} ${suffixA}${suffixB}`;
}

describe('intention-to-symbol performance audit', () => {
  it('measures the hot path for repeated conversions', () => {
    const coldIterations = 1000;
    const warmIterations = 5000;
    let totalSvgBytes = 0;

    const coldStartedAt = performance.now();

    for (let index = 0; index < coldIterations; index += 1) {
      const intention = buildUniqueIntention(index);
      const distillation = distillIntention(intention);
      const variants = generateAllVariants(distillation.finalLetters);

      totalSvgBytes += variants.reduce((sum, variant) => sum + variant.svg.length, 0);
    }

    const coldElapsedMs = performance.now() - coldStartedAt;
    const coldAverageMs = coldElapsedMs / coldIterations;

    const warmStartedAt = performance.now();

    for (let index = 0; index < warmIterations; index += 1) {
      const intention = SAMPLE_INTENTIONS[index % SAMPLE_INTENTIONS.length];
      const distillation = distillIntention(intention);
      const variants = generateAllVariants(distillation.finalLetters);

      totalSvgBytes += variants.reduce((sum, variant) => sum + variant.svg.length, 0);
    }

    const warmElapsedMs = performance.now() - warmStartedAt;
    const warmAverageMs = warmElapsedMs / warmIterations;

    console.info(
      `[perf] intention-to-symbol cold ${coldIterations} in ${coldElapsedMs.toFixed(2)}ms `
      + `(avg ${coldAverageMs.toFixed(4)}ms); warm ${warmIterations} in ${warmElapsedMs.toFixed(2)}ms `
      + `(avg ${warmAverageMs.toFixed(4)}ms, svgBytes=${totalSvgBytes})`
    );

    expect(totalSvgBytes).toBeGreaterThan(0);
    expect(coldAverageMs).toBeLessThan(5);
    expect(warmAverageMs).toBeLessThan(2);
  });
});
