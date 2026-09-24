# Vision Multi-Provider Benchmark Report

**Sample Size:** 20 Intentions Across 5 Categories
**Providers Compared:**
- **OpenAI:** GPT-Image 2.5 Flare (`gpt-image-2.5-flare`)
- **Google Gemini:** Nano Banana 2 (`gemini-3.1-flash-image`)

---

## 1. Quantitative Performance

| Metric | OpenAI (GPT-Image 2.5 Flare) | Gemini (Nano Banana 2) |
|---|---|---|
| **Average Latency** | ~3.8s | ~3.2s |
| **Est. Cost per Image** | ~$0.020 | ~$0.005 |
| **Native Portrait Aspect Ratio** | 1024x1792 (multiples of 16) | 9:16 native |
| **Mobile Crop Compatibility** | Central 70% safe area enforced | Central 70% safe area enforced |

---

## 2. Qualitative Evaluation Matrix

| Dimension | OpenAI Evaluation | Gemini Nano Banana Evaluation |
|---|---|---|
| **1. Intention Fidelity** | High adherence to specific career/life settings; accurately renders tactile props. | Strong fidelity; occasionally defaults to minimalist abstractions. |
| **2. Emotional Resonance** | Exceptional environmental lighting and depth of field; feels like documentary stills. | Very good tonal warmth and atmosphere. |
| **3. Mobile Crop Compatibility** | 1024x1792 conforms to full-screen portrait with safe center framing. | 9:16 vertical output maps directly to 1080x1920 mobile viewport. |
| **4. Anti-Stock Directive** | Avoids generic motivational tropes; respects lived-in texture instruction. | Avoids generic corporate tropes when guided by Anchor prompt engine. |
| **5. Typography & Text Artifacts** | Cleanly suppresses typography and unreadable logos. | Occasionally introduces pseudo-script on incidental books/screens. |
| **6. Realism & Coherence** | Strong physical coherence for complex workplace and nature compositions. | Clean, artistic, photographic rendering. |

---

## 3. Recommended Strategy

- **Vision Primary:** OpenAI (`gpt-image-2.5-flare`) for highest prompt adherence, documentary texture, and human rendering.
- **Vision Fallback:** Gemini (`gemini-3.1-flash-image`) for robust high-availability redundancy without disrupting user experience.
- **Anchor Artwork:** Gemini (`gemini-3.1-flash-image-preview` / Nano Banana 2) default with Pro for regeneration, using OpenAI as provider redundancy.
