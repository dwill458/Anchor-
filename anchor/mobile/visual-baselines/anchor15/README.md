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
