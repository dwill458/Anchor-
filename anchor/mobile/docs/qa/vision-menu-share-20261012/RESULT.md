# Vision menu sharing and larger Anchor

- Added **Share Vision** to the existing options menu. It closes the menu and opens the existing Share Studio with Vision selected, using the real saved tiles, notes, annotation, personal SVG, and enhanced artwork. Closing Share Studio returns to the existing Board. Other Share Studio callers retain their original default layout.
- Increased the paper-backed Vision Anchor diameter by exactly 30% relative to the previous `0.94 × slot` sizing. Its centre, saved artwork, photo dimensions, overlaps, and layouts remain unchanged. Export bounds include the enlarged mark. Bare/cinematic Anchor sizing is unchanged.
- TypeScript passed. Six relevant suites / **60 tests passed**, covering menu → Share Studio → close, initial layout/fallback, Board captions, enhanced Anchor sizing, export geometry, and existing image additions. Logs: `tests.log`, `add-image-tests.log`, `typecheck.log`.
- Verified the actual saved Regal Vision on the connected Samsung Android device: Share Vision appears in the menu; tapping it opens Share Studio with the Vision layout selected; closing returns to the Board. No outgoing share was sent. Native iOS and a new saved PNG export were not exercised in this change.

Screenshots: [larger Anchor](board-anchor-larger-final.png), [menu item](menu-share.png), [Vision selected in Share Studio](share-vision-selected.png). The earlier `board-anchor-larger.png` capture predates the reload and is excluded from acceptance.

Changes remain uncommitted. Existing unrelated dirty work was preserved.
