import { NextResponse } from "next/server";

const FOUR_MEME_API = "https://four.meme/meme-api/v1/public/token/ranking";

export interface RankingToken {
  name: string;
  symbol: string;
  address: string;
  price: number;
  cap: number;        // market cap in BNB
  day1Increase: number; // 24h % change
  day1Vol: number;    // 24h volume in USD
  holders: number;
  img?: string;
  progress: number;   // bonding curve progress 0-100
}

export async function GET() {
  try {
    const res = await fetch(FOUR_MEME_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ type: "HOT", pageSize: 5 }),
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`four.meme API ${res.status}`);

    const data = await res.json();
    // data.data is a flat array
    const list: Record<string, unknown>[] = Array.isArray(data?.data) ? data.data : [];

    const tokens: RankingToken[] = list.slice(0, 5).map((t) => ({
      name: String(t.name ?? "Unknown"),
      symbol: String(t.symbol ?? "???"),
      address: String(t.tokenAddress ?? ""),
      price: parseFloat(String(t.price ?? "0")),
      cap: parseFloat(String(t.cap ?? "0")),
      day1Increase: parseFloat(String(t.day1Increase ?? "0")),
      day1Vol: parseFloat(String(t.day1Vol ?? "0")),
      holders: parseInt(String(t.hold ?? "0")),
      img: t.img ? String(t.img) : undefined,
      progress: parseFloat(String(t.progress ?? "0")),
    }));

    return NextResponse.json({ tokens });
  } catch (err) {
    console.error("[rankings]", err);
    // Fallback mock so demo never breaks
    return NextResponse.json({
      tokens: [
        { name: "相信相信的力量", symbol: "HOPE", address: "", price: 0.000000033, cap: 33.5, day1Increase: 488.5, day1Vol: 298273, holders: 312, progress: 72 },
        { name: "忽略FUD", symbol: "FUD", address: "", price: 0.0000000117, cap: 11.7, day1Increase: 103.8, day1Vol: 179738, holders: 82, progress: 41 },
        { name: "PEPE2 BSC", symbol: "PEPE2", address: "", price: 0.000000008, cap: 8.1, day1Increase: -12.3, day1Vol: 67000, holders: 145, progress: 28 },
      ],
    });
  }
}
