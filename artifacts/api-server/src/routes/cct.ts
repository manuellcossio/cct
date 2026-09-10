import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { twitterPostsTable, instagramCarouselsTable, twitterThreadsTable, adGenTable, instagramMarketSlideshowsTable, usageTokensTable, usageDailyTable, contentGenConversationsTable, contentGenMessagesTable } from "@workspace/db/schema";
import { desc, asc, eq, gte, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { overlayLogo, overlayUrlText, toJpegDataUrl, cropToAspectRatio, makePlaceholderImage, applyGrain, type LogoVariant, type LogoPosition } from "../lib/brandImage";
import { renderCarouselSlides } from "../lib/carouselSlides";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY ?? "";

type Lang = "es" | "en";
function parseLang(v: unknown): Lang {
  return v === "en" ? "en" : "es";
}
function langName(lang: Lang): string {
  return lang === "en" ? "English" : "Spanish";
}
function breakingLabels(lang: Lang): { ultima: string; tendencia: string } {
  return lang === "en"
    ? { ultima: "BREAKING:", tendencia: "TRENDING:" }
    : { ultima: "ÚLTIMA HORA:", tendencia: "TENDENCIA:" };
}
function captionSuffix(lang: Lang): string {
  return lang === "en"
    ? "Discover more at antiq.xyz"
    : "Descubre más en antiq.xyz";
}

const ANTIQ_BRIEF = `ABOUT antiq (antiq.xyz) — "engineering the future of music.":
antiq is a music technology company building next-generation tools for artists, producers and songwriters. Product suite:
- antiq DAW — a FREE, AI-powered digital audio workstation with an integrated chatbot that can create plug-ins in real time while you produce. Pro-grade production without paywalls.
- antiq forge — an AI plugin engine: describe the sound you imagine ("a warm analog bass with tape saturation") and forge designs and builds that instrument or effect for you, instantly.
- antiq for artists — an AI agent platform that handles the business side of an artist's career: marketing, production coordination and bookings, so artists can focus on creating.
- antiq stager — set preparation for DJs and live acts: BPM and key detection, intelligent set sequencing, and Rekordbox export. Turns a messy library into show-ready sets.
Philosophy: AI should amplify human creativity, never replace it — the music stays human. Brand voice: minimal, confident, premium (Apple-like); the brand name is ALWAYS lowercase "antiq".
FACTUAL GUARDRAILS: NEVER invent prices, launch dates, user counts, awards, partnerships, integrations, or features beyond the ones listed above. If a detail is not in this brief, do not claim it.`;

const ANTIQ_PILLARS = `CONTENT PILLARS (rotate across them):
1) What antiq is (intro to the company and vision)
2) antiq DAW — free AI DAW, chatbot that builds plug-ins while you work
3) antiq forge — describe a sound, get the plugin
4) antiq for artists — AI agents for marketing, production and bookings
5) antiq stager — from messy library to show-ready sets
6) Philosophy — AI amplifies human creativity, music stays human
7) Use cases & workflows — how a producer/songwriter/DJ actually uses antiq day to day
8) Access — pro-grade tools, free, for everyone`;

async function fetchArticleText(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OpinionMarketBot/1.0)",
      "Accept": "text/html",
    },
    signal: AbortSignal.timeout(15000),
  });
  const html = await resp.text();
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 8000);
}

async function addUsageTokens(type: "instagram" | "adgen" | "twitter" | "contentgen", count: number) {
  const tokens =
    type === "instagram"
      ? 10 * count
      : type === "adgen"
        ? 5 * count
        : type === "contentgen"
          ? 10 * count
          : 1 * count;
  const existing = await db.select().from(usageTokensTable).limit(1);
  if (existing.length === 0) {
    await db.insert(usageTokensTable).values({
      totalTokens: tokens,
      instagramTokens: type === "instagram" ? tokens : 0,
      adgenTokens: type === "adgen" ? tokens : 0,
      twitterTokens: type === "twitter" ? tokens : 0,
      contentgenTokens: type === "contentgen" ? tokens : 0,
    });
  } else {
    await db
      .update(usageTokensTable)
      .set({
        totalTokens: sql`${usageTokensTable.totalTokens} + ${tokens}`,
        ...(type === "instagram" ? { instagramTokens: sql`${usageTokensTable.instagramTokens} + ${tokens}` } : {}),
        ...(type === "adgen" ? { adgenTokens: sql`${usageTokensTable.adgenTokens} + ${tokens}` } : {}),
        ...(type === "twitter" ? { twitterTokens: sql`${usageTokensTable.twitterTokens} + ${tokens}` } : {}),
        ...(type === "contentgen" ? { contentgenTokens: sql`${usageTokensTable.contentgenTokens} + ${tokens}` } : {}),
        updatedAt: new Date(),
      })
      .where(eq(usageTokensTable.id, existing[0].id));
  }

  const today = new Date().toISOString().slice(0, 10);
  const dailyRow = await db.select().from(usageDailyTable).where(eq(usageDailyTable.date, today)).limit(1);
  if (dailyRow.length === 0) {
    await db.insert(usageDailyTable).values({
      date: today,
      instagramTokens: type === "instagram" ? tokens : 0,
      adgenTokens: type === "adgen" ? tokens : 0,
      twitterTokens: type === "twitter" ? tokens : 0,
      contentgenTokens: type === "contentgen" ? tokens : 0,
    });
  } else {
    await db
      .update(usageDailyTable)
      .set({
        ...(type === "instagram" ? { instagramTokens: sql`${usageDailyTable.instagramTokens} + ${tokens}` } : {}),
        ...(type === "adgen" ? { adgenTokens: sql`${usageDailyTable.adgenTokens} + ${tokens}` } : {}),
        ...(type === "twitter" ? { twitterTokens: sql`${usageDailyTable.twitterTokens} + ${tokens}` } : {}),
        ...(type === "contentgen" ? { contentgenTokens: sql`${usageDailyTable.contentgenTokens} + ${tokens}` } : {}),
      })
      .where(eq(usageDailyTable.id, dailyRow[0].id));
  }
}

