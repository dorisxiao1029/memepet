export type Mood = "happy" | "neutral" | "disappointed" | "skeptical";
export type GoalStatus = "active" | "hit" | "missed" | "abandoned";
export type FomoScore = "LOW" | "MEDIUM" | "HIGH";
export type Reaction = "reality-check" | "encouragement" | "neutral";

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
}

export interface PetState {
  // Identity (set at onboarding)
  name: string;
  personality: string;
  emoji: string;

  // Dynamic state
  mood: Mood;
  xp: number;
  level: number;

  // Goals
  goals: Goal[];

  // Wallet
  walletAddress?: string;
  walletSummary?: string;
  walletAnalyzedAt?: number;

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
}

export interface OnboardResponse {
  pet: {
    name: string;
    personality: string;
    emoji: string;
    mood: Mood;
    greeting: string;
  };
}

export interface ChatRequest {
  message: string;
  petState: PetState;
  goals: Goal[];
  conversationHistory: Message[];
  walletSummary?: string;
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
