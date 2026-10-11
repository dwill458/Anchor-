# Vision Notes assets

All eight images were generated for this feature with the built-in ImageGen tool on 2026-10-10. There are no placeholders. Each is a 512 × 512 PNG; none contains embedded text, logos, symbols, or UI.

| File | Bytes | Alpha / intended use |
| --- | ---: | --- |
| `torn-paper.png` | 382,240 | Transparent outside its torn silhouette; center 200 × 200 mean alpha 252.5 (39,737 transparent, 221,499 partial, 908 opaque pixels total). |
| `handmade-paper.png` | 401,624 | Transparent outside its softly deckled silhouette; center 200 × 200 mean alpha 252.2 (44,375 transparent, 216,745 partial, 1,024 opaque pixels total). |
| `botanical-shadow.png` | 316,065 | Opaque warm cream field with a soft leafy shadow confined to the upper-right edge and open center. |
| `coastal-illustration.png` | 314,934 | Opaque cream field with a muted coastal watercolor/ink illustration along the lower edge. |
| `atmospheric-landscape.png` | 350,830 | Opaque cream field with a muted, misty valley illustration along the lower edge. |
| `vintage-letter.png` | 389,879 | Opaque aged ivory stationery grain with a thin edge rule and clear text field. |
| `golden-hour.png` | 433,043 | Opaque pale paper with soft architectural window shadows at the upper/right edge. |
| `misty-mountains.png` | 296,049 | Opaque cool, muted mountain layers and mist along the lower edge with clear upper text field. |

The two paper cutouts are shared across the six Paper presets. The renderer fits their measured nontransparent alpha bounds into the frame, so the full silhouette stays visible; each preset receives its native tint while retaining the generated paper grain and edge. The sticky-note colors, lines, and editorial typography are native UI styling; these files provide reusable surface texture and quiet illustration only.

The three additional backgrounds (Vintage Letter, Golden Hour, and Misty Mountains) were generated with built-in ImageGen on 2026-10-10, then resized to 512 × 512 and optimized as PNGs. Each has a quiet center for live text; none contains words, letters, logos, symbols, or a watermark. Rose Editorial, Architectural, Midnight Editorial, and Minimal Quote use restrained native SVG framing and native typography rather than decorative icons.

Generation briefs: neutral ivory paper with a blank center and either rough torn or softly deckled edges; pale cream with faint branch-leaf shadow near one corner; pale coastal scene with the illustration at the bottom and text-safe center; subdued misty valley at the bottom; aged stationery with only a thin edge rule; and a warm paper surface with soft architectural window shadows. All briefs excluded text and branding. Final paper alpha was checked after 512px optimization to confirm a nearly opaque interior and transparent exterior.
