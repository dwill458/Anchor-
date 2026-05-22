# Gemini Hard-Bans Change Record

Date: 2026-05-21

File changed:
- `backend/src/services/GeminiImageService.ts`

Purpose:
- Loosen the shared Nano Banana / Gemini prompt restrictions so symbolic motifs can appear more literally when they remain secondary and ornamental.

Location in file:
- `createPrompt()`
- shared `hardBans` template block

Previous text:

```ts
const hardBans = `
ABSOLUTE PROHIBITIONS — DO NOT INCLUDE ANY OF THE FOLLOWING:
✗ Text, words, letters, phrases, sentences, or any readable characters whatsoever
✗ Numbers, numerals, digits, or numeric symbols of any kind
✗ Currency: dollar signs ($), pound (£), euro (€), yen (¥), coins, coin stacks, banknotes, bills, cash, wallets, credit cards
✗ Financial: bank logos, charts, graphs, bar charts, pie charts, stock tickers, financial instruments
✗ Literal depictions of objects directly named in the intention — no direct illustration
✗ Literal people, human faces, human figures, or recognizable portraits
✗ Clipart, icon packs, sticker-style imagery, flat vector icons, or emoji-style symbols
✗ Photorealistic photography — keep to illustration, engraving, or filigree aesthetic
✗ Brand logos, watermarks, copyright symbols
✗ Literal chains, literal keys, literal locks, literal weapons, literal animals as main subjects
NO WORDS. NO NUMBERS. NO LETTERS. NO CURRENCY. NO FINANCIAL IMAGERY.`;
```

Current text:

```ts
const hardBans = `
STRICT AVOIDANCE RULES — KEEP THESE OUT OR STRONGLY DE-EMPHASIZED:
✗ Text, words, letters, phrases, sentences, or any readable characters whatsoever
✗ Numbers, numerals, digits, or numeric symbols of any kind
✗ Currency: dollar signs ($), pound (£), euro (€), yen (¥), coins, coin stacks, banknotes, bills, cash, wallets, credit cards
✗ Financial: bank logos, charts, graphs, bar charts, pie charts, stock tickers, financial instruments
✗ Recognizable brand logos, watermarks, copyright symbols
✗ Clipart, icon-pack, sticker-style, emoji-style, or flat app-icon aesthetics
✗ Photorealistic photography as the dominant rendering mode — keep the image illustrative, engraved, painterly, or atmospheric
✗ Recognizable human faces, portraits, or literal people as the main subject
✗ Overly literal object depictions directly illustrating the intention in a blunt or front-and-center way
✓ Symbolic motifs are allowed when they are abstracted, ornamental, secondary, and integrated into the border, background, texture field, or negative space
✓ Objects such as keys, locks, chains, animals, tools, or weapons may appear only as subtle symbolic accents, not as the dominant subject
NO WORDS. NO NUMBERS. NO LETTERS. NO CURRENCY. NO FINANCIAL IMAGERY.`;
```

Behavioral impact:
- Still hard-blocks text, numbers, currency, financial imagery, logos, and dominant literal people.
- Allows more literal symbolic accents when they remain secondary and compositionally integrated.

Manual revert:
1. Open `backend/src/services/GeminiImageService.ts`.
2. Replace the current `hardBans` block with the "Previous text" block above.
