# Reproducing Vision checks

Recorded 20 October 2026. All commands are local; none deploys.

## Mobile

```powershell
cd E:\Projects\Anchor\anchor\mobile
$files = @(rg --files src -g "*[vV]ision*.test.*" -g "*PhotoFit*.test.*") + @("src/__tests__/reactNativeReanimated.test.tsx", "src/components/dev/__tests__/DevImageModelPicker.test.tsx", "src/components/v2/primitives/__tests__/V2SheetModal.test.tsx")
npx --no-install jest --runInBand --runTestsByPath @files
npx --no-install tsc --noEmit
```

## Backend

```powershell
cd E:\Projects\Anchor\backend
npx --no-install jest --runInBand --runTestsByPath `
  src/services/v2/__tests__/VisionGenerationService.test.ts `
  src/services/__tests__/GeminiImageService.test.ts `
  src/services/v2/__tests__/VisionService.test.ts `
  src/services/v2/__tests__/visionScenePlanning.test.ts `
  src/services/v2/__tests__/VisionService.integration.test.ts `
  src/services/v2/__tests__/VisionNoteService.test.ts `
  src/api/routes/v2/__tests__/visionConversationRoutes.test.ts `
  src/services/v2/__tests__/visionWorldReferences.test.ts `
  src/services/image/__tests__/OpenAIImageProviderAdapter.test.ts `
  src/api/routes/v2/__tests__/visionPhotoExpandRoute.test.ts `
  src/services/v2/__tests__/visionPhotoExpand.test.ts `
  src/services/v2/__tests__/VisionCaptionPersistence.test.ts `
  src/domain/v2/__tests__/visionNote.test.ts `
  src/services/v2/__tests__/visionConversationContract.test.ts `
  src/services/image/__tests__/devImageModels.test.ts `
  src/domain/v2/__tests__/visionCaption.test.ts `
  src/services/image/__tests__/GeminiImageProviderAdapter.test.ts `
  src/services/v2/__tests__/VisionConversationRetentionService.test.ts `
  src/services/v2/__tests__/VisionConversationService.test.ts `
  src/services/image/__tests__/ImageGenerationService.test.ts `
  src/services/v2/__tests__/visionConversationWorker.test.ts
npx --no-install tsc --noEmit
npx --no-install prisma validate
```

## Isolated migration

`backend/scripts/verify-vision-conversation-migration.mjs` requires `@electric-sql/pglite` from an explicitly supplied external harness directory and a baseline schema SQL file. It never reads DATABASE_URL. Run with the two paths described at the top of that script; the disposable harness is removed after acceptance.

## Windows native debug build

The 16 GB host used one Gradle worker, x86_64 only, 1536 MB Java heap, 1024 MB Node heap, and CMAKE_BUILD_PARALLEL_LEVEL=1. Java 17 / Android SDK were already installed. ANCHOR_EXPO58_QA was unset so existing Google Services configuration matches the application ID.

The standard build encountered Windows Ninja MAX_PATH errors. Only generated CMake caches were changed: configure Reanimated with CMAKE_OBJECT_PATH_MAX=240 and app default-app-setup with CMAKE_OBJECT_PATH_MAX=259, manually build each target with parallel=1, then package while excluding their configureCMakeDebug[x86_64] tasks so AGP does not overwrite those cache values to 1024. No dependency source or native application source was patched.

```powershell
cd E:\Projects\Anchor\anchor\mobile\android
$env:ANCHOR_EXPO58_QA=$null
$env:NODE_OPTIONS="--max-old-space-size=1024"
$env:CMAKE_BUILD_PARALLEL_LEVEL="1"
.\gradlew.bat :app:assembleDebug --no-daemon --max-workers=1 -PreactNativeArchitectures=x86_64 "-Dorg.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m" -x ":react-native-reanimated:configureCMakeDebug[x86_64]" -x ":app:configureCMakeDebug[x86_64]"
```

This packaging command requires the preceding manual CMake builds; cache directory hashes are machine specific. It is not a claim that a clean unmodified Windows Gradle command passes. Native generated outputs are removed after QA at the user's request. EAS/Linux and iOS builds were not executed.

Final targeted run: mobile 92 suites / 944 tests passed; backend 20 suites / 240 tests passed with one suite / two database tests skipped; migration 8 checks passed. Both TypeScript commands exited 0.

Android final-source export: npx --no-install expo export --platform android --output-dir .codex-vision-export --max-workers 1 (passed; generated output removed after verification).
