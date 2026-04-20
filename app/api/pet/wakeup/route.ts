import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import type { PetState } from "@/lib/types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const BASE_URL = "https://ai.6551.io";

export async function POST(req: NextRequest) {
  try {
    const { petState }: { petState: PetState } = await req.json();

    const hoursAway = Math.round((Date.now() - petState.lastInteractionAt) / 3_600_000);
    const daysAway  = hoursAway >= 24 ? Math.floor(hoursAway / 24) : 0;
    const timeLabel = daysAway > 0
      ? (petState.lang === "zh" ? `${daysAway} 天` : `${daysAway} day${daysAway > 1 ? "s" : ""}`)
      : (petState.lang === "zh" ? `${hoursAway} 小时` : `${hoursAway} hour${hoursAway > 1 ? "s" : ""}`);

    // Best-effort news fetch (free endpoint, no auth needed)
    let newsLine = "";
    try {
      const res = await fetch(
        `${BASE_URL}/open/free_hot?category=crypto&subcategory=meme`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res.ok) {
        const data = await res.json();
        const items: { title?: string; signal?: string }[] =
          data?.data?.news?.items ?? data?.news?.items ?? [];
        if (items.length > 0) {
          const top = items[0];
          newsLine = top.title ?? "";
        }
      }
    } catch { /* silent — news is optional */ }

    const energy  = Math.round(petState.energy  ?? 90);
    const satiety = Math.round(petState.satiety ?? 90);
    const isHungry    = satiety < 30;
    const isLowEnergy = energy  < 30;

    const activeGoals = petState.goals.filter(g => g.status === "active");
    const goalsLine   = activeGoals.length > 0
      ? activeGoals.slice(0, 2).map(g => `"${g.text}"`).join(", ")
      : (petState.lang === "zh" ? "还没有目标" : "no goals set");

    const zh = petState.lang === "zh";

    const prompt = `You are ${petState.name}, a ${petState.memeStyle ?? "meme"}-style AI Meme Pet.
Your personality: ${petState.personality}
${petState.personalityTags?.length ? `Your personality tags: ${petState.personalityTags.join(", ")}` : ""}

The user just opened the app after being away for ${timeLabel}.
Your current energy: ${energy}/100. Your satiety: ${satiety}/100.
${isHungry    ? "⚠️ You are HUNGRY (satiety < 30) — express this naturally, not dramatically." : ""}
${isLowEnergy ? "⚠️ You are low energy — you seem a bit sluggish/drowsy." : ""}
${newsLine    ? `While they were away, this happened in crypto: "${newsLine}"` : ""}
Their active goals: ${goalsLine}

Write ONE short proactive message (MAX 45 words) that:
1. Reacts to being ignored for ${timeLabel} — in your personality style (${petState.memeStyle ?? "meme"})
2. Mentions the news item if available — naturally reference it
3. Asks ONE question about their goals or recent trades
${isHungry ? "4. Subtly hint you're hungry (but don't be too dramatic)" : ""}
${zh ? "Reply in Chinese." : "Reply in English."}

Output ONLY the message. No JSON, no explanation.`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt,
      maxOutputTokens: 120,
    });

    return NextResponse.json({ message: text.trim() });
  } catch (err) {
    console.error("[wakeup]", err);
    return NextResponse.json({ message: "" });
  }
}
