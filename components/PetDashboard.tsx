"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { chatWithPet } from "@/lib/pet-client";
import { appendMessage, applyXp, calcXpDelta, feedPet } from "@/lib/storage";
import type { PetState, Message, Mood, Reaction, WalletSummary } from "@/lib/types";
import WalletConnect from "./WalletConnect";

interface Props {
  petState: PetState;
  onStateUpdate: (state: PetState) => void;
  onReset: () => void;
}

interface RankingToken {
  name: string; symbol: string;
  day1Increase: number; day1Vol: number;
  holders: number;
}

interface NewsContext {
  context: string;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  sentimentScore: number;
  tweets: { handle?: string; author?: string; content?: string }[];
  freeNews: { title?: string; signal?: string }[];
}

interface MarketSnack {
  label: string;
  symbol: string;
  changePct: number;
  sentiment: NewsContext["sentiment"];
  sentimentScore: number;
  newsTitle?: string;
}

type TradePulseKind = "buy" | "profit" | "loss" | "exit";

interface TradePulseEvent {
  kind: TradePulseKind;
  icon: string;
  labelEn: string;
  labelZh: string;
  detailEn: string;
  detailZh: string;
  token: string;
  move: string;
  color: string;
  vitals: { energy: number; satiety: number; memeScore: number };
  xp: number;
  mood: Mood;
  reaction: Reaction;
}

const TRADE_PULSE_EVENTS: TradePulseEvent[] = [
  {
    kind: "buy",
    icon: "🐾",
    labelEn: "Ape In",
    labelZh: "刚买入",
    detailEn: "0.4 BNB into $BARK",
    detailZh: "0.4 BNB 冲 $BARK",
    token: "$BARK",
    move: "0.4 BNB",
    color: "#FFD166",
    vitals: { energy: 14, satiety: -5, memeScore: 12 },
    xp: 10,
    mood: "happy",
    reaction: "encouragement",
  },
  {
    kind: "profit",
    icon: "🟢",
    labelEn: "+32% Green",
    labelZh: "+32% 变绿",
    detailEn: "$BARK position is up",
    detailZh: "$BARK 仓位盈利",
    token: "$BARK",
    move: "+32%",
    color: "#00FFAA",
    vitals: { energy: 18, satiety: 8, memeScore: 10 },
    xp: 18,
    mood: "happy",
    reaction: "encouragement",
  },
  {
    kind: "loss",
    icon: "🔴",
    labelEn: "-27% Red",
    labelZh: "-27% 变红",
    detailEn: "$RUG got rough",
    detailZh: "$RUG 有点难顶",
    token: "$RUG",
    move: "-27%",
    color: "#FF6B6B",
    vitals: { energy: -14, satiety: -10, memeScore: 5 },
    xp: 8,
    mood: "disappointed",
    reaction: "neutral",
  },
  {
    kind: "exit",
    icon: "🧘",
    labelEn: "Exit Trade",
    labelZh: "卖出离场",
    detailEn: "Wallet cooled down",
    detailZh: "钱包冷静下来",
    token: "$MOON",
    move: "closed",
    color: "#00D4FF",
    vitals: { energy: 4, satiety: 5, memeScore: 2 },
    xp: 9,
    mood: "neutral",
    reaction: "neutral",
  },
];

const DASHBOARD_TAPE = [
  { label: "BSC", value: "LIVE", tone: "ticker-up" },
  { label: "$BARK", value: "+32%", tone: "ticker-up" },
  { label: "$RUG", value: "-27%", tone: "ticker-down" },
  { label: "four.meme", value: "HOT", tone: "ticker-hot" },
  { label: "PET MOOD", value: "SYNC", tone: "ticker-hot" },
];

