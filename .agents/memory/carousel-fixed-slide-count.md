---
name: formatted carousel fixed slide count
description: Why server-side carousel/slide generators must pad model output to a fixed count instead of filtering it.
---

# Formatted carousels must guarantee a fixed slide count

The content-gen "carousel mode" and the Instagram carousel generators render
`cover + N content` slides driven by an LLM that returns N paragraph fields.

**Rule:** never derive the slide count from `.filter(non-empty)` on the model's
paragraph fields. Always pad to the required fixed count (e.g. exactly 4 content
paragraphs → 5 slides), backfilling empty/omitted fields from neighbouring text
or the headline.

**Why:** gpt-5.2 occasionally omits or empties a paragraph field. Filtering then
yields a 2–4 slide deck, silently violating the "always 5 slides" contract. The
photo-query array must stay fixed-length too (don't slice it to paragraph count).

**How to apply:** in `generateFormattedCarouselForChat` (api-server cct.ts) the
paragraphs array is built by mapping all 4 fields and substituting a fallback for
any empty one, so `renderCarouselSlides` always emits cover + 4 = 5.