async function fetchThreadHookImage(topic: string, opts: { preferAgencies?: boolean; minWidth?: number; minHeight?: number; preferHD?: boolean } = {}): Promise<string | null> {
  try {
    const url = new URL("https://api.search.brave.com/res/v1/images/search");
    url.searchParams.set("q", topic);
    url.searchParams.set("count", "50");
    url.searchParams.set("safesearch", "off");
    // Wallpaper = highest resolution bucket in Brave; falls back gracefully when scarce
    url.searchParams.set("size", opts.preferHD ? "Wallpaper" : "Large");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json() as { results?: Array<{ properties?: { url?: string }; width?: number; height?: number; format?: string; source?: string; meta_url?: { netloc?: string } }> };
    const results = data.results ?? [];

    const REQ_WIDTH = opts.minWidth ?? 800;
    const REQ_HEIGHT = opts.minHeight ?? 600;
    const blocked = ["favicon", "logo", "icon", "avatar", "badge", "banner-ad", "pixel", "spacer", "tracking", "thumb", "thumbnail", "sprite"];
    const agencyDomains = ["reuters.com", "gettyimages", "apnews.com", "ap.org", "afp.com", "bloomberg.com", "nytimes.com", "washingtonpost.com", "bbc.co", "bbci.co", "cnn.com", "espn.com", "marca.com", "as.com", "lavanguardia.com", "elpais.com", "milenio.com", "eluniversal.com.mx", "infobae.com", "clarin.com", "yahoo", "msn.com"];
    const stockJunk = ["shutterstock", "istockphoto", "alamy", "dreamstime", "depositphotos", "123rf", "stockfresh", "vectorstock", "freepik", "canva.com"];

    // Tiered resolution floors: try 4K-ish first, then HD, then the caller's floor.
    // We sort by area so the best one within each tier wins; if a tier is empty we relax.
    const tiers: Array<[number, number]> = opts.preferHD
      ? [[2400, 1600], [1600, 1067], [REQ_WIDTH, REQ_HEIGHT]]
      : [[REQ_WIDTH, REQ_HEIGHT]];

    const preFiltered = results.filter(r => {
      const imgUrl = r.properties?.url ?? "";
      if (!imgUrl) return false;
      const lower = imgUrl.toLowerCase();
      if (blocked.some(b => lower.includes(b))) return false;
      if (stockJunk.some(s => lower.includes(s))) return false;
      if (lower.endsWith(".svg") || lower.endsWith(".gif")) return false;
      return true;
    });

    let candidates: typeof preFiltered = [];
    for (const [minW, minH] of tiers) {
      candidates = preFiltered.filter(r => (r.width ?? 0) >= minW && (r.height ?? 0) >= minH);
      if (candidates.length > 0) break;
    }

    candidates = candidates
      .map(r => {
        const w = r.width ?? 0;
        const h = r.height ?? 0;
        const pageHost = (r.meta_url?.netloc ?? r.source ?? "").toLowerCase();
        const imgHost = (() => {
          try { return new URL(r.properties?.url ?? "").host.toLowerCase(); } catch { return ""; }
        })();
        const isAgency = agencyDomains.some(d => pageHost.includes(d) || imgHost.includes(d));
        const area = w * h;
        // Score: agency bonus + area
        const score = (isAgency && opts.preferAgencies ? 5_000_000 : 0) + area;
        return { r, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(x => x.r);

    const hdCandidates = candidates;

    for (const r of hdCandidates) {
      const imgUrl = r.properties?.url;
      if (!imgUrl) continue;
      try {
        const parsed = new URL(imgUrl);
        for (const [key] of [...parsed.searchParams.entries()]) {
          const k = key.toLowerCase();
          if (k === "width" || k === "w" || k === "height" || k === "h" || k === "quality" || k === "q" || k === "size" || k === "resize" || k === "smart") {
            parsed.searchParams.delete(key);
          }
        }
        return parsed.toString();
      } catch {
        return imgUrl;
      }
    }

    for (const r of results) {
      const imgUrl = r.properties?.url;
      if (!imgUrl) continue;
      const lower = imgUrl.toLowerCase();
      if (blocked.some(b => lower.includes(b))) continue;
      if (stockJunk.some(s => lower.includes(s))) continue;
      if (lower.endsWith(".svg") || lower.endsWith(".gif")) continue;
      return imgUrl;
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch real-time news headlines from Brave News Search
async function fetchBraveNews(query: string, count = 10): Promise<Array<{ title: string; description: string; source: string; url: string }>> {
  try {
    const url = new URL("https://api.search.brave.com/res/v1/news/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));
    url.searchParams.set("freshness", "pd"); // past day
    url.searchParams.set("safesearch", "moderate");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];

    const data = await res.json() as {
      results?: Array<{ title?: string; description?: string; url?: string; meta_url?: { netloc?: string } }>;
    };

    return (data.results ?? [])
      .filter(r => r.title && r.description && r.url)
      .map(r => ({
        title: r.title ?? "",
        description: r.description ?? "",
        source: r.meta_url?.netloc ?? "",
        url: r.url ?? "",
      }));
  } catch {
    return [];
  }
}

router.post("/twitter/generate", async (req, res) => {
  try {
    const { topic, lang: langRaw } = req.body as { topic?: string; lang?: string };
    const lang = parseLang(langRaw);
    const today = new Date().toISOString().split("T")[0];

    const focus = typeof topic === "string" && topic.trim() ? topic.trim() : "";

    const postedPosts = await db
      .select({ headline: twitterPostsTable.headline, content: twitterPostsTable.content })
      .from(twitterPostsTable)
      .where(eq(twitterPostsTable.posted, true))
      .orderBy(desc(twitterPostsTable.createdAt))
      .limit(40);
    const postedIgCarousels = await db
      .select({ headline: instagramCarouselsTable.headline })
      .from(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.posted, true))
      .orderBy(desc(instagramCarouselsTable.createdAt))
      .limit(40);
    const usedHeadlines = [
      ...postedPosts.map(p => p.headline).filter(Boolean),
      ...postedIgCarousels.map(c => c.headline).filter(Boolean),
    ];

    const alreadyUsedSection = usedHeadlines.length > 0
      ? `\n\nALREADY PUBLISHED (DO NOT REPEAT these topics or stories):\n${usedHeadlines.map(h => `- ${h}`).join("\n")}`
      : "";

    const tweetResponse = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are the social content lead at antiq (antiq.xyz). Today is ${today}. You write ${langName(lang)} INFORMATIVE PRODUCT TWEETS that introduce antiq to musicians, producers, songwriters and DJs — what it is, what it can do, and why it matters.

${ANTIQ_BRIEF}

${ANTIQ_PILLARS}

TWEET TYPES (mix them):
- Product explainers ("what antiq forge does, in one tweet")
- Feature spotlights (one concrete capability, its benefit)
- Scenario tweets (a producer's real problem → how an antiq tool solves it)
- Philosophy statements (AI amplifies, never replaces; music stays human)
- Myth-busting about AI in music, answered through antiq's approach
- Practical tips framed around an antiq tool

FORMAT RULES (MANDATORY):
- Write in ${langName(lang)}
- Concrete and benefit-driven — name the tool, say what it does, no vague hype
- Minimal, confident, premium tone. NO hashtags, NO emojis
- "antiq.xyz" may appear in at most 1 of every 4 tweets; the rest carry no link
- Brand names always lowercase: antiq, antiq forge, antiq stager
- Maximum 280 characters per tweet
- Generate 15-20 tweets; EVERY tweet must take a DIFFERENT angle or pillar
- NEVER repeat an angle already published on Twitter OR Instagram (see list below)${alreadyUsedSection}${focus ? `\n\nFOCUS: center this batch on: ${focus}` : ""}

Return ONLY a valid JSON array. No markdown, no extra text.
Each object: { "content": "tweet text", "headline": "3-5 word title" }`,
        },
        {
          role: "user",
          content: `Generate 15-20 informative antiq product tweets in ${langName(lang)}, rotating across the content pillars. Return JSON array only.`,
        },
      ],
    });

    const rawContent = tweetResponse.choices[0]?.message?.content ?? "";
    req.log.info({ rawLength: rawContent.length }, "AI response received for twitter");

    let tweets: Array<{ content: string; headline: string }> = [];
    const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      try {
        tweets = JSON.parse(cleaned.substring(start, end + 1));
      } catch (parseErr) {
        req.log.error({ parseErr }, "JSON parse failed");
        res.status(500).json({ error: "Failed to parse AI response" });
        return;
      }
    } else {
      req.log.error({ cleaned: cleaned.substring(0, 300) }, "No JSON array found");
      res.status(500).json({ error: "AI response did not contain valid JSON" });
      return;
    }

    if (!tweets || tweets.length === 0) {
      res.status(500).json({ error: "AI returned no tweets" });
      return;
    }

    const inserted = await db
      .insert(twitterPostsTable)
      .values(
        tweets.map((t) => ({
          content: t.content,
          headline: t.headline ?? t.content.substring(0, 50),
          copied: false,
        }))
      )
      .returning();

    await addUsageTokens("twitter", inserted.length);

    res.json({
      posts: inserted.map((p) => ({
        id: p.id,
        content: p.content,
        headline: p.headline,
        copied: p.copied,
        createdAt: p.createdAt,
      })),
      count: inserted.length,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating Twitter posts");
    res.status(500).json({ error: "Failed to generate posts" });
  }
});

router.post("/twitter/generate-from-url", async (req, res) => {
  try {
    const { url, title, description, lang: langRaw } = req.body as { url: string; title?: string; description?: string; lang?: string };
    const lang = parseLang(langRaw);
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    req.log.info({ url }, "Generating Twitter post from URL");

    let articleContent: string;
    if (title && description) {
      articleContent = `Title: ${title}\n\nSummary: ${description}`;
      req.log.info("Using provided article metadata");
    } else {
      articleContent = await fetchArticleText(url);
      if (!articleContent || articleContent.length < 50) {
        res.status(500).json({ error: "Could not fetch article content" });
        return;
      }
      req.log.info({ contentLength: articleContent.length }, "Article content fetched for Twitter");
    }

    const tweetResponse = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are a ${langName(lang)}-language breaking news editor for antiq (antiq.xyz), a music technology company building next-generation tools for artists, producers and songwriters. Your coverage focuses on the music industry, music technology, AI in music, and artist/creator news. Today is ${today}.

You will receive a detailed summary of a news article. Write 1 breaking news tweet about this story.

FORMAT RULES (MANDATORY):
- The tweet MUST start with EITHER "${breakingLabels(lang).ultima}" OR "${breakingLabels(lang).tendencia}" in all caps. Pick based on the story: use "${breakingLabels(lang).ultima}" for hard, urgent, just-happened breaking news (deaths, attacks, rulings, disasters, major announcements); use "${breakingLabels(lang).tendencia}" for trending, developing, or softer-angle stories (rumors, ongoing debates, cultural events, sports speculation, market sentiment, entertainment, viral moments).
- Write in ${langName(lang)}
- Be concise, punchy, factual — wire news style
- Include specific details: exact numbers, names, cities, countries when available
- NO hashtags, NO emojis, NO links
- Maximum 280 characters
- Sound authoritative and urgent

STRICTLY BANNED WORDS: "apuesta", "apostar", "apuestas", "apostando", "bet", "betting" — ANY conjugation FORBIDDEN. Use "predicción"/"prediction", "pronóstico"/"forecast" instead.

Return ONLY a valid JSON object: { "content": "tweet text", "headline": "3-5 word title" }
No markdown fences, no extra text.`,
        },
        {
          role: "user",
          content: `Here is the article:\n\n${articleContent}\n\nWrite 1 breaking news tweet. Return JSON object only.`,
        },
      ],
    });

    const rawContent = tweetResponse.choices[0]?.message?.content ?? "";
    const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      res.status(500).json({ error: "AI response did not contain valid JSON" });
      return;
    }

    const tweet = JSON.parse(cleaned.substring(start, end + 1)) as { content: string; headline: string };

    const inserted = await db
      .insert(twitterPostsTable)
      .values([{
        content: tweet.content,
        headline: tweet.headline ?? tweet.content.substring(0, 50),
        copied: false,
      }])
      .returning();

    await addUsageTokens("twitter", 1);

    res.json({
      posts: inserted.map((p) => ({
        id: p.id,
        content: p.content,
        headline: p.headline,
        copied: p.copied,
        createdAt: p.createdAt,
      })),
      count: 1,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating Twitter post from URL");
    res.status(500).json({ error: "Failed to generate post from URL" });
  }
});

router.get("/twitter/posts", async (req, res) => {
  try {
    const archived = req.query["archived"] === "true";
    const posts = await db
      .select()
      .from(twitterPostsTable)
      .where(eq(twitterPostsTable.posted, archived))
      .orderBy(desc(twitterPostsTable.createdAt))
      .limit(200);

    res.json({
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        headline: p.headline,
        copied: p.copied,
        posted: p.posted,
        createdAt: p.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Twitter posts");
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.patch("/twitter/posts/:id/posted", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db
      .update(twitterPostsTable)
      .set({ posted: true })
      .where(eq(twitterPostsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking Twitter post as posted");
    res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/twitter/posts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db.delete(twitterPostsTable).where(eq(twitterPostsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting Twitter post");
    res.status(500).json({ error: "Failed to delete post" });
  }
});

async function fetchNewsPhotoBase64(
  searchQuery: string,
  fallbackQuery: string,
  usedUrls: Set<string> = new Set(),
  newsStyle: boolean = true,
): Promise<{ base64: string; url: string }> {
  const queries: string[] = [searchQuery];
  if (newsStyle && !searchQuery.toLowerCase().includes("reuters") && !searchQuery.toLowerCase().includes(" ap ") && !searchQuery.toLowerCase().includes("getty")) {
    queries.push(`${searchQuery} Reuters`);
  }
  queries.push(fallbackQuery);

  for (const query of queries) {
    try {
      const url = new URL("https://api.search.brave.com/res/v1/images/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", "20");
      url.searchParams.set("safesearch", "off");

      const searchRes = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": BRAVE_API_KEY,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!searchRes.ok) {
        console.warn(`[IMG] Brave API error ${searchRes.status} for: "${query}"`);
        continue;
      }

      const data = await searchRes.json() as { results?: Array<{ properties?: { url?: string }; width?: number; height?: number }> };
      const results = data.results ?? [];

      // Largest images first, so the highest-resolution candidates are tried up
      // front. Only consider the top dozen to bound network cost.
      const candidates = [...results]
        .filter((r) => r.properties?.url && !usedUrls.has(r.properties.url!))
        .sort((a, b) => ((b.width ?? 0) * (b.height ?? 0)) - ((a.width ?? 0) * (a.height ?? 0)))
        .slice(0, 12);

      // Single bounded pass (max 8 downloads): return the first genuinely
      // high-resolution source (long edge ≥ 1400px AND ≥ 120KB) so saved slides
      // stay sharp; otherwise keep the first decent image (≥ 50KB) as a fallback
      // so we never end up blank — without ever re-downloading the same URL.
      let fallback: { base64: string; url: string } | null = null;
      let attempts = 0;
      for (const result of candidates) {
        if (attempts >= 8) break;
        const imgUrl = result.properties!.url!;
        const longEdge = Math.max(result.width ?? 0, result.height ?? 0);
        attempts++;
        try {
          const imgRes = await fetch(imgUrl, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          });
          if (!imgRes.ok) continue;
          const contentType = imgRes.headers.get("content-type") ?? "";
          if (!contentType.startsWith("image/")) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length < 50000) continue;
          if ((longEdge === 0 || longEdge >= 1400) && buf.length >= 120000) {
            console.log(`[IMG] OK (HQ) for "${query}" → ${buf.length} bytes (${result.width ?? "?"}x${result.height ?? "?"})`);
            return { base64: buf.toString("base64"), url: imgUrl };
          }
          if (!fallback) fallback = { base64: buf.toString("base64"), url: imgUrl };
        } catch {
        }
      }
      if (fallback) {
        console.log(`[IMG] OK (fallback) for "${query}"`);
        return fallback;
      }
    } catch {
    }
  }
  console.warn(`[IMG] No usable image found for: "${searchQuery}"`);
  return { base64: "", url: "" };
}

const MEME_DOMAINS = [
  "imgflip.com", "knowyourmeme.com", "memedroid.com", "reddit.com",
  "i.redd.it", "i.imgur.com", "imgur.com", "memegenerator.net",
  "cheezburger.com", "quickmeme.com", "makeameme.org", "mematic.net",
  "kapwing.com", "ifunny.co", "9gag.com", "tenor.com", "giphy.com",
  "memecreator.org", "livememe.com", "memesmonkey.com",
];

async function fetchMemeBase64(
  searchQuery: string,
  fallbackQuery: string,
): Promise<string> {
  const topic = searchQuery.replace(/\bmeme\b/gi, "").replace(/\bchistoso\b/gi, "").replace(/\bgracioso\b/gi, "").trim();
  const fallbackTopic = fallbackQuery.replace(/\bmeme\b/gi, "").trim();

  const queries = [
    `${topic} meme chistoso`,
    `${topic} meme gracioso humor`,
    `${topic} meme divertido viral`,
    `${topic} funny meme imgflip`,
    `${topic} meme reddit humor`,
    `${fallbackTopic} meme chistoso gracioso`,
    `${fallbackTopic} funny meme`,
  ];

  const NEWS_PHOTO_PATTERNS = [
    /getty/i, /reuters/i, /associated.?press/i, /afp\b/i, /ap.?photo/i,
    /alamy/i, /shutterstock/i, /stock.?photo/i, /wire.?image/i,
    /news.?photo/i, /press.?conference/i, /editorial/i,
  ];

  for (const query of queries) {
    try {
      const url = new URL("https://api.search.brave.com/res/v1/images/search");
      url.searchParams.set("q", query);
      url.searchParams.set("count", "20");
      url.searchParams.set("safesearch", "off");

      const searchRes = await fetch(url.toString(), {
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": BRAVE_API_KEY,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!searchRes.ok) {
        console.warn(`[MEME] Brave API error ${searchRes.status} for: "${query}"`);
        continue;
      }

      const data = await searchRes.json() as { results?: Array<{ properties?: { url?: string }; url?: string; width?: number; height?: number; title?: string }> };
      const results = data.results ?? [];

      const scored = results.map((r) => {
        const imgUrl = (r.properties?.url ?? "").toLowerCase();
        const pageUrl = (r.url ?? "").toLowerCase();
        const title = ((r as any).title ?? "").toLowerCase();
        let score = 0;

        for (const domain of MEME_DOMAINS) {
          if (imgUrl.includes(domain) || pageUrl.includes(domain)) {
            score += 200;
            break;
          }
        }

        if (imgUrl.includes("meme") || pageUrl.includes("meme") || title.includes("meme")) score += 100;
        if (title.includes("chistoso") || title.includes("gracioso") || title.includes("funny") || title.includes("humor")) score += 80;
        if (pageUrl.includes("/r/memes") || pageUrl.includes("/r/meme") || pageUrl.includes("/r/funny") || pageUrl.includes("/r/spanish")) score += 150;
        if (imgUrl.includes("imgflip") || imgUrl.includes("i.redd.it") || imgUrl.includes("i.imgur.com")) score += 120;

        let isNewsPhoto = false;
        for (const pattern of NEWS_PHOTO_PATTERNS) {
          if (pattern.test(imgUrl) || pattern.test(pageUrl) || pattern.test(title)) {
            isNewsPhoto = true;
            break;
          }
        }
        if (isNewsPhoto) score -= 500;

        const res = (r.width ?? 0) * (r.height ?? 0);
        if (res > 200000) score += 10;

        return { result: r, score };
      });

      scored.sort((a, b) => b.score - a.score);

      const candidates = scored.filter(s => s.score > 0);

      for (const { result, score } of candidates) {
        const imgUrl = result.properties?.url;
        if (!imgUrl) continue;
        try {
          const imgRes = await fetch(imgUrl, {
            signal: AbortSignal.timeout(10000),
            headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          });
          if (!imgRes.ok) continue;
          const contentType = imgRes.headers.get("content-type") ?? "";
          if (!contentType.startsWith("image/")) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length < 15000) continue;
          console.log(`[MEME] Found for "${query}" (score=${score}) → ${buf.length} bytes from ${imgUrl.substring(0, 80)}`);
          return buf.toString("base64");
        } catch {
        }
      }
    } catch {
    }
  }
  console.warn(`[MEME] No meme found for: "${searchQuery}"`);
  return "";
}

async function fetchCarouselImages(
  item: { headline: string; coverSearchQuery: string; slide1SearchQuery: string; slide2SearchQuery: string; slide3SearchQuery: string; memeSearchQuery?: string },
  deadline?: number,
): Promise<{ photos: string[]; meme: string }> {
  const usedUrls = new Set<string>();
  const images: string[] = [];
  // Stop fetching while there is still room to finalize and flush a response
  // before the (production) request deadline. Each fetch can take up to ~8s, so
  // bail out before we'd run past the budget rather than overshoot it.
  const lowBudget = (reserveMs: number) =>
    typeof deadline === "number" && deadline - Date.now() < reserveMs;

  // News-style planning includes press agencies in its queries; product/aesthetic
  // planning does not. Route the fallbacks accordingly so a product carousel
  // never degrades into press/news imagery.
  const newsStyle = /\b(reuters|getty|afp|ap)\b/i.test(
    [item.coverSearchQuery, item.slide1SearchQuery, item.slide2SearchQuery, item.slide3SearchQuery].join(" "),
  );
  const slideQueries = newsStyle
    ? [
        { search: item.coverSearchQuery, fallback: `${item.headline} news photo Reuters` },
        { search: item.slide1SearchQuery, fallback: `${item.headline} Reuters AP photo` },
        { search: item.slide2SearchQuery, fallback: `${item.headline} press conference Reuters` },
        { search: item.slide3SearchQuery, fallback: `${item.headline} AFP Getty photo` },
      ]
    : [
        { search: item.coverSearchQuery, fallback: "music production studio dark cinematic" },
        { search: item.slide1SearchQuery, fallback: "music producer working studio moody" },
        { search: item.slide2SearchQuery, fallback: "synthesizer close up studio dark" },
        { search: item.slide3SearchQuery, fallback: "artist performing stage lights dark" },
      ];

  // Fetch all slide photos (and the meme) CONCURRENTLY. This used to be a serial
  // loop where each photo could take ~8-15s, making a carousel the slowest path
  // in the synchronous content-gen chat (observed ~4 min for two carousels) and
  // the main cause of perceived "freezing" / dropped responses. Each query
  // targets a DIFFERENT visual subject per the planner prompt, so cross-slide
  // URL dedup is best-effort only.
  const skipPhotos = lowBudget(15000);
  const memeWanted = Boolean(item.memeSearchQuery) && !lowBudget(12000);

  const [photoResults, memeBase64] = await Promise.all([
    Promise.all(
      slideQueries.map(async ({ search, fallback }) => {
        if (skipPhotos) return "";
        try {
          const { base64, url } = await fetchNewsPhotoBase64(search, fallback, usedUrls, newsStyle);
          if (url) usedUrls.add(url);
          console.log(`[IMG] OK: "${search}" → ${Math.round(base64.length / 1024)}KB`);
          return base64;
        } catch (err) {
          console.error(`[IMG] Error for "${search}":`, err);
          return "";
        }
      }),
    ),
    (async () => {
      if (!memeWanted) return "";
      try {
        const meme = await fetchMemeBase64(item.memeSearchQuery!, `${item.headline} meme`);
        console.log(`[MEME] OK: "${item.memeSearchQuery}" → ${Math.round(meme.length / 1024)}KB`);
        return meme;
      } catch (err) {
        console.error(`[MEME] Error for "${item.memeSearchQuery}":`, err);
        return "";
      }
    })(),
  ]);

  for (const b64 of photoResults) images.push(b64);

  return { photos: images, meme: memeBase64 };
}

router.post("/instagram/generate", async (req, res) => {
  try {
    const { topic, lang: langRaw, photos: photosRaw } = req.body as { topic?: string; lang?: string; photos?: string[] };
    const lang = parseLang(langRaw);

    // Optional user-uploaded photos (base64 or data URLs). Images are only
    // included when the user explicitly provides them — no automatic fetching.
    // Validation: full base64 decode, per-photo size cap, and image magic-byte check.
    const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB decoded per photo
    const userPhotos = (Array.isArray(photosRaw) ? photosRaw : [])
      .slice(0, 4)
      .filter((p): p is string => typeof p === "string" && p.length > 0)
      .map((p) => p.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, "").replace(/\s/g, ""))
      .filter((p) => {
        if (p.length > Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 8) return false;
        let buf: Buffer;
        try {
          buf = Buffer.from(p, "base64");
        } catch {
          return false;
        }
        // Reject if not valid base64 (round-trip check) or too large
        if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return false;
        if (buf.toString("base64").replace(/=+$/, "") !== p.replace(/=+$/, "")) return false;
        // Magic bytes: JPEG, PNG, GIF, WebP
        const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
        const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
        const isGif = buf.subarray(0, 3).toString("ascii") === "GIF";
        const isWebp = buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
        return isJpeg || isPng || isGif || isWebp;
      });
    if (Array.isArray(photosRaw) && photosRaw.length > 0 && userPhotos.length === 0) {
      res.status(400).json({ error: "Las fotos subidas no son válidas (usa JPG/PNG/WebP/GIF de máx. 5MB cada una)." });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const monthYear = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });

    const focus = typeof topic === "string" && topic.trim() ? topic.trim() : "";

    const postedCarousels = await db
      .select({ headline: instagramCarouselsTable.headline })
      .from(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.posted, true))
      .orderBy(desc(instagramCarouselsTable.createdAt))
      .limit(40);
    const postedTweets = await db
      .select({ headline: twitterPostsTable.headline })
      .from(twitterPostsTable)
      .where(eq(twitterPostsTable.posted, true))
      .orderBy(desc(twitterPostsTable.createdAt))
      .limit(40);
    const usedIgHeadlines = [
      ...postedCarousels.map(c => c.headline).filter(Boolean),
      ...postedTweets.map(t => t.headline).filter(Boolean),
    ];

    const alreadyUsedIgSection = usedIgHeadlines.length > 0
      ? `\n\n⚠️ ALREADY PUBLISHED — do NOT repeat the same angle or headline again:\n${usedIgHeadlines.map(h => `- ${h}`).join("\n")}\n\nIMPORTANT: carousels about the same antiq product but with a genuinely DIFFERENT angle (e.g. a different feature, workflow, or audience) are ALLOWED.`
      : "";

    const rejectedHeadlines: string[] = [];

    async function aiDuplicateCheck(newHeadline: string, existingHeadlines: string[]): Promise<{ isDuplicate: boolean; reason: string }> {
      if (existingHeadlines.length === 0) return { isDuplicate: false, reason: "no existing headlines" };
      const recentForCheck = existingHeadlines.slice(0, 25);
      try {
        const resp = await openai.chat.completions.create({
          model: "gpt-4.1-nano",
          temperature: 0,
          max_completion_tokens: 256,
          messages: [
            {
              role: "system",
              content: `You detect if a NEW carousel headline covers the IDENTICAL angle as any already-published headline for antiq's product content. Be VERY permissive — only flag TRUE duplicates.

DUPLICATE (same product AND same angle, just reworded):
- "DESCRIBE UN SONIDO. OBTÉN EL PLUGIN" vs "PIDE UN SONIDO Y FORGE LO CONSTRUYE" → DUPLICATE
- "TU SET, LISTO EN MINUTOS" vs "DE LIBRERÍA CAÓTICA A SET LISTO" → DUPLICATE

NOT DUPLICATE (these should ALL pass through):
- Same product, different feature: "FORGE CREA TU PLUGIN" vs "FORGE ENTIENDE TU LENGUAJE" (workflow vs interaction) → ALLOWED
- Same product, different audience: "STAGER PARA DJS" vs "STAGER PARA BANDAS EN VIVO" → ALLOWED
- Different products: anything about antiq DAW vs antiq forge vs antiq stager vs antiq for artists → ALLOWED
- Product vs philosophy: "EL DAW GRATUITO CON IA" vs "LA MÚSICA SIGUE SIENDO HUMANA" → ALLOWED

KEY RULE: sharing the brand name "antiq" or the same product does NOT make it a duplicate. Only the SAME product presented from the SAME angle counts as duplicate.

DEFAULT TO NOT DUPLICATE when uncertain.

Return ONLY valid JSON: {"isDuplicate": true/false, "reason": "brief explanation"}`,
            },
            {
              role: "user",
              content: `NEW HEADLINE: "${newHeadline}"\n\nALREADY PUBLISHED:\n${recentForCheck.map(h => `- "${h}"`).join("\n")}`,
            },
          ],
        });
        const raw = resp.choices[0]?.message?.content ?? "";
        const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(cleaned);
      } catch {
        return { isDuplicate: false, reason: "AI check failed, allowing through" };
      }
    }

    let carouselContents: Array<{
      headline: string;
      paragraph1: string;
      paragraph2: string;
      paragraph3: string;
      caption?: string;
      coverSearchQuery: string;
      slide1SearchQuery: string;
      slide2SearchQuery: string;
      slide3SearchQuery: string;
      memeSearchQuery?: string;
    }> = [];

    const categoryForceList = [
      "",
      "\n\n🔴 MANDATORY: Your previous picks were rejected as duplicates. You MUST pick a COMPLETELY DIFFERENT pillar. If previous picks were about one product, switch to another (DAW, forge, for artists, stager, philosophy, use cases).",
      "\n\n🔴🔴 CRITICAL: TWO attempts rejected. Pick from one of these SPECIFIC pillars ONLY: antiq stager, antiq for artists, or philosophy/use cases. Do NOT repeat any product already covered.",
      "\n\n🔴🔴🔴 FINAL ATTEMPT: Pick ANY antiq pillar or concrete workflow not yet covered — a specific feature, audience (DJ, songwriter, producer), or the free-access story ONLY.",
    ];

    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const rejectedSection = rejectedHeadlines.length > 0
        ? `\n\n🚫 REJECTED IN PREVIOUS ATTEMPTS (do NOT pick these topics again):\n${rejectedHeadlines.map(h => `- ${h}`).join("\n")}`
        : "";
      const categoryForce = categoryForceList[Math.min(attempt, categoryForceList.length - 1)];

      const contentResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 8192,
        messages: [
          {
            role: "system",
            content: `You are the content lead at antiq (antiq.xyz). Today is ${today}. You create ${langName(lang)}-language INFORMATIVE Instagram carousels that teach musicians, producers, songwriters and DJs what antiq is and what it can do.

${ANTIQ_BRIEF}

${ANTIQ_PILLARS}

Pick ONE pillar or concrete angle (not already published — see below) and write carousel content that leaves the reader genuinely understanding that part of antiq.

Produce:
1. "headline": A SHORT, BOLD, ALL-CAPS headline (max 8 words) in ${langName(lang)}. Benefit or intrigue, never vague hype. E.g. "DESCRIBE UN SONIDO. OBTÉN EL PLUGIN".
2. "paragraph1": First content slide (35-45 words MAX). 2-3 tight sentences. What it is / the problem it solves. STOP at 45 words.
3. "paragraph2": Second content slide (35-45 words MAX). 2-3 tight sentences. How it works — the concrete workflow. STOP at 45 words.
4. "paragraph3": Third content slide (35-45 words MAX). 2-3 tight sentences. What it changes for the artist + a natural nudge to antiq.xyz. STOP at 45 words.
5. "coverSearchQuery": English image search query (3-6 words) for an aesthetic, cinematic MUSIC photo matching the pillar. E.g: "music producer studio dark moody", "modular synthesizer close up macro", "dj mixing console club lights".
6. "slide1SearchQuery" / 7. "slide2SearchQuery" / 8. "slide3SearchQuery": English queries for the photos of each paragraph. Each MUST show a DIFFERENT visual subject (studio, hands on instrument, artist performing, gear close-up, headphones, waveforms on screen). NO press agencies, NO news photos — aesthetic music/production photography only.
9. "memeSearchQuery": query for an ACTUAL internet meme about music producers/DJs/musicians. MUST include the word "meme" plus ${lang === "en" ? `"funny"` : `"chistoso" or "gracioso"`}. E.g: "music producer meme ${lang === "en" ? "funny" : "chistoso"}". 3-6 words.
10. "caption": Instagram caption in ${langName(lang)} (80-120 words), PARAGRAPHS separated by "\\n\\n". Structure:
   • Paragraph 1: what this antiq tool/idea is (2-3 sentences)
   • Paragraph 2: how it helps the artist, concretely (2-3 sentences)
   • Final paragraph (ALWAYS separate): "${captionSuffix(lang)}"
   Minimal, confident, premium tone — no emojis, no hashtags, no clickbait.

RULES:
- EVERY product claim must come from the brief. NEVER invent features, prices, dates, or stats.
- Brand names always lowercase: antiq, antiq forge, antiq stager.
- ⚠️ AVOID REPEATS: do not repeat an angle already published. Same product with a genuinely different angle is allowed.${alreadyUsedIgSection}${rejectedSection}${categoryForce}${focus ? `\n\nFOCUS: the user asked to center this carousel on: ${focus}` : ""}

Return ONLY a valid JSON array of exactly 1 object:
[{ "headline", "paragraph1", "paragraph2", "paragraph3", "caption", "coverSearchQuery", "slide1SearchQuery", "slide2SearchQuery", "slide3SearchQuery", "memeSearchQuery" }]

No markdown fences, no extra text.`,
          },
          {
            role: "user",
            content: `Generate one informative antiq carousel in ${langName(lang)} on a fresh pillar. Return JSON array with 1 object only.`,
          },
        ],
      });

      const rawContent = contentResponse.choices[0]?.message?.content ?? "";
      req.log.info({ rawLength: rawContent.length, attempt: attempt + 1 }, "AI response received for instagram");

      await addUsageTokens("instagram", 1);

      let parsed: typeof carouselContents = [];
      const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        try {
          parsed = JSON.parse(cleaned.substring(start, end + 1));
        } catch (parseErr) {
          req.log.error({ parseErr, attempt: attempt + 1 }, "JSON parse failed for instagram");
          continue;
        }
      } else {
        req.log.warn({ attempt: attempt + 1 }, "AI response did not contain valid JSON, retrying");
        continue;
      }

      parsed = parsed.slice(0, 1);

      const filtered: typeof carouselContents = [];
      for (const item of parsed) {
        const dupResult = await aiDuplicateCheck(item.headline, usedIgHeadlines);
        if (dupResult.isDuplicate) {
          req.log.warn({ headline: item.headline, reason: dupResult.reason, attempt: attempt + 1 }, "AI filtered duplicate carousel topic");
          rejectedHeadlines.push(item.headline);
        } else {
          req.log.info({ headline: item.headline, reason: dupResult.reason, attempt: attempt + 1 }, "AI approved carousel as unique");
          filtered.push(item);
        }
      }

      if (filtered.length > 0) {
        carouselContents = filtered;
        break;
      }

      req.log.info({ attempt: attempt + 1, rejected: rejectedHeadlines }, "All carousels filtered as duplicates by AI, retrying with new topic");
    }

    if (carouselContents.length === 0) {
      res.status(500).json({ error: "No se pudo generar un carrusel con tema nuevo después de varios intentos. Intenta de nuevo más tarde." });
      return;
    }

    // Slides ship without images by default; photos appear only when the user
    // uploaded them (cover, then slides 1-3, in upload order).
    req.log.info({ userPhotoCount: userPhotos.length }, "Building carousel slides (user photos only, no auto-fetch)");
    const allCarouselImages = carouselContents.map(() => ({
      photos: [userPhotos[0] ?? "", userPhotos[1] ?? "", userPhotos[2] ?? "", userPhotos[3] ?? ""],
      meme: "",
    }));

    const insertedRows = await Promise.all(
      carouselContents.map((item, i) => {
        const result = allCarouselImages[i];
        return db
          .insert(instagramCarouselsTable)
          .values({
            headline: item.headline,
            contentParagraph1: item.paragraph1,
            contentParagraph2: item.paragraph2,
            contentParagraph3: item.paragraph3,
            caption: item.caption ?? null,
            coverImageData: result.photos[0] ?? "",
            slide1ImageData: result.photos[1] ?? "",
            slide2ImageData: result.photos[2] ?? "",
            slide3ImageData: result.photos[3] ?? "",
            memeImageData: result.meme || null,
          })
          .returning()
          .then((rows) => rows[0]);
      })
    );

    const results = insertedRows.map((inserted) => ({
      id: inserted.id,
      headline: inserted.headline,
      contentParagraph1: inserted.contentParagraph1,
      contentParagraph2: inserted.contentParagraph2,
      contentParagraph3: inserted.contentParagraph3,
      caption: inserted.caption ?? "",
      createdAt: inserted.createdAt,
      slides: [
        { type: "cover" as const, imageData: inserted.coverImageData ?? "", slideIndex: 0 },
        { type: "content" as const, imageData: inserted.slide1ImageData ?? "", slideIndex: 1 },
        { type: "content" as const, imageData: inserted.slide2ImageData ?? "", slideIndex: 2 },
        ...(inserted.memeImageData ? [{ type: "meme" as const, imageData: inserted.memeImageData, slideIndex: 10 }] : []),
        { type: "content" as const, imageData: inserted.slide3ImageData ?? "", slideIndex: 3 },
      ],
    }));

    res.json({ carousels: results, count: results.length });
  } catch (err) {
    req.log.error({ err }, "Error generating Instagram carousels");
    res.status(500).json({ error: "Failed to generate carousels" });
  }
});

