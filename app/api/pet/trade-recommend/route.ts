import { NextRequest, NextResponse } from "next/server";

const FOUR_MEME_API = "https://four.meme/meme-api/v1/public/token/ranking";

interface RawToken {
  name?: string;
  symbol?: string;
  tokenAddress?: string;
  price?: string | number;
  cap?: string | number;
  day1Increase?: string | number;
  day1Vol?: string | number;
  hold?: string | number;
  img?: string;
  progress?: string | number;
  version?: number;
}

interface Recommendation {
  address: string;
  name: string;
  symbol: string;
  img?: string;
  price: number;
  cap: number;
  day1Increase: number;
  day1Vol: number;
  holders: number;
  progress: number;
  reason: string;
  reasonZh: string;
  score: number;
}

type Archetype = "hype" | "comfort" | "roast" | "calm";

interface RecommendRequest {
  archetype?: Archetype;
  lang?: "en" | "zh";
}

function scoreToken(t: RawToken, archetype: Archetype): { score: number; reason: string; reasonZh: string } {
  const day1Inc = Number(t.day1Increase ?? 0);
  const day1Vol = Number(t.day1Vol ?? 0);
  const cap = Number(t.cap ?? 0);
  const progress = Number(t.progress ?? 0);
  const holders = Number(t.hold ?? 0);

  let score = 0;
  let reason = "";
  let reasonZh = "";

  switch (archetype) {
    case "hype":
      score = day1Inc * 2 + Math.log10(Math.max(day1Vol, 1)) * 10;
      reason = `+${day1Inc.toFixed(0)}% in 24h, vol $${Math.round(day1Vol).toLocaleString()} — perfect for a hype pet.`;
      reasonZh = `24h 涨 ${day1Inc.toFixed(0)}%，交易量 $${Math.round(day1Vol).toLocaleString()}，狂喜派宠物就爱这种。`;
      break;
    case "roast":
      // highest volume + chaos (either direction)
      score = Math.log10(Math.max(day1Vol, 1)) * 15 + Math.abs(day1Inc);
      reason = `High chaos: vol $${Math.round(day1Vol).toLocaleString()}, ${day1Inc > 0 ? "+" : ""}${day1Inc.toFixed(0)}% move. Degen fuel.`;
      reasonZh = `高波动：交易量 $${Math.round(day1Vol).toLocaleString()}，${day1Inc > 0 ? "涨" : "跌"} ${Math.abs(day1Inc).toFixed(0)}%。毒舌宠物的燃料。`;
      break;
    case "comfort":
      // mid-range, has holders, not totally flat
      score = holders * 0.5 + Math.min(day1Inc, 50) - Math.max(0, progress - 80) * 2;
      reason = `${holders} holders, gentle ${day1Inc > 0 ? "+" : ""}${day1Inc.toFixed(0)}% — safer pick for a comfort pet.`;
      reasonZh = `${holders} 位持有者，${day1Inc > 0 ? "温和上涨" : "小幅回调"} ${day1Inc.toFixed(0)}%，暖心派的稳妥选择。`;
      break;
    case "calm":
      // early stage with positive momentum
      score = (day1Inc > 0 ? day1Inc : 0) - Math.max(0, progress - 50) + holders * 0.3;
      reason = `Early stage (${progress.toFixed(0)}% curve), ${day1Inc > 0 ? "+" : ""}${day1Inc.toFixed(0)}% — patient entry.`;
      reasonZh = `早期阶段（曲线 ${progress.toFixed(0)}%），${day1Inc > 0 ? "涨" : "跌"} ${day1Inc.toFixed(0)}%，冷静派耐心入场。`;
      break;
  }

  // penalize graduated / nearly-graduated and capped/tiny tokens
  if (progress >= 95) score -= 1000;
  if (cap < 0.5) score -= 50;

  return { score, reason, reasonZh };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as RecommendRequest;
    const archetype: Archetype = body.archetype ?? "hype";

    const res = await fetch(FOUR_MEME_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ type: "HOT", pageSize: 20 }),
      next: { revalidate: 30 },
    });

    if (!res.ok) throw new Error(`four.meme API ${res.status}`);
    const data = await res.json();
    const list: RawToken[] = Array.isArray(data?.data) ? data.data : [];

    const candidates: Recommendation[] = list
      .filter((t) => t.tokenAddress && /^0x[a-fA-F0-9]{40}$/.test(String(t.tokenAddress)))
      .filter((t) => Number(t.progress ?? 0) < 95)
      .map((t) => {
        const { score, reason, reasonZh } = scoreToken(t, archetype);
        return {
          address: String(t.tokenAddress),
          name: String(t.name ?? "Unknown"),
          symbol: String(t.symbol ?? "???"),
          img: t.img ? String(t.img) : undefined,
          price: Number(t.price ?? 0),
          cap: Number(t.cap ?? 0),
          day1Increase: Number(t.day1Increase ?? 0),
          day1Vol: Number(t.day1Vol ?? 0),
          holders: Number(t.hold ?? 0),
          progress: Number(t.progress ?? 0),
          reason,
          reasonZh,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No live four.meme tokens matched recommendation filter." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      archetype,
      pick: candidates[0],
      alternatives: candidates.slice(1),
    });
  } catch (err) {
    console.error("[trade-recommend]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
