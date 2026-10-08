# Vision example pictures

The Ask screen shows three example prints for the Anchor's category. Each one is a picture plus the
caption and moment in `components/v2/vision/ceremony/visionExamples.ts`.

- Path: `src/assets/vision/examples/<category>/<1|2|3>.webp`
- Categories: desire, health, career, relationships, creativity, spirituality, abundance, family, learning, adventure, custom
- Spec: 4:5 portrait, 900x1125, WebP quality 80 (about 60-110 KB each)
- Scene prompts and the Gemini house-style prefix: `VISION_ENTRANCE_CODEX_PROMPT.md` section 7

Metro needs a static `require()` per file, so after adding or replacing pictures run, from `anchor/mobile`:

    node scripts/generate-vision-example-manifest.mjs

A missing picture is simply left out: a category with fewer than three tops up from `custom`, and with none
anywhere Ask shows the empty "What do you see?" frame. `custom` is the fallback for every category, so add it first.