router.post("/instagram/generate-from-url", async (req, res) => {
  try {
    const { url, title, description, lang: langRaw } = req.body as { url: string; title?: string; description?: string; lang?: string };
    const lang = parseLang(langRaw);
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const monthYear = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });

    req.log.info({ url }, "Generating carousel from user-provided URL");

    let articleContent: string;
    if (title && description) {
      articleContent = `Title: ${title}\n\nSummary: ${description}`;
      req.log.info("Using provided article metadata");
    } else {
      articleContent = await fetchArticleText(url);
      if (!articleContent || articleContent.length < 50) {
        res.status(500).json({ error: "Could not fetch article content" });
        return;
      }
      req.log.info({ contentLength: articleContent.length }, "Article content fetched for Instagram");
    }

    const contentResponse = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a senior editor at antiq (antiq.xyz), a music technology company; you write ${langName(lang)}-language editorial content about the music industry, music technology, and AI in music. Today is ${today}.

You will receive a detailed summary of a news article. Write Instagram carousel content for this story.

Produce:
1. "headline": A SHORT, BOLD, ALL-CAPS headline (max 8 words) in ${langName(lang)}. Impact over everything.
2. "paragraph1": First content slide (35-45 words MAX). 2-3 tight sentences. Facts: who, what, when, where, key number. Journalistic ${langName(lang)}. STOP at 45 words.
3. "paragraph2": Second content slide (35-45 words MAX). 2-3 tight sentences. Context or reaction. Journalistic ${langName(lang)}. STOP at 45 words.
4. "paragraph3": Third content slide (35-45 words MAX). 2-3 tight sentences. Implications, what comes next, or key quote. Journalistic ${langName(lang)}. STOP at 45 words.
5. "coverSearchQuery": Search query for the MAIN VISUAL SUBJECT. If about a PERSON → exact full name. If about a PLACE → exact place name. ALWAYS end with a press agency (Reuters, AP, AFP, Getty). E.g: "Donald Trump press conference ${monthYear} Reuters"
6. "slide1SearchQuery": English query for photo illustrating paragraph 1. Different visual subject than cover. Full name + context + agency.
7. "slide2SearchQuery": English query for photo illustrating paragraph 2. Different visual subject than cover and slide 1.
8. "slide3SearchQuery": English query for photo illustrating paragraph 3. Different visual subject than all previous.
9. "memeSearchQuery": Search query to find an ACTUAL INTERNET MEME (funny image with text overlay, reaction image, or viral humor format) related to this news topic. The query MUST include the word "meme" plus humor keywords like "chistoso", "gracioso", or "funny". Use the main subject/person name + humor terms. Examples:
   • "trump meme chistoso gracioso"
   • "guerra meme humor chistoso"
   • "messi meme gracioso divertido"
   • "economía crisis meme chistoso"
   IMPORTANT: We need MEMES (funny images, not news photos). ${lang === "en" ? `Always include "funny" or "hilarious" in the query.` : `Always include "chistoso" or "gracioso" in the query.`} 3-6 words.
10. "caption": Instagram caption in ${langName(lang)} (80-120 words), paragraphs separated by "\\n\\n". Structure:
   • Paragraph 1: Main news summary (2-3 sentences)
   • Paragraph 2: Context or implications (2-3 sentences)
   • Final paragraph: "${captionSuffix(lang)}"
   Informative, journalistic tone — no emojis, no hashtags.

CRITICAL IMAGE SEARCH RULE: The 4 search queries MUST each target a DIFFERENT visual subject.

STRICTLY BANNED WORDS: "apuesta", "apostar", "apuestas", "apostando", "bet", "betting" — ANY conjugation FORBIDDEN. Use "predicción"/"prediction", "pronóstico"/"forecast" instead.

Return ONLY a valid JSON object with these keys. No markdown fences, no extra text.`,
        },
        {
          role: "user",
          content: `Here is the article content:\n\n${articleContent}\n\nGenerate Instagram carousel content. Return JSON object only.`,
        },
      ],
    });

    const rawContent = contentResponse.choices[0]?.message?.content ?? "";
    const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) {
      res.status(500).json({ error: "AI response did not contain valid JSON" });
      return;
    }

    let parsed: {
      headline: string;
      paragraph1: string;
      paragraph2: string;
      paragraph3: string;
      caption?: string;
      coverSearchQuery: string;
      slide1SearchQuery: string;
      slide2SearchQuery: string;
      slide3SearchQuery: string;
      memeSearchQuery?: string;
    };

    try {
      parsed = JSON.parse(cleaned.substring(start, end + 1));
    } catch {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    req.log.info({ headline: parsed.headline }, "Fetching images for URL-based carousel");

    const result = await fetchCarouselImages({
      headline: parsed.headline,
      coverSearchQuery: parsed.coverSearchQuery,
      slide1SearchQuery: parsed.slide1SearchQuery,
      slide2SearchQuery: parsed.slide2SearchQuery,
      slide3SearchQuery: parsed.slide3SearchQuery,
      memeSearchQuery: parsed.memeSearchQuery,
    });

    const [inserted] = await db
      .insert(instagramCarouselsTable)
      .values({
        headline: parsed.headline,
        contentParagraph1: parsed.paragraph1,
        contentParagraph2: parsed.paragraph2,
        contentParagraph3: parsed.paragraph3,
        caption: parsed.caption ?? null,
        coverImageData: result.photos[0] ?? "",
        slide1ImageData: result.photos[1] ?? "",
        slide2ImageData: result.photos[2] ?? "",
        slide3ImageData: result.photos[3] ?? "",
        memeImageData: result.meme || null,
      })
      .returning();

    await addUsageTokens("instagram", 1);

    res.json({
      carousels: [{
        id: inserted.id,
        headline: inserted.headline,
        contentParagraph1: inserted.contentParagraph1,
        contentParagraph2: inserted.contentParagraph2,
        contentParagraph3: inserted.contentParagraph3,
        caption: inserted.caption ?? "",
        createdAt: inserted.createdAt,
        slides: [
          { type: "cover" as const, imageData: inserted.coverImageData ?? "", slideIndex: 0 },
          { type: "content" as const, imageData: inserted.slide1ImageData ?? "", slideIndex: 1 },
          { type: "content" as const, imageData: inserted.slide2ImageData ?? "", slideIndex: 2 },
          ...(inserted.memeImageData ? [{ type: "meme" as const, imageData: inserted.memeImageData, slideIndex: 10 }] : []),
          { type: "content" as const, imageData: inserted.slide3ImageData ?? "", slideIndex: 3 },
        ],
      }],
      count: 1,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating carousel from URL");
    res.status(500).json({ error: "Failed to generate carousel from URL" });
  }
});

router.post("/instagram/carousels/:id/regenerate-images", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await db
      .select()
      .from(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.id, id))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Carousel not found" });
      return;
    }

    const carousel = existing[0];
    req.log.info({ id, headline: carousel.headline }, "Regenerating carousel images");

    const monthYear = new Date().toLocaleString('en', { month: 'long', year: 'numeric' });

    const queryResponse = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You generate image search queries for news carousel slides. Given a headline and paragraph content, produce 4 DIFFERENT search queries to find relevant press/news photos plus 1 meme search query. Each photo query must target a visually DISTINCT subject. Always end photo queries with a press agency (Reuters, AP, AFP, Getty). The memeSearchQuery must find an ACTUAL INTERNET MEME (funny image, reaction image, humor format) — NOT a news photo. Include "meme" plus "chistoso" or "gracioso" or "funny". Use the main subject name + humor keywords. Example: "trump meme chistoso gracioso". 3-6 words. Return ONLY a JSON object with keys: coverSearchQuery, slide1SearchQuery, slide2SearchQuery, slide3SearchQuery, memeSearchQuery. No markdown fences.`,
        },
        {
          role: "user",
          content: `Headline: ${carousel.headline}\nParagraph 1: ${carousel.contentParagraph1}\nParagraph 2: ${carousel.contentParagraph2}\nParagraph 3: ${carousel.contentParagraph3 ?? ""}\n\nGenerate 4 FRESH, DIFFERENT image search queries (different from what was used before). Use specific names, places, dates (${monthYear}). Return JSON only.`,
        },
      ],
    });

    const raw = (queryResponse.choices[0]?.message?.content ?? "").replace(/```json\n?|\n?```/g, "").trim();
    let queries: { coverSearchQuery: string; slide1SearchQuery: string; slide2SearchQuery: string; slide3SearchQuery: string; memeSearchQuery?: string };
    try {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      queries = JSON.parse(raw.substring(s, e + 1));
    } catch {
      res.status(500).json({ error: "Failed to generate new search queries" });
      return;
    }

    const result = await fetchCarouselImages({
      headline: carousel.headline,
      coverSearchQuery: queries.coverSearchQuery,
      slide1SearchQuery: queries.slide1SearchQuery,
      slide2SearchQuery: queries.slide2SearchQuery,
      slide3SearchQuery: queries.slide3SearchQuery,
      memeSearchQuery: queries.memeSearchQuery,
    });

    const [inserted] = await db
      .insert(instagramCarouselsTable)
      .values({
        headline: carousel.headline,
        contentParagraph1: carousel.contentParagraph1,
        contentParagraph2: carousel.contentParagraph2,
        contentParagraph3: carousel.contentParagraph3,
        caption: carousel.caption,
        coverImageData: result.photos[0] ?? "",
        slide1ImageData: result.photos[1] ?? "",
        slide2ImageData: result.photos[2] ?? "",
        slide3ImageData: result.photos[3] ?? "",
        memeImageData: result.meme || null,
      })
      .returning();

    req.log.info({ id, newId: inserted.id }, "Carousel images regenerated as new entry");

    await addUsageTokens("instagram", 1);

    res.json({
      carousel: {
        id: inserted.id,
        headline: inserted.headline,
        contentParagraph1: inserted.contentParagraph1,
        contentParagraph2: inserted.contentParagraph2,
        contentParagraph3: inserted.contentParagraph3,
        caption: inserted.caption ?? "",
        createdAt: inserted.createdAt,
        slides: [
          { type: "cover" as const, imageData: inserted.coverImageData ?? "", slideIndex: 0 },
          { type: "content" as const, imageData: inserted.slide1ImageData ?? "", slideIndex: 1 },
          { type: "content" as const, imageData: inserted.slide2ImageData ?? "", slideIndex: 2 },
          ...(inserted.memeImageData ? [{ type: "meme" as const, imageData: inserted.memeImageData, slideIndex: 10 }] : []),
          { type: "content" as const, imageData: inserted.slide3ImageData ?? "", slideIndex: 3 },
        ],
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error regenerating carousel images");
    res.status(500).json({ error: "Failed to regenerate images" });
  }
});

router.get("/instagram/carousels", async (req, res) => {
  try {
    const archived = req.query["archived"] === "true";
    const carousels = await db
      .select({
        id: instagramCarouselsTable.id,
        headline: instagramCarouselsTable.headline,
        contentParagraph1: instagramCarouselsTable.contentParagraph1,
        contentParagraph2: instagramCarouselsTable.contentParagraph2,
        contentParagraph3: instagramCarouselsTable.contentParagraph3,
        caption: instagramCarouselsTable.caption,
        posted: instagramCarouselsTable.posted,
        createdAt: instagramCarouselsTable.createdAt,
        hasCover: sql<boolean>`cover_image_data IS NOT NULL AND cover_image_data != ''`.as("has_cover"),
        hasSlide1: sql<boolean>`slide1_image_data IS NOT NULL AND slide1_image_data != ''`.as("has_slide1"),
        hasSlide2: sql<boolean>`slide2_image_data IS NOT NULL AND slide2_image_data != ''`.as("has_slide2"),
        hasSlide3: sql<boolean>`slide3_image_data IS NOT NULL AND slide3_image_data != ''`.as("has_slide3"),
        hasMeme: sql<boolean>`meme_image_data IS NOT NULL AND meme_image_data != ''`.as("has_meme"),
      })
      .from(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.posted, archived))
      .orderBy(desc(instagramCarouselsTable.createdAt))
      .limit(50);

    res.json({
      carousels: carousels.map((c) => ({
        id: c.id,
        headline: c.headline,
        contentParagraph1: c.contentParagraph1,
        contentParagraph2: c.contentParagraph2,
        contentParagraph3: c.contentParagraph3,
        caption: c.caption ?? "",
        posted: c.posted,
        createdAt: c.createdAt,
        slides: [
          { type: "cover" as const, slideIndex: 0, imageUrl: c.hasCover ? `/api/cct/instagram/carousels/${c.id}/slide/0` : "" },
          { type: "content" as const, slideIndex: 1, imageUrl: c.hasSlide1 ? `/api/cct/instagram/carousels/${c.id}/slide/1` : "" },
          { type: "content" as const, slideIndex: 2, imageUrl: c.hasSlide2 ? `/api/cct/instagram/carousels/${c.id}/slide/2` : "" },
          ...(c.hasMeme ? [{ type: "meme" as const, slideIndex: 10, imageUrl: `/api/cct/instagram/carousels/${c.id}/slide/10` }] : []),
          { type: "content" as const, slideIndex: 3, imageUrl: c.hasSlide3 ? `/api/cct/instagram/carousels/${c.id}/slide/3` : "" },
        ],
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching Instagram carousels");
    res.status(500).json({ error: "Failed to fetch carousels" });
  }
});

router.patch("/instagram/carousels/:id/posted", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db
      .update(instagramCarouselsTable)
      .set({ posted: true })
      .where(eq(instagramCarouselsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking Instagram carousel as posted");
    res.status(500).json({ error: "Failed to update carousel" });
  }
});

router.get("/instagram/carousels/:id/slide/:slideIndex", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const slideIndex = parseInt(req.params["slideIndex"] ?? "0");
    const [carousel] = await db
      .select()
      .from(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.id, id));
    if (!carousel) { res.status(404).end(); return; }
    const dataMap: Record<number, string | null> = {
      0: carousel.coverImageData,
      1: carousel.slide1ImageData,
      2: carousel.slide2ImageData,
      3: carousel.slide3ImageData,
      10: carousel.memeImageData,
    };
    const b64 = dataMap[slideIndex];
    if (!b64) { res.status(404).end(); return; }
    const buf = Buffer.from(b64, "base64");
    let contentType = "image/jpeg";
    if (b64.startsWith("iVBOR")) contentType = "image/png";
    else if (b64.startsWith("UklGR")) contentType = "image/webp";
    else if (b64.startsWith("R0lGO")) contentType = "image/gif";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buf);
  } catch (err) {
    req.log.error({ err }, "Error serving slide image");
    res.status(500).end();
  }
});

router.get("/instagram/carousels/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    const [carousel] = await db
      .select()
      .from(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.id, id));

    if (!carousel) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json({
      id: carousel.id,
      headline: carousel.headline,
      contentParagraph1: carousel.contentParagraph1,
      contentParagraph2: carousel.contentParagraph2,
      contentParagraph3: carousel.contentParagraph3,
      createdAt: carousel.createdAt,
      slides: [
        { type: "cover" as const, imageData: carousel.coverImageData ?? "", slideIndex: 0 },
        { type: "content" as const, imageData: carousel.slide1ImageData ?? "", slideIndex: 1 },
        { type: "content" as const, imageData: carousel.slide2ImageData ?? "", slideIndex: 2 },
        ...(carousel.memeImageData ? [{ type: "meme" as const, imageData: carousel.memeImageData, slideIndex: 10 }] : []),
        ...(carousel.slide3ImageData ? [{ type: "content" as const, imageData: carousel.slide3ImageData, slideIndex: 3 }] : []),
      ],
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching carousel");
    res.status(500).json({ error: "Failed to fetch carousel" });
  }
});

router.post("/instagram/carousels/:id/delete", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db
      .delete(instagramCarouselsTable)
      .where(eq(instagramCarouselsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting carousel");
    res.status(500).json({ error: "Failed to delete carousel" });
  }
});

// ==================== TWITTER THREADS ====================

