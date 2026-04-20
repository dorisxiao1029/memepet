import { NextResponse } from "next/server";

const BASE_URL = "https://ai.6551.io";
const TOKEN = process.env.OPENNEWS_TOKEN;

// ── Types ────────────────────────────────────────────────────────
interface NewsArticle {
  id?: string;
  text?: string;
  title?: string;
  engineType?: string;
  link?: string;
  coins?: { symbol: string }[];
  aiRating?: {
    score: number;
    grade?: string;
    signal?: "long" | "short" | "neutral";
    summaryEn?: string;
    summaryZh?: string;
  };
}

interface FreeTweet {
  author?: string;
  handle?: string;
  content?: string;
  url?: string;
  metrics?: { likes?: number; retweets?: number };
  posted_at?: string;
}

interface FreeNewsItem {
  title?: string;
  source?: string;
  link?: string;
  score?: number;
  signal?: string;
  summaries?: { en?: string; zh?: string };
  coins?: { symbol: string }[];
  published_at?: string;
}

// ── Route ────────────────────────────────────────────────────────
export async function GET() {
  try {
    const authHeaders: HeadersInit = {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    };

    // Parallel: authenticated meme+news search  AND  free meme hot list
    const [searchResult, freeResult] = await Promise.allSettled([
      TOKEN
        ? fetch(`${BASE_URL}/open/news_search`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({
              limit: 10,
              page: 1,
              engineTypes: { meme: [], news: [] },
              hasCoin: false,
            }),
            next: { revalidate: 120 },
          })
        : Promise.reject("no OPENNEWS_TOKEN"),

      fetch(`${BASE_URL}/open/free_hot?category=crypto&subcategory=meme`, {
        next: { revalidate: 120 },
      }),
    ]);

    // ── Parse authenticated news ──────────────────────────────────
    let articles: NewsArticle[] = [];
    if (searchResult.status === "fulfilled" && searchResult.value.ok) {
      const raw = await searchResult.value.json();
      // Handle multiple possible response shapes from the API
      const list =
        raw?.data?.list ??
        raw?.data?.items ??
        (Array.isArray(raw?.data) ? raw.data : null) ??
        raw?.list ??
        raw?.items ??
        [];
      articles = Array.isArray(list) ? (list as NewsArticle[]) : [];
    }

    // ── Parse free hot ────────────────────────────────────────────
    let freeTweets: FreeTweet[] = [];
    let freeNews: FreeNewsItem[] = [];
    if (freeResult.status === "fulfilled" && freeResult.value.ok) {
      const raw = await freeResult.value.json();
      const tweetItems = raw?.data?.tweets?.items ?? raw?.tweets?.items ?? [];
      const newsItems  = raw?.data?.news?.items  ?? raw?.news?.items  ?? [];
      freeTweets = Array.isArray(tweetItems) ? tweetItems.slice(0, 5) : [];
      freeNews   = Array.isArray(newsItems)  ? newsItems.slice(0, 5)  : [];
    }

    // ── Sort authenticated articles by AI score ───────────────────
    const scored = articles
      .filter((a) => a.aiRating?.score != null)
      .sort((a, b) => (b.aiRating!.score) - (a.aiRating!.score));
    const highSignal = scored.slice(0, 5);

    // ── Compute overall sentiment ─────────────────────────────────
    const longCount    = highSignal.filter(a => a.aiRating?.signal === "long").length;
    const shortCount   = highSignal.filter(a => a.aiRating?.signal === "short").length;
    const sentiment    = longCount > shortCount ? "BULLISH" : shortCount > longCount ? "BEARISH" : "NEUTRAL";
    const sentimentScore =
      highSignal.length > 0
        ? Math.round(highSignal.reduce((s, a) => s + (a.aiRating?.score ?? 50), 0) / highSignal.length)
        : 50;

    // ── Build compact context string for AI prompt injection ──────
    const lines: string[] = [];

    if (highSignal.length > 0) {
      lines.push("📊 MARKET INTELLIGENCE (AI-scored, live):");
      highSignal.slice(0, 3).forEach((a) => {
        const sig  = (a.aiRating?.signal ?? "neutral").toUpperCase();
        const icon = sig === "LONG" ? "🟢" : sig === "SHORT" ? "🔴" : "🟡";
        const body = a.aiRating?.summaryEn ?? a.text ?? a.title ?? "";
        lines.push(`  ${icon}[${sig}] ${body.slice(0, 100)}`);
      });
    }

    if (freeTweets.length > 0) {
      lines.push("\n📱 HOT MEME TWEETS:");
      freeTweets.slice(0, 3).forEach((t) => {
        const handle = t.handle ?? t.author ?? "anon";
        lines.push(`  @${handle}: ${(t.content ?? "").slice(0, 100)}`);
      });
    }

    if (freeNews.length > 0) {
      lines.push("\n📰 MEME MARKET NEWS:");
      freeNews.slice(0, 3).forEach((n) => {
        const sig  = n.signal ? `[${n.signal.toUpperCase()}] ` : "";
        lines.push(`  ${sig}${n.title ?? "Untitled"}`);
      });
    }

    const context = lines.join("\n");

    return NextResponse.json({
      context,           // Compact string for system-prompt injection
      sentiment,         // "BULLISH" | "BEARISH" | "NEUTRAL"
      sentimentScore,    // 0-100
      articles: highSignal,
      tweets: freeTweets,
      freeNews,
    });
  } catch (err) {
    console.error("[news-context]", err);
    return NextResponse.json({
      context: "",
      sentiment: "NEUTRAL",
      sentimentScore: 50,
      articles: [],
      tweets: [],
      freeNews: [],
    });
  }
}
