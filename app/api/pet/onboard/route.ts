import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import type { OnboardRequest, OnboardResponse } from "@/lib/types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body: OnboardRequest = await req.json();
    const { description, goals } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const goalsText =
      goals?.length > 0
        ? `The user's goals are: ${goals.map((g, i) => `${i + 1}. "${g}"`).join(", ")}`
        : "The user hasn't set specific goals yet.";

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: `Create an AI accountability pet based on this description: "${description}"

${goalsText}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "name": "a fitting name for this pet",
  "personality": "2-3 sentence personality description. Be specific about tone, quirks, and how they coach. Max 60 words.",
  "emoji": "one emoji that represents this pet",
  "mood": "happy" or "neutral" or "skeptical",
  "greeting": "the pet's first message to the user. In character. Max 30 words. Reference one of their goals if possible."
}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse pet data" }, { status: 500 });
    }

    const petData = JSON.parse(jsonMatch[0]);

    const response: OnboardResponse = {
      pet: {
        name: petData.name,
        personality: petData.personality,
        emoji: petData.emoji,
        mood: petData.mood ?? "neutral",
        greeting: petData.greeting,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[onboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
