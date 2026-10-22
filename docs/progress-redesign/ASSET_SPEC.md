# Milestone Asset Specification

Status: **development artwork only.** Everything below is drawn in code (`anchor/mobile/src/milestones/artGeometry.ts`, rendered by `MilestoneArtwork`). It is a coherent placeholder system, **not final production art**. No illustrator or 3D deliverable exists yet; the section "Production brief" is the request for it.

## What exists today

| Piece | Where |
|---|---|
| Definitions, copy, per-milestone art/celebration/haptic/sound/replay spec | `src/milestones/registry.ts` (versioned) |
| Vector geometry (120 x 120 canvas, colour roles) | `src/milestones/artGeometry.ts` |
| Renderer (earned / locked / fallback, category colour) | `src/components/v2/milestones/MilestoneArtwork.tsx` |

One component serves the collection thumbnail, the celebration, and the detail hero (scale via `size`). Locked state is a dashed muted outline with no fill and no glow. Unknown ids render a dashed neutral medallion marked by the `milestone-artwork-fallback` test id; it never shows unrelated art.

## Slots every milestone must fill

- Compact thumbnail (56-72dp), celebration hero (240-280dp), detail hero (200-240dp).
- Earned and locked treatments. Locked must never read as earned.
- Optional category-colour variation (strength only).

## Families and material language

| Family | Subject | Plate | Palette | Dev motifs |
|---|---|---|---|---|
| Strength | Abstract energy from the Thread Strength glow and the user's Anchor | Ink | Category colour on ink, restrained gold | Concentric broken rings, one more per level |
| Commitment | Tactile marks of accumulated effort | Warm paper | Engraved ink, gold hairline | Sealed star, stacked stones, lotus star, hourglass |
| Journey | Engraved waypoint, route and destination, from the Chart's etched-map style | Warm paper | Engraved ink, gold route | Waypoint flag, ridge with dotted route, summit, sunrise |

Gold is reserved for meaning (route, seal, current mark); it never fills a large area. No occult imagery, stock badges or trophy graphics.

## Production brief (not done)

1. **Strength (5):** Building, Established, Integrated, Reinforced, Full Strength. Derive from the existing Thread aura effect so the artwork visibly belongs to the user's glow. Must accept a category colour; deliver as layered vector or Skia-friendly parts (glow, ring, core) so the celebration can animate them.
2. **Commitment (6):** First Practice, 10 / 30 / 100 Practices, 100 / 500 Minutes. One consistent material and lighting (engraved, soft top-left light). Each tier visibly more developed than the last.
3. **Journey (4):** First Waypoint, Halfway, All Waypoints, Goal Reached. Draw from the Chart's map artwork (paper, brush route, dotted way ahead).
4. For each: earned artwork, a matching locked silhouette, and notes on which layers move in the reveal (`bloom`, `engrave`, `rise` in the registry).
5. Delivery format: SVG with named layers (preferred) so `MilestoneArtwork` can swap the dev geometry for final paths without API changes.

Until delivered, do not describe the in-app artwork as final.

## Adding or changing a milestone

Add the id to the server registry (`backend/src/services/v2/milestones/registry.ts`) and the client registry; the parity test (`src/milestones/__tests__/milestones.test.ts`) fails if they drift. Changing a rule or art bumps that definition's `version`; existing awards keep the version they were earned under.
