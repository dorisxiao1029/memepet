"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useChainId, useSwitchChain, useWriteContract, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { type Address, parseEther } from "viem";
import { chatWithPet } from "@/lib/pet-client";
import { appendMessage, applyXp, calcXpDelta, feedPet } from "@/lib/storage";
import { TM2_BUY_ABI, TM2_SELL_MIN_ABI, ERC20_ABI, BSC_CHAIN_ID, MAX_BUY_WEI } from "@/lib/fourmeme";
import type { PetState, Message, Mood, Reaction, WalletSummary } from "@/lib/types";
import WalletConnect from "./WalletConnect";
import PetPlayground from "./PetPlayground";
import PetRank from "./PetRank";
import NavBar from "./NavBar";
import VRMViewer from "./VRMViewer";
import { USER_PET_VRM } from "@/lib/vrm-assignments";

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

type TradeStatus = "idle" | "picking" | "quoting" | "awaiting-signature" | "approving" | "broadcasting" | "confirming" | "success" | "fail";

interface AgentAction {
  id: string;
  timestamp: number;
  tool: string;              // e.g. "four.meme.rankings", "Helper3.tryBuy", "TokenManager2.buyTokenAMAP"
  summary: string;           // human-friendly line ("Picked $AINY (+12% 24h)")
  txHash?: string;
  status?: "ok" | "error" | "pending";
}

interface TradeRecommendation {
  address: string;
  name: string;
  symbol: string;
  img?: string;
  price: number;
  day1Increase: number;
  day1Vol: number;
  holders: number;
  progress: number;
  reason: string;
  reasonZh: string;
}

