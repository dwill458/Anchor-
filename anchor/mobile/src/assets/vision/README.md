# Vision "possible future" photography

Shown only before an Anchor has a Vision (Vision empty state, the describe
step, the generation atmosphere, and the Anchor Details "no Vision" card).
Once a Vision exists every one of those surfaces uses the person's own cover
image instead.

Generated 2026-09-21 through the backend's own Gemini image model
(`GEMINI_VISION_IMAGE_MODEL`) as documentary/editorial 35mm photographs:
natural light, muted realistic colour, fine grain, faces never shown clearly,
no text, screens, logos or fantasy. They are colour-neutral on purpose — the
Anchor's category colour is applied at runtime as a ~12% wash
(`VisionPhoto`), so one set serves all twelve categories.

| file | subject | used for |
| --- | --- | --- |
| `vision-future-window.jpg` | person from behind at a sunlit window over a city | desire, spirituality, custom |
| `vision-future-desk.jpg` | desk at the start of a workday, chair pulled back | career, abundance, learning |
| `vision-future-studio.jpg` | hands opening a studio door | creativity |
| `vision-future-threshold.jpg` | person stepping through a doorway into light | adventure, focus |
| `vision-future-home.jpg` | kitchen table set for people about to gather | relationships, family |
| `vision-future-movement.jpg` | hands lacing a running shoe at dawn | health |
| `vision-future-window-wide.jpg` | wide version of the window scene | Anchor Details empty Vision card |

The mapping lives in `components/v2/vision/visionArt.ts`. JPEG, 1080px wide
(1600px for the wide card), mozjpeg q80.
