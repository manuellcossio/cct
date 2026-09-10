---
name: CCT Ad Gen styles
description: How to add a new Ad Gen ad style/template, and the api-server dev-reload quirk
---

# Adding a new Ad Gen ad style (CCT)

Ad styles are stored in the `ad_gen.style` text column (free text — **no DB migration** needed to add a style).

Touch points to add a style end-to-end:
1. `artifacts/cct/src/pages/adgen.tsx` — add a `} else if (style === "<name>") {` branch in `drawAd()` (canvas render); add the value to the `designStyle` useState union type; add it to the wizard Template button list; handle any style-specific wizard behavior in `handleDesignSubmit`.
2. `artifacts/api-server/src/routes/cct.ts` — add the style to the whitelist in `POST /adgen/generate`; adjust bg-image / bgColor logic if needed; branch `generateAdContent()` prompt if the auto-gen copy/bg query should differ.
3. `lib/api-spec/openapi.yaml` — add to `GenerateAdRequest.style` enum, then run `pnpm --filter @workspace/api-spec run codegen` (regens client + zod; do NOT change info.title).

**Why:** the style string flows DB → API → generated client → canvas render; missing any one layer either rejects the style (falls back to a random style) or fails to render.

## "emotion" style specifics
Surreal/abstract AI-generated bg + large left-aligned phrase + KAPALI logo watermark. It **always** needs a bg image: route forces `wantsBgImage=true` and wizard forces `addBackgroundImage:true`.

The background is **AI-generated** via `generateEmotionImage()` (gpt-5.2 writes a surreal art-direction prompt from the phrase → `openai.images.generate` gpt-image-1 portrait `1024x1536` → `data:image/png;base64`). Goal aesthetic: abstract, creative-directed, intentionally weird, lots of negative space, NO text/logos/faces. Brave Image Search (`EMOTION_BG_QUERIES` atmospheric pool, never `BG_QUERIES` dark textures) is only a **fallback** when AI returns null. gpt-image-1 portrait works through the local OpenAI client; one generation ≈30-60s and returns ~2-3MB base64.

**Why:** user wanted the abstract/surreal reference look (cup exhaling a starry sky, etc.) which plain stock photos can't deliver.

## Dev-reload quirk
**The `api-server` `dev` script rebuilds then starts** — route edits are not hot-reloaded. Restart `pnpm dev:api` after changing routes before curl-testing.
