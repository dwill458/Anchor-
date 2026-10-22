# Vision creation refactor (Oct 2026)

Unified composer, Add Image sheet, voice input, Smart Photo Fit and scene-context isolation.

## Native rebuild required

Two new native modules were added to `anchor/mobile`:

- `expo-speech-recognition@^3.1.3` (the `sdk-54` line; do not install the SDK-58-numbered releases). Config plugin added in `app.json` with permission copy and `androidSpeechServicePackages`.
- `expo-image-manipulator@~14.0.8` (local crop and downscale for expansion).

Neither runs in Expo Go or an existing dev client. Rebuild the dev client / EAS build before testing voice or Photo Fit.
iOS gets `NSSpeechRecognitionUsageDescription` and an updated microphone string from the plugin.

## Voice input

- Lives only in `VisionSceneField` (composer and Add Image sheet). Never on the generation screens or the board.
- First use shows a disclosure (`dictationDisclosure`); on-device recognition is requested whenever the device supports it, otherwise Apple/Google speech services may process audio. Anchor never records or stores audio (`recordingOptions.persist: false`).
- The microphone is released on stop, on app background, and on unmount.

## Scene context isolation (backend)

`VisionGenerationService.run` (SCENE jobs) no longer attaches generated board images or earlier scene prompts to a new scene.
Only the person's own uploaded/camera photos are attached, and the prompt states they fix how named subjects look but never the location.
The Vision description is lowest-priority background. See `visionScenePlanning.ts`, `visionWorldReferences.ts`, `image/visionReferences.ts`.

## Expand with AI

`POST /api/v2/vision/photo-expand` (Pro-gated, shares the vision generation rate limiter): pads the photo to 9:16, asks Gemini to fill only the blank bands, then composites the original pixels back (6px seam feather). It returns a preview only; nothing is stored until the person confirms and the chosen file is uploaded through the normal asset upload.
Declined when the photo already fits or more than 60% of the frame would be invented.
Each expansion is one additional image-model call.
