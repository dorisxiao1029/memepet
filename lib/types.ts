export type Mood   = "happy" | "neutral" | "disappointed" | "skeptical";
export type Gender = "male" | "female" | "non-binary" | "mystery";
export type GoalStatus = "active" | "hit" | "missed" | "abandoned";
export type FomoScore = "LOW" | "MEDIUM" | "HIGH";
export type Reaction = "reality-check" | "encouragement" | "neutral";
export type TradingStyle = "degen" | "holder" | "scalper" | "quiet" | "recovering";
export type PetArchetype = "hype" | "comfort" | "roast" | "calm";

export interface Goal {
  id: string;
  text: string;
  status: GoalStatus;
  createdAt: number;
  resolvedAt?: number;
  checkInCount: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  reaction?: Reaction;
}

export interface WalletSummary {
  summary: string; // ~100-token string injected into Claude system prompt
  avgHoldDays: number;
  fomoScore: FomoScore;
  biggestLoss: { token: string; percent: number; date: string } | null;
  lastFourMemeTrade: { token: string; action: "buy" | "sell"; date: string } | null;
  totalFourMemeTrades: number;
  tradingDNA: TradingDNA;
}

export interface TradingDNA {
  tradingStyle: TradingStyle;
  petArchetype: PetArchetype;
  headline: string;
  vibe: string;
  tags: string[];
  initialVitals: {
    energy: number;
    satiety: number;
    memeScore: number;
  };
}

export interface PetState {
  // Identity (set at onboarding)
  name: string;
  personality: string;
  emoji: string;
  memeStyle?: string; // e.g. "毒舌" | "暖心" | "狂喜" | "冷静"

  // Identity extras (set at onboarding)
  gender?: Gender;
  personalityTags?: string[];   // e.g. ["ENFP", "💎 Diamond Hands", "⚡ Aggressive"]

  // Dynamic state
  mood: Mood;
  xp: number;
  level: number;

  // Tamagotchi vitals (0-100, decay over time)
  energy: number;    // 精力 — decays 10/4h, restored by interaction
  satiety: number;   // 饱食度 — decays 15/4h, restored by feeding/checkin
  memeScore: number; // Meme指数 — only accumulates, rises with meme discussions

  // Goals
  goals: Goal[];

  // Wallet
  walletAddress?: string;
  walletSummary?: string;
  walletAnalyzedAt?: number;
  tradingDNA?: TradingDNA;

  // Conversation (rolling window, max 20)
  conversationHistory: Message[];

  // Language preference
  lang: "en" | "zh";

  // On-chain identity
  agentId?: number;

  // Metadata
  onboardedAt: number;
  lastInteractionAt: number;
}

// API request/response types

export interface OnboardRequest {
  description: string;
  goals: string[];
  gender?: Gender;
  personalityTags?: string[];
}

export interface OnboardResponse {
  pet: {
    name: string;
    personality: string;
    emoji: string;
    mood: Mood;
    greeting: string;
    memeStyle?: string;
  };
}

export interface ChatRequest {
  message: string;
  petState: PetState;
  goals: Goal[];
  conversationHistory: Message[];
  walletSummary?: string;
  newsContext?: string;  // Live market intelligence from 6551 MCP
}

export interface ChatResponse {
  reply: string;
  moodUpdate?: Mood;
  xpDelta?: number;
  reaction?: Reaction;
}

export interface WalletAnalyzeRequest {
  walletAddress: string;
}

export interface XpRequest {
  event: "checkin" | "goal_hit" | "goal_miss" | "honest_self_report";
  goalId?: string;
}

export interface XpResponse {
  xpDelta: number;
  newTotal: number;
  levelUp: boolean;
  newMood: Mood;
}
