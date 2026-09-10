---
name: content-gen format enforcement
description: Why the content-gen image Format selector must be enforced at the final delivery stage, not just per-tool.
---

# content-gen image Format selector

The content-gen chat composer has a Format selector (auto / 1:1 / 9:16 / 4:5 / 16:9) that forces the aspect ratio of every delivered image.

**Rule:** enforce the forced aspect ratio in the FINAL delivery loop (the loop that auto-brands + watermarks + encodes each deliverable), not only inside individual tool branches.

**Why:** `generate_image` and `find_reference_image` crop to the forced ratio right after producing their buffer, but `generate_carousel` and `generate_ad` reuse the Instagram/Ad sub-pipelines which emit their own intrinsic formats (portrait/square/9:16 story) and push buffers uncropped. If the crop only lives in the per-tool branches, picking a format does nothing whenever the model routes a request to carousel/ad — the user sees "every image comes out the same format."

**How to apply:** crop with `cropToAspectRatio(buf, ratio[0], ratio[1])` at the top of the delivery loop, BEFORE auto-branding, so the KAPALI logo and kapali.com watermark land on the correctly-shaped canvas. Re-cropping an already-correct image is a safe no-op (the function returns the buffer unchanged when current ratio ≈ target). Cropping carousel/ad only affects the chat preview buffers; the saved Instagram carousel / Ad Gen records are persisted separately by their sub-pipelines and stay intact.
