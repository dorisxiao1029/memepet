import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import type { OnboardRequest, OnboardResponse } from "@/lib/types";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body: OnboardRequest = await req.json();
    const { description, goals, gender, personalityTags } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const goalsText =
      goals?.length > 0
        ? `The user's goals are: ${goals.map((g, i) => `${i + 1}. "${g}"`).join(", ")}`
        : "The user hasn't set specific goals yet.";

    const genderText = gender
      ? `The pet's gender identity: ${gender}.`
      : "";

    const tagsText = personalityTags?.length
      ? `The user self-identifies with these personality tags: ${personalityTags.join(", ")}. Reflect these in the pet's personality and communication style. E.g. ENFP = enthusiastic/idea-driven, Diamond Hands = champion long-term holding, Meme Hunter = loves discovering new dogs but wants companionship through volatility.`
      : "";

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      prompt: `You are a Meme Trading Pet generation expert. Create an AI pet companion based on this description: "${description}"

${goalsText}
${genderText}
${tagsText}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "name": "a fun, meme-flavored name for this pet (e.g. Degen Pepe, Wolf Sensei, 暖心柴犬)",
  "personality": "2-3 sentence personality description. Be specific about tone, quirks, and how they coach using memes and crypto culture. Incorporate the personality tags if provided. Max 60 words.",
  "emoji": "one emoji that best represents this pet",
  "mood": "happy",
  "meme_style": "one of: 毒舌 | 暖心 | 狂喜 | 冷静 — pick whichever fits the personality",
  "greeting": "the pet's very first message to the user. In character. Use meme energy. Reference their trading goals and personality tags if relevant. Max 35 words."
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
        mood: petData.mood ?? "happy",
        greeting: petData.greeting,
        memeStyle: petData.meme_style,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[onboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
