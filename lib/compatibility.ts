/**
 * Pet compatibility engine.
 * Philosophy: complementary > similar. Two paper hands amplify each other's anxiety;
 * a paper hand + a diamond hand teach each other discipline.
 */
import type { CommunityPet } from "./seed-pets";
import type { PetArchetype, TradingStyle } from "./types";

export type Verdict = "complementary" | "similar" | "amplifier" | "mismatch";

export interface UserPetProfile {
  archetype: PetArchetype;
  tradingStyle: TradingStyle;
  walletTags: string[];
  level: number;
}

export interface MatchResult {
  score: number;               // 0-100
  verdict: Verdict;
  reason: string;              // EN
  reasonZh: string;            // ZH
  sharedTags: string[];
  complementaryPairs: [string, string][]; // my-tag × their-tag that fit together
  amplifyingPairs: [string, string][];    // bad combinations (both paper hands, etc.)
}

// Core pairwise tag chemistry lookup.
// Values are delta contributions to the match score.
const TAG_CHEMISTRY: Record<string, Record<string, number>> = {
  DIAMOND_HANDS: {
    PAPER_HANDS: +35,         // classic complementary pair
    DIAMOND_HANDS: +12,
    HIGH_FREQ: +18,
    SNIPER: +14,
    DEGEN: +12,
    ALPHA_HUNTER: +22,
    LURKER: +16,
    WHALE: +18,
    INFO_COLLECTOR: +20,
  },
  PAPER_HANDS: {
    DIAMOND_HANDS: +35,
    PAPER_HANDS: -20,         // amplifier: anxiety * anxiety
    HIGH_FREQ: -10,
    SNIPER: -8,
    DEGEN: -12,
    ALPHA_HUNTER: +18,
    LURKER: +12,
    WHALE: +8,
    INFO_COLLECTOR: +14,
  },
  SNIPER: {
    ALPHA_HUNTER: +38,        // finding × executing — best pair
    DIAMOND_HANDS: +14,
    PAPER_HANDS: -8,
    SNIPER: -6,
    HIGH_FREQ: +8,
    DEGEN: +10,
    LURKER: +15,
    WHALE: +16,
    INFO_COLLECTOR: +22,
  },
  ALPHA_HUNTER: {
    SNIPER: +38,
    DIAMOND_HANDS: +22,
    PAPER_HANDS: +18,
    ALPHA_HUNTER: +6,
    HIGH_FREQ: +10,
    DEGEN: +8,
    LURKER: +20,
    WHALE: +16,
    INFO_COLLECTOR: +24,
  },
  HIGH_FREQ: {
    DIAMOND_HANDS: +18,
    PAPER_HANDS: -10,
    HIGH_FREQ: -15,           // two frequent traders burn each other out
    SNIPER: +8,
    DEGEN: -5,
    LURKER: +22,              // frequent + patient balance each other
    WHALE: +10,
    ALPHA_HUNTER: +10,
    INFO_COLLECTOR: +12,
  },
  DEGEN: {
    DIAMOND_HANDS: +12,
    PAPER_HANDS: -12,
    DEGEN: -18,               // two degens crash the pool
    SNIPER: +10,
    HIGH_FREQ: -5,
    LURKER: +14,
    WHALE: +8,
    ALPHA_HUNTER: +8,
    INFO_COLLECTOR: +10,
  },
  LURKER: {
    DIAMOND_HANDS: +16,
    PAPER_HANDS: +12,
    HIGH_FREQ: +22,
    SNIPER: +15,
    DEGEN: +14,
    ALPHA_HUNTER: +20,
    LURKER: +8,
    WHALE: +14,
    INFO_COLLECTOR: +16,
  },
  WHALE: {
    DIAMOND_HANDS: +18,
    PAPER_HANDS: +8,
    HIGH_FREQ: +10,
    SNIPER: +16,
    DEGEN: +8,
    LURKER: +14,
    WHALE: +10,
    ALPHA_HUNTER: +16,
    INFO_COLLECTOR: +18,
  },
  INFO_COLLECTOR: {
    DIAMOND_HANDS: +20,
    PAPER_HANDS: +14,
    HIGH_FREQ: +12,
    SNIPER: +22,
    DEGEN: +10,
    LURKER: +16,
    WHALE: +18,
    ALPHA_HUNTER: +24,
    INFO_COLLECTOR: +10,
  },
};

