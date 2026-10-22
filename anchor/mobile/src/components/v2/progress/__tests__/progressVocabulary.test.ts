import fs from 'fs';
import path from 'path';

/**
 * Anchor 2.0 language rules for the Progress surface. Internal identifiers keep
 * the data names (`deepPrimeCount`, `deep_prime`); only text a user can read
 * is checked, so this scans string literals and JSX text, never identifiers or
 * comments. "Deep Prime" is the mode's name here; bare "prime"/"priming" and Consistency are not. A word-boundary match leaves `deepPrime` and `deep_prime` alone.
 */
const SRC = path.resolve(__dirname, '../../../..');
const DIRS = [
  path.join(SRC, 'components/v2/progress'),
  path.join(SRC, 'screens/v2/progress'),
  path.join(SRC, 'adapters/v2/progress'),
  path.join(SRC, 'hooks/v2/progress'),
];

const FORBIDDEN =
  /\b(sigils?|rituals?|charge[sd]?|charging|spells?|streaks?|attract(?:s|ed|ing)?|mindfulness|meditat(?:ion|e)|vision board|occult|(?<!deep )prim(?:e|ing)|consistency)\b/i;

function sourceFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(dir, entry.name));
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Quoted strings and JSX text nodes: what could reach a screen. */
function userFacingText(source: string): string[] {
  const code = stripComments(source);
  const strings = Array.from(code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)).map(
    (match) => match[1] ?? match[2] ?? match[3] ?? '',
  )
    // Interpolated expressions are code and module specifiers are paths: neither is shown to a user.
    .map((text) => text.replace(/\$\{[^}]*\}/g, ''))
    .filter((text) => !/^(@\/|\.{1,2}\/)/.test(text));
  const jsxText = Array.from(code.matchAll(/>\s*([^<>{}=;\n][^<>{}]*?)\s*</g)).map((match) => match[1]);
  return [...strings, ...jsxText];
}

describe('Progress vocabulary', () => {
  const files = DIRS.flatMap(sourceFiles);

  it('finds the progress sources it is meant to scan', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((file) => file.endsWith('V2ProgressRhythm.tsx'))).toBe(true);
  });

  it.each(files.map((file) => [path.relative(SRC, file), file]))('%s has no forbidden user-facing words', (_name, file) => {
    const offenders = userFacingText(fs.readFileSync(file as string, 'utf8')).filter((text) => FORBIDDEN.test(text));
    expect(offenders).toEqual([]);
  });

  it('labels the deep-practice mode "Deep Prime" in the mix card', () => {
    const source = fs.readFileSync(path.join(SRC, 'components/v2/progress/progressTokens.ts'), 'utf8');
    expect(source).toMatch(/deepPrime: 'Deep Prime'/);
  });
});
