import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// The package script executes this checker from anchor/mobile.
const mobileSrc = path.resolve(process.cwd(), 'src');
const protectedRoots = ['components', 'screens', 'theme', 'navigation'];
const forbidden = ["/v2", "@/theme/v2", "@/components/v2", "@/screens/v2", "@/navigation/v2"];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'v2' || entry.name === '__tests__') continue;
      files.push(...await walk(file));
    } else if (/\.(ts|tsx)$/.test(entry.name)) files.push(file);
  }
  return files;
}

const violations = [];
for (const root of protectedRoots) {
  for (const file of await walk(path.join(mobileSrc, root))) {
    const text = await readFile(file, 'utf8');
    if (forbidden.some(value => text.includes(value))) violations.push(path.relative(process.cwd(), file));
  }
}
if (violations.length) {
  console.error('Production-to-V2 import boundary violation:', violations.join(', '));
  process.exit(1);
}
console.log('V2 import boundary OK');
