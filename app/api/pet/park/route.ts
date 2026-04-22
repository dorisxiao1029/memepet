import { NextRequest, NextResponse } from "next/server";
import { COMMUNITY_PETS } from "@/lib/seed-pets";
import { computeMatch, type UserPetProfile } from "@/lib/compatibility";

interface ParkRequest {
  me: UserPetProfile;
  limit?: number;           // number of matches to return (default 3)
  includeBotWarning?: boolean; // default true — always surface one bot warning for demo
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ParkRequest;
    if (!body.me || !body.me.archetype) {
      return NextResponse.json({ error: "me.archetype required" }, { status: 400 });
    }
    const limit = body.limit ?? 3;

    // Compute match against all community pets
    const scored = COMMUNITY_PETS.map((p) => ({ pet: p, match: computeMatch(body.me, p) }));

    // Separate the bot so the demo always surfaces one — it's the killer feature
    const bots = scored.filter((s) => s.pet.botScore >= 70);
    const humans = scored.filter((s) => s.pet.botScore < 70);

    // Sort humans by score desc
    humans.sort((a, b) => b.match.score - a.match.score);
    const topMatches = humans.slice(0, limit);

    // Pick the highest-scoring bot to showcase the detection
    const botWarning = body.includeBotWarning === false
      ? null
      : bots.sort((a, b) => b.pet.botScore - a.pet.botScore)[0] ?? null;

    return NextResponse.json({
      date: new Date().toISOString(),
      matches: topMatches.map(({ pet, match }) => ({
        id: pet.id,
        nickname: pet.nickname,
        emoji: pet.emoji,
        level: pet.level,
        archetype: pet.archetype,
        tradingStyle: pet.tradingStyle,
        walletTags: pet.walletTags,
        memeScore: pet.memeScore,
        addressShort: pet.addressShort,
        bio: pet.bio,
        bioZh: pet.bioZh,
        botScore: pet.botScore,
        match,
      })),
      botWarning: botWarning
        ? {
            id: botWarning.pet.id,
            nickname: botWarning.pet.nickname,
            emoji: botWarning.pet.emoji,
            addressShort: botWarning.pet.addressShort,
            botScore: botWarning.pet.botScore,
            walletTags: botWarning.pet.walletTags,
            bio: botWarning.pet.bio,
            bioZh: botWarning.pet.bioZh,
          }
        : null,
      totalPool: COMMUNITY_PETS.length,
    });
  } catch (err) {
    console.error("[park]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
