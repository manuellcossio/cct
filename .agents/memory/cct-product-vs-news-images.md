---
name: CCT product vs news imagery
description: Decision — product content uses aesthetic music imagery; news content keeps press-agency imagery
---

antiq product content (carousels, chat carousels) must never use press/news imagery; only external news-topic flows (from-URL routes) keep press-agency-anchored image queries.

**Why:** product posts looked like formal news posts; the user asked for playful, informative product content where photos give personality, not context. Prompts alone weren't enough — fetch fallbacks also had to respect the split, or product carousels degraded into Reuters/AP photos.

**How to apply:** any new image-fetching flow must decide up front whether it is product (aesthetic music photography, no agencies) or news (agency-anchored), and keep prompts AND fallbacks on the same side of that split.