interface TradeResult {
  action: "buy" | "sell";
  txHash: string;
  bscScanUrl: string;
  symbol: string;
  fundsBnb?: number;
  estimatedTokens?: number;
  status: "success" | "reverted" | "pending";
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
  const [minimized, setMinimized]     = useState(false);
  const [currentPage, setCurrentPage] = useState<"home" | "playground">("home");
  const [playgroundTab, setPlaygroundTab] = useState<"social" | "rank">("social");
  const [feedingMarket, setFeedingMarket] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [lastTradePulse, setLastTradePulse] = useState<TradePulseEvent | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  // ── four.meme user-signed trade state ─────────────────────
  const [tradePick, setTradePick] = useState<TradeRecommendation | null>(null);
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>("idle");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeResult, setTradeResult] = useState<TradeResult | null>(null);
  const [tradeFunds] = useState(0.001); // 0.001 BNB per trade (within 0.005 cap)
  const [tradeQuote, setTradeQuote] = useState<{ tokenManager: string; amountMsgValue: string; estimatedAmount: string; estimatedTokens: number } | null>(null);

  // ── Agent Actions log (ephemeral per session) ────────────
  const [agentActions, setAgentActions] = useState<AgentAction[]>([]);
  const appendAction = useCallback((action: Omit<AgentAction, "id" | "timestamp">) => {
    setAgentActions((prev) => [
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: Date.now(), ...action },
      ...prev,
    ].slice(0, 12));
  }, []);

  // ── wagmi: user wallet for signing ────────────────────────
  const { address: userAddress, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: BSC_CHAIN_ID });
  const onBsc = currentChainId === BSC_CHAIN_ID;

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

  // Log when a wallet DNA analysis has produced initial DNA (tool observation)
  const loggedWalletAnalyzeRef = useRef(false);
  useEffect(() => {
    if (petState.walletSummary && !loggedWalletAnalyzeRef.current) {
      loggedWalletAnalyzeRef.current = true;
      appendAction({
        tool: "moralis.wallet-analyze",
        summary: `Wallet DNA → ${petState.tradingDNA?.tradingStyle ?? "custom"} / ${petState.tradingDNA?.petArchetype ?? "hype"}`,
        status: "ok",
      });
    }
  }, [petState.walletSummary, petState.tradingDNA, appendAction]);

  // Auto-analyze the connected wagmi wallet so pets hatched via Quick Adopt
  // still pick up on-chain DNA + tags once the user connects.
  const autoAnalyzedRef = useRef<string | null>(null);
  const [autoAnalyzing, setAutoAnalyzing] = useState(false);
  useEffect(() => {
    if (!isConnected || !userAddress) return;
    if (autoAnalyzedRef.current === userAddress.toLowerCase()) return;
    if (petStateRef.current.walletAddress?.toLowerCase() === userAddress.toLowerCase()) {
      autoAnalyzedRef.current = userAddress.toLowerCase();
      return;
    }
    autoAnalyzedRef.current = userAddress.toLowerCase();
    setAutoAnalyzing(true);
    (async () => {
      try {
        const res = await fetch("/api/pet/wallet-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: userAddress }),
        });
        if (!res.ok) return;
        const summary = (await res.json()) as WalletSummary;
        const current = petStateRef.current;
        const mergedTags = [
          ...(current.personalityTags ?? []),
          ...(summary.tradingDNA?.tags ?? []),
        ];
        const dedupedTags = Array.from(new Set(mergedTags)).slice(0, 8);
        const updated: PetState = {
          ...current,
          walletAddress: userAddress,
          walletSummary: summary.summary,
          walletAnalyzedAt: Date.now(),
          tradingDNA: summary.tradingDNA ?? current.tradingDNA,
          personalityTags: dedupedTags,
        };
        onStateUpdate(updated);
        appendAction({
          tool: "moralis.wallet-analyze (auto)",
          summary: `Synced DNA from ${userAddress.slice(0, 6)}…${userAddress.slice(-4)} → ${summary.tradingDNA?.tradingStyle ?? "custom"} / ${summary.tradingDNA?.petArchetype ?? "hype"}`,
          status: "ok",
        });
      } catch {
        appendAction({ tool: "moralis.wallet-analyze (auto)", summary: "Auto-analyze failed", status: "error" });
      } finally {
        setAutoAnalyzing(false);
      }
    })();
  }, [isConnected, userAddress, onStateUpdate, appendAction]);

  // ── four.meme on-chain event listener ────────────────────
  // Polls TokenManager2 logs for the connected wallet's TokenPurchase / TokenSale,
  // so the pet reacts even to trades the user makes outside our UI.
  const lastSeenBlockRef = useRef<number>(0);
  const seenTxsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isConnected || !userAddress) return;
    // Reset seen-state when wallet changes
    lastSeenBlockRef.current = 0;
    seenTxsRef.current = new Set();

    let stopped = false;
    let attempts = 0;

    async function pollOnce() {
      try {
        const url = new URL("/api/pet/wallet-events", window.location.origin);
        url.searchParams.set("address", userAddress!);
        if (lastSeenBlockRef.current) {
          url.searchParams.set("sinceBlock", String(lastSeenBlockRef.current));
        }
        const res = await fetch(url.toString());
        if (!res.ok) return;
        const data = await res.json();
        const firstRun = lastSeenBlockRef.current === 0;
        lastSeenBlockRef.current = data.latestBlock ?? lastSeenBlockRef.current;
        if (!Array.isArray(data.events)) return;
        // First poll = baseline; don't fire on historical events, just log the listener
        if (firstRun) {
          if (attempts === 0) {
            if (data.rpcLimited) {
              appendAction({
                tool: "four.meme.events",
                summary: "Listener armed · public RPC throttled (set BSC_RPC_URL for live detection)",
                status: "pending",
              });
            } else {
              appendAction({
                tool: "four.meme.events",
                summary: `Listening for your TokenPurchase / TokenSale on TokenManager2 (block ${data.latestBlock})`,
                status: "ok",
              });
            }
          }
          return;
        }
        for (const ev of data.events) {
          if (seenTxsRef.current.has(ev.txHash)) continue;
          seenTxsRef.current.add(ev.txHash);
          const amount = Number(ev.amountWei) / 1e18;
          const cost = Number(ev.costWei) / 1e18;
          appendAction({
            tool: ev.type === "buy" ? "four.meme.TokenPurchase" : "four.meme.TokenSale",
            summary: ev.type === "buy"
              ? `Detected your BUY: ${cost.toFixed(4)} BNB → ~${Math.round(amount).toLocaleString()} ${ev.token.slice(0, 8)}…`
              : `Detected your SELL: ~${Math.round(amount).toLocaleString()} ${ev.token.slice(0, 8)}… → ${cost.toFixed(4)} BNB`,
            txHash: ev.txHash,
            status: "ok",
          });
          // Trigger a live Trade Pulse
          const pulse: TradePulseEvent = ev.type === "buy"
            ? {
                kind: "buy",
                icon: "🛰",
                labelEn: "LIVE Detected Buy",
                labelZh: "监听到你买入",
                detailEn: `${cost.toFixed(4)} BNB · ${ev.token.slice(0, 6)}…`,
                detailZh: `${cost.toFixed(4)} BNB · ${ev.token.slice(0, 6)}…`,
                token: ev.token.slice(0, 8),
                move: `${cost.toFixed(3)} BNB`,
                color: "#00FFAA",
                vitals: { energy: 14, satiety: -3, memeScore: 12 },
                xp: 18,
                mood: "happy",
                reaction: "encouragement",
              }
            : {
                kind: "exit",
                icon: "🛰",
                labelEn: "LIVE Detected Sell",
                labelZh: "监听到你卖出",
                detailEn: `→ ${cost.toFixed(4)} BNB`,
                detailZh: `→ ${cost.toFixed(4)} BNB`,
                token: ev.token.slice(0, 8),
                move: "closed",
                color: "#00D4FF",
                vitals: { energy: 6, satiety: 4, memeScore: 3 },
                xp: 12,
                mood: "neutral",
                reaction: "neutral",
              };
          handleTradePulse(pulse);
        }
      } catch { /* silent */ }
      attempts++;
    }

    pollOnce();
    // Poll every 30s — window is 30 blocks (~90s) so this has ~3x overlap for safety
    const id = setInterval(() => { if (!stopped) pollOnce(); }, 30_000);
    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, userAddress]);

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

      appendAction({
        tool: resolvedNewsCtx ? "Groq.chat + 6551.news-context" : "Groq.chat",
        summary: `Reasoned reply (${response.reply.length} chars)${response.xpDelta ? `, +${response.xpDelta} XP` : ""}`,
        status: "ok",
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
  }, [input, sending, onStateUpdate, appendAction]);

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

      appendAction({
        tool: "four.meme.rankings + 6551.news-context",
        summary: topToken
          ? `Fed pet with $${topToken.symbol} (${topToken.day1Increase >= 0 ? "+" : ""}${topToken.day1Increase?.toFixed(1)}%) · sentiment ${news?.sentiment ?? "?"}`
          : "Fed pet (cached market snack)",
        status: "ok",
      });

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

  // ── User-signed trade handlers (four.meme V2 via wagmi) ───
  async function handlePickToken() {
    setTradeStatus("picking");
    setTradeError(null);
    setTradeResult(null);
    setTradeQuote(null);
    try {
      const archetype = petState.tradingDNA?.petArchetype ?? "hype";
      const res = await fetch("/api/pet/trade-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archetype, lang: petState.lang }),
      });
      const data = await res.json();
      if (!res.ok || !data.pick) {
        setTradeError(data.error ?? "No recommendation available");
        setTradeStatus("fail");
        appendAction({ tool: "four.meme.rankings", summary: `Failed: ${data.error ?? "no pick"}`, status: "error" });
        return;
      }
      const pick: TradeRecommendation = data.pick;
      setTradePick(pick);
      appendAction({
        tool: "four.meme.rankings",
        summary: `Scored 20 HOT tokens · picked $${pick.symbol} (${pick.day1Increase >= 0 ? "+" : ""}${pick.day1Increase.toFixed(1)}% 24h)`,
        status: "ok",
      });

      // Fetch quote (Helper3.tryBuy) so we can preview slippage before asking user to sign
      setTradeStatus("quoting");
      const qRes = await fetch("/api/pet/trade-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy", tokenAddress: pick.address, fundsBnb: tradeFunds }),
      });
      const qData = await qRes.json();
      if (qRes.ok) {
        setTradeQuote({
          tokenManager: qData.tokenManager,
          amountMsgValue: qData.fundsWei,
          estimatedAmount: qData.estimatedAmount,
          estimatedTokens: qData.estimatedTokens,
        });
        appendAction({
          tool: "Helper3.tryBuy",
          summary: `Quote: ${tradeFunds} BNB → ~${Math.round(qData.estimatedTokens).toLocaleString()} $${pick.symbol}`,
          status: "ok",
        });
      }
      setTradeStatus("idle");
    } catch (err) {
      setTradeError(String(err));
      setTradeStatus("fail");
      appendAction({ tool: "four.meme.rankings", summary: `Error: ${String(err).slice(0, 80)}`, status: "error" });
    }
  }

  async function handleExecuteBuy() {
    if (!tradePick || !tradeQuote) return;
    if (!isConnected) {
      setTradeError("Connect your wallet first.");
      return;
    }
    if (!onBsc) {
      try { await switchChain({ chainId: BSC_CHAIN_ID }); } catch { /* user cancelled */ }
      return;
    }
    setTradeError(null);
    setTradeResult(null);
    try {
      const fundsWei = parseEther(String(tradeFunds));
      if (fundsWei > MAX_BUY_WEI) {
        setTradeError("Over 0.005 BNB safety cap. Lower the amount.");
        return;
      }
      // 10% slippage guard on minAmount
      const estimated = BigInt(tradeQuote.estimatedAmount);
      const minAmount = (estimated * 9000n) / 10_000n;

      setTradeStatus("awaiting-signature");
      const hash = await writeContractAsync({
        address: tradeQuote.tokenManager as Address,
        abi: TM2_BUY_ABI,
        functionName: "buyTokenAMAP",
        args: [tradePick.address as Address, fundsWei, minAmount],
        value: fundsWei,
        chainId: BSC_CHAIN_ID,
      });
      appendAction({
        tool: "TokenManager2.buyTokenAMAP",
        summary: `User signed buy: ${tradeFunds} BNB → $${tradePick.symbol}`,
        txHash: hash,
        status: "pending",
      });

      setTradeStatus("confirming");
      const receipt = await publicClient?.waitForTransactionReceipt({ hash, timeout: 60_000 });

      const result: TradeResult = {
        action: "buy",
        txHash: hash,
        bscScanUrl: `https://bscscan.com/tx/${hash}`,
        symbol: tradePick.symbol,
        fundsBnb: tradeFunds,
        estimatedTokens: tradeQuote.estimatedTokens,
        status: receipt?.status === "success" ? "success" : receipt?.status === "reverted" ? "reverted" : "pending",
      };
      setTradeResult(result);
      setTradeStatus(result.status === "success" ? "success" : "fail");
      appendAction({
        tool: "TokenManager2.buyTokenAMAP",
        summary: `Buy ${result.status === "success" ? "confirmed" : "failed"}: $${tradePick.symbol}`,
        txHash: hash,
        status: result.status === "success" ? "ok" : "error",
      });

      // Fire real Trade Pulse + chat
      const pulse: TradePulseEvent = {
        kind: "buy",
        icon: "🚀",
        labelEn: "LIVE Buy",
        labelZh: "真实买入",
        detailEn: `${tradeFunds} BNB into $${tradePick.symbol} on four.meme`,
        detailZh: `在 four.meme 用 ${tradeFunds} BNB 买入 $${tradePick.symbol}`,
        token: `$${tradePick.symbol}`,
        move: `${tradeFunds} BNB`,
        color: "#00FFAA",
        vitals: { energy: 16, satiety: -4, memeScore: 14 },
        xp: 22,
        mood: "happy",
        reaction: "encouragement",
      };
      handleTradePulse(pulse);

      const zh = petState.lang === "zh";
      const msg = zh
        ? `你刚在 four.meme 用 ${tradeFunds} BNB 买了 $${tradePick.symbol}！tx: ${hash.slice(0, 10)}... 这是真的链上交易 🚀`
        : `You just aped ${tradeFunds} BNB into $${tradePick.symbol} on four.meme! tx: ${hash.slice(0, 10)}... Real on-chain 🚀`;
      if (!chatStarted) startChat();
      setTimeout(() => sendMessage(msg), 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // user rejection is benign
      const rejected = /rejected|denied|user/i.test(msg);
      setTradeError(rejected ? "Signature declined." : msg);
      setTradeStatus("fail");
      appendAction({
        tool: "TokenManager2.buyTokenAMAP",
        summary: rejected ? "User declined signature" : `Error: ${msg.slice(0, 80)}`,
        status: "error",
      });
    }
  }

  async function handleExecuteSell() {
    if (!tradePick || !userAddress || !publicClient) return;
    if (!isConnected) { setTradeError("Connect wallet first."); return; }
    if (!onBsc) { try { await switchChain({ chainId: BSC_CHAIN_ID }); } catch {} return; }
    setTradeError(null);
    setTradeResult(null);
    try {
      // Read full balance of this token for the connected user
      const balance = (await publicClient.readContract({
        address: tradePick.address as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [userAddress],
      })) as bigint;

      if (balance <= 0n) {
        setTradeError(petState.lang === "zh" ? "你的钱包里没有这个 token。" : "Your wallet has none of this token.");
        return;
      }

      appendAction({
        tool: "ERC20.balanceOf",
        summary: `Read $${tradePick.symbol} balance: ${(Number(balance) / 1e18).toFixed(4)}`,
        status: "ok",
      });

      // Resolve tokenManager via quote endpoint (also validates V2)
      const qRes = await fetch("/api/pet/trade-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sell", tokenAddress: tradePick.address, tokenAmount: balance.toString() }),
      });
      const q = await qRes.json();
      if (!qRes.ok) { setTradeError(q.error ?? "Quote failed"); return; }

      const expectedFundsWei = BigInt(q.fundsWei ?? "0");
      const minFundsWei = (expectedFundsWei * 9000n) / 10_000n;
      const tokenManager = q.tokenManager as Address;

      // 1) approve
      setTradeStatus("approving");
      const approveHash = await writeContractAsync({
        address: tradePick.address as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [tokenManager, balance],
        chainId: BSC_CHAIN_ID,
      });
      appendAction({ tool: "ERC20.approve", summary: `Approved TokenManager for $${tradePick.symbol}`, txHash: approveHash, status: "pending" });
      await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 });

      // 2) sellToken
      setTradeStatus("awaiting-signature");
      const sellHash = await writeContractAsync({
        address: tokenManager,
        abi: TM2_SELL_MIN_ABI,
        functionName: "sellToken",
        args: [0n, tradePick.address as Address, balance, minFundsWei],
        chainId: BSC_CHAIN_ID,
      });
      appendAction({ tool: "TokenManager2.sellToken", summary: `User signed sell: $${tradePick.symbol}`, txHash: sellHash, status: "pending" });

      setTradeStatus("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: sellHash, timeout: 60_000 });

      const result: TradeResult = {
        action: "sell",
        txHash: sellHash,
        bscScanUrl: `https://bscscan.com/tx/${sellHash}`,
        symbol: tradePick.symbol,
        status: receipt?.status === "success" ? "success" : "pending",
      };
      setTradeResult(result);
      setTradeStatus(result.status === "success" ? "success" : "fail");
      appendAction({
        tool: "TokenManager2.sellToken",
        summary: `Sell ${result.status === "success" ? "confirmed" : "failed"}: $${tradePick.symbol}`,
        txHash: sellHash,
        status: result.status === "success" ? "ok" : "error",
      });

      const pulse: TradePulseEvent = {
        kind: "exit",
        icon: "🧘",
        labelEn: "LIVE Exit",
        labelZh: "真实卖出",
        detailEn: `Sold $${tradePick.symbol} on four.meme`,
        detailZh: `在 four.meme 卖出 $${tradePick.symbol}`,
        token: `$${tradePick.symbol}`,
        move: "closed",
        color: "#00D4FF",
        vitals: { energy: 6, satiety: 4, memeScore: 3 },
        xp: 14,
        mood: "neutral",
        reaction: "neutral",
      };
      handleTradePulse(pulse);

      const zh = petState.lang === "zh";
      const msg = zh
        ? `$${tradePick.symbol} 已清仓，tx: ${sellHash.slice(0, 10)}...`
        : `Closed $${tradePick.symbol}. tx: ${sellHash.slice(0, 10)}...`;
      if (!chatStarted) startChat();
      setTimeout(() => sendMessage(msg), 200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const rejected = /rejected|denied|user/i.test(msg);
      setTradeError(rejected ? "Signature declined." : msg);
      setTradeStatus("fail");
      appendAction({ tool: "TokenManager2.sellToken", summary: rejected ? "User declined signature" : `Error: ${msg.slice(0, 80)}`, status: "error" });
    }
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
        appendAction({
          tool: "EIP-8004.register",
          summary: `Minted Agent #${data.agentId}`,
          txHash: data.txHash,
          status: "ok",
        });
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

  // ── Floating corner orb (minimized mode) ─────────────────────
  if (minimized) {
    const pulseLabel = lastTradePulse
      ? `${lastTradePulse.icon} ${lastTradePulse.token} ${lastTradePulse.move}`
      : null;
    return (
      <div
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {/* Tooltip bubble — last trade event or mood */}
        {pulseLabel && (
          <div
            style={{
              background: "rgba(15,10,30,0.92)",
              border: `1px solid ${accentColor}40`,
              borderRadius: 12,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: accentColor,
              backdropFilter: "blur(8px)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: `0 4px 20px ${accentColor}25`,
            }}
          >
            {pulseLabel}
          </div>
        )}

        {/* Orb */}
        <div
          onClick={() => setMinimized(false)}
          title="Expand MemePet"
          style={{
            width: 88,
            height: 88,
            borderRadius: "50%",
            background: accentGradient,
            padding: 3,
            boxShadow: `0 0 28px ${accentColor}66, 0 8px 32px rgba(0,0,0,0.7)`,
            cursor: "pointer",
            pointerEvents: "auto",
            animation: "orb-float 3s ease-in-out infinite",
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* Inner dark circle with emoji */}
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #1e1245, #0d0a20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 42,
                lineHeight: 1,
                animation: "pet-breathe 2.8s ease-in-out infinite",
                filter: `drop-shadow(0 2px 8px ${accentColor}88)`,
                userSelect: "none",
              }}
            >
              {petState.emoji}
            </span>
          </div>

          {/* Mood badge */}
          <div
            style={{
              position: "absolute",
              bottom: 1,
              right: 1,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#1a1030",
              border: `2px solid ${accentColor}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
            }}
          >
            {moodEmoji}
          </div>
        </div>

        {/* "expand" hint label */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.3)",
            pointerEvents: "none",
            textAlign: "center",
            letterSpacing: "0.05em",
          }}
        >
          tap to expand
        </div>

        <style>{`
          @keyframes orb-float {
            0%,100% { transform: translateY(0px) scale(1); }
            50%      { transform: translateY(-6px) scale(1.02); }
          }
        `}</style>
      </div>
    );
  }

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

        {/* ── NavBar ── */}
        <NavBar
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page)}
          zh={petState.lang === "zh"}
          onShare={() => setShowShareCard(true)}
          onReset={onReset}
        />

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

        <div className="market-tape px-5 sm:px-7 py-2 text-[11px] font-black font-signal">
          <span className="text-white/35">{zh ? "孵化完成" : "JUST HATCHED"} </span>
          <span className="ticker-pill">DNA <span className="ticker-up">{dna?.tradingStyle?.toUpperCase() ?? "MEME"}</span></span>
          <span className="ticker-pill">MOOD <span className="ticker-hot">{petState.mood.toUpperCase()}</span></span>
          <span className="ticker-pill">MEME <span className="ticker-up">{liveMeme}/100</span></span>
          <span className="hidden sm:inline text-white/30">{zh ? "宠物已上线，触发交易脉冲看它实时反应。" : "Pet is live. Trigger trade pulses and watch it react."}</span>
        </div>

        <main className="flex-1 px-5 sm:px-7 py-7">
          <div className="max-w-7xl mx-auto space-y-5 lg:space-y-6">
            {/* ── Wallet DNA source banner ───────────────────────── */}
            {(() => {
              const hasDna = !!petState.walletAddress;
              const connectedMatches = isConnected && userAddress && petState.walletAddress?.toLowerCase() === userAddress.toLowerCase();
              return (
                <div
                  className="trader-card rounded-[22px] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3"
                  style={{
                    borderColor: hasDna ? "rgba(0,255,170,0.3)" : "rgba(255,209,102,0.3)",
                    background: hasDna ? "rgba(0,255,170,0.03)" : "rgba(255,209,102,0.03)",
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl flex-shrink-0">{hasDna ? "🧬" : "🔗"}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: hasDna ? "#00FFAA" : "#FFD166" }}>
                        {hasDna
                          ? (zh ? "链上 DNA 已同步" : "ON-CHAIN DNA SYNCED")
                          : (zh ? "连接钱包 · 解锁链上 DNA" : "CONNECT WALLET · UNLOCK ON-CHAIN DNA")}
                      </div>
                      <div className="text-sm mt-0.5 text-white/60 truncate">
                        {autoAnalyzing
                          ? (zh ? "Moralis 分析中 · 宠物风格和标签即将更新…" : "Moralis analyzing · pet style + tags updating…")
                          : hasDna
                          ? (zh
                              ? `${petState.walletAddress?.slice(0, 6)}…${petState.walletAddress?.slice(-4)} · 风格 ${dna?.tradingStyle ?? "custom"} · 原型 ${dna?.petArchetype ?? "hype"}`
                              : `${petState.walletAddress?.slice(0, 6)}…${petState.walletAddress?.slice(-4)} · style ${dna?.tradingStyle ?? "custom"} · archetype ${dna?.petArchetype ?? "hype"}`)
                          : (zh
                              ? "你的宠物是用自定义性格孵化的。连钱包 → 我们读你的 BSC 交易历史 → 给宠物换成你真实的交易风格 + 标签。"
                              : "Your pet hatched from a custom personality. Connect your wallet → we read your BSC history → re-theme the pet with your real trading style + tags.")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {connectedMatches ? (
                      <span
                        className="trader-chip px-2.5 py-1 text-[11px] font-signal"
                        style={{ background: "rgba(0,255,170,0.1)", borderColor: "rgba(0,255,170,0.35)", color: "#00FFAA" }}
                      >
                        {zh ? "✓ 已验证" : "✓ Verified"}
                      </span>
                    ) : null}
                    <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
                  </div>
                </div>
              );
            })()}

          {currentPage === "playground" && (
            <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-5">
              {/* Rank Tab */}
              <div className="flex items-center gap-2 mb-2">
                {(["social", "rank"] as const).map((t) => (
                  <button key={t} onClick={() => setPlaygroundTab(t)}
                    className="px-4 py-1.5 rounded-lg text-sm font-black transition-all"
                    style={{
                      background: playgroundTab === t ? "rgba(0,255,170,0.18)" : "transparent",
                      color: playgroundTab === t ? "#00FFAA" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${playgroundTab === t ? "rgba(0,255,170,0.4)" : "transparent"}`,
                    }}>
                    {t === "social" ? (zh ? "🐾 社交日志" : "🐾 Social Log") : (zh ? "📊 排行" : "📊 Rank")}
                  </button>
                ))}
              </div>

              {playgroundTab === "rank" ? (
                <PetRank petState={petState} zh={zh} />
              ) : (
                <>
                  {/* Go to Playground button */}
                  <div className="trader-card rounded-[24px] p-5 text-center">
                    <div className="text-3xl mb-3">🌳</div>
                    <div className="text-sm font-black mb-1" style={{ color: "#FF6BAA" }}>
                      {zh ? "游乐场" : "Playground"}
                    </div>
                    <p className="text-xs text-white/48 mb-4">
                      {zh ? "点击后宠物自动进场社交，遭遇结果会出现在下方日志里。" : "Tap to send your pet into the playground. Match results appear in the log below."}
                    </p>
                    <button
                      onClick={() => appendAction({ tool: "playground.enter", summary: `${petState.name} entered the playground and is socializing…`, status: "ok" })}
                      className="trader-action rounded-2xl py-2.5 px-6 text-sm font-black"
                      style={{ color: "#FF6BAA", borderColor: "rgba(255,107,170,0.4)" }}>
                      {zh ? "进入游乐场 →" : "Go to Playground →"}
                    </button>
                  </div>

                  {/* Interaction log */}
                  <div className="trader-terminal rounded-[24px] p-5">
                    <div className="text-xs font-black font-signal tracking-[0.18em] mb-4" style={{ color: "#00FFAA" }}>
                      {zh ? "互动日志" : "INTERACTION LOG"}
                    </div>
                    {agentActions.length === 0 ? (
                      <p className="text-xs text-white/32 italic">{zh ? "还没有互动记录。" : "No interactions yet."}</p>
                    ) : (
                      <div className="space-y-2">
                        {[...agentActions].reverse().slice(0, 20).map((a, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span style={{ color: a.status === "ok" ? "#00FFAA" : a.status === "error" ? "#FF6B6B" : "#FFD166" }}>
                              {a.status === "ok" ? "●" : a.status === "error" ? "✕" : "○"}
                            </span>
                            <span className="text-white/60 leading-relaxed">{a.summary}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {currentPage === "home" && <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-5 lg:gap-6 items-start">
            <section className="flex flex-col gap-4">
            <div className="trader-card rounded-[34px] p-5 sm:p-6 text-center">
              <div className="relative z-10 w-full">
                <div className="inline-flex trader-chip trader-chip-hot px-3 py-1 text-xs font-signal mb-4">
                  {zh ? "新宠物已诞生" : "NEW COMPANION ONLINE"}
                </div>

                <div className="relative mx-auto mb-5 w-56 h-56 sm:w-72 sm:h-72">
                  <div className="absolute inset-[-28px] rounded-full blur-3xl opacity-30"
                    style={{ background: accentColor }} />
                  <div className="relative pet-orb rounded-[44px] w-full h-full overflow-hidden">
                    <VRMViewer
                      url={USER_PET_VRM}
                      mood={petState.mood === "happy" ? "happy" : petState.mood === "disappointed" ? "sad" : "neutral"}
                      framing="portrait"
                      fallbackEmoji={petState.emoji}
                    />
                  </div>
                  <div className="absolute -bottom-3 -right-3 rounded-2xl px-3 py-2 trader-terminal">
                    <span className="text-2xl">{moodEmoji}</span>
                  </div>
                </div>

                {/* Tags above name */}
                {introTags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    {introTags.map(tag => (
                      <span key={tag} className="trader-chip px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-none mb-2"
                  style={{ textShadow: `0 0 34px ${accentColor}66` }}>
                  {petState.name}
                </h1>

                {/* Identity — personality + on-chain status */}
                <p className="text-sm text-white/52 italic mb-3">{petState.personality}</p>

                {/* Feed + Chat */}
                <div className="flex gap-3 mb-4">
                  <button onClick={handleFeedMarket} disabled={feedingMarket || sending}
                    className="flex-1 trader-action rounded-2xl py-2.5 px-3 text-sm font-black disabled:opacity-45"
                    style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.25)" }}>
                    {feedingMarket ? (zh ? "喂养中…" : "Feeding…") : (zh ? "🍖 喂市场" : "🍖 Feed")}
                  </button>
                  <button onClick={() => { setChatStarted(true); setShowChatPanel(true); setTimeout(() => inputRef.current?.focus(), 80); }}
                    className="flex-1 trader-action rounded-2xl py-2.5 px-3 text-sm font-black"
                    style={{ color: accentColor, borderColor: `${accentColor}40` }}>
                    {zh ? "💬 聊天" : "💬 Chat"}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="text-xs px-3 py-1 rounded-full font-black"
                    style={{ background: petState.agentId != null ? "rgba(0,255,170,0.15)" : "rgba(255,255,255,0.07)", color: petState.agentId != null ? "#00FFAA" : "rgba(255,255,255,0.4)", border: `1px solid ${petState.agentId != null ? "rgba(0,255,170,0.3)" : "rgba(255,255,255,0.1)"}` }}>
                    {petState.agentId != null ? `⛓️ Agent #${petState.agentId}` : (zh ? "⛓️ 待铸造" : "⛓️ Not minted")}
                  </div>
                  <button onClick={() => setShowMintModal(true)} disabled={registering || sending || petState.agentId != null}
                    className="text-xs px-3 py-1 rounded-full font-black disabled:opacity-35 transition-all"
                    style={{ background: "rgba(255,209,102,0.12)", color: "#FFD166", border: "1px solid rgba(255,209,102,0.3)" }}>
                    {petState.agentId != null ? (zh ? "已上链" : "Minted") : (zh ? "铸造" : "Mint")}
                  </button>
                  <button onClick={() => setShowShareCard(true)}
                    className="text-xs px-3 py-1 rounded-full font-black transition-all"
                    style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.25)" }}>
                    {zh ? "分享" : "Share"}
                  </button>
                </div>

                <p className="max-w-md mx-auto text-sm sm:text-base leading-relaxed text-white/58">
                  {greeting || (zh
                    ? "我已经在你的交易桌旁边上线了。绿色我庆祝，红色我陪你回血。"
                    : "I am online beside your trading desk. Green candles get celebration, red candles get company.")}
                </p>

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
            </div>

            {/* ── WALLET DNA / GOALS (moved under PET STATUS) ───── */}
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
          </section>

            <section className="flex flex-col gap-4">
              <PetPlayground petState={petState} onAction={appendAction} />

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

              {/* ── Pet-Recommended Trade (user-signed on four.meme V2) ── */}
              <div className="trader-card rounded-[28px] p-5 sm:p-6" style={{ borderColor: "rgba(0,255,170,0.25)" }}>
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                  <div className="relative z-10 min-w-0">
                    <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: "#FFD166" }}>
                      {zh ? "宠物推荐 × 你签名 · AGENTIC" : "PET-PICKED · YOU SIGN"}
                    </div>
                    <p className="text-sm mt-1 text-white/48">
                      {zh
                        ? "宠物用 DNA 在 four.meme 选币，你用自己的钱包在 BSC 签。"
                        : "Pet picks a four.meme token from its DNA; you sign with your wallet on BSC."}
                    </p>
                  </div>
                  <div className="relative z-10 flex-shrink-0">
                    <ConnectButton showBalance={{ smallScreen: false, largeScreen: true }} chainStatus="icon" />
                  </div>
                </div>

                {isConnected && !onBsc && (
                  <div
                    className="rounded-2xl p-3 text-xs text-white/80 mb-3 flex items-center justify-between gap-3"
                    style={{ background: "rgba(255,209,102,0.08)", border: "1px solid rgba(255,209,102,0.3)" }}
                  >
                    <span>{zh ? "请切换到 BSC 主网" : "Switch to BSC (chainId 56) to trade."}</span>
                    <button
                      onClick={() => switchChain({ chainId: BSC_CHAIN_ID })}
                      className="trader-action rounded-xl px-3 py-1.5 text-xs font-black"
                      style={{ color: "#FFD166", borderColor: "rgba(255,209,102,0.4)" }}
                    >
                      {zh ? "切到 BSC" : "Switch"}
                    </button>
                  </div>
                )}

                {!tradePick ? (
                  <button
                    onClick={handlePickToken}
                    disabled={tradeStatus === "picking" || tradeStatus === "quoting"}
                    className="w-full trader-action rounded-2xl py-3 px-4 text-sm font-black disabled:opacity-45"
                    style={{ color: "#FFD166", borderColor: "rgba(255,209,102,0.35)" }}
                  >
                    {tradeStatus === "picking"
                      ? zh ? "宠物正在扫 four.meme 榜单…" : "Scanning four.meme..."
                      : tradeStatus === "quoting"
                      ? zh ? "Helper3 报价中…" : "Quoting via Helper3..."
                      : zh ? "🐾 让宠物挑一个 token" : "🐾 Let pet pick a token"}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div
                      className="rounded-2xl p-4 flex items-start gap-3"
                      style={{ background: "rgba(0,255,170,0.06)", border: "1px solid rgba(0,255,170,0.22)" }}
                    >
                      {tradePick.img && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={tradePick.img}
                          alt={tradePick.symbol}
                          className="w-12 h-12 rounded-full flex-shrink-0"
                          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-white text-base">${tradePick.symbol}</span>
                          <span className="text-xs text-white/60 truncate">{tradePick.name}</span>
                          <span
                            className="text-[11px] font-black font-signal px-2 py-0.5 rounded"
                            style={{
                              color: tradePick.day1Increase >= 0 ? "#00FFAA" : "#FF6B6B",
                              background:
                                tradePick.day1Increase >= 0
                                  ? "rgba(0,255,170,0.1)"
                                  : "rgba(255,107,107,0.1)",
                            }}
                          >
                            {tradePick.day1Increase >= 0 ? "+" : ""}
                            {tradePick.day1Increase.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[11px] mt-1 text-white/62 leading-relaxed">
                          <span className="font-black text-white/40 mr-1.5">
                            {zh ? "理由：" : "Why:"}
                          </span>
                          {zh ? tradePick.reasonZh : tradePick.reason}
                        </div>
                        <div className="text-[10px] mt-1 text-white/32 font-signal">
                          {zh ? "曲线" : "curve"} {tradePick.progress.toFixed(0)}% · {tradePick.holders} {zh ? "持有者" : "holders"} ·{" "}
                          <a
                            href={`https://bscscan.com/token/${tradePick.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-dotted"
                          >
                            {tradePick.address.slice(0, 6)}...{tradePick.address.slice(-4)}
                          </a>
                        </div>
                        {tradeQuote && (
                          <div className="text-[11px] mt-2 font-black" style={{ color: "#00FFAA" }}>
                            {zh ? "预计" : "Estimate"}: {tradeFunds} BNB → ~{Math.round(tradeQuote.estimatedTokens).toLocaleString()} ${tradePick.symbol}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleExecuteBuy}
                        disabled={!isConnected || !onBsc || tradeStatus === "awaiting-signature" || tradeStatus === "confirming" || tradeStatus === "approving"}
                        className="trader-action rounded-2xl py-3 px-3 text-sm font-black disabled:opacity-45"
                        style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.35)" }}
                      >
                        {tradeStatus === "awaiting-signature"
                          ? zh ? "钱包签名中…" : "Sign in wallet..."
                          : tradeStatus === "confirming"
                          ? zh ? "等待确认…" : "Confirming..."
                          : !isConnected
                          ? zh ? "先连钱包" : "Connect wallet"
                          : !onBsc
                          ? zh ? "切到 BSC" : "Switch to BSC"
                          : zh ? `用 ${tradeFunds} BNB 买入` : `Buy with ${tradeFunds} BNB`}
                      </button>
                      <button
                        onClick={handleExecuteSell}
                        disabled={!isConnected || !onBsc || tradeStatus === "awaiting-signature" || tradeStatus === "confirming" || tradeStatus === "approving"}
                        className="trader-action rounded-2xl py-3 px-3 text-sm font-black disabled:opacity-45"
                        style={{ color: "#00D4FF", borderColor: "rgba(0,212,255,0.35)" }}
                      >
                        {tradeStatus === "approving"
                          ? zh ? "授权中…" : "Approving..."
                          : zh ? "清仓卖出" : "Sell all"}
                      </button>
                      <button
                        onClick={handlePickToken}
                        disabled={tradeStatus === "picking" || tradeStatus === "quoting" || tradeStatus === "awaiting-signature" || tradeStatus === "confirming"}
                        className="trader-action rounded-2xl py-3 px-3 text-sm font-black disabled:opacity-45 col-span-2"
                        style={{ color: "#A78BFA", borderColor: "rgba(167,139,250,0.3)" }}
                      >
                        {zh ? "换一个 token" : "Pick another token"}
                      </button>
                    </div>
                  </div>
                )}

                {tradeError && (
                  <div
                    className="mt-3 rounded-2xl p-3 text-xs leading-relaxed break-all"
                    style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.28)", color: "#FF9999" }}
                  >
                    {tradeError}
                  </div>
                )}

                {tradeResult && (
                  <div
                    className="mt-3 rounded-2xl p-3 text-xs leading-relaxed flex items-center justify-between gap-3"
                    style={{ background: "rgba(0,255,170,0.08)", border: "1px solid rgba(0,255,170,0.28)", color: "#AAFFD5" }}
                  >
                    <div>
                      <div className="font-black text-white">
                        {tradeResult.action === "buy"
                          ? zh
                            ? `在 BSC 上买入 $${tradeResult.symbol} 已广播 🎉`
                            : `Buy ${tradeResult.symbol} broadcast on BSC 🎉`
                          : zh
                          ? `在 BSC 上卖出 $${tradeResult.symbol} 已广播 🎉`
                          : `Sell ${tradeResult.symbol} broadcast on BSC 🎉`}
                      </div>
                      <div className="text-[10px] font-signal mt-0.5 opacity-70">
                        {tradeResult.status === "success"
                          ? zh ? "已上链确认" : "confirmed"
                          : tradeResult.status === "pending"
                          ? zh ? "等待确认…" : "pending confirmation"
                          : zh ? "回滚" : "reverted"}
                      </div>
                    </div>
                    <a
                      href={tradeResult.bscScanUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-shrink-0 trader-action rounded-xl px-3 py-2 text-xs font-black"
                      style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.4)" }}
                    >
                      BscScan →
                    </a>
                  </div>
                )}

                <div className="mt-3 text-[10px] text-white/32 font-signal">
                  {zh
                    ? "交易由你自己的钱包签 · 0.001 BNB / 次（上限 0.005）· 此非投资建议"
                    : "You sign from your wallet · 0.001 BNB/trade (cap 0.005) · Not financial advice"}
                </div>
              </div>

              {/* ── Agent Actions Log (tool-use timeline) ──────────── */}
              <div className="trader-terminal rounded-[28px] p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: "#A78BFA" }}>
                    {zh ? "AGENT 调用日志" : "AGENT ACTIONS"}
                  </div>
                  <span className="text-[10px] font-signal text-white/40">
                    {agentActions.length} {zh ? "条" : "calls"}
                  </span>
                </div>
                {agentActions.length === 0 ? (
                  <div className="text-xs text-white/40 font-signal">
                    {zh
                      ? "还没有工具调用 —— 让宠物挑币、喂市场或聊天就会开始记录。"
                      : "No tool calls yet — pick a token, feed the market, or chat to start the log."}
                  </div>
                ) : (
                  <ul className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                    {agentActions.map((a) => {
                      const color = a.status === "error" ? "#FF6B6B" : a.status === "pending" ? "#FFD166" : "#00FFAA";
                      return (
                        <li
                          key={a.id}
                          className="rounded-xl px-3 py-2 text-[11px] leading-relaxed flex items-start gap-2"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          <span
                            className="font-signal font-black text-[10px] flex-shrink-0 mt-[1px]"
                            style={{ color }}
                          >
                            {a.status === "error" ? "✕" : a.status === "pending" ? "⋯" : "✓"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-black font-signal" style={{ color: "#A78BFA" }}>
                                {a.tool}
                              </span>
                              <span className="text-white/30 text-[9px] font-signal">
                                {new Date(a.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="text-white/72 mt-0.5 break-words">{a.summary}</div>
                            {a.txHash && (
                              <a
                                href={`https://bscscan.com/tx/${a.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] underline decoration-dotted"
                                style={{ color: "#00FFAA" }}
                              >
                                {a.txHash.slice(0, 10)}...{a.txHash.slice(-6)} ↗
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

            </section>
          </div>
          }  {/* end currentPage === "home" */}
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

            {/* Quick-reply buttons */}
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {[
                { icon: "🔥", label: "Hot Today", labelZh: "今日热榜", action: () => handleTodayRankings(), color: "#ff9340", bg: "rgba(255,107,0,0.12)" },
                { icon: "📡", label: "Market Pulse", labelZh: "市场脉搏", action: () => handleMarketPulse(), color: "#00D4FF", bg: "rgba(0,212,255,0.1)" },
                { icon: "✅", label: "Check In", labelZh: "每日打卡", action: () => { setChatStarted(true); sendMessage(zh ? "我今天完成了打卡！" : "I completed my daily check-in!"); }, color: "rgba(255,255,255,0.75)", bg: "rgba(255,255,255,0.06)" },
                { icon: "📊", label: "My Patterns", labelZh: "行为分析", action: () => startChat(zh ? "分析一下我最近的交易行为？" : "Analyze my recent trading behavior."), color: "#a78bfa", bg: "rgba(139,92,246,0.12)" },
              ].map((b) => (
                <button key={b.label} onClick={b.action} disabled={sending}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black disabled:opacity-40 transition-all"
                  style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}44` }}>
                  {b.icon} {zh ? b.labelZh : b.label}
                </button>
              ))}
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
          <button
            onClick={() => setMinimized(true)}
            title="Minimize to corner / 缩小到角落"
            className="trader-action text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
            style={{ color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.12)" }}
          >
            🪟 Float
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

              {/* Quick-reply buttons */}
              <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { icon: "🔥", label: "Hot Today", labelZh: "今日热榜", action: () => handleTodayRankings(), color: "#ff9340", bg: "rgba(255,107,0,0.12)" },
                  { icon: "📡", label: "Market Pulse", labelZh: "市场脉搏", action: () => handleMarketPulse(), color: "#00D4FF", bg: "rgba(0,212,255,0.1)" },
                  { icon: "✅", label: "Check In", labelZh: "每日打卡", action: () => { setChatStarted(true); sendMessage(petState.lang === "zh" ? "我今天完成了打卡！" : "I completed my daily check-in!"); }, color: "rgba(255,255,255,0.75)", bg: "rgba(255,255,255,0.06)" },
                  { icon: "📊", label: "My Patterns", labelZh: "行为分析", action: () => startChat(petState.lang === "zh" ? "分析一下我最近的交易行为？" : "Analyze my recent trading behavior."), color: "#a78bfa", bg: "rgba(139,92,246,0.12)" },
                ].map((b) => (
                  <button key={b.label} onClick={b.action} disabled={sending}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black disabled:opacity-40 transition-all"
                    style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}44` }}>
                    {b.icon} {petState.lang === "zh" ? b.labelZh : b.label}
                  </button>
                ))}
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