router.post("/twitter/threads/generate", async (req, res) => {
  try {
    const { lang: langRaw } = req.body as { lang?: string };
    const lang = parseLang(langRaw);
    const today = new Date().toISOString().split("T")[0];

    const recentThreads = await db
      .select({ title: twitterThreadsTable.title, tweets: twitterThreadsTable.tweets })
      .from(twitterThreadsTable)
      .orderBy(desc(twitterThreadsTable.createdAt))
      .limit(100);
    const usedThreadTopics = recentThreads.flatMap(t => {
      const topics = [t.title];
      try {
        const tweets = JSON.parse(t.tweets) as string[];
        if (tweets[0]) topics.push(tweets[0]);
      } catch {}
      return topics;
    }).filter(Boolean);

    const recentPosts = await db
      .select({ headline: twitterPostsTable.headline })
      .from(twitterPostsTable)
      .orderBy(desc(twitterPostsTable.createdAt))
      .limit(100);
    const usedPostHeadlines = recentPosts.map(p => p.headline).filter(Boolean);

    const allUsed = [...usedThreadTopics, ...usedPostHeadlines];

    const alreadyUsedSection = allUsed.length > 0
      ? `\n\nALREADY PUBLISHED — DO NOT REPEAT (check each thread title AND hook tweet below):\n${allUsed.map(h => `- ${h}`).join("\n")}\n\nIf a pillar or angle matches ANY of the above (same product presented the same way), SKIP IT and choose a different pillar, feature, workflow, or audience. Originality is mandatory.`
      : "";

    const threadResponse = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are the content lead at antiq (antiq.xyz). Today is ${today}. You write ${langName(lang)}-language INFORMATIVE Twitter/X threads that teach musicians, producers, songwriters and DJs what antiq is and what it can do for them.

${ANTIQ_BRIEF}

${ANTIQ_PILLARS}

YOUR TASK: create 3 threads, each a deep dive on a DIFFERENT pillar (and different from previously published threads — see list below). Each thread should leave the reader understanding one part of antiq well enough to explain it to a friend.

THREAD FORMAT:
- Each thread has 5-8 tweets

Tweet 1 (HOOK — THE MOST IMPORTANT TWEET):
- Make the reader stop scrolling. Open with the real problem the tool solves or a sharp, concrete statement about how music gets made today.
- Confident, minimal, premium tone — like a keynote opening line, never influencer-speak or clickbait.
- Good examples of tone: ${lang === "en" ? `"Most producers lose their best ideas waiting on tools. antiq DAW was built so the tool keeps up with you — a thread:", "You describe a sound. Thirty seconds later, it's a plugin in your session. This is antiq forge:"` : `"La mayoría de los productores pierden sus mejores ideas esperando a sus herramientas. antiq DAW existe para que la herramienta te siga el paso — un hilo:", "Describes un sonido. Treinta segundos después, es un plugin en tu sesión. Así funciona antiq forge:"`}
- Max 280 chars.

Tweets 2-6 (BODY):
- Explain how it works, step by step or benefit by benefit. One idea per tweet.
- Be CONCRETE: name the tool, describe the workflow, paint the scenario (a producer at 2am, a DJ prepping a set, a songwriter stuck on a sound).
- Stay strictly within the product brief — never invent features, numbers, or claims.
- Weave in the philosophy where natural: AI amplifies human creativity; the decisions stay with the artist.
- Max 280 chars each.

Second-to-last tweet (THE BIGGER PICTURE):
- Zoom out: what this means for how music gets made, or who gets to make it.
- Max 280 chars.

LAST TWEET (MANDATORY FORMAT):
- One inviting closing line about trying or exploring the tool.
- Then on a new line, ALWAYS end with exactly: "${lang === "en" ? "Discover the tools behind the future of music at antiq.xyz" : "Descubre las herramientas del futuro de la música en antiq.xyz"}"
- Max 280 chars.

NUMBERING FORMAT (MANDATORY):
- Tweet 1 MUST start with "${lang === "en" ? "THREAD: " : "HILO: "}" followed by the hook text
- All subsequent tweets MUST start with "(N/T) " where N is the tweet number and T is the total tweets in the thread. E.g. "(2/7) ", "(3/7) ", etc.
- The numbering prefix counts toward the 280 character limit

CRITICAL RULES:
- Write ONLY in ${langName(lang)} (brand names stay lowercase: antiq, antiq forge, antiq stager)
- EVERY claim about the product MUST come from the brief above. NEVER fabricate features, prices, dates, stats, or quotes.
- NO emojis, NO hashtags, NO links except the mandatory final antiq.xyz line
- Each tweet max 280 characters (including the numbering prefix)
- TONE: minimal, confident, premium — a company explaining its craft, not an influencer selling.
- The 3 threads must cover COMPLETELY different pillars from each other AND from previously published content.${alreadyUsedSection}

For each thread produce:
1. "title": Short descriptive title (3-6 words)
2. "tweets": Array of 5-8 tweet strings
3. "sources": Array with the single string "antiq.xyz"

Return ONLY a valid JSON array of exactly 3 thread objects. No markdown fences, no extra text.
{ "title", "tweets": ["tweet1", "tweet2", ...], "sources": ["antiq.xyz"] }`,
        },
        {
          role: "user",
          content: `Create 3 informative antiq threads in ${langName(lang)}, each on a different pillar. Return JSON array only.`,
        },
      ],
    });

    const rawContent = threadResponse.choices[0]?.message?.content ?? "";
    req.log.info({ rawLength: rawContent.length }, "AI response received for threads");

    let threads: Array<{ title: string; tweets: string[]; sources?: string[] }> = [];
    const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      try {
        threads = JSON.parse(cleaned.substring(start, end + 1));
      } catch (parseErr) {
        req.log.error({ parseErr }, "JSON parse failed for threads");
        res.status(500).json({ error: "Failed to parse AI response" });
        return;
      }
    } else {
      res.status(500).json({ error: "AI response did not contain valid JSON" });
      return;
    }

    threads = threads.slice(0, 3);
    if (threads.length === 0) {
      res.status(500).json({ error: "AI returned no threads" });
      return;
    }

    const hookImages = await Promise.all(
      threads.map((t) => fetchThreadHookImage(t.title))
    );

    const insertedRows = await Promise.all(
      threads.map((t, i) =>
        db
          .insert(twitterThreadsTable)
          .values({
            title: t.title,
            tweets: JSON.stringify(t.tweets),
            sourceArticles: t.sources ? JSON.stringify(t.sources) : null,
            hookImageUrl: hookImages[i] ?? null,
          })
          .returning()
          .then((rows) => rows[0])
      )
    );

    res.json({
      threads: insertedRows.map((row) => ({
        id: row.id,
        title: row.title,
        tweets: JSON.parse(row.tweets),
        sourceArticles: row.sourceArticles ? JSON.parse(row.sourceArticles) : [],
        hookImageUrl: row.hookImageUrl ?? null,
        posted: row.posted,
        createdAt: row.createdAt,
      })),
      count: insertedRows.length,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating Twitter threads");
    res.status(500).json({ error: "Failed to generate threads" });
  }
});

// ---------- Instagram Market Slideshow ----------

async function fetchImageBase64FromUrl(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8000) return "";
    return buf.toString("base64");
  } catch {
    return "";
  }
}

type MarketApiData = {
  id: number;
  question: string;
  description: string;
  marketType: string;
  endDate: string;
  isResolved: boolean;
  resolvedOption: string | null;
  volume: number;
  participants: number;
  options: Array<{ text: string; currentPrice: number; totalVolume: number }>;
  category?: { name: string };
};

async function fetchMarketData(marketId: number): Promise<MarketApiData | null> {
  try {
    const r = await fetch(`https://opinionmarket.mx/api/markets/${marketId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OpinionMarketCCT/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const d = await r.json() as MarketApiData;
    if (!d.question) return null;
    return d;
  } catch {
    return null;
  }
}

router.post("/instagram/slideshow-mkt/generate", async (req, res) => {
  try {
    const { marketIds, lang: langRaw } = req.body as { marketIds?: number[]; lang?: string };
    const lang = parseLang(langRaw);
    if (!Array.isArray(marketIds) || marketIds.length === 0) {
      res.status(400).json({ error: "Se requiere al menos un ID de mercado." });
      return;
    }
    const ids = marketIds.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0).slice(0, 8);
    if (ids.length === 0) {
      res.status(400).json({ error: "IDs de mercado inválidos." });
      return;
    }

    req.log.info({ ids }, "Fetching market data for slideshow");
    const markets = (await Promise.all(ids.map(id => fetchMarketData(id)))).filter((m): m is MarketApiData => m !== null);
    if (markets.length === 0) {
      res.status(400).json({ error: "No se pudo cargar ningún mercado." });
      return;
    }

    const marketsContext = markets.map(m => {
      const opts = m.options.map(o => `${o.text}: ${(o.currentPrice * 100).toFixed(1)}%`).join(", ");
      return `MARKET #${m.id}\nQuestion: ${m.question}\nCategory: ${m.category?.name ?? "General"}\nOptions: ${opts}`;
    }).join("\n\n");

    req.log.info("Generating slideshow content with AI");
    const aiResp = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: `You are editorial director at antiq's content studio, producing ${langName(lang)}-language social content. This slideshow uses prediction-market data from an external legacy source (opinionmarket.mx).

You will receive a list of prediction markets. Produce a JSON object to drive an Instagram slideshow.

For each market, output an English image search query for a high-quality EDITORIAL PRESS PHOTOGRAPH that captures the topic.

CRITICAL RULES for image queries:
1. SHORT — 3 to 6 words MAX. Long queries return junk.
2. ALWAYS include the SPECIFIC proper noun(s) from the market — the actual person's name, team name, country, brand, or event. Never generic.
3. END with a press agency: "Reuters", "AP", "Getty", or "AFP".
4. NO adjectives like "cinematic", "dramatic", "editorial", "moody", "atmospheric", "high production value", "bokeh", "no logos", "no text". Brave Search ignores them or returns stock-photo garbage.
5. NO commas, NO punctuation. Just space-separated keywords.
6. Prefer current/recent context (2025/2026) when relevant: "2026", "World Cup 2026", "election 2024", etc.

GOOD examples (copy this exact style):
- "Lionel Messi Inter Miami Getty"
- "Donald Trump rally podium Reuters"
- "Claudia Sheinbaum press conference AP"
- "Bad Bunny concert stage AFP"
- "Kim Jong Un missile launch Reuters"
- "Real Madrid Mbappe celebration Getty"
- "Bitcoin chart screen trader Reuters"
- "Mexico earthquake rescue AP"
- "Taylor Swift Eras Tour Getty"

BAD examples (do NOT do this):
- "alien spaceship dark sky cinematic dramatic atmospheric"  (vague, abstract)
- "nighttime football stadium tunnel dramatic lighting cinematic editorial photograph, tense transfer rumor atmosphere, blurred crowd bokeh, high production value, no logos, no text"  (way too long, comma-separated, full of buzzwords)
- "soccer player cinematic" (no specific name)

The cover image query follows the same rules — pick the most visually iconic SPECIFIC subject from the slideshow theme.

Also produce:
- coverHeadline: ALL-CAPS ${langName(lang)} headline (4-9 words) that previews the slideshow theme. Bold, intriguing, NEVER mentions "apuesta" or "apostar" or "betting".
- coverAccentWord: ONE word from the headline to render in green (the most emotionally charged word).
- caption: Instagram caption in ${langName(lang)} (60-100 words). Hook → 1-2 sentences of context → "${captionSuffix(lang)}". No emojis, no hashtags. NEVER use "apuesta/apostar/betting".

CRITICAL: NEVER use the words "apuesta", "apostar", "apuestas", "betting", "bet", or any conjugation. Use "predicción", "mercado", "probabilidad", "pronóstico" instead.

Return ONLY valid JSON, no markdown fences:
{
  "coverHeadline": "...",
  "coverAccentWord": "...",
  "caption": "...",
  "coverImageQuery": "short specific press-photo query ending in Reuters/AP/Getty/AFP",
  "marketImageQueries": [
    { "marketId": 552, "query": "..." },
    ...
  ]
}`,
        },
        {
          role: "user",
          content: `Today's markets for the slideshow:\n\n${marketsContext}`,
        },
      ],
    });

    await addUsageTokens("instagram", 1);

    const raw = aiResp.choices[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
    const oStart = cleaned.indexOf("{");
    const oEnd = cleaned.lastIndexOf("}");
    if (oStart === -1 || oEnd === -1) {
      res.status(500).json({ error: "AI response invalid" });
      return;
    }

    let aiData: {
      coverHeadline: string;
      coverAccentWord?: string;
      caption?: string;
      coverImageQuery: string;
      marketImageQueries: Array<{ marketId: number; query: string }>;
    };
    try {
      aiData = JSON.parse(cleaned.substring(oStart, oEnd + 1));
    } catch (parseErr) {
      req.log.error({ parseErr, raw: raw.slice(0, 500) }, "Slideshow AI JSON parse failed");
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    // Sanitize banned words
    const ban = /\b(apuest\w*|apost\w*|bett\w*|bet|bets)\b/gi;
    const sanitize = (s: string) => (s ?? "").replace(ban, "predicción");
    aiData.coverHeadline = (aiData.coverHeadline ?? "").replace(ban, "PREDICCIÓN").toUpperCase();
    aiData.caption = (aiData.caption ?? "").replace(ban, "predicción");

    // For 3+ markets, a thematic headline rarely works (markets are too diverse).
    // Override with a curated generic antiq tagline + a neutral atmospheric cover image query.
    if (markets.length >= 3) {
      const taglines: Array<{ headline: string; accent: string }> = [
        { headline: "EL FUTURO DE LA MÚSICA", accent: "FUTURO" },
        { headline: "TU SONIDO, TUS REGLAS", accent: "SONIDO" },
        { headline: "HERRAMIENTAS PARA CREAR", accent: "CREAR" },
        { headline: "LA MÚSICA SIGUE SIENDO HUMANA", accent: "HUMANA" },
        { headline: "PRODUCE SIN LÍMITES", accent: "LÍMITES" },
        { headline: "TECNOLOGÍA AL SERVICIO DEL ARTE", accent: "ARTE" },
        { headline: "CREA A TU MANERA", accent: "MANERA" },
      ];
      const pick = taglines[Math.floor(Math.random() * taglines.length)];
      aiData.coverHeadline = pick.headline;
      aiData.coverAccentWord = pick.accent;
      aiData.coverImageQuery = "diverse crowd people city street Reuters";
    }

    // Fetch images in parallel — prefer press-agency sources and HD for slideshows
    req.log.info({ coverImageQuery: aiData.coverImageQuery }, "Fetching slideshow images");
    const imgOpts = { preferAgencies: true, preferHD: true, minWidth: 1200, minHeight: 800 };
    const coverUrlPromise = fetchThreadHookImage(aiData.coverImageQuery, imgOpts);
    const marketUrlPromises = markets.map(m => {
      const q = aiData.marketImageQueries?.find(x => Number(x.marketId) === m.id)?.query
        ?? `${m.question} Reuters`;
      return fetchThreadHookImage(q, imgOpts);
    });
    const [coverUrl, ...marketUrls] = await Promise.all([coverUrlPromise, ...marketUrlPromises]);

    const [coverB64, ...marketB64s] = await Promise.all([
      coverUrl ? fetchImageBase64FromUrl(coverUrl) : Promise.resolve(""),
      ...marketUrls.map(u => u ? fetchImageBase64FromUrl(u) : Promise.resolve("")),
    ]);

    // Build slides
    type Slide = {
      type: "cover" | "market" | "cta";
      marketId?: number;
      question?: string;
      imageData?: string;
      isBinary?: boolean;
      chancePercent?: number;
      changePercent?: number;
      changeDirection?: "up" | "down" | "flat";
      options?: Array<{ label: string; percentage: number }>;
      headline?: string;
      accentWord?: string;
    };

    const slides: Slide[] = [];
    slides.push({
      type: "cover",
      headline: aiData.coverHeadline,
      accentWord: aiData.coverAccentWord ?? "",
      imageData: coverB64,
    });

    for (let i = 0; i < markets.length; i++) {
      const m = markets[i];
      const opts = m.options.map(o => ({
        label: sanitize(o.text).toUpperCase(),
        percentage: Math.round(o.currentPrice * 1000) / 10,
      }));
      const isBinary = m.marketType?.toUpperCase() === "BINARY" || (opts.length === 2 && opts.some(o => o.label === "YES" || o.label === "SÍ" || o.label === "SI"));
      // Pick the YES option (or the highest) as "chance"
      let chance = opts[0]?.percentage ?? 0;
      if (isBinary) {
        const yes = opts.find(o => o.label === "YES" || o.label === "SÍ" || o.label === "SI");
        if (yes) chance = yes.percentage;
      } else {
        chance = Math.max(...opts.map(o => o.percentage));
      }
      // Fake a small believable movement (±0.5% to ±4%) — direction biased by chance vs 50
      const drift = Math.round((Math.random() * 3.5 + 0.5) * 10) / 10;
      const dir: "up" | "down" = Math.random() < 0.5 ? "up" : "down";
      slides.push({
        type: "market",
        marketId: m.id,
        question: sanitize(m.question).toUpperCase(),
        imageData: marketB64s[i] ?? "",
        isBinary,
        chancePercent: chance,
        changePercent: drift,
        changeDirection: dir,
        options: opts,
      });
    }

    slides.push({ type: "cta" });

    const successfulIds = markets.map(m => m.id);
    const [inserted] = await db
      .insert(instagramMarketSlideshowsTable)
      .values({
        marketIds: JSON.stringify(successfulIds),
        coverHeadline: aiData.coverHeadline,
        coverAccentWord: aiData.coverAccentWord ?? null,
        coverImageData: coverB64 || null,
        slides: JSON.stringify(slides),
        caption: aiData.caption ?? null,
      })
      .returning();

    res.json({
      slideshow: {
        id: inserted.id,
        marketIds: JSON.parse(inserted.marketIds) as number[],
        coverHeadline: inserted.coverHeadline,
        coverAccentWord: inserted.coverAccentWord,
        caption: inserted.caption,
        posted: inserted.posted,
        createdAt: inserted.createdAt,
        slides: JSON.parse(inserted.slides) as Slide[],
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error generating market slideshow");
    res.status(500).json({ error: "Failed to generate slideshow" });
  }
});

router.get("/instagram/slideshow-mkt", async (req, res) => {
  try {
    const archived = req.query["archived"] === "true";
    const rows = await db
      .select()
      .from(instagramMarketSlideshowsTable)
      .where(eq(instagramMarketSlideshowsTable.posted, archived))
      .orderBy(desc(instagramMarketSlideshowsTable.createdAt))
      .limit(50);
    res.json({
      slideshows: rows.map(r => ({
        id: r.id,
        marketIds: JSON.parse(r.marketIds),
        coverHeadline: r.coverHeadline,
        coverAccentWord: r.coverAccentWord,
        caption: r.caption,
        posted: r.posted,
        createdAt: r.createdAt,
        slides: JSON.parse(r.slides),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error listing slideshows");
    res.status(500).json({ error: "Failed to list slideshows" });
  }
});

router.delete("/instagram/slideshow-mkt/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db.delete(instagramMarketSlideshowsTable).where(eq(instagramMarketSlideshowsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting slideshow");
    res.status(500).json({ error: "Failed to delete slideshow" });
  }
});

router.patch("/instagram/slideshow-mkt/:id/posted", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db.update(instagramMarketSlideshowsTable).set({ posted: true }).where(eq(instagramMarketSlideshowsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking slideshow as posted");
    res.status(500).json({ error: "Failed to mark slideshow as posted" });
  }
});

router.post("/twitter/threads/generate-market", async (req, res) => {
  try {
    const { marketId, lang: langRaw } = req.body as { marketId?: string; lang?: string };
    const lang = parseLang(langRaw);
    if (!marketId || !/^\d+$/.test(marketId)) {
      res.status(400).json({ error: "Se requiere un número de mercado válido." });
      return;
    }

    const marketUrl = `https://opinionmarket.mx/markets/${marketId}`;
    const marketApiUrl = `https://opinionmarket.mx/api/markets/${marketId}`;
    const today = new Date().toISOString().split("T")[0];

    req.log.info({ marketId, marketUrl, marketApiUrl }, "Fetching market data from API");

    let marketData: {
      id: number;
      question: string;
      description: string;
      marketType: string;
      endDate: string;
      isResolved: boolean;
      resolvedOption: string | null;
      volume: number;
      participants: number;
      options: Array<{ text: string; currentPrice: number; totalVolume: number }>;
      category?: { name: string };
    };

    try {
      const apiRes = await fetch(marketApiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OpinionMarketCCT/1.0)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!apiRes.ok) {
        res.status(400).json({ error: `No se pudo acceder al mercado #${marketId}. Verifica que el número sea correcto.` });
        return;
      }
      marketData = await apiRes.json() as typeof marketData;
    } catch {
      res.status(500).json({ error: `Error al conectar con opinionmarket.mx. Intenta de nuevo.` });
      return;
    }

    if (!marketData.question) {
      res.status(400).json({ error: `El mercado #${marketId} no tiene datos válidos.` });
      return;
    }

    const optionsText = marketData.options
      .map(o => `"${o.text}": ${(o.currentPrice * 100).toFixed(1)}% (volumen: ${o.totalVolume})`)
      .join(" | ");

    const endDateFormatted = new Date(marketData.endDate).toLocaleDateString("es-MX", {
      year: "numeric", month: "long", day: "numeric",
    });

    const marketSummary = `MARKET #${marketData.id}
Question: ${marketData.question}
Description: ${marketData.description}
Category: ${marketData.category?.name ?? "General"}
Type: ${marketData.marketType}
Status: ${marketData.isResolved ? `Resolved (${marketData.resolvedOption})` : "Active"}
End Date: ${endDateFormatted}
Total Volume: ${marketData.volume}
Participants: ${marketData.participants}
Current Prices: ${optionsText}`;

    req.log.info({ question: marketData.question, options: optionsText }, "Market data extracted");

    const searchQuery = marketData.question;
    const newsResults = await Promise.all([
      fetchBraveNews(searchQuery, 8),
      fetchBraveNews(`${searchQuery} latest news`, 8),
    ]);
    const relatedNews = newsResults.flat();
    const newsContext = relatedNews.length > 0
      ? `\n\nRELATED RECENT NEWS:\n${relatedNews.slice(0, 10).map((a, i) => `[${i + 1}] ${a.title} — ${a.description} (${a.source})`).join("\n")}`
      : "";

    const threadResponse = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You are a senior analyst at antiq (antiq.xyz), a music technology company building next-generation tools for artists, producers and songwriters. Today is ${today}.

You will receive structured data from a specific prediction market on Opinion Market (opinionmarket.mx), an external legacy data source. Your job is to create a single Twitter/X thread analyzing this market.

The market URL is: ${marketUrl}

THREAD FORMAT (6-8 tweets):

Tweet 1 (HOOK — MOST IMPORTANT):
- DO NOT simply restate the market question. That's boring and people will scroll past.
- Instead, open with a PROVOCATIVE INSIGHT about the topic: a surprising stat, a counterintuitive angle, a tension that makes people NEED to know more.
- The reader should think "wait, really?" or "I need to understand this" — not "oh, another prediction market post."
- Use the market data (especially the probability) to create intrigue. E.g. if something is at 96%, ask WHY the market is so confident or what the 4% dissenters know. If it's at 50/50, highlight the uncertainty and what's at stake.
- Frame it around what's HAPPENING in the real world that makes this market interesting RIGHT NOW.
- Institutional tone, but compelling. Like an FT or Bloomberg columnist opening a must-read column.
- Good examples: ${lang === "en" ? `"The market gives [X] a 96% probability. The question isn't whether it'll happen, but what it means for [Y] — and why 4% of participants predict otherwise:", "Only 17 people are participating in a market that could define [Z]. The data suggests something few are seeing:"` : `"El mercado le da un 96% de probabilidad a [X]. La pregunta no es si pasará, sino qué significa para [Y] — y por qué un 4% de participantes predice lo contrario:", "Solo 17 personas están participando en un mercado que podría definir [Z]. Los datos sugieren algo que pocos están viendo:"`}
- Max 280 chars.

Tweets 2-5 (ANALYSIS):
- Build the case for why this market matters. Connect it to real-world events, decisions, and consequences.
- Use the market data intelligently: probability movements, volume concentration, participant behavior — what do these numbers TELL US?
- If related news is provided, weave it into the narrative to show how current events are shaping the market.
- Each tweet should make the reader want to read the next one. End tweets with implicit cliffhangers or transitions.
- Institutional voice, but engaging. Every tweet must add value.
- Max 280 chars each.

Tweet before last (OUTLOOK):
- What specific events, dates, or decisions will move this market? Be concrete.
- Create a sense of "I should pay attention to this" — give the reader a reason to follow the story.
- Max 280 chars.

LAST TWEET (MANDATORY FORMAT):
- Pose a specific, thought-provoking question about the market outcome that makes people want to participate.
- Then on a new line: "${lang === "en" ? `Join this market at ${marketUrl}` : `Participa en este mercado en ${marketUrl}`}"
- Max 280 chars.

NUMBERING FORMAT (MANDATORY):
- Tweet 1 MUST start with "${lang === "en" ? "THREAD: " : "HILO: "}" followed by the hook text
- All subsequent tweets MUST start with "(N/T) " where N is the tweet number and T is the total tweets in the thread. E.g. "(2/7) ", "(3/7) ", etc.
- The numbering prefix counts toward the 280 character limit

CRITICAL RULES:
- Write ONLY in ${langName(lang)}
- Use facts from the market data and related news provided. Do NOT invent data.
- Reference the actual market probability, volume, participants, and end date in your analysis.
- NO emojis, NO hashtags
- Each tweet max 280 characters (including the numbering prefix)
- Institutional, formal, authoritative tone

Return ONLY a valid JSON object (not an array). No markdown fences.
{ "title": "3-6 word title", "tweets": ["tweet1", "tweet2", ...], "sources": ["opinionmarket.mx", ...other sources used] }`,
        },
        {
          role: "user",
          content: `Here is the structured data from prediction market #${marketId}. Create an analytical thread about this market.\n\n${marketSummary}${newsContext}`,
        },
      ],
    });

    const rawContent = threadResponse.choices[0]?.message?.content ?? "";
    req.log.info({ rawLength: rawContent.length }, "AI response for market thread");

    let thread: { title: string; tweets: string[]; sources?: string[] };
    const cleaned = rawContent.replace(/```json\n?|\n?```/g, "").trim();
    const objStart = cleaned.indexOf("{");
    const objEnd = cleaned.lastIndexOf("}");
    if (objStart !== -1 && objEnd !== -1) {
      try {
        thread = JSON.parse(cleaned.substring(objStart, objEnd + 1));
      } catch (parseErr) {
        req.log.error({ parseErr }, "JSON parse failed for market thread");
        res.status(500).json({ error: "Failed to parse AI response" });
        return;
      }
    } else {
      res.status(500).json({ error: "AI response did not contain valid JSON" });
      return;
    }

    const hookImage = await fetchThreadHookImage(thread.title);

    const [inserted] = await db
      .insert(twitterThreadsTable)
      .values({
        title: thread.title,
        tweets: JSON.stringify(thread.tweets),
        sourceArticles: JSON.stringify([...(thread.sources ?? []), marketUrl]),
        hookImageUrl: hookImage ?? null,
      })
      .returning();

    res.json({
      threads: [{
        id: inserted.id,
        title: inserted.title,
        tweets: JSON.parse(inserted.tweets),
        sourceArticles: inserted.sourceArticles ? JSON.parse(inserted.sourceArticles) : [],
        hookImageUrl: inserted.hookImageUrl ?? null,
        posted: inserted.posted,
        createdAt: inserted.createdAt,
      }],
      count: 1,
    });
  } catch (err) {
    req.log.error({ err }, "Error generating market-based thread");
    res.status(500).json({ error: "Failed to generate market thread" });
  }
});

