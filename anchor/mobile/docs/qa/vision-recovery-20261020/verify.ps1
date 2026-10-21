$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
Set-Location -LiteralPath $mobileRoot
$tests = @(
  'src/components/v2/vision/material/__tests__/VisionMaterialSurface.test.tsx'
  'src/components/v2/vision/notes/__tests__/VisionNoteRenderer.test.tsx'
  'src/components/v2/vision/board/__tests__/VisionBoardScrapbook.test.tsx'
  'src/components/v2/vision/board/__tests__/VisionBoardPhoto.test.tsx'
  'src/components/v2/vision/board/__tests__/VisionBoardNoteElement.test.tsx'
  'src/components/v2/vision/board/__tests__/visionScrapbookLayouts.test.ts'
  'src/components/v2/vision/board/__tests__/visionCanvas.test.ts'
  'src/components/v2/vision/board/__tests__/VisionBoardScene.notes.test.tsx'
  'src/components/v2/vision/__tests__/V2SavedVision.removal.test.tsx'
  'src/components/v2/vision/__tests__/VisionAddSceneSheet.test.tsx'
  'src/components/v2/vision/__tests__/VisionReferenceStrip.test.tsx'
  'src/components/v2/vision/__tests__/VisionRefineSheet.test.tsx'
  'src/components/v2/primitives/__tests__/V2SheetModal.test.tsx'
  'src/components/v2/primitives/__tests__/V2ActionSheet.test.tsx'
  'src/components/v2/primitives/__tests__/V2ConfirmSheet.test.tsx'
  'src/screens/v2/vision/__tests__/V2VisionNoteComposer.test.tsx'
  'src/screens/v2/practice/visualize/__tests__/V2VisualizePreparation.test.tsx'
  'src/screens/v2/practice/visualize/__tests__/visualizePhotoFrame.test.ts'
  'src/screens/v2/practice/visualize/__tests__/V2CinematicSessionLifecycle.test.tsx'
  'src/screens/v2/practice/visualize/__tests__/V2CinematicSessionReadiness.test.tsx'
)
& npx jest --runInBand --runTestsByPath @tests --silent *> (Join-Path $PSScriptRoot 'focused-tests-final.log')
if ($LASTEXITCODE -ne 0) { throw 'Focused tests failed; see focused-tests-final.log' }
& npx tsc --noEmit --pretty false *> (Join-Path $PSScriptRoot 'types-final.log')
if ($LASTEXITCODE -ne 0) { throw 'TypeScript failed; see types-final.log' }
& git diff --check
if ($LASTEXITCODE -ne 0) { throw 'Diff whitespace check failed' }
Get-Content (Join-Path $PSScriptRoot 'focused-tests-final.log') | Select-Object -Last 6
