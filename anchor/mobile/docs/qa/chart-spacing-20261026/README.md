# Chart spacing verification - 2026-10-26

- User reference: 165852.jpg (title touching completed-Move card).
- Shared sheet header now owns 12dp clearance before scroll content; the One Move row no longer adds its own 10dp top margin.
- Completion notice and Move/all-done card share a 12dp stack gap.
- Android physical-device Chart motion lab: completed the synthetic Move, expanded the sheet, dismissed the completion notice using its 44dp close target, and captured after.png.
- This lab uses the production components with synthetic course data; it does not verify authenticated production waypoint completion.
- 23 focused UI tests passed (ChartSheetContent, ChartOneMoveRow, ChartSheet).
- Backend deployment 3d23539c-142c-4e81-88e5-e399f92c1acd reached SUCCESS; production health returned HTTP 200 with database ok.
- UI spacing changes are local mobile code, separate from the Railway backend release.