// Narrative templates for the top complementary pairs.
const PAIR_STORIES: Record<string, { en: string; zh: string }> = {
  "DIAMOND_HANDS+PAPER_HANDS": {
    en: "Your diamond grip teaches them to hold. Their exit pressure teaches you to take profits.",
    zh: "你教他别跑，他教你及时落袋。",
  },
  "SNIPER+ALPHA_HUNTER": {
    en: "They find the alpha, you pull the trigger. Trading pair made in meme heaven.",
    zh: "他发现 alpha，你扣扳机。meme 天堂里的搭档。",
  },
  "HIGH_FREQ+LURKER": {
    en: "You're always moving, they're watching the bigger picture. Balance.",
    zh: "你永远在动，他看着大局。平衡。",
  },
  "PAPER_HANDS+LURKER": {
    en: "Their patience steadies your nerves. Your energy keeps them alive to the market.",
    zh: "他的耐心稳住你，你的活力让他不脱节。",
  },
  "INFO_COLLECTOR+SNIPER": {
    en: "You read everything, they execute on what matters.",
    zh: "你读遍信息，他只在关键时出手。",
  },
  "ALPHA_HUNTER+DIAMOND_HANDS": {
    en: "You find early, they hold through. You both end up rich.",
    zh: "你找得早，他拿得住，最后一起富。",
  },
};

function storyFor(myTag: string, theirTag: string): { en: string; zh: string } | null {
  const key1 = `${myTag}+${theirTag}`;
  const key2 = `${theirTag}+${myTag}`;
  return PAIR_STORIES[key1] ?? PAIR_STORIES[key2] ?? null;
}

export function computeMatch(me: UserPetProfile, them: CommunityPet): MatchResult {
  const myTags = me.walletTags;
  const theirTags = them.walletTags;

  // Baseline 50, normalize by pair count so scores spread across the 0-100 range
  // instead of saturating. Ignore zero-chemistry pairs so partial overlap doesn't dilute strong pairs.
  let deltaSum = 0;
  let contributingPairs = 0;
  const sharedTags: string[] = [];
  const complementaryPairs: [string, string][] = [];
  const amplifyingPairs: [string, string][] = [];

  for (const myTag of myTags) {
    for (const theirTag of theirTags) {
      const delta = TAG_CHEMISTRY[myTag]?.[theirTag] ?? 0;
      if (delta !== 0) {
        deltaSum += delta;
        contributingPairs += 1;
      }
      if (myTag === theirTag && delta > 0) sharedTags.push(myTag);
      else if (delta >= 20) complementaryPairs.push([myTag, theirTag]);
      else if (delta <= -10) amplifyingPairs.push([myTag, theirTag]);
    }
  }
  const avgDelta = contributingPairs > 0 ? deltaSum / contributingPairs : 0;
  // Boost slightly when multiple pairs align, but not linearly
  const alignmentBoost = Math.min(15, Math.sqrt(Math.max(0, contributingPairs)) * 3);
  let total = 50 + avgDelta + (avgDelta > 0 ? alignmentBoost : 0);


  // Archetype chemistry modifier
  const ARCHETYPE_BONUS: Record<PetArchetype, Record<PetArchetype, number>> = {
    hype: { hype: -5, calm: +12, roast: -3, comfort: +10 },
    calm: { hype: +12, calm: +4, roast: +8, comfort: +8 },
    roast: { hype: -3, calm: +8, roast: -5, comfort: +14 },
    comfort: { hype: +10, calm: +8, roast: +14, comfort: +4 },
  };
  total += ARCHETYPE_BONUS[me.archetype]?.[them.archetype] ?? 0;

  // Level-gap penalty — mentors and beginners match less naturally
  const levelGap = Math.abs(me.level - them.level);
  if (levelGap > 5) total -= 8;

  // Bot detection — high bot score heavily penalizes the match
  if (them.botScore >= 70) total = Math.min(total, 30); // keep visible but clearly discouraged

  total = Math.max(0, Math.min(100, Math.round(total)));

  // Verdict
  let verdict: Verdict;
  if (them.botScore >= 70) verdict = "mismatch";
  else if (amplifyingPairs.length > 0 && complementaryPairs.length === 0) verdict = "amplifier";
  else if (complementaryPairs.length >= 2) verdict = "complementary";
  else if (sharedTags.length >= 2) verdict = "similar";
  else verdict = total >= 70 ? "complementary" : total >= 55 ? "similar" : "mismatch";

  // Build narrative reason
  let reason: string;
  let reasonZh: string;
  if (them.botScore >= 70) {
    reason = "Bot behavior detected. Pet stayed away.";
    reasonZh = "检测到 bot 行为。宠物自动回避。";
  } else if (complementaryPairs.length > 0) {
    const [myTag, theirTag] = complementaryPairs[0];
    const story = storyFor(myTag, theirTag);
    reason = story?.en ?? `Your ${humanize(myTag)} and their ${humanize(theirTag)} complement each other.`;
    reasonZh = story?.zh ?? `你的 ${humanize(myTag)} 和他的 ${humanize(theirTag)} 互补。`;
  } else if (sharedTags.length > 0) {
    reason = `You both have ${humanize(sharedTags[0])}. Kindred spirits.`;
    reasonZh = `你俩都是 ${humanize(sharedTags[0])}。同类。`;
  } else if (amplifyingPairs.length > 0) {
    const [myTag] = amplifyingPairs[0];
    reason = `Two ${humanize(myTag)} in a room = pool drained. Pet recommends distance.`;
    reasonZh = `两个 ${humanize(myTag)} 凑一起 = 钱包共同掏空。建议保持距离。`;
  } else {
    reason = "Different styles, no strong pull.";
    reasonZh = "风格不同，缘分一般。";
  }

  return { score: total, verdict, reason, reasonZh, sharedTags, complementaryPairs, amplifyingPairs };
}

