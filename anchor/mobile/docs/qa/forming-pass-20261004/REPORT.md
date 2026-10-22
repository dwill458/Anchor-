# Forming fix and verify pass — 2026-10-04

Independent checks: six-style rendered motion and actual production artwork pair reviews pass; fresh native Prism and Alloy handoffs pass. Final independent signoff is recorded in the linked verifier report. See ../forming-independent-20261004/REPORT.md for the fresh verifier's evidence and disposition.

## Changes and ownership

The checkout already contained forming glow/halo changes, selection caveat removal, stronger backend paired-form prompts, and unrelated Home/seal/export work. Those changes were preserved and audited in place. This pass did not change seal timing, home landing, sounds, artwork persistence, canonical geometry, generation contracts, or existing screen layouts.

- Continuous apply motion: existing shared implementation paints two luminous travelling heads with trailing glow, plus a breathing halo in the material hue. It overlaps the initial material sweep so there is no dead handoff. It is shared by all fifteen treatments; pale/flat styles get visible motion beyond the stroke instead of relying on white-on-white sheen.
- Forming-to-Choose: the independent verifier caught a real 1.6s native hold. The sweep branch was painting the last fixed forming time. This pass advances that same clock during the existing fade; no timing constant changed. Integration regression proves the clock advances through resolution and sweep. Fresh native rechecks pass: Prism Flow0.60s maximum static metric, Alloy0.50s, both below~1s.
- Wait copy: selection no longer renders the caveat. This pass preserves Drawing your line… then Applying your style… throughout the wait, while showing Forging your [style] — this one takes a moment below it. Nondefault styles retain the existing expectation condition; Alloy always gets it, even if recommended. Very long default waits keep Applying plus Still working on your anchor… as a secondary line.
- Form I/II: existing backend changes use different field values and gathered/rich versus open/quiet compositions, with staggered material/motif choices, preserving input geometry and the same style identity. Actual production service artwork was generated for six styles using the mobile generationStyle IDs and canonical SVG from buildSceneContext. The independent verifier reviews actual pixels, not only prompts.
- User follow-up: bottom captions across Distill, Map and Form now use existing Figtree Medium at15px instead of14px regular,92–100% opacity instead of78%, and a1.5px breathing rise on the existing clock. The helper is84% opacity. Reduce Motion stays still. No timer, sound, asset, layout replacement, or per-frame React state was added.

## Per-style audit

Only Prism Flow was directly reported static in the user's recording; Porcelain's original fill sweep was visible. Other original styles are not labelled confirmed failures without evidence. Every style received the same shared waiting-motion safeguard.

| Style | Original issue/evidence | Change | Rendered motion audit |
| --- | --- | --- | --- |
| Velvet Ember | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Porcelain | Fill sweep already visible; safeguard resting wait | Preserve fill + two heads + halo | PASS:0.1s sampling |
| Prism Flow | User recording ~5s static | Two heads + high contrast halo | PASS:0.1s sampling |
| Joybrush | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Deep Cosmos | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Woven | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Paper | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Mineral Wash | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Graphic | Flat material could hide sheen | Two heads outside stroke + halo | PASS:0.1s sampling |
| Plush | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Herbarium | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Alloy | Slow wait; verifier found native handoff hold | Two heads + halo + wait copy + advancing sweep clock | PASS raster; native final max static0.50s |
| Gilt | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Flash | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |
| Buff | Audit shared waiting sheen | Two heads + halo | PASS:0.1s sampling |

All-style raster evidence: all-style-motion/results_new.json, production drawForm operation rasterization sampled tf0.9–10s at10fps, hero-only pixels. Every style changes at each sampled frame; maximum static-run metric is0.1s, the sample interval. This does not replace native performance acceptance. Independent longer two-intention evidence and per-style artwork judgments are in the verifier report.

## Verification and limitations

- Final mobile creation suite:14 suites /112 tests passed, including sweep clock and Reduce Motion caption regressions.
- Backend style suite:236 tests passed.
- Final Android Expo export passed at .expo/forming-pass-final-export (5689 modules; bundle index-287df34242a72a30791739cb3f15d8f3.hbc).
- Scoped git diff --check passed.
- Normal TypeScript run was blocked by pre-existing QA .ts snapshots with unresolved relative imports. A temporary application-source config excluding docs/qa also reported unrelated concurrent release module type errors. No check or test was weakened, and those files were preserved.
- Initial direct-service QA used presentation style IDs and hit legacy routing. Those parent-directory images are excluded from acceptance. Only production-pairs/ images, using *_v2 generationStyle IDs, count.
- Generative distinction is verified for the actual sampled pairs; it is not a guarantee for every future model response. No production deployment or OTA was requested or performed, so backend prompt improvements require the normal deployment before production users receive them.
- Reduced-motion users intentionally receive stationary crossfade rather than travelling heads. This is the existing accessibility exception. Midrange physical Android performance and iOS acceptance have not been measured here.

Native captures use the existing development-only CreationFlowQADevHost, which substitutes desk/window images for completion. Those recordings can verify the production forming painter, stage copy, selected style and native handoff timing; they cannot verify generated Form I/II artwork delivery. Actual artwork acceptance uses production-pairs/ generated with the real backend service. The QA host and fixture assets were not changed.

Final Prism native recheck: independent prism-final2.mp4, video5–16s including fade/handoff; hero-only10fps maximum static metric0.60s at14.5s. Original incorrectly selected Plush recording excluded. Final Alloy recording alloy-final.mp4 passes0.50s maximum static at video4–16s including handoff.

Final independent disposition: PASS for all three requested acceptance checks across six styles (Prism Flow, Alloy, Porcelain, Velvet Ember, Joybrush, Graphic), with equivalent raster and native/provider evidence limits documented in the verifier report. The stronger bottom-caption follow-up also passes native visual review. Full typecheck remains blocked by unrelated release and pre-existing QA snapshot diagnostics; physical midrange Android performance is still unverified.
