# Anchor 1.5 screenshot diff captures

Place approved reference captures and native captures in separate directories,
using the filenames listed by `scripts/compare-anchor15-screenshots.mjs`.

Run the comparison from `anchor/mobile`:

```powershell
npm run test:anchor15:visual -- --reference .\visual-baselines\anchor15\reference --actual .\artifacts\anchor15-native
```

Capture at the same 393 × 852 dp phone viewport and pixel density. Inspect the
generated `artifacts/anchor15-visual-diff/*.diff.png` files for documented
safe-area exceptions before approving a mismatch.

Wave 2 captures use the state identifiers in the comparison script. Capture
both Anchor- and Practice-origin Weave states, each range control, a selected
aggregate node, cached-offline and unavailable-history states, plus reduced
motion/long-text Android variants before visual approval. The native capture
must use real canonical practice history; do not seed production screenshots
with decorative/random Weave data.

The required capture list also includes the first-visit teaching, About sheet,
loading, confirmed empty, and retryable history-error variants. Verify node
focus order with VoiceOver/TalkBack: the summary is announced once and every
completed-session node remains an individual 44 dp target.