export function humanize(tag: string): string {
  const m: Record<string, string> = {
    DIAMOND_HANDS: "Diamond Hands",
    PAPER_HANDS: "Paper Hands",
    SNIPER: "Sniper",
    ALPHA_HUNTER: "Alpha Hunter",
    WHALE: "Whale",
    DEGEN: "Degen",
    INFO_COLLECTOR: "Info Collector",
    HIGH_FREQ: "High Freq",
    LURKER: "Lurker",
    COMMUNITY: "Community",
    ROUND_AMOUNTS: "Round Amounts",
    NO_SLEEP: "24/7 Active",
    LATE_NIGHT: "Night Owl",
  };
  return m[tag] ?? tag;
}

export function humanizeZh(tag: string): string {
  const m: Record<string, string> = {
    DIAMOND_HANDS: "钻石手",
    PAPER_HANDS: "纸手",
    SNIPER: "狙击手",
    ALPHA_HUNTER: "Alpha 猎人",
    WHALE: "入金大佬",
    DEGEN: "冲土狗",
    INFO_COLLECTOR: "信息集大成",
    HIGH_FREQ: "高频玩家",
    LURKER: "滑水专家",
    COMMUNITY: "社区支柱",
    ROUND_AMOUNTS: "整数金额",
    NO_SLEEP: "24/7 无休",
    LATE_NIGHT: "夜猫子",
  };
  return m[tag] ?? tag;
}

export function tagEmoji(tag: string): string {
  const m: Record<string, string> = {
    DIAMOND_HANDS: "💎",
    PAPER_HANDS: "🏃",
    SNIPER: "🎯",
    ALPHA_HUNTER: "🔭",
    WHALE: "💸",
    DEGEN: "🌊",
    INFO_COLLECTOR: "📰",
    HIGH_FREQ: "🎰",
    LURKER: "😴",
    COMMUNITY: "🌸",
    ROUND_AMOUNTS: "🤖",
    NO_SLEEP: "🤖",
    LATE_NIGHT: "🌙",
  };
  return m[tag] ?? "⭐";
}