router.get("/twitter/threads", async (req, res) => {
  try {
    const archived = req.query["archived"] === "true";
    const threads = await db
      .select()
      .from(twitterThreadsTable)
      .where(eq(twitterThreadsTable.posted, archived))
      .orderBy(desc(twitterThreadsTable.createdAt))
      .limit(50);

    res.json({
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        tweets: JSON.parse(t.tweets),
        sourceArticles: t.sourceArticles ? JSON.parse(t.sourceArticles) : [],
        hookImageUrl: t.hookImageUrl ?? null,
        posted: t.posted,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching threads");
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

router.patch("/twitter/threads/:id/posted", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db
      .update(twitterThreadsTable)
      .set({ posted: true })
      .where(eq(twitterThreadsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking thread as posted");
    res.status(500).json({ error: "Failed to mark thread as posted" });
  }
});

router.delete("/twitter/threads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db
      .delete(twitterThreadsTable)
      .where(eq(twitterThreadsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting thread");
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

router.get("/image-proxy", async (req, res) => {
  try {
    const imageUrl = req.query["url"] as string;
    if (!imageUrl) { res.status(400).json({ error: "Missing url" }); return; }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": new URL(imageUrl).origin + "/",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });

    if (!response.ok) {
      req.log.warn({ imageUrl, status: response.status }, "Image proxy upstream error");
      res.status(502).json({ error: "Failed to fetch image" });
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    req.log.warn({ err, imageUrl: req.query["url"] }, "Image proxy failed");
    res.status(502).json({ error: "Failed to proxy image" });
  }
});

// ---------- Ad Gen ----------

const AD_STYLES = [
  "mockup-dark",
  "mockup-light",
  "center",
] as const;

const PREFERRED_DOMAINS = [
  "unsplash.com", "images.unsplash.com",
  "pexels.com", "images.pexels.com",
  "pixabay.com", "cdn.pixabay.com",
  "peakpx.com", "w0.peakpx.com",
  "wallpapers.com", "wallpaperscraft.com",
  "hdqwalls.com", "wallhaven.cc",
  "4kwallpapers.com",
];

const BLOCKED_DOMAINS = [
  "istockphoto.com", "gettyimages.com", "shutterstock.com",
  "adobestock.com", "depositphotos.com", "dreamstime.com",
  "123rf.com", "alamy.com", "bigstockphoto.com", "canstockphoto.com",
  "vectorstock.com", "freepik.com", "vecteezy.com",
  "pinterest.com", "pinimg.com",
  "facebook.com", "fbcdn.net",
  "instagram.com", "cdninstagram.com",
  "twitter.com", "twimg.com",
  "reddit.com", "redd.it",
  "tiktok.com", "youtube.com", "ytimg.com",
  "amazon.com", "ebay.com", "aliexpress.com",
  "wikipedia.org", "wikimedia.org",
  "etsy.com", "redbubble.com", "society6.com", "teepublic.com",
];

const BLOCKED_KEYWORDS = [
  "favicon", "logo", "icon", "avatar", "badge", "banner-ad",
  "pixel", "spacer", "tracking", "meme", "cartoon", "clipart",
  "vector", "illustration", "drawing", "sketch", "comic",
  "infographic", "chart", "graph", "diagram", "screenshot",
  "product", "template", "mockup", "preview", "sample",
  "watermark", "stock-photo", "editorial", "news-photo",
  "portrait", "selfie", "headshot", "face-",
  "thumb", "small", "150x", "100x", "200x", "thumbnail",
];

async function fetchAdBackground(query: string): Promise<string | null> {
  try {
    const url = new URL("https://api.search.brave.com/res/v1/images/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", "20");
    url.searchParams.set("safesearch", "off");
    url.searchParams.set("size", "Large");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json() as { results?: Array<{ properties?: { url?: string; width?: number; height?: number }; width?: number; height?: number; title?: string; thumbnail?: { src?: string } }> };
    const results = data.results ?? [];

    const isClean = (imgUrl: string, title: string) => {
      const lower = imgUrl.toLowerCase();
      const titleLower = title.toLowerCase();
      if (BLOCKED_DOMAINS.some(d => lower.includes(d))) return false;
      if (BLOCKED_KEYWORDS.some(b => lower.includes(b) || titleLower.includes(b))) return false;
      if (lower.endsWith(".svg") || lower.endsWith(".gif") || lower.endsWith(".bmp")) return false;
      return true;
    };

    const isPreferred = (imgUrl: string) =>
      PREFERRED_DOMAINS.some(d => imgUrl.toLowerCase().includes(d));

    const scored = results
      .map(r => {
        const imgUrl = r.properties?.url ?? "";
        const title = r.title ?? (r as any).title ?? "";
        if (!imgUrl || !isClean(imgUrl, title)) return null;
        let score = 0;
        if (isPreferred(imgUrl)) score += 10;
        const w = (r as any).properties?.width ?? (r as any).width ?? 0;
        const h = (r as any).properties?.height ?? (r as any).height ?? 0;
        if (w >= 1200 && h >= 800) score += 5;
        else if (w >= 800 && h >= 600) score += 2;
        if (imgUrl.match(/\.(jpg|jpeg|webp)(\?|$)/i)) score += 2;
        if (imgUrl.includes("unsplash")) score += 3;
        if (imgUrl.includes("pexels")) score += 3;
        return { url: imgUrl, score };
      })
      .filter((x): x is { url: string; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

    for (const c of scored.slice(0, 10)) {
      try {
        const parsed = new URL(c.url);
        for (const [key] of [...parsed.searchParams.entries()]) {
          const k = key.toLowerCase();
          if (["width", "w", "height", "h", "quality", "q", "size", "resize", "smart", "fit", "crop"].includes(k)) {
            parsed.searchParams.delete(key);
          }
        }
        return parsed.toString();
      } catch {
        return c.url;
      }
    }

    for (const r of results.slice(0, 10)) {
      const thumbUrl = (r as any).thumbnail?.src;
      if (thumbUrl && thumbUrl.startsWith("http")) return thumbUrl;
    }

    return null;
  } catch {
    return null;
  }
}

const HEADLINE_POOL = [
  "El futuro de la música", "Tu sonido, tus reglas", "Crea sin límites",
  "Herramientas que escuchan", "La música sigue humana", "Produce a tu manera",
  "Describe. Crea. Escucha.", "Tu estudio, potenciado", "El DAW que se adapta",
  "Sonido sin fronteras", "Tu flujo, tus plugins", "Crea el instrumento",
  "Música sin fricción", "Del caos al set", "Tu carrera, un solo lugar",
  "Ingeniería para artistas", "Tu idea, en segundos", "Hecho para creadores",
  "La tecnología acompaña", "El arte decide", "Tu próximo sonido",
  "Produce más, pelea menos", "Herramientas a tu medida", "Tu momento creativo",
];

const SUBHEADLINE_POOL = [
  "El DAW gratuito impulsado por IA.",
  "Describe un sonido y créalo al instante.",
  "Plugins hechos a tu medida, en tiempo real.",
  "Tecnología que respeta tu proceso creativo.",
  "Herramientas de nueva generación para artistas.",
  "Tu flujo de trabajo, tus reglas.",
  "Produce, refina y gestiona tu música.",
  "De la idea al sonido, sin fricción.",
  "La música sigue siendo humana.",
  "Gratis, y hecho para como tú trabajas.",
];

const HEADLINE_POOL_EN = [
  "The future of music", "Your sound, your rules", "Create without limits",
  "Tools that listen", "Music stays human", "Produce your way",
  "Describe. Create. Listen.", "Your studio, amplified", "The DAW that adapts",
  "Sound without borders", "Your flow, your plugins", "Build the instrument",
  "Frictionless music", "From mess to set", "Your career, one place",
  "Engineering for artists", "Your idea, in seconds", "Made for creators",
  "Technology follows", "The artist decides", "Your next sound",
  "Produce more, fight less", "Tools made for you", "Your creative moment",
];

const SUBHEADLINE_POOL_EN = [
  "The free, AI-powered DAW.",
  "Describe a sound. Hear it instantly.",
  "Plugins built for you, in real time.",
  "Technology that respects your creative process.",
  "Next-generation tools for artists.",
  "Your workflow, your rules.",
  "Produce, refine and manage your music.",
  "From idea to sound, no friction.",
  "The future of music is still human.",
  "Free, and built around how you work.",
];

function headlinePool(lang: Lang): string[] {
  return lang === "en" ? HEADLINE_POOL_EN : HEADLINE_POOL;
}
function subheadlinePool(lang: Lang): string[] {
  return lang === "en" ? SUBHEADLINE_POOL_EN : SUBHEADLINE_POOL;
}

const EMOTION_BG_QUERIES = [
  "minimal cinematic landscape soft light fog atmospheric",
  "calm ocean horizon minimal soft pastel sky",
  "misty mountains minimal fog muted atmospheric",
  "empty desert road minimal cinematic golden hour",
  "soft clouds sky minimal pastel dreamy abstract",
  "quiet forest fog minimal moody atmospheric",
  "open grass field big sky minimal serene",
  "minimalist architecture soft light shadow neutral tones",
  "calm water reflection minimal moody dawn",
  "sand dunes minimal soft light abstract curves",
  "snowy minimal landscape soft white atmospheric",
  "lone tree empty field minimalist cinematic",
  "northern lights minimal night sky atmospheric",
  "minimal mountain silhouette dusk soft gradient",
  "still lake mist minimal serene morning light",
];

const BG_QUERIES = [
  "dark marble texture close up surface detail",
  "black concrete texture rough surface macro",
  "dark leather texture grain close up detail",
  "charcoal paper texture dark matte surface",
  "dark wood grain texture close up walnut ebony",
  "black granite stone texture polished surface",
  "dark fabric texture linen canvas close up",
  "dark slate stone texture natural surface detail",
  "black brushed metal texture aluminum surface",
  "dark sand texture close up grain detail",
  "obsidian glass texture dark smooth surface",
  "dark terrazzo texture speckled surface close up",
  "black ceramic texture matte surface detail",
  "dark rust metal texture patina surface close up",
  "dark cork texture natural surface macro",
  "charcoal sketch paper texture dark matte grain",
  "dark asphalt texture rough surface close up",
  "black plaster wall texture minimal surface",
  "dark clay texture earthy surface close up",
  "dark kraft paper texture brown black matte",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function generateEmotionImage(rawHeadline: string, log: any, format: "story" | "post" = "story", timeoutMs?: number): Promise<string | null> {
  const headline = (rawHeadline || "").slice(0, 80).trim();
  // Clamp each network call to the remaining budget (if provided) so a single
  // slow gpt-image-1 call can never overrun the caller's deadline.
  const promptTimeout = timeoutMs ? Math.max(5000, Math.min(60000, timeoutMs)) : undefined;
  const imageTimeout = timeoutMs ? Math.max(8000, timeoutMs) : undefined;
  try {
    let scene = "";
    try {
      const promptResp = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 320,
        temperature: 1.25,
        messages: [
          {
            role: "system",
            content: `You are an award-winning art director and conceptual photographer creating images for a high-end editorial ad campaign. The aesthetic: images that look like REAL PHOTOGRAPHS — shot on 35mm film, a phone flash, or a cinematic camera — but containing ONE surreal, uncanny, slightly unsettling or absurd twist. Mundane, believable real-world scenes made strange by a single out-of-place element.

Reference moodboard (capture THIS energy, do not copy literally):
- A real horse standing inside a fluorescent-lit corner convenience store at night, eerie green light, phone-flash snapshot.
- A single empty wooden chair alone in the middle of a vast green grass field under a huge calm sky.
- A lone figure on a white horse in the dark watching a distant house burn, fire glow, grainy night film.
- Two old men reading newspapers seated on a concrete ledge against a bold flat orange wall, long dramatic shadows, editorial.
- A person in a suit on a chair in a plain studio, deadpan and minimal.

Given an emotional phrase, invent ONE such scene that EVOKES its feeling — never literal, never illustrating the words.

Rules for the concept:
- It MUST read as a REAL PHOTOGRAPH — real-world physics, lighting and materials. NOT a painting, illustration, 3D render, or fantasy/AI-art.
- Exactly ONE surreal, uncanny, deadpan or absurd twist: something out of place, liminal, or eerie. Keep everything else ordinary and believable.
- Strong, simple composition with GENEROUS negative space (sky, blank wall, field, void, ceiling) so text can be overlaid.
- Real photographic lighting: phone flash, fluorescent tubes, golden hour, moonlight, fire glow, overcast, or a bold single-color studio backdrop.
- If a person appears, their face must be hidden, turned away, distant, or silhouetted. No crowds.
- No readable text, letters, words, numbers, logos, signage or watermarks anywhere in the scene.

Return ONLY the image-generation prompt as one vivid paragraph of concrete PHOTOGRAPHIC detail (subject, setting, lighting, film/camera look, color palette, mood). No preamble, no quotes.`,
          },
          {
            role: "user",
            content: `Emotional phrase: "${headline}". Invent the photorealistic, uncanny, slightly absurd real-photo scene.`,
          },
        ],
      }, promptTimeout ? { timeout: promptTimeout, maxRetries: 0 } : undefined);
      scene = (promptResp.choices[0]?.message?.content ?? "").replace(/```/g, "").trim();
    } catch (e) {
      log.warn({ err: e }, "Emotion image-prompt generation failed, using template");
    }

    if (!scene || scene.length < 20) {
      scene = `A candid real photograph evoking the feeling of "${headline}": an ordinary, believable real-world scene with ONE uncanny, out-of-place element — like a lone empty chair in a vast grass field, or an animal somewhere it should not be — shot on grainy 35mm film with lots of empty sky or wall as negative space.`;
    }

    const fullPrompt = `${scene}

ART DIRECTION: this MUST look like a genuine REAL PHOTOGRAPH — authentic 35mm film or phone-flash photography, natural film grain, real-world lighting, physics and materials, documentary/editorial realism. Surreal and uncanny in CONTENT only via one out-of-place or absurd element — but NEVER a painting, NEVER illustration, NEVER 3D render, NEVER digital fantasy or AI-art, NEVER double-exposure, smoke-galaxy, glowing-particle or dreamlike-blur effects. Minimalist composition with generous negative space (sky, blank wall, field, ceiling) for text overlay. Cinematic, slightly muted color grade with subtle grain. ${format === "post" ? "Square 1:1 framing" : "Vertical 9:16 framing"}. NO text, NO words, NO letters, NO numbers, NO logos, NO watermarks, NO signage. Any human face must be hidden, turned away, distant, or silhouetted.`;

    const imgResp = await openai.images.generate({
      model: "gpt-image-1",
      prompt: fullPrompt,
      size: format === "post" ? "1024x1024" : "1024x1536",
    }, imageTimeout ? { timeout: imageTimeout, maxRetries: 0 } : undefined);
    const b64 = imgResp.data?.[0]?.b64_json;
    if (!b64) {
      log.warn("Emotion AI image returned no data");
      return null;
    }
    log.info({ headline }, "Emotion AI image generated");
    return `data:image/png;base64,${b64}`;
  } catch (err) {
    log.warn({ err }, "Emotion AI image generation failed");
    return null;
  }
}

async function generateAdContent(style: string, log: any, lang: Lang = "es"): Promise<{ headline: string; accentWord: string; subheadline: string; bgSearchQuery: string }> {
  const maxAttempts = 2;
  const isEmotion = style === "emotion";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const seed = pickRandom(headlinePool(lang));
      const contentResponse = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 512,
        temperature: 1.1,
        messages: [
          {
            role: "system",
            content: `You are an elite creative copywriter for antiq (antiq.xyz), a music technology company. Products: antiq DAW (free, AI-powered DAW), antiq forge (AI plugin engine that builds instruments on demand), antiq for artists (agent platform for marketing, production and bookings) and antiq stager (turns a messy library into show-ready sets).

Generate a UNIQUE Instagram Story ad. Do NOT repeat the seed — use it only as inspiration for tone/length.

STYLE: "${style}"

Generate ALL 4 fields:
${isEmotion
  ? `1. "headline": 2-5 words. Evocative, emotional, poetic yet catchy — an aspirational phrase that stirs feeling (curiosity, ambition, belonging). ${langName(lang)}. Must be DIFFERENT from the seed "${seed}".
2. "accentWord": ONE word from your headline to render in italic accent style (the emotional keyword).
3. "subheadline": Quiet, supporting tagline, 5-10 words, ${langName(lang)}.
4. "bgSearchQuery": English search query for an ATMOSPHERIC, CINEMATIC, MINIMAL photo — serene landscapes, soft light, fog, empty minimal scenes, abstract natural beauty. Examples: "minimal cinematic landscape soft light fog atmospheric", "calm ocean horizon minimal soft pastel sky", "misty mountains minimal fog muted atmospheric". Never busy scenes, never people, never logos, never text. Always provide one.`
  : `1. "headline": 2-4 words. Bold, dramatic, ${langName(lang)}. Must be DIFFERENT from the seed "${seed}".
2. "accentWord": ONE word from your headline to render in italic accent style (the emotional keyword).
3. "subheadline": Supporting tagline, 6-12 words, ${langName(lang)}.
4. "bgSearchQuery": English search query for a DARK TEXTURE or SURFACE close-up photo. Must be a real material texture — never landscapes, wallpapers, people, or busy scenes. Examples: "dark marble texture close up surface detail", "black concrete texture rough surface macro", "dark leather texture grain close up detail", "dark wood grain texture close up walnut ebony". Always provide one.`}

ABSOLUTE RULES:
- NEVER use "apuesta", "apostar", "apuestas", "apostando", "bet", "betting" or ANY conjugation. STRICTLY FORBIDDEN.
- ALL fields are REQUIRED. Never return empty strings for headline, accentWord, or subheadline.
- ${lang === "en" ? `English copy only (except the "antiq" brand name).` : `Spanish copy only (except the "antiq" brand name).`}
- Minimal, premium, Apple-style. No emojis, no hashtags, no exclamation marks.

Return ONLY valid JSON: { "headline": "...", "accentWord": "...", "subheadline": "...", "bgSearchQuery": "..." }`,
          },
          {
            role: "user",
            content: "Generate one Instagram Story ad for antiq. All fields are required.",
          },
        ],
      });

      const raw = contentResponse.choices[0]?.message?.content ?? "";
      const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.headline) parsed.headline = parsed.headline.replace(/\*/g, "").trim();
      if (parsed.subheadline) parsed.subheadline = parsed.subheadline.replace(/\*/g, "").trim();
      if (parsed.accentWord) parsed.accentWord = parsed.accentWord.replace(/\*/g, "").trim();

      if (!parsed.headline || typeof parsed.headline !== "string" || parsed.headline.trim().length < 3) {
        log.warn({ attempt, parsed }, "Invalid headline from AI, retrying");
        continue;
      }
      if (!parsed.subheadline || typeof parsed.subheadline !== "string" || parsed.subheadline.trim().length < 5) {
        parsed.subheadline = pickRandom(SUBHEADLINE_POOL);
      }
      if (!parsed.accentWord || typeof parsed.accentWord !== "string") {
        const words = parsed.headline.split(" ");
        parsed.accentWord = words[words.length - 1];
      }
      if (!parsed.bgSearchQuery || parsed.bgSearchQuery.trim().length < 3) {
        parsed.bgSearchQuery = pickRandom(isEmotion ? EMOTION_BG_QUERIES : BG_QUERIES);
      }

      const forbidden = /apuest|apostar|apostando|\bbett?ing\b|\bbets?\b/i;
      if (forbidden.test(parsed.headline) || forbidden.test(parsed.subheadline)) {
        log.warn({ attempt, parsed }, "Forbidden word detected, retrying");
        continue;
      }

      return parsed;
    } catch (err) {
      log.warn({ attempt, err }, "AI generation attempt failed");
    }
  }

  const fallbackHeadline = pickRandom(headlinePool(lang));
  const words = fallbackHeadline.split(" ");
  return {
    headline: fallbackHeadline,
    accentWord: words[words.length - 1],
    subheadline: pickRandom(subheadlinePool(lang)),
    bgSearchQuery: pickRandom(isEmotion ? EMOTION_BG_QUERIES : BG_QUERIES),
  };
}

router.post("/adgen/generate", async (req, res) => {
  try {
    const body = req.body as any;
    const lang = parseLang(body?.lang);
    const requestedStyle = body?.style?.trim() || null;
    const addBg = body?.addBackgroundImage ?? null;
    let style: string;
    if (requestedStyle && ["mockup-dark", "mockup-light", "center", "emotion"].includes(requestedStyle)) {
      style = requestedStyle;
    } else {
      const r = Math.random();
      style = r < 0.5 ? "center" : r < 0.8 ? "mockup-dark" : "mockup-light";
    }
    const format = body?.format === "post" ? "post" : "story";
    const isEmotion = style === "emotion";
    const wantsBgImage = isEmotion ? true : addBg === true;
    const customHeadline = body?.customHeadline?.trim() || null;
    const noSubheadline = body?.noSubheadline === true;
    const customSubheadline = body?.customSubheadline?.trim() || null;
    const rawBgColor = body?.bgColor?.trim() || null;
    const bgColor = rawBgColor && /^#[0-9a-fA-F]{6}$/.test(rawBgColor) ? rawBgColor : null;

    let parsed: { headline: string; accentWord: string; subheadline: string; bgSearchQuery: string };

    if (customHeadline) {
      const words = customHeadline.split(" ");
      parsed = {
        headline: customHeadline,
        accentWord: words[words.length - 1],
        subheadline: noSubheadline ? "" : (customSubheadline || pickRandom(subheadlinePool(lang))),
        bgSearchQuery: wantsBgImage ? pickRandom(isEmotion ? EMOTION_BG_QUERIES : BG_QUERIES) : "",
      };
    } else {
      parsed = await generateAdContent(style, req.log, lang);
    }

    let backgroundImageUrl: string | null = null;
    let imageData: string | null = null;

    if (wantsBgImage && isEmotion) {
      imageData = await generateEmotionImage(parsed.headline, req.log, format);
      backgroundImageUrl = null;
    }

    if (wantsBgImage && !imageData) {
      const bgPool = isEmotion ? EMOTION_BG_QUERIES : BG_QUERIES;
      const queries = [
        parsed.bgSearchQuery || pickRandom(bgPool),
        pickRandom(bgPool),
        pickRandom(bgPool),
      ];

      for (const query of queries) {
        req.log.info({ bgSearchQuery: query }, "Fetching ad background image");
        backgroundImageUrl = await fetchAdBackground(query);
        if (!backgroundImageUrl) continue;

        try {
          const imgRes = await fetch(backgroundImageUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
              "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Referer": new URL(backgroundImageUrl).origin + "/",
            },
            signal: AbortSignal.timeout(12000),
            redirect: "follow",
          });

          if (imgRes.ok) {
            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            const buffer = Buffer.from(await imgRes.arrayBuffer());
            if (buffer.length > 5000) {
              imageData = `data:${contentType};base64,${buffer.toString("base64")}`;
              req.log.info({ backgroundImageUrl, size: buffer.length }, "Background image downloaded and encoded");
              break;
            }
          }
          req.log.warn({ backgroundImageUrl, status: imgRes.status }, "Image download failed, trying next");
          backgroundImageUrl = null;
        } catch (dlErr) {
          req.log.warn({ backgroundImageUrl, err: dlErr }, "Image download error, trying next");
          backgroundImageUrl = null;
        }
      }

      if (!imageData) {
        req.log.warn("All bg image attempts failed");
        backgroundImageUrl = null;
      }
    }

    const [inserted] = await db
      .insert(adGenTable)
      .values({
        headline: parsed.headline,
        subheadline: parsed.subheadline,
        accentWord: parsed.accentWord,
        style,
        format,
        backgroundImageUrl,
        imageData,
        bgColor,
        posted: false,
      })
      .returning();

    await addUsageTokens("adgen", 1);

    req.log.info({ id: inserted.id, style, headline: parsed.headline, hasBgImage: !!imageData, bgColor }, "Ad generated");

    res.json({
      ad: {
        id: inserted.id,
        headline: inserted.headline,
        subheadline: inserted.subheadline,
        accentWord: inserted.accentWord,
        style: inserted.style,
        format: inserted.format,
        backgroundImageUrl: inserted.backgroundImageUrl,
        imageData: inserted.imageData,
        bgColor: inserted.bgColor,
        posted: inserted.posted,
        createdAt: inserted.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error generating ad");
    res.status(500).json({ error: "Error al generar anuncio" });
  }
});

router.get("/adgen/ads", async (req, res) => {
  try {
    const ads = await db
      .select()
      .from(adGenTable)
      .where(eq(adGenTable.posted, false))
      .orderBy(desc(adGenTable.createdAt))
      .limit(50);

    res.json({
      ads: ads.map((a) => ({
        id: a.id,
        headline: a.headline,
        subheadline: a.subheadline,
        accentWord: a.accentWord,
        style: a.style,
        format: a.format,
        backgroundImageUrl: a.backgroundImageUrl,
        imageData: a.imageData,
        bgColor: a.bgColor,
        posted: a.posted,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching ads");
    res.status(500).json({ error: "Failed to fetch ads" });
  }
});

router.post("/adgen/ads/:id/delete", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db.delete(adGenTable).where(eq(adGenTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting ad");
    res.status(500).json({ error: "Failed to delete ad" });
  }
});

router.patch("/adgen/ads/:id/posted", async (req, res) => {
  try {
    const id = parseInt(req.params["id"] ?? "0");
    await db.update(adGenTable).set({ posted: true }).where(eq(adGenTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error marking ad as posted");
    res.status(500).json({ error: "Failed to update ad" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      twitterTotal,
      twitterToday,
      instagramTotal,
      instagramToday,
      lastTwitter,
      lastInstagram,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(twitterPostsTable),
      db
        .select({ count: sql<number>`count(*)` })
        .from(twitterPostsTable)
        .where(gte(twitterPostsTable.createdAt, todayStart)),
      db.select({ count: sql<number>`count(*)` }).from(instagramCarouselsTable),
      db
        .select({ count: sql<number>`count(*)` })
        .from(instagramCarouselsTable)
        .where(gte(instagramCarouselsTable.createdAt, todayStart)),
      db
        .select({ createdAt: twitterPostsTable.createdAt })
        .from(twitterPostsTable)
        .orderBy(desc(twitterPostsTable.createdAt))
        .limit(1),
      db
        .select({ createdAt: instagramCarouselsTable.createdAt })
        .from(instagramCarouselsTable)
        .orderBy(desc(instagramCarouselsTable.createdAt))
        .limit(1),
    ]);

    const lastAt =
      lastInstagram[0]?.createdAt ?? lastTwitter[0]?.createdAt ?? null;

    res.json({
      twitterPostsToday: Number(twitterToday[0]?.count ?? 0),
      twitterPostsTotal: Number(twitterTotal[0]?.count ?? 0),
      instagramCarouselsToday: Number(instagramToday[0]?.count ?? 0),
      instagramCarouselsTotal: Number(instagramTotal[0]?.count ?? 0),
      lastGeneratedAt: lastAt,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.get("/usage", async (_req, res) => {
  try {
    const rows = await db.select().from(usageTokensTable).limit(1);
    const usage = rows[0] ?? { totalTokens: 0, instagramTokens: 0, adgenTokens: 0, twitterTokens: 0, contentgenTokens: 0 };

    const dailyRows = await db
      .select()
      .from(usageDailyTable)
      .orderBy(usageDailyTable.date)
      .limit(30);

    res.json({
      totalTokens: usage.totalTokens,
      instagramTokens: usage.instagramTokens,
      adgenTokens: usage.adgenTokens,
      twitterTokens: usage.twitterTokens,
      contentgenTokens: usage.contentgenTokens,
      daily: dailyRows.map((r) => ({
        date: r.date,
        instagram: r.instagramTokens,
        adgen: r.adgenTokens,
        twitter: r.twitterTokens,
        contentgen: r.contentgenTokens,
        total: r.instagramTokens + r.adgenTokens + r.twitterTokens + r.contentgenTokens,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch usage" });
  }
});

router.get("/engine/news", async (req, res) => {
  try {
    const searchQueries = [
      "music industry breaking news today",
      "musica noticias urgentes hoy",
      "music technology AI news today",
      "music streaming industry breaking news",
      "artists concerts tours breaking news",
      "record labels music business news today",
      "AI music production tools news",
      "music startup funding news today",
      "Latin music industry news today",
      "music charts albums releases today",
      "music copyright AI law news",
      "musica latina artistas noticias hoy",
      "music festivals news today",
      "audio technology news today",
    ];

    req.log.info("Fetching engine news from Brave");
    const allResults = await Promise.all(
      searchQueries.map((q) => fetchBraveNews(q, 8))
    );

    const SPAM_SOURCES = [
      "blog", "medium.com", "substack", "wordpress", "buzzfeed", "boredpanda",
      "dailymail", "thesun.co.uk", "nypost.com", "pagesix", "tmz", "eonline",
      "people.com", "usmagazine", "hollywoodreporter", "variety.com", "deadline",
      "screenrant", "cbr.com", "gamerant", "kotaku", "polygon", "ign.com",
      "pcgamer", "techradar", "tomsguide", "cnet.com", "zdnet", "lifehacker",
      "howtogeek", "makeuseof", "mashable", "gizmodo", "theverge",
      "yahoo.com/lifestyle", "yahoo.com/entertainment", "msn.com",
      "foxnews.com/entertainment", "foxnews.com/lifestyle",
      "pinterest", "instagram", "tiktok", "reddit",
      "investopedia", "fool.com", "benzinga", "seekingalpha",
      "healthline", "webmd", "medicalnewstoday", "verywellhealth",
      "allrecipes", "foodnetwork", "eater.com",
      "weather.com", "accuweather",
    ];

    const SPAM_TITLE_PATTERNS = [
      /^(\d+)\s+(best|top|ways|things|reasons|tips|tricks|hacks)/i,
      /how\s+to\s+/i,
      /you\s+(need|should|must|won't believe)/i,
      /here('s|\s+is)\s+(what|why|how|everything)/i,
      /\breview\b.*\b(rating|stars|score)\b/i,
      /\b(deal|discount|sale|coupon|promo|off)\b/i,
      /\b(recipe|workout|diet|weight loss|skincare)\b/i,
      /\b(horoscope|zodiac|astrology)\b/i,
      /\b(quiz|poll|survey|vote)\b/i,
      /\b(ranking|ranked|best of|worst of)\b/i,
      /\b(rumors?|reportedly|allegedly|sources say)\b/i,
      /\b(celebrity|celeb|kardashian|jenner|swift|bieber)\b/i,
      /\b(trailer|premiere|season \d|episode \d|streaming)\b/i,
      /\b(crypto|bitcoin|ethereum|nft|meme coin|dogecoin)\b/i,
    ];

    const seen = new Set<string>();
    const rawArticles: Array<{ title: string; description: string; source: string; url: string }> = [];
    for (const batch of allResults) {
      for (const article of batch) {
        const key = article.title.toLowerCase().trim();
        if (seen.has(key)) continue;

        const sourceLower = article.source.toLowerCase();
        if (SPAM_SOURCES.some(s => sourceLower.includes(s))) continue;

        if (SPAM_TITLE_PATTERNS.some(p => p.test(article.title))) continue;

        if (article.title.length < 15 || article.description.length < 20) continue;

        seen.add(key);
        rawArticles.push(article);
      }
    }

    if (rawArticles.length === 0) {
      res.json({ articles: [] });
      return;
    }

    const articlesText = rawArticles
      .map((a, i) => `${i + 1}. [${a.source}] ${a.title} — ${a.description}`)
      .join("\n");

    const filterResponse = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are the chief editor of a leading music-industry publication (like Billboard, Music Business Worldwide, or Pitchfork's news desk). You are selecting the TOP music-world stories of the day. Your standard is EXTREMELY HIGH — only stories that genuinely matter to artists, producers, and the music business.

RUTHLESSLY REMOVE — if in doubt, REMOVE:
- ANY promotional, sponsored, or advertorial content
- Opinion pieces, editorials, columns, reviews, commentary
- Celebrity gossip unrelated to music (relationships, scandals, fashion)
- Lifestyle, travel, food, wellness, self-help
- Listicles, rankings, "best of" lists, roundups
- How-to articles, guides, tutorials, tips, advice
- Fan speculation, rumor mills, unconfirmed reports
- Local gig listings or minor venue announcements
- Duplicate stories about the same event — keep ONLY the single best source
- Anything with clickbait phrasing ("you won't believe", "here's why", "shocking")
- Anything unrelated to music, audio technology, or the creator economy

ONLY KEEP stories that meet ALL of these criteria:
1. RELEVANT — clearly about the music industry, music technology, artists' careers, or AI in creative tools
2. BREAKING or DEVELOPING — happening right now or just happened
3. CONSEQUENTIAL — will have lasting impact on artists, the industry, or how music is made
4. FACTUAL — from credible sources, not speculation

Examples of stories to KEEP:
- Major label deals, acquisitions, mergers, or artist signings
- Streaming platform policy, royalty, or payout changes
- AI-in-music breakthroughs, tools, lawsuits, or regulation
- Landmark copyright rulings or industry litigation
- Major artist releases, record-breaking charts or tours
- Music tech product launches with real industry impact
- Festival/live-industry shifts (cancellations, records, new models)
- Creator-economy platform changes affecting musicians

SCORING (be strict — most articles should NOT pass):
- 10: Industry-defining event (landmark AI copyright ruling, major label merger)
- 9: Major industry shift (streaming royalty overhaul, historic chart record)
- 8: Important development (major artist deal, significant music tech launch)
- 7: Significant event (notable tour/festival news, meaningful platform change)
- 6: Notable but less urgent (industry data, mid-size deals, product updates)
- 5 or below: DO NOT INCLUDE — not important enough

Return a JSON array of objects with: { "index", "importance" }
where "index" is the 1-based number from the input list.
Sort by importance descending. Maximum 20 articles. MINIMUM importance: 6.
Return ONLY valid JSON, no markdown fences. If nothing qualifies, return [].`,
        },
        {
          role: "user",
          content: `You have ${rawArticles.length} headlines. Apply your strictest editorial judgment. Only return stories that genuinely matter to the music world. Return index numbers and importance scores:\n\n${articlesText}`,
        },
      ],
    });

    const rawContent = filterResponse.choices[0]?.message?.content ?? "[]";
    let filterResults: Array<{ index: number; importance: number }> = [];
    try {
      const cleaned = rawContent.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      filterResults = JSON.parse(cleaned);
    } catch {
      req.log.error({ rawContent: rawContent.slice(0, 300) }, "Failed to parse AI filter response");
      filterResults = [];
    }

    const filtered = filterResults
      .filter((r) => r.importance >= 6 && r.index >= 1 && r.index <= rawArticles.length)
      .map((r) => ({
        ...rawArticles[r.index - 1],
        importance: r.importance,
      }))
      .slice(0, 20);

    res.json({
      articles: filtered,
      totalFetched: rawArticles.length,
      totalFiltered: filtered.length,
    });
  } catch (err) {
    req.log.error({ err }, "Engine news fetch failed");
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// ---------- Content Gen (brand-aware image chatbot) ----------

type CgAttachment = { name: string; mimeType: string; dataUrl: string };

function isUnsafeFetchHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  // IPv4 private / loopback / link-local ranges
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isUnsafeFetchHost(parsed.hostname)) return null;
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": new URL(url).origin + "/",
      },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const m = /^data:[^;]+;base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

async function extractDocumentText(att: CgAttachment): Promise<string> {
  const buf = dataUrlToBuffer(att.dataUrl);
  if (!buf) return "";
  const lower = att.name.toLowerCase();
  const mime = att.mimeType || "";
  try {
    if (mime.startsWith("text/") || /\.(txt|md|csv|json|html?|xml|tsv)$/.test(lower)) {
      return buf.toString("utf8").slice(0, 8000);
    }
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      try {
        const result = await parser.getText();
        return (result.text ?? "").replace(/\s+/g, " ").trim().slice(0, 8000);
      } finally {
        await parser.destroy().catch(() => {});
      }
    }
  } catch {
    return "";
  }
  return "";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Robust AI image generation with a multi-stage fallback pipeline so we almost
// always come back with a usable image:
//   1. Requested size, high quality (with retries + backoff for transient errors)
//   2. Requested size, default quality
//   3. Square 1024x1024, default quality
// Each individual API call has its own timeout so a single hung request can't
// eat the whole route budget.
async function generateAiImage(prompt: string, aspect: string, deadline?: number): Promise<Buffer | null> {
  const sizeMap: Record<string, "1024x1024" | "1024x1536" | "1536x1024"> = {
    square: "1024x1024",
    portrait: "1024x1536",
    landscape: "1536x1024",
  };
  const size = sizeMap[aspect] ?? "1024x1024";

  const basePrompt = (prompt ?? "").trim() || "A clean, minimal, cinematic editorial photograph.";
  // Append a concise, brand-consistent quality directive so every generated
  // image reads as high-end editorial work (cinematic light, fine detail,
  // refined grade) rather than a generic stock render. Kept short to avoid
  // overpowering the caller's specific creative intent.
  const QUALITY_DIRECTIVE =
    "High-end editorial photography. Cinematic, directional natural light with soft falloff and deep, rich shadows. Refined, slightly desaturated color grade with filmic contrast. Shallow depth of field, crisp focus on the subject, elegant minimal composition with generous negative space. Photorealistic, ultra-detailed textures, no text, no watermarks, no logos.";
  const cleanPrompt = `${basePrompt}\n\n${QUALITY_DIRECTIVE}`;

  type Stage = {
    size: "1024x1024" | "1024x1536" | "1536x1024";
    quality?: "high" | "medium" | "low";
  };
  // Build the stage list, de-duping the square fallback when the requested
  // size is already square.
  const stages: Stage[] = [
    { size, quality: "high" },
    { size },
    ...(size !== "1024x1024" ? [{ size: "1024x1024" as const }] : []),
  ];

  for (const stage of stages) {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Respect the overall route budget: stop trying when we're (nearly) out
      // of time so we leave room for the real-photo / placeholder fallback.
      const remaining = deadline ? deadline - Date.now() : Infinity;
      if (remaining < 8000) {
        logger.warn({ remaining }, "generateAiImage out of time budget, aborting attempts");
        return null;
      }
      const callTimeout = Math.max(8000, Math.min(150000, remaining - 4000));
      try {
        const body: Record<string, unknown> = { model: "gpt-image-1", prompt: cleanPrompt, size: stage.size };
        if (stage.quality) body["quality"] = stage.quality;
        const resp = await openai.images.generate(body as never, {
          timeout: callTimeout,
          maxRetries: 0,
        });
        const b64 = resp.data?.[0]?.b64_json ?? "";
        if (b64) return Buffer.from(b64, "base64");
      } catch (e) {
        logger.warn({ err: e, stage, attempt }, "generateAiImage attempt failed");
        // brief exponential backoff before retrying transient failures
        await sleep(600 * 2 ** attempt);
      }
    }
  }
  return null;
}

// Build a full Instagram carousel for the content-gen chat, REUSING the same
// pipeline as POST /instagram/generate (AI content planning + real news photos
// via fetchCarouselImages) and persisting it to instagramCarouselsTable so it
// shows up ready-to-finalize in the Instagram section. Returns the slide photo
// buffers so the chat can deliver them inline.
async function generateCarouselForChat(
  topic: string,
  lang: Lang,
  log: any,
  deadline?: number,
): Promise<{ id: number; headline: string; slides: Buffer[] }> {
  const today = new Date().toISOString().split("T")[0];
  const monthYear = new Date().toLocaleString("en", { month: "long", year: "numeric" });
  // Cap the GPT planning call and reserve ~55s of the remaining budget for the
  // image fetches + finalization that follow, so the carousel can't consume the
  // whole budget on planning alone.
  const planTimeout = deadline ? Math.max(8000, Math.min(45000, deadline - Date.now() - 55000)) : undefined;

  const contentResponse = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `You are the content lead at antiq (antiq.xyz), a music technology company. You write ${langName(lang)}-language Instagram carousel content. Today is ${today}.

${ANTIQ_BRIEF}

Create Instagram carousel content for the topic the user requests. If the topic is about antiq itself or its products, write INFORMATIVE PRODUCT content strictly within the brief (what it is, how it works, what it changes for the artist) and use aesthetic music-production image queries (studio, gear, artists at work) WITHOUT press agencies. If the topic is external (music news, industry), keep an editorial angle and press-photo queries. Produce these fields:
1. "headline": SHORT, BOLD, ALL-CAPS headline (max 8 words) in ${langName(lang)}.
2. "paragraph1" / "paragraph2" / "paragraph3": three content slides, 35-45 words each, tight journalistic ${langName(lang)}.
3. "coverSearchQuery" / "slide1SearchQuery" / "slide2SearchQuery" / "slide3SearchQuery": English image search queries (3-6 words). Each MUST target a DIFFERENT visual subject. FOR PRODUCT/antiq TOPICS: aesthetic music-production photography (studio, gear close-ups, artists at work, stage) — NO press agencies, NO dates. FOR NEWS TOPICS: include specific names/places, end with a press agency (Reuters, AP, AFP or Getty) and the period ${monthYear}.
4. "memeSearchQuery": query to find an ACTUAL internet meme about the topic — include the word "meme" plus ${lang === "en" ? `"funny"` : `"chistoso"`}.
5. "caption": Instagram caption in ${langName(lang)} (80-120 words) in paragraphs separated by "\\n\\n". The final paragraph must be EXACTLY: "${captionSuffix(lang)}". No emojis, no hashtags. NEVER use "apuesta/apostar/betting".

Return ONLY a valid JSON object with those keys. No markdown fences, no extra text.`,
      },
      { role: "user", content: `Topic / request: ${topic}` },
    ],
  }, planTimeout ? { timeout: planTimeout, maxRetries: 0 } : undefined);

  const raw = contentResponse.choices[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("carousel content parse failed");
  const item = JSON.parse(cleaned.substring(start, end + 1)) as {
    headline: string;
    paragraph1: string;
    paragraph2: string;
    paragraph3: string;
    caption?: string;
    coverSearchQuery: string;
    slide1SearchQuery: string;
    slide2SearchQuery: string;
    slide3SearchQuery: string;
    memeSearchQuery?: string;
  };

  await addUsageTokens("instagram", 1);

  const result = await fetchCarouselImages(item, deadline);

  const [inserted] = await db
    .insert(instagramCarouselsTable)
    .values({
      headline: item.headline,
      contentParagraph1: item.paragraph1,
      contentParagraph2: item.paragraph2,
      contentParagraph3: item.paragraph3,
      caption: item.caption ?? null,
      coverImageData: result.photos[0] ?? "",
      slide1ImageData: result.photos[1] ?? "",
      slide2ImageData: result.photos[2] ?? "",
      slide3ImageData: result.photos[3] ?? "",
      memeImageData: result.meme || null,
    })
    .returning();

  const slides: Buffer[] = [];
  for (const b64 of result.photos) {
    if (!b64) continue;
    try {
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 0) slides.push(buf);
    } catch { /* skip */ }
  }

  log.info({ id: inserted.id, headline: item.headline, slides: slides.length }, "content-gen carousel generated");
  return { id: inserted.id, headline: item.headline, slides };
}

// Build a fully-FORMATTED 5-slide carousel for the content-gen chat: same
// information-division logic and visual format as the Instagram carousels
// (cover slide with photo + headline, then content slides with black bg,
// wrapped text and an embedded news photo) but WITHOUT the meme slide. Unlike
// generateCarouselForChat (which delivers raw photos), this renders the slides
// server-side via renderCarouselSlides so the chat returns ready-to-post images.
async function generateFormattedCarouselForChat(
  topic: string,
  lang: Lang,
  log: any,
  deadline?: number,
): Promise<{ headline: string; caption: string; slides: Buffer[] }> {
  const today = new Date().toISOString().split("T")[0];
  const monthYear = new Date().toLocaleString("en", { month: "long", year: "numeric" });
  const planTimeout = deadline ? Math.max(8000, Math.min(45000, deadline - Date.now() - 55000)) : undefined;

  const contentResponse = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `You are the content lead at antiq (antiq.xyz), a music technology company. You write ${langName(lang)}-language Instagram carousel content. Today is ${today}.

${ANTIQ_BRIEF}

Create a 5-slide Instagram carousel (1 cover + 4 content slides) for the topic the user requests. If the topic is about antiq itself or its products, write INFORMATIVE PRODUCT content strictly within the brief (context → how it works → what it changes → invitation), and use aesthetic music-production image queries (studio, gear, artists at work) WITHOUT press agencies. If the topic is external (music news, industry), keep an editorial angle and press-photo queries. Produce these fields:
1. "headline": SHORT, BOLD, ALL-CAPS headline (max 8 words) in ${langName(lang)}.
2. "paragraph1" / "paragraph2" / "paragraph3" / "paragraph4": four content slides, 35-45 words each, tight journalistic ${langName(lang)}. Together they must divide the story logically: context → key facts → analysis → outlook.
3. "coverSearchQuery" / "slide1SearchQuery" / "slide2SearchQuery" / "slide3SearchQuery" / "slide4SearchQuery": English image search queries (3-6 words). Each MUST target a DIFFERENT visual subject. FOR PRODUCT/antiq TOPICS: aesthetic music-production photography (studio, gear close-ups, artists at work, stage) — NO press agencies, NO dates. FOR NEWS TOPICS: include specific names/places, end with a press agency (Reuters, AP, AFP or Getty) and the period ${monthYear}.
4. "caption": Instagram caption in ${langName(lang)} (80-120 words) in paragraphs separated by "\\n\\n". The final paragraph must be EXACTLY: "${captionSuffix(lang)}". No emojis, no hashtags. NEVER use "apuesta/apostar/betting".

Return ONLY a valid JSON object with those keys. No markdown fences, no extra text.`,
      },
      { role: "user", content: `Topic / request: ${topic}` },
    ],
  }, planTimeout ? { timeout: planTimeout, maxRetries: 0 } : undefined);

  const raw = contentResponse.choices[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("formatted carousel content parse failed");
  const item = JSON.parse(cleaned.substring(start, end + 1)) as {
    headline: string;
    paragraph1: string;
    paragraph2: string;
    paragraph3: string;
    paragraph4: string;
    caption?: string;
    coverSearchQuery: string;
    slide1SearchQuery: string;
    slide2SearchQuery: string;
    slide3SearchQuery: string;
    slide4SearchQuery: string;
  };

  await addUsageTokens("instagram", 1);

  // Guarantee EXACTLY 4 non-empty content paragraphs so the carousel is always
  // cover + 4 content = 5 slides. If the model omits or empties any field, fall
  // back to neighbouring text (or the headline) so we never render a short deck.
  const rawParagraphs = [item.paragraph1, item.paragraph2, item.paragraph3, item.paragraph4].map((p) =>
    typeof p === "string" ? p.trim() : "",
  );
  const nonEmpty = rawParagraphs.filter((p) => p.length > 0);
  const paragraphs = rawParagraphs.map(
    (p, i) => p || nonEmpty[i % nonEmpty.length] || item.headline || topic,
  );

  // Fetch the 5 news photos (cover + 4 slides) CONCURRENTLY, bailing out if the
  // request budget is nearly spent so we still flush a response in time.
  const lowBudget = typeof deadline === "number" && deadline - Date.now() < 18000;
  const usedUrls = new Set<string>();
  const newsStyle = /\b(reuters|getty|afp|ap)\b/i.test(
    [item.coverSearchQuery, item.slide1SearchQuery, item.slide2SearchQuery, item.slide3SearchQuery, item.slide4SearchQuery].join(" "),
  );
  const queries = newsStyle
    ? [
        { search: item.coverSearchQuery, fallback: `${item.headline} news photo Reuters` },
        { search: item.slide1SearchQuery, fallback: `${item.headline} Reuters AP photo` },
        { search: item.slide2SearchQuery, fallback: `${item.headline} press conference Reuters` },
        { search: item.slide3SearchQuery, fallback: `${item.headline} AFP Getty photo` },
        { search: item.slide4SearchQuery, fallback: `${item.headline} Getty news photo` },
      ]
    : [
        { search: item.coverSearchQuery, fallback: "music production studio dark cinematic" },
        { search: item.slide1SearchQuery, fallback: "music producer working studio moody" },
        { search: item.slide2SearchQuery, fallback: "synthesizer close up studio dark" },
        { search: item.slide3SearchQuery, fallback: "artist performing stage lights dark" },
        { search: item.slide4SearchQuery, fallback: "headphones studio desk dark aesthetic" },
      ];

  const photoB64 = await Promise.all(
    queries.map(async ({ search, fallback }) => {
      if (lowBudget) return "";
      try {
        const { base64, url } = await fetchNewsPhotoBase64(search, fallback, usedUrls, newsStyle);
        if (url) usedUrls.add(url);
        return base64;
      } catch (err) {
        log.error({ err, search }, "formatted carousel photo fetch failed");
        return "";
      }
    }),
  );

  const photos = photoB64.map((b64) => {
    if (!b64) return null;
    try {
      const buf = Buffer.from(b64, "base64");
      return buf.length > 0 ? buf : null;
    } catch {
      return null;
    }
  });

  const slides = await renderCarouselSlides({ headline: item.headline, paragraphs, photos });

  log.info({ headline: item.headline, slides: slides.length }, "content-gen formatted carousel generated");
  return { headline: item.headline, caption: item.caption ?? "", slides };
}

