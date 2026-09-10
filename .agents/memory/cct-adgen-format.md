---
name: CCT Ad Gen format (aspect ratio)
description: How ad aspect ratio (Story 9:16 vs Post 1:1) flows end-to-end and must be persisted
---

# Ad Gen format / aspect ratio

Ads can render at two aspect ratios, persisted per-ad as `ad_gen.format` text ("story" | "post", default "story").

- **Why persisted:** ads are re-rendered from stored fields in grid/lightbox/export, and the emotion AI image is generated at a matching aspect on the server — the client must know the format to draw/crop correctly, so it cannot be client-only.
- **Dimensions:** W is always 1080. H = 1080 for `post`, 1920 for `story`. Set in BOTH `AdCanvas` and `exportAd` (they each hardcode their own canvas size), and the container className switches `aspect-square` vs `aspect-[9/16]` (grid + lightbox wrapper).
- **drawAd layout:** emotion & center styles use H-fractions so they adapt to any aspect automatically. mockup-dark/mockup-light use absolute pixel offsets tuned for portrait — for square they need `isSquare = H <= W*1.3`, a proportional headY, and the phone/macbook width CLAMPED to `(H - topY - margin)/aspect` so the device fits the shorter canvas.
- **Emotion AI image:** `generateEmotionImage(headline, log, format)` requests size `1024x1024` (post) vs `1024x1536` (story) and swaps the "Square 1:1 framing" / "Vertical 9:16 framing" line in the prompt.
- **Spec:** `format` is an enum [story,post] on GenerateAdRequest and a required string on AdItem; rerun orval codegen after editing openapi.yaml. `format` is a real DB column (unlike `style` which is free-text), so it needs a db push.
- **UI placement:** the Format selector lives under the Template selector in the Design wizard step only (Auto Gen has no template/style control and defaults to story).
