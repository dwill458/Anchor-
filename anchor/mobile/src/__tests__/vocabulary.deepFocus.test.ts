import fs from 'fs';
import path from 'path';
import ts from 'typescript';
const SRC = path.resolve(__dirname, '..');
const ROOTS = ['components/v2', 'screens/v2', 'adapters/v2', 'constants/v2', 'hooks/v2', 'widgets'];
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '__tests__') return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? files(file) : /\.tsx?$/.test(file) && !/\.(test|spec)\./.test(file) ? [file] : [];
  });
}
function allowed(file: string, node: ts.Node, text: string): boolean {
  if (text !== 'Deep Prime') return false;
  if (file === 'constants/v2/practice.ts') {
    return ts.isLiteralTypeNode(node.parent) || (ts.isPropertyAssignment(node.parent) && node.parent.name === node);
  }
  return file === 'adapters/v2/home/todayForDisplay.ts' && ts.isPropertyAssignment(node.parent) && node.parent.name.getText() === 'deep_prime';
}
it('keeps Deep Focus in all V2 and widget display strings, preserving only the server enum/mapping', () => {
  const offenders: string[] = [];
  const sources = ROOTS.flatMap(dir => files(path.join(SRC, dir)));
  expect(sources.length).toBeGreaterThan(100);
  for (const file of sources) {
    const relative = path.relative(SRC, file).replace(/\\/g, '/');
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
        if (/\bdeep primes?\b/i.test(node.text) && !allowed(relative, node, node.text)) {
          offenders.push(`${relative}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${node.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(offenders).toEqual([]);
});
