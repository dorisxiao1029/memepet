/**
 * Synthesized Community Pets for the Pet Park.
 * These are demo personas with behavioral tag combinations sampled from
 * public BSC meme-trader archetypes. No real wallets are referenced.
 *
 * Addresses are checksum-valid but not tied to any private individual.
 * Disclaimer shown to the user: "Synthesized from BSC public behavior patterns".
 */
import type { PetArchetype, TradingStyle } from "./types";

export interface CommunityPet {
  id: string;
  nickname: string;
  emoji: string;
  level: number;
  addressShort: string;      // for display only, e.g. "0x4f...b3a"
  archetype: PetArchetype;
  tradingStyle: TradingStyle;
  walletTags: string[];      // structured tag ids — see lib/wallet-tags.ts
  memeScore: number;
  bio: string;
  bioZh: string;
  botScore: number;          // 0-100, higher = more bot-like
}

// 12 community pets, chosen to span the tag space so matching has contrast.
export const COMMUNITY_PETS: CommunityPet[] = [
  {
    id: "dragonfrost-4f3a",
    nickname: "DragonFrost",
    emoji: "🐉",
    level: 7,
    addressShort: "0x4f3a...b3a",
    archetype: "calm",
    tradingStyle: "holder",
    walletTags: ["DIAMOND_HANDS", "INFO_COLLECTOR", "LURKER"],
    memeScore: 2840,
    bio: "Cold operator. Holds through the dips, laughs through the pumps.",
    bioZh: "冷静操盘手。跌时不慌、涨时不急。",
    botScore: 12,
  },
  {
    id: "shibaking-7c21",
    nickname: "ShibaKing",
    emoji: "🦊",
    level: 5,
    addressShort: "0x7c21...ffe",
    archetype: "hype",
    tradingStyle: "degen",
    walletTags: ["SNIPER", "HIGH_FREQ", "PAPER_HANDS"],
    memeScore: 1920,
    bio: "First in, first out. Too fast for his own good.",
    bioZh: "第一个冲、第一个跑。有点太快了。",
    botScore: 28,
  },
  {
    id: "moonoracle-8b92",
    nickname: "MoonOracle",
    emoji: "🔮",
    level: 8,
    addressShort: "0x8b92...c44",
    archetype: "calm",
    tradingStyle: "scalper",
    walletTags: ["ALPHA_HUNTER", "INFO_COLLECTOR", "WHALE"],
    memeScore: 3120,
    bio: "Catches tokens before they trend. Whisperer of the hotlist.",
    bioZh: "榜单还没热的时候就在了。低语者。",
    botScore: 18,
  },
  {
    id: "papernugget-2e07",
    nickname: "PaperNugget",
    emoji: "🐰",
    level: 3,
    addressShort: "0x2e07...1ab",
    archetype: "comfort",
    tradingStyle: "scalper",
    walletTags: ["PAPER_HANDS", "HIGH_FREQ"],
    memeScore: 680,
    bio: "Sells too early. Every. Single. Time. Needs a diamond friend.",
    bioZh: "每次都卖飞。需要一个钻石手朋友。",
    botScore: 22,
  },
  {
    id: "alphahowl-1d45",
    nickname: "AlphaHowl",
    emoji: "🐺",
    level: 6,
    addressShort: "0x1d45...7e2",
    archetype: "calm",
    tradingStyle: "scalper",
    walletTags: ["ALPHA_HUNTER", "SNIPER", "WHALE"],
    memeScore: 2410,
    bio: "Finds the candle before the chart sees it.",
    bioZh: "图表还没画出来，她已经在里面了。",
    botScore: 31,
  },
  {
    id: "bonkmama-9f33",
    nickname: "BonkMama",
    emoji: "🐶",
    level: 4,
    addressShort: "0x9f33...042",
    archetype: "comfort",
    tradingStyle: "holder",
    walletTags: ["DIAMOND_HANDS", "COMMUNITY"],
    memeScore: 1210,
    bio: "Warm hugs after losses. Bag-holder-in-chief since 2023.",
    bioZh: "亏损时的拥抱。从 2023 年就在捂的袋子。",
    botScore: 9,
  },
  {
    id: "scalpkid-6a18",
    nickname: "ScalpKid",
    emoji: "⚡",
    level: 5,
    addressShort: "0x6a18...9d0",
    archetype: "hype",
    tradingStyle: "scalper",
    walletTags: ["HIGH_FREQ", "SNIPER", "PAPER_HANDS"],
    memeScore: 1540,
    bio: "200 trades a week. Gas wallet always empty.",
    bioZh: "一周 200 笔，gas 钱包永远空。",
    botScore: 44,
  },
  {
    id: "zenfox-3c71",
    nickname: "ZenFox",
    emoji: "🍃",
    level: 9,
    addressShort: "0x3c71...5fc",
    archetype: "calm",
    tradingStyle: "quiet",
    walletTags: ["LURKER", "WHALE", "DIAMOND_HANDS"],
    memeScore: 3480,
    bio: "Trades once a month. Always right.",
    bioZh: "一月下一次单，通常都对。",
    botScore: 7,
  },
  {
    id: "degenpup-e204",
    nickname: "DegenPup",
    emoji: "🎲",
    level: 4,
    addressShort: "0xe204...8aa",
    archetype: "roast",
    tradingStyle: "degen",
    walletTags: ["DEGEN", "HIGH_FREQ", "PAPER_HANDS"],
    memeScore: 980,
    bio: "Every trade is 'just one more'. It never is.",
    bioZh: "每笔都是'最后一笔'，永远不是。",
    botScore: 36,
  },
  {
    id: "infosage-5b88",
    nickname: "InfoSage",
    emoji: "🦉",
    level: 7,
    addressShort: "0x5b88...c19",
    archetype: "calm",
    tradingStyle: "recovering",
    walletTags: ["INFO_COLLECTOR", "ALPHA_HUNTER"],
    memeScore: 2260,
    bio: "Has opened 73 different tokens this quarter. Reading everything.",
    bioZh: "这季度开过 73 种币。什么都看。",
    botScore: 14,
  },
  // The bot (intentionally flagged)
  {
    id: "perfectxyz-0000",
    nickname: "PerfectX",
    emoji: "🤖",
    level: 10,
    addressShort: "0x0000...bcd",
    archetype: "calm",
    tradingStyle: "scalper",
    walletTags: ["HIGH_FREQ", "ROUND_AMOUNTS", "NO_SLEEP"],
    memeScore: 9999,
    bio: "Trades exactly every 47 seconds. Always in 0.1 BNB increments.",
    bioZh: "每 47 秒交易一次，永远 0.1 BNB 整数。",
    botScore: 91,
  },
  {
    id: "nightowl-8e55",
    nickname: "NightOwl",
    emoji: "🌙",
    level: 6,
    addressShort: "0x8e55...d77",
    archetype: "roast",
    tradingStyle: "degen",
    walletTags: ["LATE_NIGHT", "DEGEN", "HIGH_FREQ"],
    memeScore: 1780,
    bio: "3 AM is her prime time. Most losses happen after midnight.",
    bioZh: "凌晨 3 点最嗨，大多数亏损发生在午夜后。",
    botScore: 19,
  },
];

export function findCommunityPet(id: string): CommunityPet | undefined {
  return COMMUNITY_PETS.find((p) => p.id === id);
}
