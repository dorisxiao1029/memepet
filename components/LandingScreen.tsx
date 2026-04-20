"use client";

import { useState, useEffect, useCallback } from "react";
import EggSVG, { type EggColor, type EggPhase } from "./EggSVG";
import { analyzeWallet, onboardPet } from "@/lib/pet-client";
import { createInitialState } from "@/lib/storage";
import type { PetState, Gender, WalletSummary } from "@/lib/types";

interface Props {
  onComplete: (state: PetState) => void;
}

// ── Hatching steps ────────────────────────────────────────────
const STEPS_EN = ["Parsing your description...", "Sculpting appearance...", "Injecting personality & goals...", "Preparing on-chain identity..."];
const STEPS_ZH = ["解析自然语言...", "生成外观...", "注入性格与目标...", "准备上链身份..."];
const PARTICLES  = ["✨", "⭐", "💫", "🌟", "🔥", "💎", "🚀", "🐾"];

// ── Personality quick-picks ───────────────────────────────────
const PERSONALITIES_EN = [
  { label: "Sarcastic Coach 🦊", value: "Brutally honest and sarcastic, but secretly caring. Calls out bad trades with dry humor." },
  { label: "Hype Friend 🐶",     value: "Always energetic and supportive. Celebrates every win, softens every loss with memes." },
  { label: "Wise Sensei 🦉",     value: "Calm and analytical. Gives measured advice based on data, never panics." },
];
const PERSONALITIES_ZH = [
  { label: "毒舌教练 🦊", value: "毒舌但关心我，用干幽默指出坏交易，在我赚钱时比我还开心。" },
  { label: "热血伙伴 🐶", value: "永远元气满满，为每次盈利欢呼，用梗图化解每次亏损。" },
  { label: "智慧导师 🦉", value: "冷静理性，用数据说话，从不慌乱，给出有依据的建议。" },
];

// ── Ready-made pets ───────────────────────────────────────────
const READY_PETS = [
  {
    emoji: "🐸", name: "Degen Pepe", eggColor: "pink" as EggColor,
    color: "#FF00AA", styleEn: "Sarcastic", styleZh: "毒舌",
    tagEn: "Meme-Trade Buddy", tagZh: "打狗嘴替",
    descEn: "Roasts chaotic entries, celebrates every brave green candle",
    descZh: "吐槽混乱买点，也为每根绿线狂喜",
    personality: "A sarcastic Pepe frog who reacts to every meme trade with crypto jokes, celebrates green candles loudly, and comforts losses without judging the user. Uses WAGMI/NGMI vocabulary naturally.",
    goals: ["Review every ape", "Celebrate green candles"],
  },
  {
    emoji: "🐕", name: "暖心柴犬", eggColor: "blue" as EggColor,
    color: "#00FFAA", styleEn: "Supportive", styleZh: "暖心",
    tagEn: "HODL Coach", tagZh: "持仓教练",
    descEn: "Warm hugs after losses, happy dances after wins",
    descZh: "亏损后给你拥抱，盈利时陪你庆祝",
    personality: "A warm supportive Shiba Inu that gives emotional support, celebrates every small trading win loudly, and gently reminds you to hold through dips without panic.",
    goals: ["Hold positions ≥2 weeks", "Review red candles together"],
  },
  {
    emoji: "🐺", name: "Wolf Sensei", eggColor: "blue" as EggColor,
    color: "#A78BFA", styleEn: "Analytical", styleZh: "冷静",
    tagEn: "Data Companion", tagZh: "数据陪伴",
    descEn: "Reads signals calmly and stays beside every candle",
    descZh: "冷静读信号，陪你看完每根 K 线",
    personality: "A cool analytical Wolf who speaks in data and probabilities. It keeps the user company through pumps and dips, explains signals clearly, and never grabs the steering wheel.",
    goals: ["Research before every trade", "Review exits calmly"],
  },
];

const FEATURES = [
  { icon: "🔥", titleEn: "Daily Meme Hot List",      titleZh: "每日热榜 meme 总结",   descEn: "Real-time analysis of four.meme trending tokens",  descZh: "实时解读 four.meme 热门代币" },
  { icon: "💪", titleEn: "Trade Companion",           titleZh: "交易情绪陪伴",         descEn: "Celebrates wins, comforts losses, stays beside the chart", descZh: "赚钱替你开心，亏损陪你缓一下" },
  { icon: "🏆", titleEn: "Celebrate Every Win",       titleZh: "交易小胜利庆祝",       descEn: "Every small progress deserves a celebration",       descZh: "每次进步都值得被庆祝" },
  { icon: "⛓",  titleEn: "On-Chain Growth & Evolve", titleZh: "链上成长进化",          descEn: "Mint EIP-8004 NFT to record your journey forever",  descZh: "铸造 EIP-8004 NFT 永久记录旅程" },
];

