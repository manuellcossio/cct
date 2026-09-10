---
name: content-gen image pipeline time budget & image guarantee
description: Why the content-gen agentic chat enforces an internal deadline below the route timeout and always returns an image.
---

# content-gen chat: time budget + guaranteed image

The `/api/cct/content-gen/chat` agentic loop (gpt-5.2 + image tools) was occasionally
aborted mid-stream: it hit the Express `res.setTimeout` and the client saw an error.

## Rules to keep

- **Autoscale production aborts ANY HTTP request at ~300s** (observed in deploy
  logs as `request aborted ... responseTime=299999, statusCode:null`). The
  content-gen budget MUST stay under this or long generations work in dev but
  silently fail in prod. Keep the internal `DEADLINE` ~250s and the Express
  `res.setTimeout` for content-gen under 300s (~290s). The DEADLINE is the real
  guarantee — `res.setTimeout` alone does nothing against the proxy cap.
- The handler runs under an **internal DEADLINE strictly below the prod request
  cap** (~250s). Every model turn, image attempt, and tool call must be
  budget-aware: check remaining time and break/short-circuit before starting new
  network work, so there is always headroom to flush a response. Never set a
  per-call timeout with a hard floor that can exceed the remaining budget. Heavy
  tools (carousel/ad) are gated on remaining budget and auto-scale with DEADLINE.
- `generate_image` must **always** return an image via a 3-tier fallback:
  AI gen (gpt-image-1, staged size/quality retries) → real photo (Brave search)
  → deterministic branded placeholder (`makePlaceholderImage`, sharp+SVG). The
  KAPALI logo is still auto-applied afterward.

**Why:** a single hung image/model call could eat the whole route budget and
abort the request; users also gave up during long waits. Bounded budget + a
hard image guarantee makes the endpoint reliably finish with usable output.

**How to apply:** when editing the content-gen loop or image helpers, preserve
the DEADLINE checks (loop top, inside tool-call loop, inside `generateAiImage`)
and the placeholder fallback. The frontend shows an elapsed timer + asymptotic
progress bar so the wait feels bounded.

## Carousel = the slow path; keep photo fetches concurrent + one heavy call per turn

The carousel tool is by far the slowest content-gen path. Two compounding bugs
once made a single carousel request take ~224s (right at the 250s budget → it
"froze" / dropped the response in prod):

- `fetchCarouselImages` fetched the 4 slide photos + meme **serially** (each
  Brave search + download is ~8-15s). **Keep these concurrent** (`Promise.all`).
  Parallelizing alone took the carousel from ~50s → ~12s of image work. Note the
  `usedURLs` cross-slide dedup becomes best-effort under parallelism (acceptable;
  the planner prompt already targets a distinct subject per slide).
- The model sometimes called `generate_carousel` (and `generate_ad`) **twice in
  one turn**, doubling latency and payload (8 images). Guard heavy tools with a
  per-request `carouselDone` / `adDone` flag, and **set the flag BEFORE the heavy
  call** (not after success) so a thrown tool error can't trigger an expensive
  retry in the same request.

**Why:** the synchronous request model means total latency = sum of every model
turn + every image fetch; any serial multiplier or duplicate heavy call blows the
budget. After both fixes the same carousel/ad requests complete in ~14-15s.