// Build an antiq ad creative for the content-gen chat, REUSING the same
// pipeline as POST /adgen/generate (generateAdContent + generateEmotionImage /
// fetchAdBackground) and persisting it to adGenTable so it shows up
// ready-to-finalize in the Ad Gen section. Returns the background/emotion image
// buffer (if any) so the chat can deliver it inline.
async function generateAdForChat(
  opts: { style?: string; lang: Lang; customHeadline?: string; withBackground?: boolean; format?: "story" | "post"; deadline?: number },
  log: any,
): Promise<{ id: number; headline: string; style: string; image: Buffer | null }> {
  const lang = opts.lang;
  const requested =
    opts.style && ["mockup-dark", "mockup-light", "center", "emotion"].includes(opts.style) ? opts.style : null;
  const r = Math.random();
  const style = requested ?? (r < 0.5 ? "center" : r < 0.8 ? "mockup-dark" : "mockup-light");
  const isEmotion = style === "emotion";
  const format = opts.format === "post" ? "post" : "story";
  const wantsBgImage = isEmotion ? true : opts.withBackground === true;
  const customHeadline = opts.customHeadline?.trim() || null;

  let parsed: { headline: string; accentWord: string; subheadline: string; bgSearchQuery: string };
  if (customHeadline) {
    const words = customHeadline.split(" ");
    parsed = {
      headline: customHeadline,
      accentWord: words[words.length - 1],
      subheadline: pickRandom(subheadlinePool(lang)),
      bgSearchQuery: wantsBgImage ? pickRandom(isEmotion ? EMOTION_BG_QUERIES : BG_QUERIES) : "",
    };
  } else {
    parsed = await generateAdContent(style, log, lang);
  }

  let backgroundImageUrl: string | null = null;
  let imageData: string | null = null;

  if (wantsBgImage && isEmotion) {
    const emotionBudget = opts.deadline ? Math.max(8000, opts.deadline - Date.now() - 5000) : undefined;
    imageData = await generateEmotionImage(parsed.headline, log, format, emotionBudget);
  }

  if (wantsBgImage && !imageData) {
    const bgPool = isEmotion ? EMOTION_BG_QUERIES : BG_QUERIES;
    const queries = [parsed.bgSearchQuery || pickRandom(bgPool), pickRandom(bgPool)];
    for (const query of queries) {
      const url = await fetchAdBackground(query);
      if (!url) continue;
      // Reuse the project's safe image fetch (protocol + private-host validation),
      // then normalize to a JPEG data URL for storage/rendering.
      const buffer = await fetchImageBuffer(url);
      if (buffer && buffer.length > 5000) {
        backgroundImageUrl = url;
        imageData = await toJpegDataUrl(buffer);
        break;
      }
    }
  }

  const [inserted] = await db
    .insert(adGenTable)
    .values({
      headline: parsed.headline,
      subheadline: parsed.subheadline,
      accentWord: parsed.accentWord,
      style,
      format,
      backgroundImageUrl,
      imageData,
      bgColor: null,
      posted: false,
    })
    .returning();

  await addUsageTokens("adgen", 1);

  const buf = imageData ? dataUrlToBuffer(imageData) : null;
  log.info({ id: inserted.id, style, headline: parsed.headline, hasImage: !!buf }, "content-gen ad generated");
  return { id: inserted.id, headline: parsed.headline, style, image: buf };
}