const MARKET_TAPE = [
  { symbol: "$BARK", move: "+42.8%", tone: "ticker-up" },
  { symbol: "$RUG", move: "-18.4%", tone: "ticker-down" },
  { symbol: "$PEPE", move: "HOT", tone: "ticker-hot" },
  { symbol: "BSC GAS", move: "LOW", tone: "ticker-up" },
  { symbol: "FOUR.MEME", move: "LIVE", tone: "ticker-hot" },
];

function buildWalletGoals(walletData: WalletSummary, isZh: boolean): string[] {
  const style = walletData.tradingDNA.tradingStyle;
  if (style === "holder") {
    return isZh
      ? ["陪我稳住持仓节奏", "盈利时一起庆祝"]
      : ["Keep me company while positions breathe", "Celebrate green trades together"];
  }
  if (style === "recovering") {
    return isZh
      ? ["亏损时陪我缓一下", "每次交易后一起复盘"]
      : ["Help me reset after red trades", "Review each trade together"];
  }
  if (style === "scalper") {
    return isZh
      ? ["陪我保持交易节奏", "小赚也要一起开心"]
      : ["Keep up with my trading rhythm", "Celebrate small wins too"];
  }
  if (style === "degen") {
    return isZh
      ? ["陪我打狗但保持情绪稳定", "挣钱了立刻一起狂喜"]
      : ["Ride meme trades with me", "Go full celebration mode when I win"];
  }
  return isZh
    ? ["从第一笔交易开始陪我成长", "把我的链上行为养成宠物"]
    : ["Grow with me from the first trade", "Turn my wallet behavior into pet energy"];
}

function buildWalletDescription(address: string, walletData: WalletSummary, isZh: boolean): string {
  const dna = walletData.tradingDNA;
  const intro = isZh
    ? "根据这个 BSC 钱包的链上交易行为孵化一个 trading-friendly meme pet。它陪用户打狗，赚钱时替用户开心，亏损时安慰用户，不评判、不替用户按按钮。"
    : "Hatch a trading-friendly meme pet from this BSC wallet behavior. It accompanies meme trading, celebrates wins, comforts losses, and should not judge the user or grab the steering wheel.";

  return `${intro}
Wallet: ${address}
Behavior summary: ${walletData.summary}
Trading DNA: ${dna.headline}
DNA tags: ${dna.tags.join(", ")}
Core vibe: ${dna.vibe}`;
}

// ── Gender options ────────────────────────────────────────────
const GENDER_OPTIONS: { value: Gender; icon: string; labelEn: string; labelZh: string }[] = [
  { value: "male",       icon: "♂",  labelEn: "Male",       labelZh: "男" },
  { value: "female",     icon: "♀",  labelEn: "Female",     labelZh: "女" },
  { value: "non-binary", icon: "⚧",  labelEn: "Non-binary", labelZh: "非二元" },
  { value: "mystery",    icon: "✨", labelEn: "Mystery",    labelZh: "神秘" },
];

// ── Personality tag groups ────────────────────────────────────
interface TagOption { value: string; labelEn: string; labelZh: string }

const TAG_GROUPS: { titleEn: string; titleZh: string; tags: TagOption[] }[] = [
  {
    titleEn: "MBTI", titleZh: "MBTI 性格",
    tags: ["INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
           "ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP"]
      .map(t => ({ value: t, labelEn: t, labelZh: t })),
  },
  {
    titleEn: "Trading Style", titleZh: "交易风格",
    tags: [
      { value: "Diamond Hands",  labelEn: "💎 Diamond Hands", labelZh: "💎 钻石手" },
      { value: "Paper Hands",    labelEn: "📄 Paper Hands",   labelZh: "📄 纸手" },
      { value: "Meme Hunter",    labelEn: "🐕 Meme Hunter",   labelZh: "🐕 土狗猎手" },
      { value: "Buy The Dip",    labelEn: "📉 Buy The Dip",   labelZh: "📉 逢跌必买" },
      { value: "All-In",         labelEn: "🎰 All-In",        labelZh: "🎰 梭哈选手" },
      { value: "Patient Hunter", labelEn: "🎯 Patient Hunter",labelZh: "🎯 耐心猎人" },
      { value: "Whale Watcher",  labelEn: "🐋 Whale Watcher", labelZh: "🐋 大户观察员" },
      { value: "Scalper",        labelEn: "🔁 Scalper",       labelZh: "🔁 短线高手" },
    ],
  },
  {
    titleEn: "Risk Profile", titleZh: "风险偏好",
    tags: [
      { value: "Conservative", labelEn: "🛡 Conservative", labelZh: "🛡 保守型" },
      { value: "Balanced",     labelEn: "⚖️ Balanced",    labelZh: "⚖️ 均衡型" },
      { value: "Aggressive",   labelEn: "⚡ Aggressive",   labelZh: "⚡ 激进型" },
    ],
  },
];

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

