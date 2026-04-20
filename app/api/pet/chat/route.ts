import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import type { ChatRequest, ChatResponse, Mood, Reaction } from "@/lib/types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, petState, goals, conversationHistory, walletSummary, newsContext } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(petState, goals, walletSummary, newsContext);

    const messages = [
      ...conversationHistory.slice(-20).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const { text: fullText } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages,
      maxOutputTokens: 400,
    });

    // Parse optional JSON block at end of response
    let reply = fullText;
    let xpDelta: number | undefined;
    let moodUpdate: Mood | undefined;
    let reaction: Reaction | undefined;

    const jsonMatch = fullText.match(/\{[\s\S]*?\}\s*$/);
    if (jsonMatch) {
      try {
        const metadata = JSON.parse(jsonMatch[0]);
        xpDelta = metadata.xpDelta;
        moodUpdate = metadata.moodUpdate;
        reply = fullText.slice(0, fullText.lastIndexOf(jsonMatch[0])).trim();
      } catch {
        // JSON parse failed — use full text as reply
      }
    }

    if (reply.toLowerCase().includes("wallet") || reply.toLowerCase().includes("hold time") || reply.toLowerCase().includes("fomo")) {
      reaction = "reality-check";
    } else if (xpDelta && xpDelta > 0) {
      reaction = "encouragement";
    } else {
      reaction = "neutral";
    }

    const chatResponse: ChatResponse = {
      reply,
      moodUpdate,
      xpDelta,
      reaction,
    };

    return NextResponse.json(chatResponse);
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
