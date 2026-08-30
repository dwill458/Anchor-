import type { AIStyle } from '../services/AIEnhancer';
import {
  VALID_AI_STYLES,
  buildStylePrompt,
  getStyleNegativePrompt,
} from '../services/stylePromptLibrary';

const SUPPORTED_STYLES: readonly AIStyle[] = VALID_AI_STYLES;

type CliOptions = {
  intention: string;
  allVariations: boolean;
  variationIndex: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    intention: 'steady focus',
    allVariations: false,
    variationIndex: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--intention' && argv[i + 1]) {
      options.intention = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--variation-index' && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        options.variationIndex = parsed;
      }
      i += 1;
      continue;
    }

    if (arg === '--all-variations') {
      options.allVariations = true;
    }
  }

  return options;
}

function variationLabel(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function writeLine(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function main(): void {
  // Silence repo logger chatter so the output can be redirected straight to Markdown.
  console.log = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;

  const options = parseArgs(process.argv.slice(2));

  const variationIndexes = options.allVariations
    ? [0, 1, 2, 3]
    : [Math.max(0, options.variationIndex)];

  writeLine('# Anchor Generation Prompt Pack');
  writeLine();
  writeLine(`- Intention: "${options.intention}"`);
  writeLine(`- Styles: ${SUPPORTED_STYLES.length}`);
  writeLine(
    `- Variations: ${options.allVariations ? 'A, B, C, D' : variationLabel(variationIndexes[0])}`
  );
  writeLine('- Source: backend/src/services/stylePromptLibrary.ts#buildStylePrompt');
  writeLine();

  for (const style of SUPPORTED_STYLES) {
    writeLine(`## ${style}`);
    writeLine();

    for (const index of variationIndexes) {
      writeLine(`### Variation ${variationLabel(index)}`);
      writeLine();
      writeLine('```text');
      writeLine(buildStylePrompt(options.intention, style, index).trim());
      writeLine('```');
      writeLine();
    }

    writeLine('### Negative Prompt');
    writeLine();
    writeLine('```text');
    writeLine(getStyleNegativePrompt(style));
    writeLine('```');
    writeLine();
  }
}

main();
