import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..', '..'); // anchor/mobile/src

function collect(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      collect(full, acc);
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

const UI_D_DIRS = [
  join(ROOT, 'screens', 'v2', 'home'),
  join(ROOT, 'screens', 'v2', 'anchors'),
  join(ROOT, 'components', 'v2', 'home'),
  join(ROOT, 'components', 'v2', 'anchors'),
  join(ROOT, 'hooks', 'v2', 'home'),
  join(ROOT, 'hooks', 'v2', 'anchors'),
  join(ROOT, 'adapters', 'v2', 'home'),
];

const uiDFiles = UI_D_DIRS.flatMap((dir) => collect(dir));

describe('UI-D isolation', () => {
  it('has files under every owned namespace', () => {
    expect(uiDFiles.length).toBeGreaterThan(15);
  });

  it('does not import other V2 workstream screen namespaces (creation / practice / vision / progress / release / chart / paywall / settings)', () => {
    const forbidden = /from ['"]@\/screens\/v2\/(creation|practice|vision|progress|release|chart|paywall|settings)/;
    const offenders = uiDFiles.filter((file) => forbidden.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('does not touch backend, central V2 navigation, or legacy theme', () => {
    const forbidden = /from ['"]@\/(navigation\/v2\/(routes|types|AnchorV2Navigator)|theme\/colors|theme\/typography)['"]/;
    const offenders = uiDFiles.filter((file) => forbidden.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('is never imported by production (non-v2) screens or navigation', () => {
    const productionDirs = [
      join(ROOT, 'navigation'),
      join(ROOT, 'screens', 'vault'),
      join(ROOT, 'screens', 'practice'),
      join(ROOT, 'screens', 'chart'),
    ];
    const forbidden = /from ['"]@\/(screens|components|hooks|adapters)\/v2\/(home|anchors)/;
    const offenders = productionDirs
      .filter((dir) => {
        try {
          statSync(dir);
          return true;
        } catch {
          return false;
        }
      })
      .flatMap((dir) => collect(dir))
      // The development-only AnchorV2Navigator legitimately mounts V2 screens.
      .filter((file) => !/[\\/]v2[\\/]/.test(file))
      .filter((file) => forbidden.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