type Mode = null | "wallet" | "create" | "adopt";

export default function LandingScreen({ onComplete }: Props) {
  const [lang, setLang]           = useState<"en" | "zh">("en");
  const [mode, setMode]           = useState<Mode>(null);
  const [eggColor, setEggColor]   = useState<EggColor>("pink");
  const [petName, setPetName]     = useState("");
  const [quickPick, setQuickPick] = useState<number | null>(null);
  const [description, setDesc]    = useState("");
  const [gender, setGender]             = useState<Gender | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [phase, setPhase]               = useState<EggPhase>("form");
  const [hatchStep, setHatchStep]       = useState(0);
  const [error, setError]               = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletScanning, setWalletScanning] = useState(false);
  const [walletDNA, setWalletDNA] = useState<WalletSummary | null>(null);

  function toggleTag(value: string) {
    setSelectedTags(prev =>
      prev.includes(value)
        ? prev.filter(t => t !== value)
        : prev.length < 5 ? [...prev, value] : prev  // max 5 tags
    );
  }

  const isZh = lang === "zh";
  const steps = isZh ? STEPS_ZH : STEPS_EN;
  const personalities = isZh ? PERSONALITIES_ZH : PERSONALITIES_EN;

  const effectiveDesc = quickPick !== null
    ? `${personalities[quickPick].value}${description.trim() ? ` Additional: ${description.trim()}` : ""}`
    : description.trim();

  const accentColor = eggColor === "pink" ? "#FF00AA" : "#00AAFF";
  const accentGrad  = eggColor === "pink"
    ? "linear-gradient(135deg, #FF00AA, #A78BFA)"
    : "linear-gradient(135deg, #00AAFF, #00FFAA)";

  // Scroll to form when mode changes
  useEffect(() => {
    if (mode) {
      setTimeout(() => {
        document.getElementById("cta-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [mode]);

  const runHatch = useCallback(async (
    name: string | null, desc: string, color: EggColor, goals: string[],
    petGender?: Gender, petTags?: string[],
    walletSeed?: { address: string; summary: WalletSummary },
  ) => {
    setEggColor(color);
    setPhase("hatching");
    setHatchStep(0);
    const timers = [600, 1300, 2100].map((ms, i) => setTimeout(() => setHatchStep(i + 1), ms));
    try {
      const response = await onboardPet({ description: desc, goals, gender: petGender, personalityTags: petTags });
      timers.forEach(clearTimeout);
      setHatchStep(3);
      await delay(300);
      setPhase("cracking");
      await delay(1200);
      setPhase("done");
      await delay(900);
      const { pet } = response;
      const finalName = name?.trim() || pet.name;
      const finalTags = petTags ?? walletSeed?.summary.tradingDNA.tags;
      const finalState = createInitialState(
        finalName, pet.personality,
        walletSeed ? pet.emoji : color === "pink" ? "🌸" : "💙",
        pet.mood, goals, lang, pet.memeStyle,
        petGender ?? undefined,
        finalTags?.length ? finalTags : undefined,
        walletSeed?.summary.tradingDNA,
      );
      const walletState = walletSeed
        ? {
            ...finalState,
            walletAddress: walletSeed.address,
            walletSummary: walletSeed.summary.summary,
            walletAnalyzedAt: Date.now(),
          }
        : finalState;
      onComplete({ ...walletState, conversationHistory: [{ role: "assistant", content: pet.greeting, timestamp: Date.now(), reaction: "neutral" }] });
    } catch {
      timers.forEach(clearTimeout);
      setError(isZh ? "创建失败，请重试 😢" : "Hatching failed, please retry 😢");
      setPhase("form");
    } finally {
      setWalletScanning(false);
    }
  }, [lang, isZh, onComplete]);

  const handleCreateHatch = useCallback(() => {
    if (!petName.trim())  { setError(isZh ? "给你的 Pet 起个名字 🐾" : "Give your pet a name 🐾"); return; }
    if (!effectiveDesc)   { setError(isZh ? "描述一下性格吧 ✨" : "Describe its personality ✨"); return; }
    setError("");
    runHatch(petName.trim(), effectiveDesc, eggColor, [],
      gender ?? undefined,
      selectedTags.length ? selectedTags : undefined
    );
  }, [petName, effectiveDesc, eggColor, gender, selectedTags, runHatch, isZh]);

  const handleWalletHatch = useCallback(async () => {
    const address = walletAddress.trim();
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError(isZh ? "请输入有效的 BSC 钱包地址（0x...）" : "Enter a valid BSC wallet address (0x...)");
      return;
    }

    setError("");
    setWalletScanning(true);
    setWalletDNA(null);

    try {
      const summary = await analyzeWallet({ walletAddress: address });
      setWalletDNA(summary);
      await delay(700);

      const goals = buildWalletGoals(summary, isZh);
      const description = buildWalletDescription(address, summary, isZh);
      const egg: EggColor = summary.tradingDNA.petArchetype === "comfort" || summary.tradingDNA.petArchetype === "calm"
        ? "blue"
        : "pink";

      await runHatch(null, description, egg, goals, undefined, summary.tradingDNA.tags, {
        address,
        summary,
      });
    } catch {
      setError(isZh ? "钱包读取失败，换个地址或稍后再试" : "Wallet scan failed. Try another address or retry in a moment.");
      setWalletScanning(false);
    }
  }, [walletAddress, isZh, runHatch]);

  // ── Hatching overlay ──────────────────────────────────────────
  if (phase !== "form") {
    const dark = eggColor === "pink"
      ? { bg: "#2d0a1e, #1a0830, #0D0D1A", glow: "#FF00AA" }
      : { bg: "#0a1e2d, #081430, #0D0D1A", glow: "#00AAFF" };
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${dark.bg})` }}>
        {PARTICLES.map((p, i) => (
          <span key={i} className="absolute text-lg pointer-events-none select-none"
            style={{ left: `${8 + (i * 12) % 90}%`, bottom: `${10 + (i * 13) % 60}%`,
              animation: `particle-rise ${2.5 + (i % 3) * 0.8}s ${(i * 0.4) % 2}s ease-out infinite`, opacity: 0.6 }}>
            {p}
          </span>
        ))}
        <div className="absolute w-64 h-64 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: dark.glow }} />
        <div className={`relative z-10 transition-all duration-500
          ${phase === "cracking" ? "scale-125" : ""}
          ${phase === "done" ? "scale-140" : ""}
          ${phase === "hatching" ? "egg-float" : ""}`}
          style={{ width: 160, height: 200 }}>
          <EggSVG color={eggColor} phase={phase} />
        </div>
        <div className="text-center mt-6 mb-2 z-10 relative">
          <p className="text-2xl font-black text-white">
            {phase === "hatching" && (isZh ? `正在孵化...` : `Hatching...`)}
            {phase === "cracking" && (isZh ? "💥 破壳而出！" : "💥 Breaking free!")}
            {phase === "done"     && (isZh ? "🎉 诞生了！" : "🎉 Born!")}
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {isZh ? "你的 Trading Pet 正在破壳..." : "Your Trading Pet is emerging..."}
          </p>
        </div>
        <div className="z-10 relative w-full max-w-xs px-6 mt-5 space-y-2.5">
          {steps.map((label, i) => {
            const done = i <= hatchStep;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all duration-300 ${done ? "step-pop" : ""}`}
                  style={{ background: done ? dark.glow : "rgba(255,255,255,0.1)", color: done ? "#fff" : "rgba(255,255,255,0.3)" }}>
                  {done ? "✓" : i + 1}
                </div>
                <span className="text-xs font-semibold transition-all duration-300"
                  style={{ color: done ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="z-10 relative w-full max-w-xs px-6 mt-4">
          <div className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (hatchStep + 1) * 25)}%`, background: accentGrad }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col trader-shell" style={{ color: "#fff" }}>

      {/* Navbar */}
      <nav className="trader-nav sticky top-0 z-40 flex items-center justify-between px-5 sm:px-7 py-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🐾</span>
          <span className="font-black text-lg tracking-tight">Meme<span style={{ color: "#00FFAA" }}>Pet</span></span>
          <span className="hidden sm:inline-flex trader-chip trader-chip-hot text-[11px] px-2.5 py-1 font-signal">
            BSC MEME DESK
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-3 text-xs font-bold font-signal" style={{ color: "rgba(255,255,255,0.44)" }}>
            {["Wallet DNA", "Live Pulse", "Pet Growth"].map(l => (
              <span key={l} className="trader-chip px-2.5 py-1 hover:text-white/80 cursor-pointer transition-colors">{l}</span>
            ))}
          </div>
          <button onClick={() => setLang(isZh ? "en" : "zh")}
            className="text-xs px-3 py-1.5 rounded-full font-black transition-colors trader-action"
            style={{ color: "rgba(255,255,255,0.72)" }}>
            {isZh ? "EN" : "中文"}
          </button>
        </div>
      </nav>

      <div className="market-tape px-5 sm:px-7 py-2 text-[11px] font-black font-signal">
        <span className="text-white/35">LIVE MEME TAPE</span>
        {MARKET_TAPE.map(item => (
          <span key={item.symbol} className="ticker-pill">
            {item.symbol} <span className={item.tone}>{item.move}</span>
          </span>
        ))}
        <span className="hidden sm:inline text-white/30">Wallet behavior feeds the pet, not another boring chat box.</span>
      </div>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-5 sm:px-7 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12 items-center">
          <div className="text-left">
            <div className="inline-flex trader-chip trader-chip-hot text-xs px-4 py-1.5 mb-6 font-signal">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#FF00AA" }} />
              DoraHacks AI Sprint · four.meme Hackathon
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-[0.95] tracking-tight mb-5 max-w-4xl">
              {isZh ? (
                <>
                  <span className="text-white">你的钱包</span><br />
                  <span className="shimmer-text">孵化一只会打狗的 Pet</span>
                </>
              ) : (
                <>
                  <span className="text-white">Your wallet</span><br />
                  <span className="shimmer-text">hatches a meme-trading pet</span>
                </>
              )}
            </h1>
            <p className="text-base sm:text-xl max-w-2xl leading-relaxed mb-7" style={{ color: "rgba(238,245,255,0.62)" }}>
              {isZh
                ? "它不是大聊天框，也不是风控老师。它像交易桌边的小伙伴：读你的链上行为，跟着仓位变心情，赚钱替你开心，红了陪你回血。"
                : "Not another giant chat box. MemePet is a desk-side companion that reads wallet behavior, reacts to positions, celebrates green candles, and sits with you through red ones."}
            </p>

            <div className="grid grid-cols-3 gap-3 max-w-xl mb-7">
              {[
                [isZh ? "钱包 DNA" : "Wallet DNA", isZh ? "链上性格" : "On-chain traits"],
                [isZh ? "Live Pulse" : "Live Pulse", isZh ? "交易变状态" : "Trades change mood"],
                [isZh ? "Feed Market" : "Feed Market", isZh ? "热榜喂养" : "Hotlist as food"],
              ].map(([title, sub]) => (
                <div key={title} className="trader-terminal rounded-2xl px-3 py-3">
                  <div className="text-xs font-black font-signal" style={{ color: "#00FFAA" }}>{title}</div>
                  <div className="text-[11px] mt-1" style={{ color: "rgba(238,245,255,0.42)" }}>{sub}</div>
                </div>
              ))}
            </div>

            <div id="cta-section" className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
              {[
                {
                  key: "wallet" as const,
                  icon: "🔗",
                  title: isZh ? "钱包孵化" : "Wallet Hatch",
                  sub: isZh ? "推荐：最快 aha" : "Recommended aha",
                  active: mode === "wallet",
                  bg: "linear-gradient(135deg, #00FFAA, #FFD166)",
                  color: "#00FFAA",
                },
                {
                  key: "create" as const,
                  icon: "🥚",
                  title: isZh ? "自己创建" : "Create Pet",
                  sub: isZh ? "性格自定义" : "Custom personality",
                  active: mode === "create",
                  bg: "linear-gradient(135deg, #FF00AA, #A78BFA)",
                  color: "#FF00AA",
                },
                {
                  key: "adopt" as const,
                  icon: "⚡",
                  title: isZh ? "直接领养" : "Quick Adopt",
                  sub: isZh ? "一键开演示" : "Fastest demo path",
                  active: mode === "adopt",
                  bg: "linear-gradient(135deg, #00D4FF, #00FFAA)",
                  color: "#00D4FF",
                },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setMode(mode === item.key ? null : item.key)}
                  className="trader-action rounded-2xl px-4 py-4 text-left transition-all hover:scale-[1.025] active:scale-[0.98]"
                  style={{
                    background: item.active ? item.bg : "rgba(255,255,255,0.055)",
                    color: item.active ? "#061018" : item.color,
                    border: `1px solid ${item.active ? "rgba(255,255,255,0.25)" : `${item.color}55`}`,
                    boxShadow: item.active ? `0 0 34px ${item.color}44` : "none",
                  }}>
                  <span className="text-2xl block mb-2">{item.icon}</span>
                  <span className="block font-black text-base">{item.title}</span>
                  <span className="block text-xs font-bold opacity-70 mt-0.5">{item.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="trader-card rounded-[32px] p-5 sm:p-6">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: "#00FFAA" }}>PET COCKPIT</div>
                  <div className="text-sm font-bold text-white/45 mt-1">{isZh ? "交易员视角，而不是聊天产品视角" : "Built for traders, not chat tourists"}</div>
                </div>
                <span className="trader-chip trader-chip-green text-[11px] px-2.5 py-1 font-signal">BSC LIVE</span>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-4 items-center rounded-3xl p-4 trader-terminal mb-4">
                <div className="pet-orb w-24 h-24 rounded-[28px] flex items-center justify-center text-5xl">🐸</div>
                <div>
                  <div className="text-2xl font-black text-white">Degen Pepe</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="trader-chip trader-chip-hot text-[10px] px-2 py-0.5">Meme Hunter</span>
                    <span className="trader-chip trader-chip-green text-[10px] px-2 py-0.5">High Energy</span>
                  </div>
                  <p className="text-xs leading-relaxed mt-3 text-white/52">
                    {isZh ? "刚看到你买了 $BARK，我兴奋但不抢方向盘。绿色我庆祝，红色我陪你复盘。" : "I saw your $BARK buy. I get excited, but I do not grab the wheel. Green gets a party, red gets company."}
                  </p>
                </div>
              </div>

              <div className="rounded-3xl p-4 trader-terminal">
                {[
                  [isZh ? "Wallet DNA" : "Wallet DNA", isZh ? "Degen / Fast Paws / Meme Hunter" : "Degen / Fast Paws / Meme Hunter", "#00FFAA"],
                  [isZh ? "Last Pulse" : "Last Pulse", isZh ? "$BARK +32% · pet mood happy" : "$BARK +32% · pet mood happy", "#FFD166"],
                  [isZh ? "Vitals" : "Vitals", isZh ? "Energy 88 · Satiety 72 · Meme 64" : "Energy 88 · Satiety 72 · Meme 64", "#00D4FF"],
                ].map(([label, value, color]) => (
                  <div key={label} className="signal-row">
                    <span className="text-xs font-black font-signal text-white/35">{label}</span>
                    <span className="text-xs font-black text-right" style={{ color }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WALLET HATCH (on-chain DNA) ── */}
      {mode === "wallet" && (
        <section className="px-4 pb-10 flex justify-center">
          <div className="w-full max-w-xl">
            <div className="trader-card rounded-3xl p-0.5">
              <div className="relative z-10 rounded-[22px] p-6 space-y-5 trader-terminal">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isZh ? "用链上行为孵化" : "Hatch from on-chain behavior"}
                  </p>
                  <h2 className="text-2xl font-black text-white leading-tight">
                    {isZh ? "你的钱包就是宠物基因" : "Your wallet becomes pet DNA"}
                  </h2>
                  <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.48)" }}>
                    {isZh
                      ? "读取 BSC 交易节奏、meme 活跃度和持仓习惯，生成会陪你打狗、替你开心、亏了安慰你的 Pet。"
                      : "Scan BSC trading rhythm, meme activity, and hold habits to hatch a pet that rides trades with you."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider block" style={{ color: "rgba(255,255,255,0.35)" }}>
                    BSC Wallet
                  </label>
                  <input
                    value={walletAddress}
                    onChange={e => setWalletAddress(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !walletScanning) handleWalletHatch(); }}
                    placeholder="0x..."
                    className="w-full rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-white/20 focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(0,255,170,0.16)" }}
                  />
                </div>

                {walletDNA && (
                  <div className="rounded-2xl p-4 space-y-3"
                    style={{ background: "rgba(0,255,170,0.07)", border: "1px solid rgba(0,255,170,0.18)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "rgba(0,255,170,0.6)" }}>
                          Trading DNA
                        </p>
                        <p className="text-sm font-black text-white mt-1">{walletDNA.tradingDNA.headline}</p>
                      </div>
                      <div className="text-right text-xs font-bold uppercase" style={{ color: "#00FFAA" }}>
                        {walletDNA.tradingDNA.tradingStyle}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {walletDNA.tradingDNA.tags.map(tag => (
                        <span key={tag} className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm font-bold text-center" style={{ color: "#FF6B6B" }}>{error}</p>}

                <button
                  onClick={handleWalletHatch}
                  disabled={walletScanning}
                  className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 trader-action"
                  style={{
                    background: "linear-gradient(135deg, #00FFAA, #FFD166)",
                    color: "#0D0D1A",
                    boxShadow: "0 0 28px rgba(0,255,170,0.3)",
                  }}>
                  {walletScanning
                    ? (isZh ? "🔍 正在读取链上 DNA..." : "🔍 Reading on-chain DNA...")
                    : (isZh ? "🔗 扫描并孵化" : "🔗 Scan & Hatch")}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CREATE FORM (expandable) ── */}
      {mode === "create" && (
        <section className="px-4 pb-10 flex justify-center">
          <div className="w-full max-w-xl">
            <div className="trader-card rounded-3xl p-0.5">
              <div className="relative z-10 rounded-[22px] p-6 space-y-5 trader-terminal">

                {/* Egg picker */}
                <div>
                  <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isZh ? "选择宠物蛋" : "Choose your egg"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["pink", "blue"] as EggColor[]).map(c => {
                      const sel = eggColor === c;
                      const col = c === "pink" ? "#FF00AA" : "#00AAFF";
                      return (
                        <button key={c} onClick={() => setEggColor(c)}
                          className="trader-action flex items-center gap-3 p-3 rounded-2xl transition-all"
                          style={{
                            background: sel ? `${col}18` : "rgba(255,255,255,0.04)",
                            border: `2px solid ${sel ? col : "rgba(255,255,255,0.1)"}`,
                            boxShadow: sel ? `0 0 16px ${col}33` : "none",
                          }}>
                          <div style={{ width: 44, height: 56, flexShrink: 0 }}>
                            <EggSVG color={c} phase="form" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-black text-white">
                              {c === "pink" ? (isZh ? "粉色蛋 🌸" : "Pink Egg 🌸") : (isZh ? "蓝色蛋 💙" : "Blue Egg 💙")}
                            </div>
                            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                              {c === "pink" ? (isZh ? "温柔可爱型" : "Warm & Cute") : (isZh ? "酷帅理性型" : "Cool & Rational")}
                            </div>
                          </div>
                          {sel && <span className="ml-auto" style={{ color: col }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pet name */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isZh ? "宠物名字 ✏️" : "Pet Name ✏️"}
                  </label>
                  <input
                    value={petName}
                    onChange={e => setPetName(e.target.value)}
                    placeholder={isZh ? "例如：毛毛、CryptoFox、HODL 兔" : "e.g. Mochi, CryptoFox, HODL Bunny"}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white placeholder-white/25 focus:outline-none"
                    style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>

                {/* Personality */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isZh ? "性格 — 快速选择 or 自由描述" : "Personality — quick pick or free text"}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {personalities.map((p, i) => {
                      const sel = quickPick === i;
                      return (
                        <button key={i}
                          onClick={() => { setQuickPick(sel ? null : i); if (!sel) setDesc(""); }}
                          className="trader-action text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                          style={{
                            background: sel ? "rgba(255,0,170,0.25)" : "rgba(255,255,255,0.06)",
                            color: sel ? "#FF00AA" : "rgba(255,255,255,0.55)",
                            border: `1px solid ${sel ? "#FF00AA" : "rgba(255,255,255,0.12)"}`,
                          }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={description}
                    onChange={e => { setDesc(e.target.value); if (e.target.value) setQuickPick(null); }}
                    rows={2}
                    placeholder={quickPick !== null
                      ? (isZh ? "（可选）补充更多描述..." : "(Optional) Add more details...")
                      : (isZh ? "例如：毒舌但关心我的狐狸，赚钱时替我狂喜，亏了陪我嘴硬回血..." : "e.g. A sarcastic fox that celebrates wins and comforts red candles with memes...")}
                    className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white placeholder-white/25 focus:outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                </div>

                {/* ── Gender ── */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isZh ? "性别（可选）" : "Gender (optional)"}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {GENDER_OPTIONS.map(g => {
                      const sel = gender === g.value;
                      return (
                        <button key={g.value} onClick={() => setGender(sel ? null : g.value)}
                          className="trader-action flex flex-col items-center gap-1 py-2 rounded-xl transition-all text-xs font-bold"
                          style={{
                            background: sel ? `${accentColor}20` : "rgba(255,255,255,0.04)",
                            border: `1.5px solid ${sel ? accentColor : "rgba(255,255,255,0.1)"}`,
                            color: sel ? accentColor : "rgba(255,255,255,0.45)",
                          }}>
                          <span className="text-base">{g.icon}</span>
                          <span>{isZh ? g.labelZh : g.labelEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Personality Tags ── */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider block mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {isZh ? "性格标签（最多选 5 个）" : "Personality Tags (up to 5)"}
                  </label>
                  <p className="text-[11px] mb-3" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {selectedTags.length > 0
                      ? selectedTags.join(" · ")
                      : (isZh ? "选择标签，宠物会根据你的性格调整风格" : "Tags shape how your pet talks to you")}
                  </p>
                  <div className="space-y-3">
                    {TAG_GROUPS.map(group => (
                      <div key={group.titleEn}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1.5"
                          style={{ color: "rgba(255,255,255,0.22)" }}>
                          {isZh ? group.titleZh : group.titleEn}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.tags.map(tag => {
                            const sel = selectedTags.includes(tag.value);
                            return (
                              <button key={tag.value} onClick={() => toggleTag(tag.value)}
                                className="trader-action text-[11px] font-bold px-2.5 py-1 rounded-full transition-all"
                                style={{
                                  background: sel ? `${accentColor}25` : "rgba(255,255,255,0.05)",
                                  border: `1px solid ${sel ? accentColor : "rgba(255,255,255,0.1)"}`,
                                  color: sel ? accentColor : "rgba(255,255,255,0.4)",
                                  opacity: !sel && selectedTags.length >= 5 ? 0.35 : 1,
                                }}>
                                {isZh ? tag.labelZh : tag.labelEn}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="text-sm font-bold text-center" style={{ color: "#FF6B6B" }}>{error}</p>}

                <button
                  onClick={handleCreateHatch}
                  className="w-full py-4 rounded-2xl font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98] trader-action"
                  style={{
                    background: "linear-gradient(135deg, #FF00AA, #A78BFA)",
                    color: "#fff",
                    boxShadow: "0 0 28px rgba(255,0,170,0.4)",
                  }}>
                  🥚 {isZh ? "开始孵化！" : "Hatch Now!"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── ADOPT (ready-made pets) ── */}
      {mode === "adopt" && (
        <section className="px-4 pb-10 flex justify-center">
          <div className="w-full max-w-3xl">
            <p className="text-center text-sm mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
              {isZh ? "点击任意一只，立即孵化 👇" : "Click any pet to hatch instantly 👇"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {READY_PETS.map(pet => (
                <button
                  key={pet.name}
                  onClick={() => runHatch(pet.name, pet.personality, pet.eggColor, pet.goals)}
                  className="trader-card rounded-3xl p-0.5 text-left transition-all hover:scale-[1.03] active:scale-[0.97] group"
                  style={{ background: `linear-gradient(135deg, ${pet.color}66, ${pet.color}22)` }}>
                  <div className="relative z-10 rounded-[22px] p-5 h-full flex flex-col gap-3 trader-terminal">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{pet.emoji}</span>
                      <div>
                        <div className="font-black text-white text-base">{pet.name}</div>
                        <div className="text-xs px-2 py-0.5 rounded-full inline-block mt-0.5 font-bold"
                          style={{ background: `${pet.color}22`, color: pet.color, border: `1px solid ${pet.color}44` }}>
                          {isZh ? pet.styleZh : pet.styleEn}
                        </div>
                      </div>
                    </div>
                    {/* Tag */}
                    <div className="text-xs font-black" style={{ color: pet.color }}>
                      {isZh ? pet.tagZh : pet.tagEn}
                    </div>
                    {/* Description */}
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {isZh ? pet.descZh : pet.descEn}
                    </p>
                    {/* Goals */}
                    <div className="space-y-1 mt-auto">
                      {pet.goals.map(g => (
                        <div key={g} className="flex items-center gap-1.5 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          <span style={{ color: pet.color }}>✓</span>{g}
                        </div>
                      ))}
                    </div>
                    {/* CTA */}
                    <div
                      className="mt-2 w-full py-2.5 rounded-xl text-center text-sm font-black transition-all group-hover:opacity-100 opacity-80"
                      style={{ background: `${pet.color}22`, color: pet.color, border: `1px solid ${pet.color}44` }}>
                      {isZh ? "⚡ 立即孵化" : "⚡ Hatch Now"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="px-6 py-10 border-t border-white/8 mt-4" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-xl font-black mb-6">
            {isZh ? "你的 Pet 会做什么？" : "What does your Pet do?"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {FEATURES.map(f => (
              <div key={f.icon} className="rounded-2xl p-4 flex flex-col gap-2"
                style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                <span className="text-2xl">{f.icon}</span>
                <div className="text-xs font-bold text-white">{f.titleEn}</div>
                <div className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>{f.titleZh}</div>
                <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{f.descEn} / {f.descZh}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-5 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs"
        style={{ color: "rgba(255,255,255,0.28)" }}>
        <div className="flex items-center gap-2">
          <span>🐾 MemePet</span>
          <span>·</span>
          <span className="px-2 py-0.5 rounded-full" style={{ background: "rgba(255,0,170,0.12)", color: "#FF00AA" }}>
            DoraHacks AI Sprint
          </span>
          <span>·</span>
          <span>Built on four.meme × BSC</span>
        </div>
        <div className="flex gap-4">
          <span className="hover:text-white/50 cursor-pointer transition-colors">GitHub</span>
          <span className="hover:text-white/50 cursor-pointer transition-colors">{isZh ? "演示视频" : "Demo Video"}</span>
        </div>
      </footer>
    </div>
  );
}
