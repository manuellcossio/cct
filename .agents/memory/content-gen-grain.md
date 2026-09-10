---
name: content-gen retro grain
description: How/why the content-gen pipeline applies film grain to delivered images.
---

# content-gen retro film grain

`applyGrain(buf, sigma=9)` in `brandImage.ts` adds monochrome (luminance) gaussian
noise in raw-pixel space (Box-Muller, same delta on R/G/B per pixel, clamped 0-255).

**Why raw additive, not a sharp `composite` "overlay" blend:** overlay grain is
luminance-weighted and all but vanishes on dark areas — and KAPALI imagery is
predominantly dark backgrounds. Raw additive luminance noise is uniform across
shadows AND highlights. Verified: flat dark/mid/light all reach ~stdev 7.9-9.0.

**Why applied LAST (after crop → logo → watermark), over the fully-composited
frame:** real film grain covers the whole frame uniformly, and applying it last
guarantees every delivered image gets identical grain regardless of whether it was
branded by the `add_logo` tool or by the auto-brand fallback. An earlier "grain
before logo" placement gave inconsistent results because tool-branded images
(`p.branded`) skipped the auto-brand block.

**How to apply:** grain lives only in the content-gen delivery loop in `cct.ts`.
Each call is ~150-200ms per image (linear in pixels), fail-open via try/catch, well
within the 250s route budget. Sigma 9 is intentionally subtle; raise toward 12 for
heavier grain, cap is 40.
