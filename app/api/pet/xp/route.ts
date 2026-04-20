import { NextRequest, NextResponse } from "next/server";
import { calcXpDelta, calcMood } from "@/lib/storage";
import type { XpRequest, XpResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body: XpRequest = await req.json();
    const { event } = body;

    const xpDelta = calcXpDelta(event);

    // We don't store state server-side (localStorage only for hackathon)
    // This endpoint just validates and returns the delta + mood calculation
    // Client applies it to localStorage

    const response: XpResponse = {
      xpDelta,
      newTotal: 0, // client calculates actual total
      levelUp: false, // client calculates
      newMood: calcMood(0, event),
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[xp]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