// ── Confetti ──────────────────────────────────────────────────────
const CONFETTI_COLORS = ["#FF00AA", "#00FFAA", "#A78BFA", "#FFD700", "#FF6B6B", "#00D4FF"];
function Confetti() {
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: (i * 2.1) % 100,
    delay: (i * 0.08) % 2.5,
    duration: 2.2 + (i % 5) * 0.4,
    size: 6 + (i % 5) * 2,
    shape: i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0%",
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <div key={p.id} className="absolute" style={{
          left: `${p.left}%`, top: "-20px",
          width: p.size, height: p.size,
          background: p.color, borderRadius: p.shape,
          animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

// ── Mood helpers ──────────────────────────────────────────────────
const MOOD_EMOJI: Record<string, string> = {
  happy: "😄", neutral: "😐", disappointed: "😔", skeptical: "🤨",
};

function clampVital(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function buildMarketSnackMessage(
  petState: PetState,
  snack: MarketSnack | null,
  gains: { energy: number; satiety: number; memeScore: number; xp: number }
): string {
  const zh = petState.lang === "zh";
  const style = petState.tradingDNA?.tradingStyle ?? "meme";

  if (!snack) {
    return zh
      ? `我吃了一口备用市场零食，先补充体力。精力 +${gains.energy}，饱食 +${gains.satiety}，Meme 指数 +${gains.memeScore}。等热榜回来我再陪你闻新狗。`
      : `I ate a backup market snack and got my paws moving. Energy +${gains.energy}, satiety +${gains.satiety}, meme score +${gains.memeScore}. When the hot list wakes up, I will sniff fresh dogs with you.`;
  }

  const direction = snack.changePct >= 0 ? "+" : "";
  const move = `${snack.label}(${snack.symbol}) ${direction}${snack.changePct.toFixed(1)}%`;
  const spicy = snack.changePct > 80 || snack.sentiment === "BULLISH";
  const sour = snack.changePct < -10 || snack.sentiment === "BEARISH";

  if (zh) {
    if (sour) {
      return `我刚吃了 ${move} 这口市场零食，有点酸，但不难吃。精力 +${gains.energy}，饱食 +${gains.satiety}。红的时候我陪你扛，别一个人硬撑。`;
    }
    if (spicy) {
      return `我刚吃了 ${move}，辣到耳朵发光。精力 +${gains.energy}，Meme 指数 +${gains.memeScore}。${style === "degen" ? "这口很打狗，我醒了。" : "我陪你看，但我们开心点不失控。"}`;
    }
    return `我刚吃了 ${move}，味道刚刚好。精力 +${gains.energy}，饱食 +${gains.satiety}。今天我坐你旁边陪你看盘。`;
  }

  if (sour) {
    return `I just ate ${move}. A little sour, still useful. Energy +${gains.energy}, satiety +${gains.satiety}. Red candles happen, I am staying next to you.`;
  }
  if (spicy) {
    return `I just ate ${move} and my ears lit up. Energy +${gains.energy}, meme score +${gains.memeScore}. ${style === "degen" ? "That was a proper dog-sniff snack." : "I am excited, but I am keeping you company, not yelling orders."}`;
  }
  return `I just ate ${move}. Nice balanced market snack. Energy +${gains.energy}, satiety +${gains.satiety}. I am parked beside your chart.`;
}

function buildTradePulseMessage(petState: PetState, event: TradePulseEvent): string {
  const zh = petState.lang === "zh";
  const name = petState.name;
  const energy = formatDelta(event.vitals.energy);
  const satiety = formatDelta(event.vitals.satiety);
  const meme = formatDelta(event.vitals.memeScore);
  const style = petState.tradingDNA?.tradingStyle ?? "quiet";

  if (zh) {
    if (event.kind === "buy") {
      return `链上脉搏来了：我看到你刚碰了 ${event.token}（${event.move}）。${style === "degen" ? "这味儿很打狗，我耳朵已经竖起来了。" : "我不替你按按钮，但我会坐在图表旁边陪你看。"} 精力 ${energy}，饱食 ${satiety}，Meme 指数 ${meme}。`;
    }
    if (event.kind === "profit") {
      return `${event.token} 变绿 ${event.move}！${name} 的尾巴已经开始转圈。挣钱了就该有人替你开心，但我不会抢你的方向盘。精力 ${energy}，XP +${event.xp}。`;
    }
    if (event.kind === "loss") {
      return `${event.token} 红了 ${event.move}，先别一个人硬扛。我把灯调暗一点，陪你复盘：这不是人格审判，只是一笔交易。精力 ${energy}，饱食 ${satiety}，但诚实面对也有 XP +${event.xp}。`;
    }
    return `我看到你从 ${event.token} 离场了。钱包安静下来，我也跟着慢慢呼吸。我们把这笔放进记忆，不评判，等下一只狗出现。饱食 ${satiety}，XP +${event.xp}。`;
  }

  if (event.kind === "buy") {
    return `Chain pulse: I saw you touch ${event.token} (${event.move}). ${style === "degen" ? "That smells like fresh dog season, my ears are up." : "I am not grabbing the wheel, I am sitting beside the chart with you."} Energy ${energy}, satiety ${satiety}, meme score ${meme}.`;
  }
  if (event.kind === "profit") {
    return `${event.token} is green ${event.move}! ${name}'s tail is spinning. You deserve someone celebrating the win, without stealing the steering wheel. Energy ${energy}, XP +${event.xp}.`;
  }
  if (event.kind === "loss") {
    return `${event.token} is red ${event.move}. You do not have to hold that alone. I am dimming the lights and staying for the review. It is one trade, not a verdict on you. Energy ${energy}, satiety ${satiety}, XP +${event.xp} for facing it.`;
  }
  return `I saw you exit ${event.token}. Wallet cooled down, so I am breathing slower too. We log it, no judgment, and wait for the next dog to bark. Satiety ${satiety}, XP +${event.xp}.`;
}

export default function PetDashboard({ petState, onStateUpdate, onReset }: Props) {
  // ── Stale-closure fix: keep a ref that always tracks latest petState ──
  const petStateRef = useRef<PetState>(petState);
  useEffect(() => { petStateRef.current = petState; });

  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const [showWalletPanel, setShowWalletPanel] = useState(false);
  const [xpPopup, setXpPopup]         = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [showConfetti, setShowConfetti]   = useState(false);
  const [leftOpen, setLeftOpen]       = useState(true);
  const [feedingMarket, setFeedingMarket] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [lastTradePulse, setLastTradePulse] = useState<TradePulseEvent | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  // "Start Petting" gate — show welcome screen if the user has never sent a message
  const hasUserMessages = petState.conversationHistory.some(m => m.role === "user");
  const [chatStarted, setChatStarted] = useState(hasUserMessages);

  // Pending quick-start message: set before calling setChatStarted(true)
  const pendingQuickRef = useRef<string | null>(null);
  const didFirePending  = useRef(false);

  // ── 6551 MCP news context cache ────────────────────────────────
  // Pre-fetched in background; auto-included in every AI call so
  // the pet can reference live market data even on free-text messages.
  const newsCtxCache    = useRef<string>("");
  const newsCtxFetchedAt = useRef<number>(0);
  const NEWS_TTL_MS     = 2 * 60 * 1000; // refresh every 2 min

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const eggColor      = petState.emoji === "💙" ? "blue" : "pink";
  const accentColor   = eggColor === "pink" ? "#FF00AA" : "#00AAFF";
  const accentGradient = eggColor === "pink"
    ? "linear-gradient(135deg, #FF00AA, #A78BFA)"
    : "linear-gradient(135deg, #00AAFF, #00FFAA)";

  // Confetti for brand-new pet (no user messages yet)
  const wasNewPet = useRef(!hasUserMessages);
  useEffect(() => {
    if (wasNewPet.current) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    setShareUrl(window.location.origin);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [petState.conversationHistory]);

  // ── Background news context pre-fetch ─────────────────────────
  // Silently refreshes every 2 min so every chat message is market-aware
  async function refreshNewsCtx() {
    if (Date.now() - newsCtxFetchedAt.current < NEWS_TTL_MS) return; // still fresh
    try {
      const res = await fetch("/api/pet/news-context");
      if (res.ok) {
        const data: NewsContext = await res.json();
        newsCtxCache.current    = data.context ?? "";
        newsCtxFetchedAt.current = Date.now();
      }
    } catch { /* silent — stale cache is fine */ }
  }

  // Pre-fetch as soon as chat opens, then keep refreshing
  useEffect(() => {
    if (!chatStarted) return;
    refreshNewsCtx();
    const id = setInterval(refreshNewsCtx, NEWS_TTL_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStarted]);

  // Fire pending quick-start message after chatStarted becomes true
  useEffect(() => {
    if (chatStarted && pendingQuickRef.current && !didFirePending.current) {
      didFirePending.current = true;
      const msg = pendingQuickRef.current;
      pendingQuickRef.current = null;
      setTimeout(() => sendMessage(msg), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStarted]);

  function startChat(quickMsg?: string) {
    if (quickMsg) {
      didFirePending.current = false;
      pendingQuickRef.current = quickMsg;
    }
    setChatStarted(true);
    setShowChatPanel(true);
    setTimeout(() => inputRef.current?.focus(), 200);
  }

  // ── Core send function using petStateRef to avoid stale closure ──
  // newsCtx: optional live market context from 6551 MCP, injected into system prompt
  const sendMessage = useCallback(async (text?: string, newsCtx?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    if (!text) setInput("");
    setSending(true);

    const current = petStateRef.current;
    const userMsg: Message = { role: "user", content: msg, timestamp: Date.now() };
    let updated = appendMessage(current, userMsg);
    onStateUpdate(updated);

    try {
      // Explicit newsCtx (e.g. from Market Pulse) takes priority;
      // fall back to background-cached context so every message is market-aware
      const resolvedNewsCtx = newsCtx ?? (newsCtxCache.current || undefined);

      const response = await chatWithPet({
        message: msg,
        petState: updated,
        goals: updated.goals,
        conversationHistory: updated.conversationHistory.slice(-20),
        walletSummary: updated.walletSummary,
        newsContext: resolvedNewsCtx,
      });

      const assistantMsg: Message = {
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
        reaction: response.reaction,
      };
      updated = appendMessage(updated, assistantMsg);

      if (response.xpDelta) {
        const prevLevel = updated.level;
        updated = applyXp(updated, response.xpDelta, response.moodUpdate as Mood | undefined);
        setXpPopup(response.xpDelta);
        setTimeout(() => setXpPopup(null), 1800);
        if (updated.level > prevLevel) {
          setLevelUpFlash(true);
          setTimeout(() => setLevelUpFlash(false), 3000);
        }
      } else if (response.moodUpdate) {
        updated = { ...updated, mood: response.moodUpdate };
      }

      // Restore vitals: chatting feeds the pet
      const MEME_KW = ["meme","pepe","doge","shib","pump","rug","degen","ape","moon","four.meme","bonk","wif","memecoin","trending","fomo","ngmi","wagmi"];
      const isMemeMsg = MEME_KW.some(k => msg.toLowerCase().includes(k));
      updated = feedPet(updated, { energy: 5, satiety: 8, memeScore: isMemeMsg ? 3 : 1 });
      onStateUpdate(updated);
    } catch {
      const errMsg: Message = {
        role: "assistant",
        content: "😢 Something went wrong — please try again.",
        timestamp: Date.now(),
      };
      onStateUpdate(appendMessage(updated, errMsg));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, onStateUpdate]);

  async function handleWalletConnected(address: string, walletData: WalletSummary) {
    const updated: PetState = {
      ...petStateRef.current,
      walletAddress: address,
      walletSummary: walletData.summary,
      walletAnalyzedAt: Date.now(),
    };
    onStateUpdate(updated);
    setShowWalletPanel(false);
    if (!chatStarted) setChatStarted(true);
    await sendMessage("I just connected my wallet — please comment on my trading history. / 我刚连接了钱包，请根据我的交易记录说说看。");
  }

  async function handleTodayRankings() {
    // Parallel: four.meme rankings + 6551 news context for richer AI response
    if (!chatStarted) startChat();
    try {
      const [rankResult, newsResult] = await Promise.allSettled([
        fetch("/api/pet/rankings"),
        fetch("/api/pet/news-context"),
      ]);

      let prompt = "";
      let newsCtx = "";

      if (rankResult.status === "fulfilled" && rankResult.value.ok) {
        const { tokens }: { tokens: RankingToken[] } = await rankResult.value.json();
        const lines = tokens.map((tk, i) =>
          `${i + 1}. ${tk.name}(${tk.symbol}) ${tk.day1Increase >= 0 ? "+" : ""}${tk.day1Increase.toFixed(1)}% | $${(tk.day1Vol / 1000).toFixed(0)}K vol | ${tk.holders} holders`
        ).join("\n");
        prompt = petState.lang === "zh"
          ? `今天 four.meme 热榜 Top5:\n${lines}\n\n请用你的性格点评，结合我的目标，80字以内。`
          : `Today's four.meme Hot Top5:\n${lines}\n\nComment in your personality, tie to my goals. Under 80 words.`;
      }

      if (newsResult.status === "fulfilled" && newsResult.value.ok) {
        const news: NewsContext = await newsResult.value.json();
        newsCtx = news.context;
      }

      if (prompt) await sendMessage(prompt, newsCtx || undefined);
    } catch { /* silent */ }
  }

  async function handleMarketPulse() {
    if (!chatStarted) startChat();
    try {
      const res = await fetch("/api/pet/news-context");
      if (!res.ok) return;
      const data: NewsContext = await res.json();

      const sentEmoji = data.sentiment === "BULLISH" ? "🟢" : data.sentiment === "BEARISH" ? "🔴" : "🟡";
      const prompt = petState.lang === "zh"
        ? `市场脉搏报告！${sentEmoji} 当前市场情绪：${data.sentiment}（AI综合评分 ${data.sentimentScore}/100）。\n请用你的风格帮我解读，结合我的目标，100字以内。`
        : `Market pulse check! ${sentEmoji} Sentiment: ${data.sentiment} (AI score ${data.sentimentScore}/100).\nGive me your take under 100 words, tied to my goals.`;

      await sendMessage(prompt, data.context || undefined);
    } catch { /* silent */ }
  }

  async function handleFeedMarket() {
    if (feedingMarket || sending) return;
    setFeedingMarket(true);

    try {
      const [rankResult, newsResult] = await Promise.allSettled([
        fetch("/api/pet/rankings"),
        fetch("/api/pet/news-context"),
      ]);

      let topToken: RankingToken | null = null;
      let news: NewsContext | null = null;

      if (rankResult.status === "fulfilled" && rankResult.value.ok) {
        const data: { tokens: RankingToken[] } = await rankResult.value.json();
        topToken = data.tokens?.[0] ?? null;
      }

      if (newsResult.status === "fulfilled" && newsResult.value.ok) {
        news = await newsResult.value.json();
        newsCtxCache.current = news?.context ?? "";
        newsCtxFetchedAt.current = Date.now();
      }

      const snack: MarketSnack | null = topToken
        ? {
            label: topToken.name,
            symbol: topToken.symbol,
            changePct: topToken.day1Increase,
            sentiment: news?.sentiment ?? "NEUTRAL",
            sentimentScore: news?.sentimentScore ?? 50,
            newsTitle: news?.freeNews?.[0]?.title,
          }
        : null;

      const spicy = (snack?.changePct ?? 0) > 80 || snack?.sentiment === "BULLISH";
      const sour = (snack?.changePct ?? 0) < -10 || snack?.sentiment === "BEARISH";
      const gains = {
        energy: spicy ? 12 : sour ? 5 : 8,
        satiety: spicy ? 18 : 14,
        memeScore: spicy ? 10 : sour ? 4 : 6,
        xp: spicy ? 12 : 8,
      };

      const prevLevel = petStateRef.current.level;
      let updated = feedPet(petStateRef.current, {
        energy: gains.energy,
        satiety: gains.satiety,
        memeScore: gains.memeScore,
      });
      updated = applyXp(updated, gains.xp, sour ? "skeptical" : "happy");
      const assistantMsg: Message = {
        role: "assistant",
        content: buildMarketSnackMessage(updated, snack, gains),
        timestamp: Date.now(),
        reaction: sour ? "neutral" : "encouragement",
      };
      updated = appendMessage(updated, assistantMsg);

      setXpPopup(gains.xp);
      setTimeout(() => setXpPopup(null), 1800);
      if (updated.level > prevLevel) {
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 3000);
      }
      if (spicy) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2400);
      }
      onStateUpdate(updated);
    } catch {
      const gains = { energy: 4, satiety: 8, memeScore: 2, xp: 4 };
      const prevLevel = petStateRef.current.level;
      let updated = feedPet(petStateRef.current, gains);
      updated = applyXp(updated, gains.xp, "neutral");
      updated = appendMessage(updated, {
        role: "assistant",
        content: buildMarketSnackMessage(updated, null, gains),
        timestamp: Date.now(),
        reaction: "neutral",
      });
      if (updated.level > prevLevel) {
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 3000);
      }
      onStateUpdate(updated);
    } finally {
      setFeedingMarket(false);
    }
  }

  function handleTradePulse(event: TradePulseEvent) {
    const current = petStateRef.current;
    const prevLevel = current.level;
    const withVitals: PetState = {
      ...current,
      energy: clampVital((current.energy ?? 90) + event.vitals.energy),
      satiety: clampVital((current.satiety ?? 90) + event.vitals.satiety),
      memeScore: clampVital((current.memeScore ?? 0) + event.vitals.memeScore),
    };

    let updated = applyXp(withVitals, event.xp, event.mood);
    updated = appendMessage(updated, {
      role: "assistant",
      content: buildTradePulseMessage(updated, event),
      timestamp: Date.now(),
      reaction: event.reaction,
    });

    setLastTradePulse(event);
    setChatStarted(true);
    setXpPopup(event.xp);
    setTimeout(() => setXpPopup(null), 1800);

    if (updated.level > prevLevel) {
      setLevelUpFlash(true);
      setTimeout(() => setLevelUpFlash(false), 3000);
    }

    if (event.kind === "profit" || event.kind === "buy") {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2200);
    }

    onStateUpdate(updated);
  }

  async function handleMintIdentity() {
    setRegistering(true);
    setShowMintModal(false);
    try {
      const res = await fetch("/api/pet/register-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          petName: petState.name,
          personality: petState.personality,
          emoji: petState.emoji,
        }),
      });
      const data = await res.json();
      if (data.agentId != null) {
        const updated: PetState = { ...petStateRef.current, agentId: data.agentId };
        onStateUpdate(updated);
        if (!chatStarted) startChat();
        await sendMessage(
          petState.lang === "zh"
            ? `链上身份已铸造！Agent ID #${data.agentId} ✨ tx: ${data.txHash?.slice(0, 10)}...`
            : `On-chain identity minted! Agent ID #${data.agentId} ✨ tx: ${data.txHash?.slice(0, 10)}...`
        );
      } else {
        // Show failure as a chat message so user knows what happened
        if (!chatStarted) startChat();
        await sendMessage(
          petState.lang === "zh"
            ? "铸造失败，可能是钱包余额不足或网络问题。/ Mint failed — may need BNB for gas."
            : "Identity minting failed — wallet may need BNB for gas."
        );
      }
    } catch {
      // silent — registering flag will be cleared in finally
    } finally {
      setRegistering(false);
    }
  }

  // ── Goal completion handlers ──────────────────────────────────
  function resolveGoal(goalId: string, outcome: "hit" | "missed") {
    const goal = petStateRef.current.goals.find(g => g.id === goalId);
    if (!goal) return;
    const updatedGoals = petStateRef.current.goals.map(g =>
      g.id === goalId ? { ...g, status: outcome, resolvedAt: Date.now() } : g
    );
    const delta = calcXpDelta(outcome === "hit" ? "goal_hit" : "goal_miss");
    const mood  = outcome === "hit" ? "happy" : "disappointed";
    const prevLevel = petStateRef.current.level;
    const updated   = applyXp({ ...petStateRef.current, goals: updatedGoals }, delta, mood as "happy" | "disappointed");
    onStateUpdate(updated);

    // Goal completion also restores vitals
    const vitalDelta = outcome === "hit"
      ? { energy: 20, satiety: 25, memeScore: 2 }
      : { energy: 5,  satiety: 5  };
    const withVitals = feedPet(updated, vitalDelta);
    onStateUpdate(withVitals);

    if (delta > 0) {
      setXpPopup(delta);
      setTimeout(() => setXpPopup(null), 1800);
    }
    if (withVitals.level > prevLevel) {
      setLevelUpFlash(true);
      setTimeout(() => setLevelUpFlash(false), 3000);
    }
    if (!chatStarted) startChat();
    const zh = petState.lang === "zh";
    const msg = outcome === "hit"
      ? (zh ? `目标完成了！"${goal.text}" ✅ 给我庆祝一下！` : `Goal completed! "${goal.text}" ✅ Celebrate with me!`)
      : (zh ? `这次没完成目标："${goal.text}"，但我诚实承认了 ❌` : `Missed this goal: "${goal.text}" — being honest about it ❌`);
    setTimeout(() => sendMessage(msg), 100);
  }

  const activeGoals  = petState.goals.filter(g => g.status === "active");
  const doneGoals    = petState.goals.filter(g => g.status === "hit");
  const xpPct        = Math.min(100, petState.xp % 100);
  const moodEmoji    = MOOD_EMOJI[petState.mood] ?? "😐";
  const greeting     = [...petState.conversationHistory].reverse().find(m => m.role === "assistant")?.content ?? "";
  const showHatchIntro = true;

  // Pet mood decay: if ignored > 24h show "missing you" badge
  const hoursSince   = (Date.now() - petState.lastInteractionAt) / 3_600_000;
  const petIsMissing = hoursSince > 24;

  // Live vitals with time decay applied for display
  const liveEnergy  = Math.max(0, Math.round((petState.energy  ?? 90) - hoursSince * 2.5));
  const liveSatiety = Math.max(0, Math.round((petState.satiety ?? 90) - hoursSince * 3.75));
  const liveMeme    = Math.min(100, Math.round(petState.memeScore ?? 0));
  const energyColor  = liveEnergy  > 60 ? "#00FFAA" : liveEnergy  > 30 ? "#FFD700" : "#FF6B6B";
  const satietyColor = liveSatiety > 60 ? "#00AAFF" : liveSatiety > 30 ? "#FFD700" : "#FF6B6B";

  // Level decoration overlaid on avatar at milestones
  const LEVEL_DECOR: Record<number, string> = { 3: "👑", 5: "✨", 7: "🔥", 10: "🦋" };
  const levelDecor   = Object.entries(LEVEL_DECOR)
    .filter(([lvl]) => petState.level >= Number(lvl))
    .map(([, d]) => d).slice(-1)[0] ?? ""; // show highest earned

  if (showHatchIntro) {
    const zh = petState.lang === "zh";
    const dna = petState.tradingDNA;
    const introTags = [
      petState.memeStyle,
      ...(dna?.tags ?? petState.personalityTags ?? []),
    ].filter(Boolean).slice(0, 4) as string[];
    return (
      <div className="min-h-screen trader-shell flex flex-col" style={{ color: "#fff" }}>
        {showConfetti && <Confetti />}

        {xpPopup !== null && (
          <div className="fixed top-16 right-4 z-50 pointer-events-none"
            style={{ animation: "step-pop 0.4s ease" }}>
            <div className="text-white text-sm font-black px-4 py-1.5 rounded-full shadow-xl"
              style={{ background: accentGradient, boxShadow: `0 0 20px ${accentColor}66` }}>
              +{xpPopup} XP
            </div>
          </div>
        )}

        {levelUpFlash && (
          <div className="fixed inset-x-0 top-0 z-40 text-center py-2.5 text-sm font-black text-white animate-pulse"
            style={{ background: accentGradient }}>
            LEVEL UP! {petState.name} {"->"} Lv.{petState.level}
          </div>
        )}

        {showMintModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
            <div className="trader-terminal rounded-3xl p-6 max-w-sm w-full space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-2">⛓️</div>
                <h3 className="font-black text-white text-xl">Mint On-Chain Identity</h3>
                <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Register {petState.name} as an EIP-8004 Agent NFT on BSC.
                </p>
              </div>
              <div className="rounded-2xl p-4 space-y-2 text-xs"
                style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {[
                  ["Network", "BNB Chain"],
                  ["Standard", "EIP-8004 Agent NFT"],
                  ["Gas", "~0.0005 BNB"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <span>{k}</span><span className="font-signal text-white/70">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowMintModal(false)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm trader-action"
                  style={{ color: "rgba(255,255,255,0.58)" }}>
                  Cancel
                </button>
                <button onClick={handleMintIdentity}
                  className="flex-1 py-3 rounded-2xl text-white font-black text-sm trader-action"
                  style={{ background: accentGradient }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {showShareCard && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6"
            onClick={() => setShowShareCard(false)}>
            <div className="trader-terminal rounded-3xl p-6 max-w-xs w-full text-center space-y-4"
              onClick={e => e.stopPropagation()}>
              <div className="pet-orb mx-auto rounded-[28px] w-24 h-24 flex items-center justify-center text-5xl">
                {petState.emoji}
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">{petState.name}</h3>
                <p className="text-xs mt-1 text-white/42">Lv.{petState.level} · {petState.xp} XP · Meme {liveMeme}/100</p>
              </div>
              <p className="text-xs leading-relaxed text-white/48">{petState.personality.slice(0, 110)}{petState.personality.length > 110 ? "..." : ""}</p>
              <button
                onClick={() => {
                  const url = shareUrl || window.location.origin;
                  const text = `I have a Meme Pet called ${petState.name} — Lv.${petState.level}, ${petState.xp} XP.\n\nCreate yours at: ${url}`;
                  if (navigator.share) {
                    navigator.share({ title: `My Meme Pet: ${petState.name}`, text, url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                  }
                }}
                className="w-full py-3 rounded-2xl text-white font-black text-sm trader-action"
                style={{ background: accentGradient }}>
                Share / 分享
              </button>
            </div>
          </div>
        )}

        <header className="trader-nav flex items-center justify-between px-5 sm:px-7 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🐾</span>
            <span className="font-black text-lg tracking-tight">Meme<span style={{ color: "#00FFAA" }}>Pet</span></span>
            <span className="hidden sm:inline-flex trader-chip trader-chip-green text-[10px] px-2.5 py-1 font-signal">
              HATCH COMPLETE
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowShareCard(true)}
              className="trader-action rounded-full px-3 py-1.5 text-xs font-black"
              style={{ color: accentColor }}>
              Share / 分享
            </button>
            <button onClick={onReset}
              className="trader-action rounded-full px-3 py-1.5 text-xs font-black"
              style={{ color: "rgba(255,255,255,0.62)" }}>
              Reset / 重置
            </button>
          </div>
        </header>

        <div className="market-tape px-5 sm:px-7 py-2 text-[11px] font-black font-signal">
          <span className="text-white/35">{zh ? "孵化完成" : "JUST HATCHED"} </span>
          <span className="ticker-pill">DNA <span className="ticker-up">{dna?.tradingStyle?.toUpperCase() ?? "MEME"}</span></span>
          <span className="ticker-pill">MOOD <span className="ticker-hot">{petState.mood.toUpperCase()}</span></span>
          <span className="ticker-pill">MEME <span className="ticker-up">{liveMeme}/100</span></span>
          <span className="hidden sm:inline text-white/30">{zh ? "先认识它，再进入交易驾驶舱。" : "Meet the pet first, then enter the cockpit."}</span>
        </div>

        <main className="flex-1 px-5 sm:px-7 py-7">
          <div className="max-w-7xl mx-auto grid xl:grid-cols-[0.9fr_1.1fr] gap-5 lg:gap-6 items-start">
            <section className="trader-card rounded-[34px] p-5 sm:p-6 text-center">
              <div className="relative z-10 w-full">
                <div className="inline-flex trader-chip trader-chip-hot px-3 py-1 text-xs font-signal mb-4">
                  {zh ? "新宠物已诞生" : "NEW COMPANION ONLINE"}
                </div>

                <div className="relative mx-auto mb-5 w-48 h-48 sm:w-56 sm:h-56">
                  <div className="absolute inset-[-28px] rounded-full blur-3xl opacity-30"
                    style={{ background: accentColor }} />
                  <div className="relative pet-orb rounded-[44px] w-full h-full flex items-center justify-center">
                    <span className="pet-breathe select-none"
                      style={{ fontSize: 112, lineHeight: 1, filter: `drop-shadow(0 10px 30px ${accentColor}66)` }}>
                      {petState.emoji}
                    </span>
                  </div>
                  <div className="absolute -bottom-3 -right-3 rounded-2xl px-3 py-2 trader-terminal">
                    <span className="text-2xl">{moodEmoji}</span>
                  </div>
                </div>

                <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-3"
                  style={{ textShadow: `0 0 34px ${accentColor}66` }}>
                  {petState.name}
                </h1>
                <p className="max-w-md mx-auto text-sm sm:text-base leading-relaxed text-white/58">
                  {greeting || (zh
                    ? "我已经在你的交易桌旁边上线了。绿色我庆祝，红色我陪你回血。"
                    : "I am online beside your trading desk. Green candles get celebration, red candles get company.")}
                </p>

                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  {introTags.map(tag => (
                    <span key={tag} className="trader-chip px-3 py-1 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-6 rounded-3xl p-4 trader-terminal text-left">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: "#00FFAA" }}>
                        PET STATUS
                      </div>
                      <div className="text-xs mt-1 text-white/38">{zh ? "集中保留核心指标" : "Core indicators, one place"}</div>
                    </div>
                    <span className="trader-chip trader-chip-green px-2.5 py-1 text-[11px] font-signal">LV.{petState.level}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      [zh ? "XP / 经验" : "XP", petState.xp % 100, "#FF00AA", "/100"],
                      [zh ? "Energy / 精力" : "Energy", liveEnergy, energyColor, ""],
                      [zh ? "Satiety / 饱食" : "Satiety", liveSatiety, satietyColor, ""],
                      [zh ? "Meme 指数" : "Meme", liveMeme, "#A78BFA", ""],
                    ].map(([label, value, color, suffix]) => (
                      <div key={label as string} className="rounded-2xl p-3"
                        style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase font-signal text-white/32">{label}</span>
                          <span className="text-sm font-black" style={{ color: color as string }}>{value}{suffix}</span>
                        </div>
                        <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                          <div className="h-full rounded-full" style={{ width: `${value}%`, background: color as string }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div className="trader-card rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="relative z-10">
                    <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: "#00FFAA" }}>
                      LIVE TRADE PULSE
                    </div>
                    <p className="text-sm mt-1 text-white/48">
                      {zh ? "触发交易事件，宠物状态会即时变化。" : "Trigger a trade event; the pet state reacts immediately."}
                    </p>
                  </div>
                  <span className="relative z-10 trader-chip trader-chip-green px-2.5 py-1 text-[11px] font-signal">
                    {lastTradePulse ? `${lastTradePulse.move} ${lastTradePulse.labelEn}` : "READY"}
                  </span>
                </div>

                <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {TRADE_PULSE_EVENTS.map(event => (
                    <button key={event.kind}
                      onClick={() => handleTradePulse(event)}
                      className="trader-action rounded-2xl p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{ borderColor: `${event.color}35`, background: `${event.color}0f` }}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xl">{event.icon}</span>
                        <span className="text-[11px] font-black font-signal" style={{ color: event.color }}>{event.move}</span>
                      </div>
                      <div className="font-black text-sm text-white">{zh ? event.labelZh : event.labelEn}</div>
                      <div className="text-[11px] mt-1 text-white/42">{zh ? event.detailZh : event.detailEn}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_0.9fr] gap-4">
                <div className="trader-terminal rounded-[28px] p-5">
                  <div className="text-xs font-black font-signal tracking-[0.18em] mb-3" style={{ color: "#00FFAA" }}>
                    {zh ? "钱包 DNA / 目标" : "WALLET DNA / GOALS"}
                  </div>
                  <div className="space-y-1 mb-4">
                    <div className="signal-row">
                      <span className="text-xs font-black font-signal text-white/32">DNA</span>
                      <span className="text-xs font-black text-right" style={{ color: "#00FFAA" }}>
                        {dna?.headline ?? (zh ? "自定义性格孵化" : "Custom personality hatch")}
                      </span>
                    </div>
                    <div className="signal-row">
                      <span className="text-xs font-black font-signal text-white/32">{zh ? "模式" : "MODE"}</span>
                      <span className="text-xs font-black text-right" style={{ color: "#FFD166" }}>
                        {zh ? "交易友好，不抢方向盘" : "Trading-friendly, no wheel-grabbing"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {activeGoals.length > 0 ? activeGoals.map(goal => (
                      <div key={goal.id} className="rounded-2xl p-3"
                        style={{ background: `${accentColor}0d`, border: `1px solid ${accentColor}24` }}>
                        <div className="text-sm font-black text-white mb-2">{goal.text}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => resolveGoal(goal.id, "hit")}
                            className="trader-action rounded-xl py-2 text-xs font-black"
                            style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.25)" }}>
                            ✅ Done
                          </button>
                          <button onClick={() => resolveGoal(goal.id, "missed")}
                            className="trader-action rounded-xl py-2 text-xs font-black"
                            style={{ color: "#FF6B6B", borderColor: "rgba(255,107,107,0.25)" }}>
                            ✕ Missed
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="text-sm text-white/42">{zh ? "还没有目标。" : "No active goals yet."}</div>
                    )}
                  </div>
                </div>

                <div className="trader-terminal rounded-[28px] p-5 flex flex-col gap-3">
                  <div>
                    <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: accentColor }}>
                      {zh ? "身份 / 操作" : "IDENTITY / ACTIONS"}
                    </div>
                    <p className="text-sm mt-2 leading-relaxed text-white/52">{petState.personality}</p>
                  </div>
                  <div className="rounded-2xl p-3"
                    style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-[10px] font-black font-signal text-white/30">ON-CHAIN</div>
                    <div className="text-sm font-black mt-1" style={{ color: petState.agentId != null ? "#00FFAA" : "rgba(255,255,255,0.56)" }}>
                      {petState.agentId != null ? `Agent #${petState.agentId}` : (zh ? "待铸造" : "Not minted yet")}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button onClick={handleFeedMarket} disabled={feedingMarket || sending}
                      className="trader-action rounded-2xl py-3 px-3 text-sm font-black disabled:opacity-45"
                      style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.25)" }}>
                      {feedingMarket ? (zh ? "喂养中" : "Feeding") : (zh ? "喂市场" : "Feed")}
                    </button>
                    <button onClick={() => startChat()}
                      className="trader-action rounded-2xl py-3 px-3 text-sm font-black"
                      style={{ color: accentColor, borderColor: `${accentColor}40` }}>
                      {zh ? "小对话" : "Chat"}
                    </button>
                    <button onClick={() => setShowMintModal(true)} disabled={registering || sending || petState.agentId != null}
                      className="trader-action rounded-2xl py-3 px-3 text-sm font-black disabled:opacity-35"
                      style={{ color: "#FFD166", borderColor: "rgba(255,209,102,0.25)" }}>
                      {petState.agentId != null ? (zh ? "已上链" : "Minted") : (zh ? "铸造" : "Mint")}
                    </button>
                    <button onClick={() => setShowShareCard(true)}
                      className="trader-action rounded-2xl py-3 px-3 text-sm font-black"
                      style={{ color: "#00D4FF", borderColor: "rgba(0,212,255,0.25)" }}>
                      {zh ? "分享" : "Share"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        {showChatPanel && (
          <div className="fixed right-4 bottom-4 z-50 w-[min(420px,calc(100vw-2rem))] max-h-[72vh] flex flex-col rounded-3xl overflow-hidden trader-terminal"
            style={{ boxShadow: "0 22px 80px rgba(0,0,0,0.62)", backdropFilter: "blur(16px)" }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">{petState.emoji}</span>
                <div>
                  <div className="text-sm font-black text-white">Talk with {petState.name}</div>
                  <div className="text-[11px] font-signal" style={{ color: "rgba(255,255,255,0.35)" }}>
                    desk-side chat / 小对话框
                  </div>
                </div>
              </div>
              <button onClick={() => setShowChatPanel(false)}
                className="w-8 h-8 rounded-lg text-sm font-black transition-all hover:opacity-70"
                style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }}>
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[260px]">
              {petState.conversationHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base"
                      style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
                      {petState.emoji}
                    </div>
                  )}
                  <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"}`}
                    style={msg.role === "user"
                      ? { background: accentGradient, color: "#fff" }
                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.88)" }
                    }>
                    <p className="font-medium">{msg.content}</p>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base"
                    style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
                    {petState.emoji}
                  </div>
                  <div className="rounded-2xl rounded-bl-sm px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    <div className="flex gap-1.5 items-center">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                          style={{ background: accentColor, opacity: 0.7, animationDelay: `${i * 160}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-3 py-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.25)" }}>
              <div className="flex gap-2 items-center">
                <input
                  ref={inputRef}
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.9)",
                  }}
                  placeholder={`Talk to ${petState.name}...`}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="flex-shrink-0 font-black px-4 py-2.5 rounded-xl text-sm text-white transition-all hover:scale-[1.04] active:scale-[0.97] disabled:opacity-30 disabled:scale-100"
                  style={{ background: accentGradient }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col trader-shell" style={{ color: "#fff" }}>
      {showConfetti && <Confetti />}

      {/* XP popup */}
      {xpPopup !== null && (
        <div className="fixed top-16 right-4 z-50 pointer-events-none"
          style={{ animation: "step-pop 0.4s ease" }}>
          <div className="text-white text-sm font-black px-4 py-1.5 rounded-full shadow-xl"
            style={{ background: accentGradient, boxShadow: `0 0 20px ${accentColor}66` }}>
            +{xpPopup} XP ✨
          </div>
        </div>
      )}

      {/* Level-up banner */}
      {levelUpFlash && (
        <div className="fixed inset-x-0 top-0 z-40 text-center py-2.5 text-sm font-black text-white animate-pulse"
          style={{ background: accentGradient }}>
          🎉 LEVEL UP! {petState.name} → Lv.{petState.level} 升级啦 🎉
        </div>
      )}

      {/* Mint NFT modal */}
      {showMintModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="rounded-3xl p-6 max-w-sm w-full space-y-4"
            style={{ background: "#1a1030", border: "1px solid rgba(255,255,255,0.12)", boxShadow: `0 0 60px ${accentColor}22` }}>
            <div className="text-center space-y-1">
              <div className="text-5xl mb-2">⛓️</div>
              <h3 className="font-black text-white text-xl">Mint On-Chain NFT</h3>
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>铸造链上身份</p>
              <p className="text-sm pt-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                Register <span className="font-bold text-white">{petState.name}</span> as an EIP-8004 Agent NFT on BSC.
                <br /><span style={{ color: "rgba(255,255,255,0.35)" }}>需要少量 BNB 支付 gas 费。</span>
              </p>
            </div>
            <div className="rounded-2xl p-4 space-y-2 text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                ["Contract / 合约", "0x8004...a432"],
                ["Network / 网络", "BNB Chain"],
                ["Standard / 标准", "EIP-8004 Agent NFT"],
                ["Gas", "~0.0005 BNB"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <span>{k}</span><span className="font-mono text-white/70">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowMintModal(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-colors hover:opacity-80"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
                Cancel / 取消
              </button>
              <button onClick={handleMintIdentity}
                className="flex-1 py-3 rounded-2xl text-white font-black text-sm transition-all hover:scale-[1.02]"
                style={{ background: accentGradient, boxShadow: `0 0 20px ${accentColor}44` }}>
                ⛓ Confirm / 确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARE CARD MODAL ── */}
      {showShareCard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setShowShareCard(false)}>
          <div className="rounded-3xl p-7 max-w-xs w-full text-center space-y-4"
            onClick={e => e.stopPropagation()}
            style={{ background: "linear-gradient(145deg,#1a1030,#0d1a30)", border: `1px solid ${accentColor}30`, boxShadow: `0 0 80px ${accentColor}22` }}>

            {/* Pet avatar */}
            <div className="relative inline-block">
              <div className="rounded-[28px] p-[3px] inline-block"
                style={{ background: accentGradient, boxShadow: `0 0 40px ${accentColor}55` }}>
                <div className="rounded-[25px] flex items-center justify-center"
                  style={{ width: 96, height: 96, background: "linear-gradient(135deg,#1a1030,#0d1a30)" }}>
                  <span style={{ fontSize: 48, lineHeight: 1 }}>{petState.emoji}</span>
                </div>
              </div>
              {levelDecor && (
                <span className="absolute -top-3 -right-3 text-2xl">{levelDecor}</span>
              )}
            </div>

            {/* Name + badges */}
            <div>
              <h3 className="text-2xl font-black text-white">{petState.name}</h3>
              <div className="flex justify-center gap-2 mt-2 flex-wrap">
                {petState.memeStyle && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                    {petState.memeStyle}
                  </span>
                )}
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                  ⭐ Lv.{petState.level}
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}>
                  {petState.xp} XP
                </span>
              </div>
            </div>

            {/* Personality snippet */}
            <p className="text-xs leading-relaxed px-2"
              style={{ color: "rgba(255,255,255,0.45)" }}>
              {petState.personality.slice(0, 100)}{petState.personality.length > 100 ? "…" : ""}
            </p>

            {/* Goals achieved */}
            {doneGoals.length > 0 && (
              <div className="rounded-2xl p-3 text-left"
                style={{ background: "rgba(0,255,170,0.06)", border: "1px solid rgba(0,255,170,0.15)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5"
                  style={{ color: "rgba(0,255,170,0.5)" }}>Goals Hit / 已完成目标</p>
                {doneGoals.map(g => (
                  <p key={g.id} className="text-xs font-medium" style={{ color: "#00FFAA" }}>✅ {g.text}</p>
                ))}
              </div>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

            {/* Branding */}
            <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>
              MemePet · {shareUrl ? shareUrl.replace(/^https?:\/\//, "") : "current demo"}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const url = shareUrl || window.location.origin;
                  const text = `I have a Meme Pet called ${petState.name} (${petState.memeStyle ?? "meme style"}) — Lv.${petState.level}, ${petState.xp} XP.\n\nCreate yours at: ${url}`;
                  if (navigator.share) {
                    navigator.share({ title: `My Meme Pet: ${petState.name}`, text, url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                    // brief feedback via alert (works everywhere)
                    alert("Copied to clipboard! / 已复制到剪贴板");
                  }
                }}
                className="flex-1 py-3 rounded-2xl text-white font-black text-sm transition-all hover:scale-[1.02]"
                style={{ background: accentGradient, boxShadow: `0 0 20px ${accentColor}44` }}>
                📤 Share / 分享
              </button>
              <button onClick={() => setShowShareCard(false)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-colors hover:opacity-80"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" }}>
                Close / 关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP HEADER ── */}
      <header className="trader-nav flex-shrink-0 flex items-center justify-between px-4 py-3 z-30">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🐾</span>
          <span className="font-black text-sm tracking-tight" style={{ color: "rgba(255,255,255,0.9)" }}>
            Meme<span style={{ color: "#00FFAA" }}>Pet</span>
          </span>
          <span className="hidden md:inline-flex trader-chip trader-chip-hot text-[10px] px-2 py-0.5 font-signal">
            TRADER COCKPIT
          </span>
          <button className="lg:hidden ml-1 text-xs px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}
            onClick={() => setLeftOpen(v => !v)}>
            {leftOpen ? "▲" : "▼"} Pet
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {petState.memeStyle && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full hidden sm:inline"
              style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
              {petState.memeStyle}
            </span>
          )}
          {petState.agentId != null && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full hidden sm:inline"
              style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}>
              ⛓ #{petState.agentId}
            </span>
          )}
          <button onClick={handleFeedMarket} disabled={feedingMarket || sending}
            className="trader-action text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-40"
            style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.25)" }}>
            {feedingMarket ? "Feeding..." : "🍖 Feed Market"}
          </button>
          {!petState.walletAddress ? (
            <button onClick={() => setShowWalletPanel(v => !v)}
              className="trader-action text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
              style={{ color: accentColor, borderColor: `${accentColor}55` }}>
              🔗 Connect Wallet / 连钱包
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl"
              style={{ background: "rgba(0,255,170,0.08)", border: "1px solid rgba(0,255,170,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00FFAA", display: "inline-block" }} />
              <span className="text-xs font-bold font-mono" style={{ color: "#00FFAA" }}>
                {petState.walletAddress.slice(0, 6)}…{petState.walletAddress.slice(-4)}
              </span>
            </div>
          )}
          <button onClick={() => setShowShareCard(true)} title="Share / 分享"
            className="trader-action text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
            style={{ color: accentColor, borderColor: `${accentColor}44` }}>
            📤 Share
          </button>
          <button onClick={onReset} title="Reset / 重置"
            className="text-xs px-2 py-1 rounded-lg transition-all hover:opacity-60"
            style={{ color: "rgba(255,255,255,0.2)" }}>↩</button>
        </div>
      </header>

      <div className="market-tape px-4 py-2 text-[11px] font-black font-signal z-20">
        <span className="text-white/35">MEME DESK</span>
        {DASHBOARD_TAPE.map(item => (
          <span key={item.label} className="ticker-pill">
            {item.label} <span className={item.tone}>{item.value}</span>
          </span>
        ))}
        <span className="hidden md:inline text-white/30">Wallet events are pet events.</span>
      </div>

      {/* Wallet panel */}
      {showWalletPanel && (
        <div className="flex-shrink-0 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.3)" }}>
          <WalletConnect onConnected={handleWalletConnected} walletAddress={petState.walletAddress} />
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* ── LEFT PANEL ── */}
        <aside className={`lg:w-72 xl:w-80 flex-shrink-0 flex flex-col overflow-y-auto trader-terminal
            ${leftOpen ? "flex" : "hidden"} lg:flex`}
          style={{ borderRight: "1px solid rgba(255,255,255,0.09)" }}>

          {/* Pet hero */}
          <div className="flex flex-col items-center pt-8 pb-5 px-5">
            {/* Glow ring + avatar */}
            <div className="relative mb-4">
              <div className="absolute inset-[-16px] rounded-full blur-2xl opacity-20 pointer-events-none animate-pulse"
                style={{ background: accentColor }} />
              <div className="relative rounded-3xl p-[2px] pet-orb"
                style={{ background: accentGradient, boxShadow: `0 0 32px ${accentColor}40` }}>
                <div className="rounded-[22px] flex items-center justify-center"
                  style={{ width: 128, height: 128, background: "transparent" }}>
                  <span className="pet-breathe select-none"
                    style={{ fontSize: 64, lineHeight: 1, filter: `drop-shadow(0 4px 12px ${accentColor}66)` }}>
                    {petState.emoji}
                  </span>
                </div>
              </div>
              {/* Level decoration (top-left) */}
              {levelDecor && (
                <span className="absolute -top-3 -left-1 text-xl" title={`Level ${petState.level} reward`}>
                  {levelDecor}
                </span>
              )}
              {/* Mood badge */}
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-lg"
                style={{ background: "#1a1030", border: `2px solid ${accentColor}55` }}>
                {moodEmoji}
              </div>
            </div>

            {/* "Misses you" badge when inactive 24h+ */}
            {petIsMissing && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full mt-2 animate-pulse"
                style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>
                😢 宠物想你了 · Missed you
              </div>
            )}

            {/* Name */}
            <h2 className="text-2xl font-black text-white text-center tracking-tight mt-1"
              style={{ textShadow: `0 0 20px ${accentColor}55` }}>
              {petState.name}
            </h2>

            {/* Badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {petState.memeStyle && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  {petState.memeStyle}
                </span>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)" }}>
                ⭐ Lv.{petState.level}
              </span>
            </div>

            {/* XP bar */}
            <div className="w-full max-w-[200px] mt-4 space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>⭐ XP / 经验</span>
                  <span className="font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {petState.xp % 100}<span style={{ color: "rgba(255,255,255,0.25)" }}>/100</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${xpPct}%`, background: accentGradient }} />
                </div>
              </div>

              {/* ── Tamagotchi Vitals ── */}
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>⚡ 精力 Energy</span>
                  <span className="font-bold" style={{ color: energyColor }}>{liveEnergy}</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${liveEnergy}%`, background: energyColor }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>🍖 饱食 Satiety</span>
                  <span className="font-bold" style={{ color: satietyColor }}>{liveSatiety}</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${liveSatiety}%`, background: satietyColor }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                  <span>🎭 Meme 指数</span>
                  <span className="font-bold" style={{ color: "#A78BFA" }}>{liveMeme}</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${liveMeme}%`, background: "linear-gradient(90deg,#7C3AED,#A78BFA)" }} />
                </div>
              </div>
            </div>

            {/* Personality tags badges */}
            {petState.personalityTags && petState.personalityTags.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3 max-w-[200px]">
                {petState.personalityTags.map(tag => (
                  <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-5" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

          {/* Stats body */}
          <div className="flex flex-col gap-4 px-5 py-5">

            {/* Core Goal */}
            {/* Goals — active with Done/Missed, completed shown as trophies */}
            {petState.goals.length > 0 && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ color: "rgba(255,255,255,0.28)" }}>
                  Goals / 目标
                </p>
                <div className="space-y-2">
                  {activeGoals.map((g) => (
                    <div key={g.id} className="rounded-xl p-3"
                      style={{
                        background: `${accentColor}0d`,
                        border: `1px solid ${accentColor}22`,
                        borderLeft: `3px solid ${accentColor}`,
                      }}>
                      <p className="text-xs font-bold text-white leading-snug mb-2">{g.text}</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => resolveGoal(g.id, "hit")}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-black transition-all hover:scale-[1.03] active:scale-[0.97]"
                          style={{ background: "rgba(0,255,170,0.12)", color: "#00FFAA", border: "1px solid rgba(0,255,170,0.25)" }}>
                          ✅ Done / 完成
                        </button>
                        <button
                          onClick={() => resolveGoal(g.id, "missed")}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-black transition-all hover:scale-[1.03] active:scale-[0.97]"
                          style={{ background: "rgba(255,100,100,0.1)", color: "#ff6b6b", border: "1px solid rgba(255,100,100,0.2)" }}>
                          ❌ Missed / 错过
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Completed goals shown as small trophies */}
                  {doneGoals.map((g) => (
                    <div key={g.id} className="rounded-xl px-3 py-2 flex items-center gap-2"
                      style={{ background: "rgba(0,255,170,0.05)", border: "1px solid rgba(0,255,170,0.12)" }}>
                      <span className="text-sm">🏆</span>
                      <p className="text-xs flex-1 line-through" style={{ color: "rgba(0,255,170,0.5)" }}>{g.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet DNA */}
            {petState.tradingDNA && (
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ color: "rgba(255,255,255,0.28)" }}>
                  Wallet DNA / 链上基因
                </p>
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: "rgba(0,255,170,0.05)", border: "1px solid rgba(0,255,170,0.14)" }}>
                  <p className="text-xs font-black leading-snug" style={{ color: "#00FFAA" }}>
                    {petState.tradingDNA.headline}
                  </p>
                  <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>
                    {petState.tradingDNA.vibe}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {petState.tradingDNA.tags.map(tag => (
                      <span key={tag} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Personality */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest mb-2"
                style={{ color: "rgba(255,255,255,0.28)" }}>
                Personality / 性格
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {petState.personality}
              </p>
            </div>

            {/* On-chain + Mint */}
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest mb-2"
                style={{ color: "rgba(255,255,255,0.28)" }}>
                On-Chain / 链上身份
              </p>
              <div className="rounded-xl p-3 flex items-center gap-2 text-xs font-semibold mb-2"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span style={{ fontSize: 16, color: petState.agentId != null ? "#00FFAA" : "rgba(255,255,255,0.2)" }}>⛓</span>
                <span style={{ color: petState.agentId != null ? "#00FFAA" : "rgba(255,255,255,0.35)" }}>
                  {petState.agentId != null
                    ? `Minted — Agent #${petState.agentId}`
                    : "Not yet minted / 待铸造"}
                </span>
              </div>
              {petState.agentId == null && (
                <button onClick={() => setShowMintModal(true)} disabled={registering || sending}
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.5)" }}>
                  {registering ? "Minting… / 铸造中…" : "⛓ Mint Identity / 铸造链上身份"}
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ── RIGHT: COMPANION STAGE ── */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 60% 50% at 50% 45%, ${accentColor}16, transparent 65%)` }} />

          <div className="relative z-10 flex-1 overflow-y-auto px-5 py-7 flex flex-col items-center justify-center">
            <div className="inline-flex items-center gap-2 text-xs font-black px-4 py-1.5 rounded-full mb-4 trader-chip"
              style={{ color: accentColor, borderColor: `${accentColor}44`, background: `${accentColor}13` }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor, display: "inline-block" }} />
              {petState.walletAddress ? "Live wallet companion / 链上陪伴中" : "Pocket trading companion / 交易陪伴中"}
            </div>

            <div className="grid grid-cols-3 gap-2 w-full max-w-2xl mb-5">
              {[
                ["MOOD", petState.mood.toUpperCase(), accentColor],
                ["LEVEL", `LV.${petState.level}`, "#FFD166"],
                ["MEME", `${liveMeme}/100`, "#00FFAA"],
              ].map(([label, value, color]) => (
                <div key={label} className="trader-terminal rounded-2xl px-3 py-2 text-center">
                  <div className="text-[10px] font-black font-signal text-white/30">{label}</div>
                  <div className="text-sm font-black mt-0.5" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full blur-3xl opacity-30 pointer-events-none"
                style={{ background: accentColor, transform: "scale(1.55)" }} />
              <div className="relative rounded-[32px] p-[3px] pet-orb"
                style={{ background: accentGradient, boxShadow: `0 0 56px ${accentColor}50` }}>
                <div className="rounded-[29px] flex items-center justify-center"
                  style={{ width: 184, height: 184, background: "transparent" }}>
                  <span className="pet-breathe select-none"
                    style={{ fontSize: 92, lineHeight: 1, filter: `drop-shadow(0 6px 22px ${accentColor}80)` }}>
                    {petState.emoji}
                  </span>
                </div>
              </div>
              {levelDecor && (
                <span className="absolute -top-4 -left-2 text-2xl">{levelDecor}</span>
              )}
              <div className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg"
                style={{ background: "#1a1030", border: `2px solid ${accentColor}55` }}>
                {moodEmoji}
              </div>
            </div>

            <h2 className="text-4xl font-black text-white text-center mb-2"
              style={{ textShadow: `0 0 30px ${accentColor}66` }}>
              {petState.name}
            </h2>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {petState.memeStyle && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40` }}>
                  {petState.memeStyle}
                </span>
              )}
              {petState.tradingDNA?.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
                  {tag}
                </span>
              ))}
            </div>

            {greeting && (
              <div className="relative max-w-xl w-full mb-7">
                <div className="relative rounded-3xl rounded-tl-sm p-5"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                  }}>
                  <div className="absolute -top-[9px] left-5 w-4 h-4 rotate-45"
                    style={{ background: "rgba(255,255,255,0.06)", borderTop: "1px solid rgba(255,255,255,0.1)", borderLeft: "1px solid rgba(255,255,255,0.1)" }} />
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.86)" }}>
                    {greeting}
                  </p>
                </div>
              </div>
            )}

            <div className="w-full max-w-2xl mb-5 rounded-3xl p-4 trader-card">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: accentColor }}>
                    Live Trade Pulse
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {petState.lang === "zh"
                      ? "模拟 BSC 交易事件，看看宠物如何被你的链上行为影响。"
                      : "Trigger BSC-style trade events and watch the pet react like a living companion."}
                  </p>
                </div>
                {lastTradePulse && (
                  <div className="relative z-10 text-xs font-black px-2.5 py-1 rounded-full self-start font-signal"
                    style={{ color: lastTradePulse.color, background: `${lastTradePulse.color}14`, border: `1px solid ${lastTradePulse.color}30` }}>
                    {lastTradePulse.icon} {petState.lang === "zh" ? lastTradePulse.labelZh : lastTradePulse.labelEn}
                  </div>
                )}
              </div>
              <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2">
                {TRADE_PULSE_EVENTS.map(event => (
                  <button key={event.kind}
                    onClick={() => handleTradePulse(event)}
                    className="trader-action rounded-2xl p-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: `${event.color}10`, border: `1px solid ${event.color}28`, color: "rgba(255,255,255,0.86)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg">{event.icon}</span>
                      <span className="text-[10px] font-black" style={{ color: event.color }}>{event.move}</span>
                    </div>
                    <div className="text-sm font-black mt-1">
                      {petState.lang === "zh" ? event.labelZh : event.labelEn}
                    </div>
                    <div className="text-[11px] font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                      {petState.lang === "zh" ? event.detailZh : event.detailEn}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-2xl">
              <button onClick={handleFeedMarket} disabled={feedingMarket || sending}
                className="trader-action py-3 px-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{ background: "rgba(0,255,170,0.1)", border: "1px solid rgba(0,255,170,0.25)", color: "#00FFAA" }}>
                {feedingMarket ? "🍖 Feeding..." : "🍖 Feed Market"}
                <span className="block text-[11px] font-bold opacity-70 mt-0.5">喂市场</span>
              </button>
              <button onClick={handleTodayRankings} disabled={sending}
                className="trader-action py-3 px-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{ background: "rgba(255,107,0,0.12)", border: "1px solid rgba(255,107,0,0.25)", color: "#ff9340" }}>
                🔥 Hot Today
                <span className="block text-[11px] font-bold opacity-70 mt-0.5">今日热榜</span>
              </button>
              <button onClick={handleMarketPulse} disabled={sending}
                className="trader-action py-3 px-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", color: "#00D4FF" }}>
                📡 Market Pulse
                <span className="block text-[11px] font-bold opacity-70 mt-0.5">市场脉搏</span>
              </button>
              <button
                onClick={() => { setChatStarted(true); sendMessage(petState.lang === "zh" ? "我今天完成了打卡，坚持了我的目标！" : "I completed my daily check-in and stayed on track today!"); }}
                disabled={sending}
                className="trader-action py-3 px-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.82)" }}>
                ✅ Check In
                <span className="block text-[11px] font-bold opacity-60 mt-0.5">每日打卡</span>
              </button>
              <button
                onClick={() => startChat(petState.lang === "zh" ? "分析一下我最近的交易行为，告诉我需要改进什么？" : "Analyze my recent trading behavior and tell me what to improve.")}
                disabled={sending}
                className="trader-action py-3 px-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "#a78bfa" }}>
                📊 My Patterns
                <span className="block text-[11px] font-bold opacity-70 mt-0.5">行为分析</span>
              </button>
              <button
                onClick={() => { setChatStarted(true); setShowChatPanel(true); setTimeout(() => inputRef.current?.focus(), 80); }}
                className="trader-action py-3 px-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: accentGradient, color: "#fff", boxShadow: `0 0 20px ${accentColor}35` }}>
                💬 Talk
                <span className="block text-[11px] font-bold opacity-75 mt-0.5">小对话</span>
              </button>
            </div>
          </div>

          {showChatPanel && (
            <div className="fixed right-4 bottom-4 z-50 w-[min(420px,calc(100vw-2rem))] max-h-[72vh] flex flex-col rounded-3xl overflow-hidden trader-terminal"
              style={{ boxShadow: "0 22px 80px rgba(0,0,0,0.62)", backdropFilter: "blur(16px)" }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{petState.emoji}</span>
                  <div>
                    <div className="text-sm font-black text-white">Talk with {petState.name}</div>
                    <div className="text-[11px] font-signal" style={{ color: "rgba(255,255,255,0.35)" }}>desk-side chat / 小对话框</div>
                  </div>
                </div>
                <button onClick={() => setShowChatPanel(false)}
                  className="w-8 h-8 rounded-lg text-sm font-black transition-all hover:opacity-70"
                  style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }}>
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[260px]">
                {petState.conversationHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} items-end gap-2`}>
                    {msg.role === "assistant" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base"
                        style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
                        {petState.emoji}
                      </div>
                    )}
                    <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                      ${msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"}`}
                      style={msg.role === "user"
                        ? { background: accentGradient, color: "#fff" }
                        : msg.reaction === "reality-check"
                          ? { background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", color: "rgba(255,255,255,0.88)" }
                          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.88)" }
                      }>
                      <p className="font-medium">{msg.content}</p>
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="flex items-end gap-2 justify-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-base"
                      style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}30` }}>
                      {petState.emoji}
                    </div>
                    <div className="rounded-2xl rounded-bl-sm px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      <div className="flex gap-1.5 items-center">
                        {[0, 1, 2].map(i => (
                          <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                            style={{ background: accentColor, opacity: 0.7, animationDelay: `${i * 160}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="px-3 py-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.25)" }}>
                <div className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    className="flex-1 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                    placeholder={`Talk to ${petState.name}...`}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || sending}
                    className="flex-shrink-0 font-black px-4 py-2.5 rounded-xl text-sm text-white transition-all hover:scale-[1.04] active:scale-[0.97] disabled:opacity-30 disabled:scale-100"
                    style={{ background: accentGradient }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
