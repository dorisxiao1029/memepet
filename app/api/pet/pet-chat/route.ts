import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { humanize, humanizeZh, type MatchResult } from "@/lib/compatibility";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

interface PetRef {
  nickname: string;
  emoji: string;
  archetype: string;
  tradingStyle: string;
  walletTags: string[];
  bio?: string;
}

interface PetChatRequest {
  me: PetRef;
  them: PetRef;
  match: MatchResult;
  lang?: "en" | "zh";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PetChatRequest;
    const lang = body.lang ?? "en";
    const humanizer = lang === "zh" ? humanizeZh : humanize;

    const myTags = body.me.walletTags.map(humanizer).join(", ");
    const theirTags = body.them.walletTags.map(humanizer).join(", ");

    const reason = lang === "zh" ? body.match.reasonZh : body.match.reason;

    const systemPrompt = lang === "zh"
      ? `生成 4-6 轮对话，两只 meme-trader AI 宠物在"宠物公园"首次见面。

pet-a = ${body.me.nickname} ${body.me.emoji}（用户的宠物）· ${body.me.archetype}/${body.me.tradingStyle} · 标签：${myTags}
pet-b = ${body.them.nickname} ${body.them.emoji}（另一只）· ${body.them.archetype}/${body.them.tradingStyle} · 标签：${theirTags}

兼容度 ${body.match.score}%。原因：${reason}

硬性规则：
1. 必须严格交替：pet-a → pet-b → pet-a → pet-b → ...（决不能两句同一个说话人）
2. 第一句必须是 pet-a 开场
3. 每句 < 35 字
4. 对话要让两只宠物的标签互相"戳"一下（钻石手 vs 纸手互相吐槽、Alpha 猎人 + 狙击手讨论怎么配合）
5. 最后一句留"下次再见"的钩子
6. 只输出 JSON 数组，不要任何其他文字：[{"speaker":"pet-a","text":"..."},{"speaker":"pet-b","text":"..."}, ...]`
      : `Generate a 4-6 line dialogue between two meme-trader AI pets meeting in the Pet Park.

pet-a = ${body.me.nickname} ${body.me.emoji} (user's pet) · ${body.me.archetype}/${body.me.tradingStyle} · tags: ${myTags}
pet-b = ${body.them.nickname} ${body.them.emoji} (other pet) · ${body.them.archetype}/${body.them.tradingStyle} · tags: ${theirTags}

Match score ${body.match.score}%. Why: ${reason}

STRICT RULES:
1. MUST alternate strictly: pet-a → pet-b → pet-a → pet-b → ... (never two lines from same speaker in a row)
2. First line MUST be pet-a (user's pet opens)
3. Each line < 20 words
4. Lines should let their tag contrast show (Diamond Hand teases Paper Hand's exits, Sniper + Alpha plan a setup, etc.)
5. Last line leaves a "meet again" hook
6. Output JSON array ONLY, no extra text: [{"speaker":"pet-a","text":"..."},{"speaker":"pet-b","text":"..."}, ...]`;

    const { text } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages: [{ role: "user", content: "go" }],
      maxOutputTokens: 500,
    });

    // Extract JSON array
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ error: "no dialogue generated", raw: text }, { status: 500 });
    }
    let lines: { speaker: "pet-a" | "pet-b"; text: string }[] = [];
    try {
      lines = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "parse failed", raw: text }, { status: 500 });
    }

    // Safety net: force strict alternation starting with pet-a. Groq sometimes
    // puts all lines under one speaker — the UI relies on correct attribution.
    lines = lines
      .filter((l) => l && typeof l.text === "string" && l.text.trim().length > 0)
      .map((l, i) => ({ speaker: i % 2 === 0 ? "pet-a" : "pet-b", text: l.text.trim() }));

    return NextResponse.json({
      lines,
      meta: {
        me: { nickname: body.me.nickname, emoji: body.me.emoji },
        them: { nickname: body.them.nickname, emoji: body.them.emoji },
        score: body.match.score,
      },
    });
  } catch (err) {
    console.error("[pet-chat]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
