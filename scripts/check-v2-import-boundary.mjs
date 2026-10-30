import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// The package script executes this checker from anchor/mobile.
const mobileSrc = path.resolve(process.cwd(), 'src');
const protectedRoots = ['components', 'screens', 'theme', 'navigation'];
const forbidden = ["/v2", "@/theme/v2", "@/components/v2", "@/screens/v2", "@/navigation/v2"];

/**
 * Anchor 2.0 transitional integration exceptions:
 * Shared surfaces (modals, share studio, settings, creation handoff) that were upgraded
 * to use V2 design tokens, V2 bottom sheets, and V2 presentation.
 * This list is frozen: any NEW file importing V2 from protected roots is rejected.
 */
const FROZEN_V2_INTEGRATION_EXCEPTIONS = new Set([
  'src/components/AnchorOptionsMenu.tsx',
  'src/components/chart/ChartMapCrop.tsx',
  'src/components/chart/ChartPreview.tsx',
  'src/components/chart/ChartProgressBar.tsx',
  'src/components/dev/DevMenuRow.tsx',
  'src/components/dev/devMenuStyles.ts',
  'src/components/ExportAnchorSheet.tsx',
  'src/components/ExportPreviewRenderer.tsx',
  'src/components/modals/ConfirmDeleteAnchorSheet.tsx',
  'src/components/modals/ConfirmUnchargedBurnSheet.tsx',
  'src/components/notifications/DailyReminderPrompt.tsx',
  'src/components/settings/DeveloperToolsSection.tsx',
  'src/components/settings/SettingsPrimitives.tsx',
  'src/components/share/AnchorShareStudio.tsx',
  'src/components/share/environmentLayout.ts',
  'src/components/share/prepareVisionShareAssets.ts',
  'src/components/share/shareData.ts',
  'src/components/share/ShareLayoutSelector.tsx',
  'src/components/share/shareTypes.ts',
  'src/components/share/StyleEditorialMorphPreview.tsx',
  'src/components/share/templates/environmentParts.tsx',
  'src/components/share/templates/EnvironmentPoster.tsx',
  'src/components/share/templates/shared.tsx',
  'src/components/share/templates/VisionExportTemplate.tsx',
  'src/components/share/VisionBackgroundPicker.tsx',
  'src/components/share/visionBoardExportFrame.ts',
  'src/components/ThreadStrength.tsx',
  'src/components/wavePath.ts',
  'src/screens/auth/LoginScreen.tsx',
  'src/screens/create/components/IntentionChrome.tsx',
  'src/screens/create/flow/AnchorCreationFlowScreen.tsx',
  'src/screens/create/flow/components/IntentionGhost.tsx',
  'src/screens/create/IntentionInputScreen.tsx',
  'src/screens/dev/ChartPreviewDevScreen.tsx',
  'src/screens/rituals/components/ConfirmModal.tsx',
  'src/screens/settings/EditProfileSubscreen.tsx',
  'src/screens/settings/HelpAboutSubscreen.tsx',
  'src/screens/settings/SettingsScreen.tsx',
  'src/screens/vault/components/PhysicalAnchorModal.tsx',
].map(p => path.normalize(p)));

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
    if (forbidden.some(value => text.includes(value))) {
      const rel = path.relative(process.cwd(), file);
      if (!FROZEN_V2_INTEGRATION_EXCEPTIONS.has(path.normalize(rel))) {
        violations.push(rel);
      }
    }
  }
}
if (violations.length) {
  console.error('Production-to-V2 import boundary violation:', violations.join(', '));
  process.exit(1);
}
console.log(`V2 import boundary OK (${FROZEN_V2_INTEGRATION_EXCEPTIONS.size} frozen legacy integrations audited)`);
