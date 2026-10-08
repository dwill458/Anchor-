import fs from 'fs';
import path from 'path';

/** A corrupted character once shipped as "Preparing your Vision�"; keep the Vision tree free of them. */
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(tsx?|json)$/.test(entry.name) ? [full] : [];
  });
}

describe('Vision source encoding', () => {
  it('contains no U+FFFD replacement characters under components/v2/vision', () => {
    const root = path.resolve(__dirname, '..');
    const hits = sources(root).filter(file => file !== __filename && fs.readFileSync(file, 'utf8').includes('�'))
      .map(file => path.relative(root, file));
    expect(hits).toEqual([]);
  });
});
