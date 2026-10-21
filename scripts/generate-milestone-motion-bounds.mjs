// Offline build-time SVG geometry measurement. Browser is not part of app runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = path.join(root, 'design/milestones/approved-20261021/svg/earned');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const bounds = {};
  for (const name of (await fs.readdir(input)).filter(n => n.endsWith('.svg')).sort()) {
    await page.setContent(await fs.readFile(path.join(input, name), 'utf8'));
    Object.assign(bounds, await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('svg [id]')]
      .filter(el => typeof el.getBBox === 'function')
      .map(el => { const b = el.getBBox(); return [el.id, [b.x + b.width / 2, b.y + b.height / 2, b.y + b.height]]; }))));
  }
  await fs.writeFile(path.join(root, 'anchor/mobile/src/milestones/approvedMotionBounds.json'), JSON.stringify(bounds));
  await fs.copyFile(path.join(root, 'design/milestones/approved-20261021/docs/motion-spec.json'),
    path.join(root, 'anchor/mobile/src/milestones/approvedMotionSpec.json'));
} finally { await browser.close(); }
