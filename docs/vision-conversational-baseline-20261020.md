# Vision conversational creation baseline — 2026-10-20

- Workspace: `E:\Projects\Anchor`; backend `backend`; mobile `anchor/mobile`.
- Starting branch: `feat/celebration-layer`, commit `8e82063206049234147f5ef2eae62b8bb63c43dd`.
- Implementation branch: `feat/vision-conversational-creation-20261020`, created from the same HEAD without replacing working files.
- Runtime manifests: Expo ^58.0.14, React Native 0.88.0, React 19.3.0, TypeScript ~6.0.3 mobile; Prisma ^5.8.1 backend. Host Node v24.15.0, npm 11.12.1.
- Existing dirty work: Chart mobile service/tests; backend Chart planner/schema/routes/tests; Thread strength/backfill/tests; Prisma Thread strength Float changes and migration `20261020210000_thread_v2_precision`; untracked technical audit and Chart planner test. Preserve these independently from Vision changes.
- All final source resources found at `C:\Users\dwill\.gemini\antigravity\brain\36218526-29f9-4723-b153-404e5479f9e3`: final handoff, editable HTML, all A1–E1 PNGs and storyboard. These supersede conceptual designs.
- API baseline: authenticated anchor-scoped `scene-generation` POST/GET, generation retry; owner-scoped assets; Pro and AI rate limiters; existing two-candidate scene worker. Keep single-reference `startAssetId` compatibility.
- PR #340 remote state: open draft, one commit `f1abbea2`, paper materials/entrance Anchor; base `feat/celebration-layer`. Its head already appears in this checkout via local merge `50a174d7`. Audit attribution to photo expansion is inaccurate; independently verify expansion history/deployment.
- Baseline tests and TypeScript started before edits; detailed results are recorded in the implementation report.

## Integration ownership

Sol owns backend schema/migration, generation service/provider contracts, API routes, generation hooks, creation actions and ceremony integration. Luna edits are restricted to assigned presentation files and their tests. Shared component contracts live in `anchor/mobile/src/types/visionConversation.ts` and are owned by Sol.

## Architecture

Extend existing generation rows as rounds and existing candidate rows as stable candidates. Add one scene session and normalized per-generation reference associations. The parent candidate is a separate foreign key, outside the five attachments. Legacy rows remain sessionless. CREATE/COMPOSE receive only explicitly selected references; EDIT requires an owned successful candidate in this session. Provider endpoint selection remains independent from semantic intent. Navigation never updates lineage.
