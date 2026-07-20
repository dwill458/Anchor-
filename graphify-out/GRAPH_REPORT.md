# Graph Report - anchor/mobile/src/screens/vault  (2026-07-16)

## Corpus Check
- Corpus is ~21,303 words - fits in a single context window. You may not need a graph.

## Summary
- 162 nodes · 214 edges · 14 communities (8 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Orb Background
- Anchor Collection
- Anchor Details
- Sigil Aura
- Detail Screen Tests
- Physical Anchor
- Hero Anchor Card
- Letter Distillation
- Anchor Section
- Daily Streak
- Forge CTA
- Ghost Anchor
- Practice Path
- Empty Sanctuary

## God Nodes (most connected - your core abstractions)
1. `hasIgnited()` - 10 edges
2. `VaultScreen()` - 9 edges
3. `DivineSigilAura()` - 7 edges
4. `isAnchorReleased()` - 7 edges
5. `toDisplayAnchor()` - 4 edges
6. `AnchorDetailsScreen()` - 4 edges
7. `getFadeUp()` - 4 edges
8. `seeded()` - 4 edges
9. `HeroAnchorCardInner()` - 4 edges
10. `VaultGridModal()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `VaultScreen()` --calls--> `hasIgnited()`  [EXTRACTED]
  VaultScreen.tsx → utils/anchorStateHelpers.ts
- `VaultScreen()` --calls--> `isAnchorReleased()`  [EXTRACTED]
  VaultScreen.tsx → utils/anchorStateHelpers.ts
- `HeroAnchorCardInner()` --calls--> `hasIgnited()`  [EXTRACTED]
  components/HeroAnchorCard.tsx → utils/anchorStateHelpers.ts
- `AnchorStack()` --calls--> `isAnchorReleased()`  [EXTRACTED]
  components/AnchorStack.tsx → utils/anchorStateHelpers.ts
- `SigilHeroCardProps` --references--> `AnchorState`  [EXTRACTED]
  components/SigilHeroCard.tsx → utils/anchorStateHelpers.ts

## Import Cycles
- None detected.

## Communities (14 total, 6 thin omitted)

### Community 0 - "Orb Background"
Cohesion: 0.09
Nodes (24): AtmosphericOrbs(), AtmosphericOrbsProps, OrbMotion, OrbProps, styles, SanctuaryHeader(), SanctuaryHeaderProps, styles (+16 more)

### Community 1 - "Anchor Collection"
Cohesion: 0.13
Nodes (19): AnchorStack(), AnchorStackProps, StackCard, StackCardProps, styles, styles, VaultGridModal(), VaultGridModalProps (+11 more)

### Community 2 - "Anchor Details"
Cohesion: 0.13
Nodes (15): AnchorDetailsScreen(), C, CARD_GRADIENT, CATEGORY_LABELS, formatDate(), getDateValue(), isoWeekKey(), localDateString() (+7 more)

### Community 3 - "Sigil Aura"
Cohesion: 0.16
Nodes (17): buildParticles(), buildRaySeeds(), buildStreaks(), clamp01(), DivineSigilAura(), DivineSigilAuraProps, ParticleSeed, RaySeed (+9 more)

### Community 4 - "Detail Screen Tests"
Cohesion: 0.12
Nodes (15): mockAnalyticsTrack, mockAnchor, mockCaptureRef, mockDel, mockExportAnchorArtwork, mockNavigate, mockNavigateToPractice, mockRemoveAnchor (+7 more)

### Community 5 - "Physical Anchor"
Cohesion: 0.17
Nodes (10): PhysicalAnchorCardProps, styles, MODAL_WIDTH, PhysicalAnchorModal(), PhysicalAnchorModalProps, Product, PRODUCTS, TODO: Navigate to product detail when API ready (+2 more)

### Community 6 - "Hero Anchor Card"
Cohesion: 0.31
Nodes (8): anchorDisplayName(), CIRCLE_SIZE, formatCategory(), HeroAnchorCard, HeroAnchorCardInner(), HeroAnchorCardProps, styles, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }

### Community 7 - "Letter Distillation"
Cohesion: 0.40
Nodes (3): DistilledLettersModalProps, styles, { width }

## Knowledge Gaps
- **81 isolated node(s):** `{ width: SCREEN_W }`, `SIGIL_CIRCLE_SIZE`, `C`, `CARD_GRADIENT`, `MINI_WEEK_DAYS` (+76 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DivineSigilAura()` connect `Sigil Aura` to `Anchor Details`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `VaultScreen()` connect `Orb Background` to `Anchor Collection`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `hasIgnited()` connect `Anchor Collection` to `Orb Background`, `Hero Anchor Card`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `{ width: SCREEN_W }`, `SIGIL_CIRCLE_SIZE`, `C` to the rest of the system?**
  _81 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Orb Background` be split into smaller, more focused modules?**
  _Cohesion score 0.08602150537634409 - nodes in this community are weakly interconnected._
- **Should `Anchor Collection` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._
- **Should `Anchor Details` be split into smaller, more focused modules?**
  _Cohesion score 0.12857142857142856 - nodes in this community are weakly interconnected._