const CONTENT_GEN_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description:
        "Generate a brand-new image with AI (gpt-image-1). Use for AI-generated scenes, ad creatives, illustrations or any visual. For ad creatives, include the exact headline/marketing text to render INSIDE the prompt. Never ask the AI to draw the antiq logo — that is composited separately with add_logo. Do not request watermarks.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Detailed, vivid image-generation prompt in English describing subject, setting, lighting, style, color palette and mood.",
          },
          aspect: {
            type: "string",
            enum: ["square", "portrait", "landscape"],
            description: "square = 1:1 feed post, portrait = 4:5 / story, landscape = wide.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_reference_image",
      description:
        "Find a REAL photograph on the web (news agencies / free stock) by an English search query. Use when the user wants a real photo of a news topic, person, place or event.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "English image search query." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_logo",
      description:
        "Composite the EXACT official antiq logo onto a previously produced image as a real PNG element. Apply this to every final image before delivering, unless the user explicitly says not to.",
      parameters: {
        type: "object",
        properties: {
          image_ref: { type: "string", description: "Reference id of the image to brand (e.g. img1, ref1, adjunto1, previo1)." },
          variant: { type: "string", enum: ["wordmark", "icon"], description: "wordmark = full antiq logotype (default), icon = compact circular mark." },
          position: {
            type: "string",
            enum: ["top-left", "top-right", "top-center", "bottom-left", "bottom-right", "bottom-center", "center"],
            description: "Placement of the logo. Default bottom-left.",
          },
          color: { type: "string", description: "auto (default, picks white/black for legibility), white, black, or a #RRGGBB hex." },
          size_pct: { type: "number", description: "Logo width as a percent of image width. Default ~24 for wordmark, ~14 for icon." },
        },
        required: ["image_ref"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_carousel",
      description:
        "Build a COMPLETE Instagram carousel (bold headline + cover + 3 content slides + caption) about a news topic, REUSING the Instagram pipeline (real news photos via web search). The carousel is saved to the Instagram section ready to finalize there, and its slide photos are delivered here as image references. Use this whenever the user asks for a carousel, a multi-slide Instagram post, or a news post for Instagram.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "The news topic or angle for the carousel, in the user's language. Be specific (person, place, event).",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_ad",
      description:
        "Create an antiq Instagram ad creative, REUSING the Ad Gen pipeline (AI headline + accent word + subheadline + an atmospheric or AI-generated emotional background image). The ad is saved to the Ad Gen section ready to finalize there, and the background image is delivered here as an image reference. Use this whenever the user asks for an ad, promo, or marketing creative for antiq.",
      parameters: {
        type: "object",
        properties: {
          style: {
            type: "string",
            enum: ["center", "mockup-dark", "mockup-light", "emotion"],
            description: "center / mockup = product-style ad; emotion = AI-generated cinematic emotional background image. Prefer 'emotion' when the user wants a striking standalone visual.",
          },
          headline: {
            type: "string",
            description: "Optional custom headline (2-5 words) in the user's language. Omit to let the AI write it.",
          },
        },
        required: [],
      },
    },
  },
];

