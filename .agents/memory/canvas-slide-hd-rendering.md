---
name: server-side canvas slides must supersample for sharp output
description: Why @napi-rs/canvas slide renderers render at 2x and how source-photo quality is gated.
---

# HD output for server-rendered canvas slides

Server-side canvas slide renderers (carousel/Instagram) must **supersample**:
create the canvas at `SCALE×` the logical layout (e.g. 2160×2700 for a 1080×1350
design) and call `ctx.scale(SCALE, SCALE)` once, leaving all drawing code in
logical coordinates. Any offscreen helper (e.g. the recolored logo) must also be
built at device scale and drawn with explicit logical dest dims, or it upscales
and looks blurry.

**Why:** rendering directly at 1080×1350 produced visibly pixelated exports; users
expect near-HD/4K saveable images.

**How to apply:** photo sharpness is still capped by the *source* image. The Brave
image fetch (`fetchNewsPhotoBase64`) must prefer high-res sources (long edge
≥1400px) but stay bounded — single pass, capped download attempts, no duplicate
re-fetches — because it runs inside the content-gen deadline budget.
