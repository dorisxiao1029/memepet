import { NextResponse } from "next/server";

const FOUR_MEME_API = "https://four.meme/meme-api/v1/public/token/ranking";

export interface RankingToken {
  name: string;
  symbol: string;
  address: string;
  priceUsd: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  holders: number;
  image?: string;
}

export async function GET() {
  try {
    const res = await fetch(FOUR_MEME_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ type: "HOT", pageSize: 5 }),
      next: { revalidate: 60 }, // cache 60s
    });

    if (!res.ok) {
      throw new Error(`four.meme API ${res.status}`);
    }

    const data = await res.json();
    // four.meme returns { code, data: { list: [...] } }
    const list = data?.data?.list ?? data?.data ?? [];

    const tokens: RankingToken[] = list.slice(0, 5).map((t: Record<string, unknown>) => ({
      name: (t.name as string) ?? "Unknown",
      symbol: (t.symbol as string) ?? "???",
      address: (t.address as string) ?? "",
      priceUsd: parseFloat((t.priceUsd as string) ?? "0") || 0,
      volume24h: parseFloat((t.volume24h as string) ?? "0") || 0,
      marketCap: parseFloat((t.marketCap as string) ?? "0") || 0,
      priceChange24h: parseFloat((t.priceChange24h as string) ?? "0") || 0,
      holders: parseInt((t.holders as string) ?? "0") || 0,
      image: (t.image as string) ?? undefined,
    }));

    return NextResponse.json({ tokens });
  } catch (err) {
    console.error("[rankings]", err);
    // Return mock data so demo never breaks
    return NextResponse.json({
      tokens: [
        { name: "相信相信的力量", symbol: "HOPE", address: "", priceUsd: 0.0000042, volume24h: 128000, marketCap: 42000, priceChange24h: 88.5, holders: 312 },
        { name: "PEPE2 BSC", symbol: "PEPE2", address: "", priceUsd: 0.000001, volume24h: 95000, marketCap: 31000, priceChange24h: -12.3, holders: 891 },
        { name: "四季豆", symbol: "BEAN", address: "", priceUsd: 0.0000008, volume24h: 67000, marketCap: 18000, priceChange24h: 210.0, holders: 145 },
      ],
    });
  }
}