router.post("/content-gen/chat", async (req, res) => {
  try {
    const { conversationId, message, attachments, lang: langRaw, format: formatRaw, marketId: marketIdRaw, watermark: watermarkRaw, carousel: carouselRaw } = req.body as {
      conversationId?: number;
      message?: string;
      attachments?: CgAttachment[];
      lang?: string;
      format?: string;
      marketId?: string | number | null;
      watermark?: boolean;
      carousel?: boolean;
    };
    const watermark = watermarkRaw === true;
    const carouselMode = carouselRaw === true;
    const lang = parseLang(langRaw);
    const userMessage = (message ?? "").trim();
    const atts = Array.isArray(attachments) ? attachments.slice(0, 8) : [];

    // Forced aspect ratio for generated images (overrides the model's choice).
    // gpt-image-1 only natively renders square/portrait/landscape, so we pick the
    // closest native size and then center-crop to the EXACT requested ratio.
    const formatMap: Record<string, { aspect: "square" | "portrait" | "landscape"; ratio: [number, number] }> = {
      "1:1": { aspect: "square", ratio: [1, 1] },
      "9:16": { aspect: "portrait", ratio: [9, 16] },
      "4:5": { aspect: "portrait", ratio: [4, 5] },
      "16:9": { aspect: "landscape", ratio: [16, 9] },
    };
    const forced = formatRaw && formatRaw !== "auto" ? formatMap[formatRaw] : undefined;
    const forcedAspect = forced?.aspect;

    // Optional market context: pull live data from opinionmarket.mx (legacy external source) by number.
    const marketId = marketIdRaw != null && String(marketIdRaw).trim() !== "" ? String(marketIdRaw).trim() : "";
    let marketContext = "";
    if (marketId) {
      if (!/^\d+$/.test(marketId)) {
        res.status(400).json({ error: `Número de mercado inválido: "${marketId}".` });
        return;
      }
      let md: Awaited<ReturnType<typeof fetchMarketData>> = null;
      let networkError = false;
      try {
        const apiRes = await fetch(`https://opinionmarket.mx/api/markets/${marketId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OpinionMarketCCT/1.0)",
            "Accept": "application/json",
          },
          signal: AbortSignal.timeout(15000),
        });
        if (apiRes.ok) {
          const data = (await apiRes.json()) as MarketApiData;
          if (data?.question) md = data;
        }
      } catch {
        networkError = true;
      }
      if (networkError) {
        res.status(500).json({ error: "Error al conectar con opinionmarket.mx. Intenta de nuevo." });
        return;
      }
      if (!md) {
        res.status(400).json({ error: `No se pudo acceder al mercado #${marketId}. Verifica que el número sea correcto.` });
        return;
      }
      const optionsText = md.options
        .map((o) => `"${o.text}": ${(o.currentPrice * 100).toFixed(1)}% (volumen: ${o.totalVolume})`)
        .join(" | ");
      const endDateFormatted = md.endDate
        ? new Date(md.endDate).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
        : "—";
      marketContext = `\n\n[CONTEXTO DEL MERCADO #${md.id} — opinionmarket.mx (fuente externa)]
Pregunta: ${md.question}
Descripción: ${md.description}
Categoría: ${md.category?.name ?? "General"}
Estado: ${md.isResolved ? `Resuelto (${md.resolvedOption})` : "Activo"}
Cierre: ${endDateFormatted}
Volumen total: ${md.volume}
Participantes: ${md.participants}
Precios actuales: ${optionsText}
URL: https://opinionmarket.mx/markets/${md.id}

El contenido visual que crees debe tratar sobre este mercado: usa la pregunta, las probabilidades y el contexto para inspirar el titular y la imagen.`;
    }

    if (!userMessage && atts.length === 0 && !marketContext) {
      res.status(400).json({ error: "Mensaje vacío" });
      return;
    }

    // Resolve / create conversation
    let convId = typeof conversationId === "number" ? conversationId : null;
    if (convId !== null) {
      const existing = await db.select().from(contentGenConversationsTable).where(eq(contentGenConversationsTable.id, convId)).limit(1);
      if (existing.length === 0) convId = null;
    }
    if (convId === null) {
      const title = (userMessage || (marketId ? `Mercado #${marketId}` : "") || atts[0]?.name || "Nueva conversación").replace(/\s+/g, " ").trim().slice(0, 60);
      const [conv] = await db.insert(contentGenConversationsTable).values({ title, lang }).returning();
      convId = conv.id;
    }

    // Carousel mode: short-circuit the agentic loop and deterministically build
    // a fully-formatted 5-slide carousel (cover + 4 content) in the Instagram
    // visual format, WITHOUT the meme. Slides are rendered server-side already
    // branded with the antiq logo, so they bypass the standard image-delivery
    // post-processing (logo/grain/crop).
    if (carouselMode) {
      const CAROUSEL_DEADLINE = Date.now() + 250000;
      const topic = `${userMessage}${marketContext}`.trim() || userMessage;
      let finalText: string;
      let deliveredImages: Array<{ dataUrl: string }> = [];
      try {
        const result = await generateFormattedCarouselForChat(topic, lang, req.log, CAROUSEL_DEADLINE);
        deliveredImages = await Promise.all(result.slides.map(async (buf) => ({ dataUrl: await toJpegDataUrl(buf) })));
        const intro = lang === "en"
          ? `Here's your ${deliveredImages.length}-slide carousel — "${result.headline}". Same format as the Instagram carousels.`
          : `Aquí tienes tu carrusel de ${deliveredImages.length} slides — "${result.headline}". Mismo formato que los carruseles de Instagram.`;
        finalText = result.caption ? `${intro}\n\n${result.caption}` : intro;
      } catch (e) {
        req.log.error({ err: e }, "content-gen carousel mode failed");
        finalText = lang === "en"
          ? "I couldn't build the carousel this time. Please try again."
          : "No pude crear el carrusel esta vez. Intenta de nuevo.";
      }

      const storedUserAtts = atts.map((a) => ({
        name: a.name,
        mimeType: a.mimeType,
        kind: a.mimeType.startsWith("image/") ? "image" : "document",
        dataUrl: a.mimeType.startsWith("image/") ? a.dataUrl : null,
      }));
      await db.insert(contentGenMessagesTable).values({
        conversationId: convId,
        role: "user",
        content: userMessage || (marketId ? `Mercado #${marketId}` : "(carrusel)"),
        attachments: storedUserAtts.length > 0 ? JSON.stringify(storedUserAtts) : null,
        images: null,
      });
      const [assistantRow] = await db
        .insert(contentGenMessagesTable)
        .values({
          conversationId: convId,
          role: "assistant",
          content: finalText,
          attachments: null,
          images: deliveredImages.length > 0 ? JSON.stringify(deliveredImages) : null,
        })
        .returning();
      await db
        .update(contentGenConversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(contentGenConversationsTable.id, convId));
      if (deliveredImages.length > 0) await addUsageTokens("contentgen", deliveredImages.length);

      res.json({
        conversationId: convId,
        message: {
          id: assistantRow.id,
          role: "assistant",
          content: finalText,
          images: deliveredImages,
          createdAt: assistantRow.createdAt,
        },
      });
      return;
    }

    // Load prior messages for context
    const history = await db
      .select()
      .from(contentGenMessagesTable)
      .where(eq(contentGenMessagesTable.conversationId, convId))
      .orderBy(asc(contentGenMessagesTable.createdAt));

    // Produced-image registry for this turn
    type Produced = { ref: string; buffer: Buffer; superseded: boolean; origin: "attachment" | "previous" | "generated"; branded: boolean };
    const produced: Produced[] = [];
    let imgCounter = 0;

    // Seed refs from the most recent assistant message's delivered images (for refinement)
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant" && m.images);
    if (lastAssistant?.images) {
      try {
        const imgs = JSON.parse(lastAssistant.images) as Array<{ dataUrl: string }>;
        imgs.forEach((im, i) => {
          const buf = dataUrlToBuffer(im.dataUrl);
          if (buf) produced.push({ ref: `previo${i + 1}`, buffer: buf, superseded: false, origin: "previous", branded: true });
        });
      } catch { /* ignore */ }
    }

    // Process current attachments: images -> vision + refs; documents -> text
    const visionParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    const storedAttachments: Array<{ name: string; mimeType: string; kind: "image" | "document"; dataUrl?: string }> = [];
    let documentText = "";
    let attImgIndex = 0;
    for (const att of atts) {
      const isImage = (att.mimeType || "").startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(att.name || "");
      if (isImage) {
        attImgIndex += 1;
        const buf = dataUrlToBuffer(att.dataUrl);
        if (buf) produced.push({ ref: `adjunto${attImgIndex}`, buffer: buf, superseded: false, origin: "attachment", branded: false });
        visionParts.push({ type: "image_url", image_url: { url: att.dataUrl } });
        storedAttachments.push({ name: att.name, mimeType: att.mimeType, kind: "image", dataUrl: att.dataUrl });
      } else {
        const text = await extractDocumentText(att);
        if (text) documentText += `\n\n[Documento adjunto: ${att.name}]\n${text}`;
        storedAttachments.push({ name: att.name, mimeType: att.mimeType, kind: "document" });
      }
    }

    const availableRefs = produced.map((p) => p.ref);
    const refsNote = availableRefs.length > 0
      ? `\n\n(Referencias de imagen disponibles para add_logo: ${availableRefs.join(", ")})`
      : "";

    const system = `Eres el asistente de Generación de Contenido visual de antiq (antiq.xyz), una empresa de tecnología musical que construye herramientas de nueva generación para artistas, productores y compositores (antiq DAW gratuito con IA, antiq forge, antiq for artists, antiq stager). Idioma de respuesta: ${langName(lang)}.

Tu trabajo: a partir de la petición del usuario y de los archivos adjuntos, CREAR contenido visual de marca — imágenes generadas con IA, creatividades para anuncios, sets tipo carrusel (varias imágenes), o cualquier imagen que pida.

MARCA antiq:
- antiq es TECNOLOGÍA MUSICAL (DAW, plugins, IA para producir música). NO tiene NADA que ver con antigüedades, muebles ni objetos "antique" — JAMÁS generes imágenes de ese tipo. En los prompts de imagen escribe el contexto completo (ej. "music production studio", "producer at a mixing console"), nunca la palabra "antiq" sola.
- Universo visual: estudios de grabación, sintetizadores, consolas de mezcla, monitores de estudio, audífonos, ondas de sonido, músicos y productores creando, escenarios, interfaces de software musical.
- Estética Apple-minimal: fondos oscuros, alto contraste, tipografía limpia, elegante y editorial.
- El logotipo oficial SIEMPRE se coloca sobre la imagen final como elemento real (PNG exacto), NUNCA lo dibuja la IA. Usa add_logo para componerlo. Jamás pidas a la IA generar "el logo de antiq".

HERRAMIENTAS:
- generate_image: crea una imagen con IA. Escribe prompts RICOS y específicos como un director de arte: sujeto concreto, encuadre/plano (primer plano, plano medio, gran angular), tipo de luz (natural direccional, hora dorada, contraluz, claroscuro), paleta y ambiente (oscuro, editorial, sobrio), textura y materiales, y composición (espacio negativo, regla de tercios). Pide fotografías realistas, cinematográficas y minimalistas salvo indicación contraria. Evita lo genérico tipo "stock". Para anuncios, incluye el texto del titular DENTRO del prompt para que la IA lo renderice. Sin logos ni marcas de agua en el prompt.
- find_reference_image: busca una foto REAL (agencias/stock libre) por un término en inglés. Útil para fotos reales de temas noticiosos.
- generate_carousel: arma un CARRUSEL de Instagram completo (titular + portada + 3 slides + caption), reutilizando el pipeline de Instagram con fotos reales. Sirve tanto para temas informativos del PRODUCTO antiq (qué es, qué hace cada herramienta) como para temas de la industria musical. Úsalo cuando el usuario pida un carrusel o post de varias imágenes para Instagram. El carrusel queda guardado en la sección Instagram listo para finalizar, y aquí se entregan sus fotos.
- generate_ad: crea una creatividad de anuncio de antiq reutilizando el pipeline de Ad Gen (titular + subtítulo + fondo atmosférico o emocional generado con IA). Úsalo cuando el usuario pida un anuncio o promo. El anuncio queda guardado en la sección Ad Gen listo para finalizar, y aquí se entrega su imagen de fondo.
- add_logo: superpone el logotipo EXACTO de antiq sobre una imagen ya producida (por su image_ref). APLÍCALO a cada imagen final antes de entregar, salvo que el usuario diga lo contrario.

FLUJO:
1. Si hay imágenes adjuntas, analízalas (las ves directamente).
2. Elige la herramienta correcta: generate_carousel si piden un carrusel/post de Instagram; generate_ad si piden un anuncio/promo; generate_image o find_reference_image para una sola imagen.
3. Aplica add_logo a cada imagen final (las imágenes de generate_carousel y generate_ad llevan el logo automáticamente, no hace falta repetirlo por cada slide).
4. Responde breve: describe lo que creaste y, para carruseles/anuncios, recuérdale al usuario que ya quedaron guardados en su sección (Instagram / Ad Gen) para finalizarlos.

Para un carrusel usa SIEMPRE generate_carousel (no generes slide por slide con generate_image). Entrega solo las imágenes finales.

REGLA ESTRICTA: nunca uses "apuesta", "apostar", "apuestas", "bet", "betting" ni conjugaciones; usa "predicción" / "pronóstico".`;

    const messages: any[] = [{ role: "system", content: system }];
    for (const m of history) {
      if (m.role === "user") {
        messages.push({ role: "user", content: m.content });
      } else {
        let imgNote = "";
        try {
          const imgs = m.images ? (JSON.parse(m.images) as unknown[]) : [];
          if (imgs.length > 0) imgNote = `\n[se generaron ${imgs.length} imagen(es) en este turno]`;
        } catch { /* ignore */ }
        messages.push({ role: "assistant", content: (m.content ?? "") + imgNote });
      }
    }

    const formatNote = forcedAspect
      ? `\n\n(Formato solicitado: ${formatRaw}. TODAS las imágenes deben generarse en orientación "${forcedAspect}".)`
      : "";
    const currentUserText = `${userMessage || (marketContext ? "Crea contenido visual sobre este mercado." : "")}${marketContext}${formatNote}${documentText}${refsNote}`;
    if (visionParts.length > 0) {
      messages.push({ role: "user", content: [{ type: "text", text: currentUserText }, ...visionParts] });
    } else {
      messages.push({ role: "user", content: currentUserText });
    }

    // Agentic tool loop. We keep the whole pipeline inside a global time
    // budget that sits comfortably under the route's 10-min response timeout,
    // so we always have time to flush a response (and a fallback image) before
    // the connection is aborted.
    let finalText = "";
    // Heavy multi-image generators (carousel = 4 photos, ad = background pass)
    // must run at most ONCE per request. The model occasionally calls them twice
    // in a single turn, doubling latency (~4 min) and payload (8+ images) and
    // pushing the request past the budget. Cap them so the response stays fast.
    let carouselDone = false;
    let adDone = false;
    const MAX_ITERS = 8;
    // Autoscale production aborts any HTTP request at ~300s. Keep the internal
    // budget safely below that so the loop wraps up, finalizes images, and
    // flushes a response BEFORE the proxy kills the connection.
    const DEADLINE = Date.now() + 250000; // 250s budget (< 300s prod request cap)
    for (let iter = 0; iter < MAX_ITERS; iter++) {
      const chatRemaining = DEADLINE - Date.now();
      // Stop if we no longer have a meaningful budget for another model turn;
      // leaving headroom guarantees we can still flush a response.
      if (chatRemaining <= 6000) {
        logger.warn({ iter, chatRemaining }, "content-gen loop hit time budget, stopping");
        if (!finalText) finalText = "Aquí tienes el contenido generado.";
        break;
      }
      const completion = await openai.chat.completions.create(
        {
          model: "gpt-5.2",
          max_completion_tokens: 4096,
          messages,
          tools: CONTENT_GEN_TOOLS as any,
        },
        { timeout: Math.min(120000, chatRemaining - 5000), maxRetries: 1 },
      );
      const choice = completion.choices[0]?.message;
      if (!choice) break;

      const toolCalls = choice.tool_calls ?? [];
      if (toolCalls.length === 0) {
        finalText = choice.content ?? "";
        break;
      }

      messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });

      for (const tc of toolCalls) {
        if (tc.type !== "function") continue;
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch { /* ignore */ }
        let result = "";
        // Guard each tool call against the budget: if we're nearly out of time,
        // don't kick off more network work — report back so the model can wrap
        // up with whatever has already been produced.
        if (Date.now() > DEADLINE - 8000) {
          result = "Aviso: se alcanzó el límite de tiempo. Entrega ahora el contenido ya generado sin más herramientas.";
          messages.push({ role: "tool", tool_call_id: tc.id, content: result });
          continue;
        }
        try {
          if (tc.function.name === "generate_image") {
            const aspect = forcedAspect ?? String(args.aspect ?? "square");
            const prompt = String(args.prompt ?? "");
            let buf = await generateAiImage(prompt, aspect, DEADLINE);
            let fallbackKind: "none" | "photo" | "placeholder" = "none";
            // Fallback 1: if AI generation fully failed, try to fetch a real
            // photo using the prompt as a search query.
            if (!buf) {
              try {
                const fbUrl = await fetchThreadHookImage(prompt, { preferAgencies: true, preferHD: true });
                buf = fbUrl ? await fetchImageBuffer(fbUrl) : null;
                if (buf) fallbackKind = "photo";
              } catch (e) {
                logger.warn({ err: e }, "generate_image photo fallback failed");
              }
            }
            // Fallback 2 (hard guarantee): if both AI and photo search failed,
            // synthesize a deterministic branded placeholder so we ALWAYS
            // return an image rather than an error.
            if (!buf) {
              try {
                const dims: Record<string, [number, number]> = {
                  square: [1024, 1024],
                  portrait: [1024, 1536],
                  landscape: [1536, 1024],
                };
                const [w, h] = dims[aspect] ?? [1024, 1024];
                buf = await makePlaceholderImage(w, h, prompt);
                if (buf) fallbackKind = "placeholder";
              } catch (e) {
                logger.error({ err: e }, "generate_image placeholder fallback failed");
              }
            }
            if (buf && forced) {
              try { buf = await cropToAspectRatio(buf, forced.ratio[0], forced.ratio[1]); } catch { /* keep original */ }
            }
            if (buf) {
              imgCounter += 1;
              const ref = `img${imgCounter}`;
              produced.push({ ref, buffer: buf, superseded: false, origin: "generated", branded: false });
              result =
                fallbackKind === "photo"
                  ? `La generación con IA no estuvo disponible, así que usé una foto real de respaldo con referencia ${ref}. Aplica add_logo a ${ref} antes de entregar.`
                  : fallbackKind === "placeholder"
                    ? `La generación con IA y la búsqueda de fotos no estuvieron disponibles; creé una imagen de respaldo con la marca y el texto solicitado, referencia ${ref}. Aplica add_logo a ${ref} antes de entregar.`
                    : `Imagen generada con referencia ${ref}. Recuerda aplicar add_logo a ${ref} antes de entregar.`;
            } else {
              result = "Error: la generación de imagen falló tras varios intentos. Intenta con otro prompt o usa find_reference_image.";
            }
          } else if (tc.function.name === "find_reference_image") {
            const url = await fetchThreadHookImage(String(args.query ?? ""), { preferAgencies: true, preferHD: true });
            let buf = url ? await fetchImageBuffer(url) : null;
            if (buf && forced) {
              try { buf = await cropToAspectRatio(buf, forced.ratio[0], forced.ratio[1]); } catch { /* keep original */ }
            }
            if (buf) {
              imgCounter += 1;
              const ref = `img${imgCounter}`;
              produced.push({ ref, buffer: buf, superseded: false, origin: "generated", branded: false });
              result = `Foto real encontrada con referencia ${ref}. Aplica add_logo a ${ref} antes de entregar.`;
            } else {
              result = "Error: no se encontró una foto adecuada. Prueba otro término o usa generate_image.";
            }
          } else if (tc.function.name === "add_logo") {
            const ref = String(args.image_ref ?? "");
            const src = produced.find((p) => p.ref === ref && !p.superseded);
            if (!src) {
              result = `Error: no existe la referencia de imagen "${ref}". Referencias válidas: ${produced.filter((p) => !p.superseded).map((p) => p.ref).join(", ") || "ninguna"}.`;
            } else {
              const out = await overlayLogo(src.buffer, {
                variant: (args.variant === "icon" ? "icon" : "wordmark") as LogoVariant,
                position: (args.position as LogoPosition) ?? "bottom-left",
                color: args.color ? String(args.color) : "auto",
                sizePct: typeof args.size_pct === "number" ? args.size_pct : undefined,
              });
              src.superseded = true;
              imgCounter += 1;
              const newRef = `logo${imgCounter}`;
              produced.push({ ref: newRef, buffer: out, superseded: false, origin: "generated", branded: true });
              result = `Logo antiq aplicado. Imagen final lista con referencia ${newRef}.`;
            }
          } else if (tc.function.name === "generate_carousel") {
            const topic = String(args.topic ?? userMessage ?? "").trim();
            if (carouselDone) {
              result = "Ya creaste un carrusel en esta respuesta. No generes otro: entrega el que ya está listo.";
            } else if (!topic) {
              result = "Error: falta el tema del carrusel.";
            } else if (DEADLINE - Date.now() < 90000) {
              // Carousel = 1 LLM plan + several image downloads; don't start it
              // when remaining budget can't safely cover the work.
              result = "Aviso: no queda tiempo suficiente en esta respuesta para generar un carrusel completo. Pídele al usuario que lo intente de nuevo.";
            } else {
              // Mark done BEFORE the heavy call so a thrown error can't trigger an
              // expensive retry within the same request.
              carouselDone = true;
              const carousel = await generateCarouselForChat(topic, lang, req.log, DEADLINE);
              if (carousel.slides.length === 0) {
                result = `Se creó el carrusel "${carousel.headline}" y quedó guardado en la sección Instagram, pero no se pudieron descargar fotos para mostrarlas aquí. Pídele al usuario que lo finalice en la sección Instagram.`;
              } else {
                const refs: string[] = [];
                for (const slide of carousel.slides) {
                  imgCounter += 1;
                  const ref = `img${imgCounter}`;
                  produced.push({ ref, buffer: slide, superseded: false, origin: "generated", branded: false });
                  refs.push(ref);
                }
                result = `Carrusel "${carousel.headline}" creado y guardado en la sección Instagram (listo para finalizar ahí). Se entregan ${refs.length} foto(s) de slides con referencias ${refs.join(", ")}. El logo antiq se aplica automáticamente; no necesitas llamar add_logo por cada slide.`;
              }
            }
          } else if (tc.function.name === "generate_ad") {
            if (adDone) {
              result = "Ya creaste un anuncio en esta respuesta. No generes otro: entrega el que ya está listo.";
            } else if (DEADLINE - Date.now() < 60000) {
              // Ad = 1 LLM headline pass + emotion image or background fetch;
              // skip cleanly when remaining budget is too low to finish safely.
              result = "Aviso: no queda tiempo suficiente en esta respuesta para generar un anuncio completo. Pídele al usuario que lo intente de nuevo.";
            } else {
            // Mark done BEFORE the heavy call so a thrown error can't trigger an
            // expensive retry within the same request.
            adDone = true;
            const ad = await generateAdForChat(
              {
                style: typeof args.style === "string" ? args.style : "emotion",
                lang,
                customHeadline: typeof args.headline === "string" ? args.headline : undefined,
                withBackground: true,
                format: forced?.aspect === "landscape" ? "post" : "story",
                deadline: DEADLINE,
              },
              req.log,
            );
            if (!ad.image) {
              result = `Se creó el anuncio "${ad.headline}" (estilo ${ad.style}) y quedó guardado en la sección Ad Gen, pero no se pudo obtener una imagen de fondo para mostrarla aquí. Pídele al usuario que lo finalice en la sección Ad Gen.`;
            } else {
              imgCounter += 1;
              const ref = `img${imgCounter}`;
              produced.push({ ref, buffer: ad.image, superseded: false, origin: "generated", branded: false });
              result = `Anuncio "${ad.headline}" (estilo ${ad.style}) creado y guardado en la sección Ad Gen (listo para finalizar ahí). Imagen de fondo entregada con referencia ${ref}. El logo antiq se aplica automáticamente antes de entregar.`;
            }
            }
          } else {
            result = "Error: herramienta desconocida.";
          }
        } catch (e) {
          req.log.error({ err: e, tool: tc.function.name }, "content-gen tool failed");
          result = "Error al ejecutar la herramienta.";
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
    }

    if (!finalText) {
      finalText = lang === "en"
        ? "Here is what I created. Tell me how you'd like to refine it."
        : "Esto es lo que creé. Dime cómo te gustaría ajustarlo.";
    }

    // Deliver final images (not superseded, not raw uploads/previous untouched)
    const deliverable = produced.filter((p) => !p.superseded && p.origin === "generated");
    // Enforce antiq branding: every final image must carry the exact logo, even
    // if the model forgot to call add_logo. Auto-composite onto any unbranded output.
    const noBrandRequested = /\b(sin logo|no logo|sin marca|without (the )?logo|no watermark|sin logotipo)\b/i.test(userMessage);
    const deliveredImages: Array<{ dataUrl: string }> = [];
    for (const p of deliverable) {
      try {
        let buf = p.buffer;
        // Enforce the requested aspect ratio on EVERY delivered image, including
        // carousel/ad outputs whose pipelines emit their own intrinsic formats.
        // No-op for generate_image/find_reference_image (already cropped above).
        if (forced) {
          try { buf = await cropToAspectRatio(buf, forced.ratio[0], forced.ratio[1]); } catch { /* keep original */ }
        }
        if (!p.branded && !noBrandRequested) {
          try {
            buf = await overlayLogo(buf, { variant: "wordmark", position: "bottom-left", color: "auto" });
          } catch (e) {
            req.log.error({ err: e }, "content-gen auto-brand failed");
          }
        }
        // Optional "antiq.xyz" URL stamp at the bottom of the image.
        if (watermark) {
          try {
            buf = await overlayUrlText(buf, "antiq.xyz");
          } catch (e) {
            req.log.error({ err: e }, "content-gen watermark failed");
          }
        }
        // Soft retro film-grain finish applied LAST, over the fully-composited
        // frame, so every delivered image carries identical, authentic grain
        // (real film grain covers the whole frame uniformly) regardless of which
        // branding path it took. Fail-open: keep the clean image on error.
        try { buf = await applyGrain(buf, 9); } catch { /* keep original */ }
        deliveredImages.push({ dataUrl: await toJpegDataUrl(buf) });
      } catch { /* skip */ }
    }

    // Persist user + assistant messages
    await db.insert(contentGenMessagesTable).values({
      conversationId: convId,
      role: "user",
      content: userMessage || "(adjuntos)",
      attachments: storedAttachments.length > 0 ? JSON.stringify(storedAttachments) : null,
      images: null,
    });
    const [assistantRow] = await db
      .insert(contentGenMessagesTable)
      .values({
        conversationId: convId,
        role: "assistant",
        content: finalText,
        attachments: null,
        images: deliveredImages.length > 0 ? JSON.stringify(deliveredImages) : null,
      })
      .returning();

    await db
      .update(contentGenConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(contentGenConversationsTable.id, convId));

    if (deliveredImages.length > 0) {
      await addUsageTokens("contentgen", deliveredImages.length);
    }

    res.json({
      conversationId: convId,
      message: {
        id: assistantRow.id,
        role: "assistant",
        content: finalText,
        images: deliveredImages,
        createdAt: assistantRow.createdAt,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Error in content-gen chat");
    res.status(500).json({ error: "Error al generar contenido" });
  }
});

router.get("/content-gen/conversations", async (req, res) => {
  try {
    const archived = req.query["archived"] === "true";
    const rows = await db
      .select({
        id: contentGenConversationsTable.id,
        title: contentGenConversationsTable.title,
        lang: contentGenConversationsTable.lang,
        posted: contentGenConversationsTable.posted,
        createdAt: contentGenConversationsTable.createdAt,
        updatedAt: contentGenConversationsTable.updatedAt,
      })
      .from(contentGenConversationsTable)
      .where(eq(contentGenConversationsTable.posted, archived))
      .orderBy(desc(contentGenConversationsTable.updatedAt));
    res.json({ conversations: rows });
  } catch (err) {
    req.log.error({ err }, "Error listing content-gen conversations");
    res.status(500).json({ error: "Error al listar conversaciones" });
  }
});

router.get("/content-gen/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const conv = await db.select().from(contentGenConversationsTable).where(eq(contentGenConversationsTable.id, id)).limit(1);
    if (conv.length === 0) {
      res.status(404).json({ error: "No encontrada" });
      return;
    }
    const msgs = await db
      .select()
      .from(contentGenMessagesTable)
      .where(eq(contentGenMessagesTable.conversationId, id))
      .orderBy(asc(contentGenMessagesTable.createdAt));
    res.json({
      conversation: conv[0],
      messages: msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        attachments: m.attachments ? JSON.parse(m.attachments) : [],
        images: m.images ? JSON.parse(m.images) : [],
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Error getting content-gen conversation");
    res.status(500).json({ error: "Error al obtener conversación" });
  }
});

router.delete("/content-gen/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    await db.delete(contentGenMessagesTable).where(eq(contentGenMessagesTable.conversationId, id));
    await db.delete(contentGenConversationsTable).where(eq(contentGenConversationsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting content-gen conversation");
    res.status(500).json({ error: "Error al eliminar conversación" });
  }
});

export default router;
