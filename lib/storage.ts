import { nanoid } from "nanoid";
import type { PetState, Goal, Message, Mood, TradingDNA } from "./types";

const STORAGE_KEY = "petState";
const MAX_HISTORY = 20;

// Vitals decay rates (per hour)
const ENERGY_DECAY_PER_HOUR  = 2.5;   // full drain in 40h; -10 per 4h
const SATIETY_DECAY_PER_HOUR = 3.75;  // full drain in 27h; -15 per 4h

export function loadPetState(): PetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PetState;
  } catch {
    return null;
  }
}

export function savePetState(state: PetState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearPetState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function createInitialState(
  name: string,
  personality: string,
  emoji: string,
  mood: Mood,
  goalTexts: string[],
  lang: "en" | "zh" = "en",
  memeStyle?: string,
  gender?: import("./types").Gender,
  personalityTags?: string[],
  tradingDNA?: TradingDNA,
): PetState {
  const goals: Goal[] = goalTexts.map((text) => ({
    id: nanoid(),
    text,
    status: "active",
    createdAt: Date.now(),
    checkInCount: 0,
  }));

  return {
    name,
    personality,
    emoji,
    mood,
    memeStyle,
    gender,
    personalityTags,
    xp: 0,
    level: 1,
    // Start vitals at 90 — a little room to feed right away
    energy: tradingDNA?.initialVitals.energy ?? 90,
    satiety: tradingDNA?.initialVitals.satiety ?? 90,
    memeScore: tradingDNA?.initialVitals.memeScore ?? 0,
    goals,
    lang,
    tradingDNA,
    conversationHistory: [],
    onboardedAt: Date.now(),
    lastInteractionAt: Date.now(),
  };
}

/** Apply time-based vitals decay since lastInteractionAt. */
export function applyTimeDecay(state: PetState): PetState {
  const hours = Math.max(0, (Date.now() - state.lastInteractionAt) / 3_600_000);
  return {
    ...state,
    energy:  Math.max(0, (state.energy  ?? 90) - hours * ENERGY_DECAY_PER_HOUR),
    satiety: Math.max(0, (state.satiety ?? 90) - hours * SATIETY_DECAY_PER_HOUR),
  };
}

/** Restore vitals after interaction — call after every meaningful event. */
export function feedPet(
  state: PetState,
  delta: { energy?: number; satiety?: number; memeScore?: number }
): PetState {
  return {
    ...state,
    energy:    Math.min(100, (state.energy    ?? 0) + (delta.energy    ?? 0)),
    satiety:   Math.min(100, (state.satiety   ?? 0) + (delta.satiety   ?? 0)),
    memeScore: Math.min(100, (state.memeScore ?? 0) + (delta.memeScore ?? 0)),
  };
}

export function appendMessage(state: PetState, message: Message): PetState {
  const history = [...state.conversationHistory, message];
  let trimmed = history;
  if (history.length > MAX_HISTORY) {
    // Always keep index 0 (the pet's opening greeting) so it's never lost
    const greeting = history[0];
    const rest = history.slice(history.length - (MAX_HISTORY - 1));
    trimmed = [greeting, ...rest];
  }
  return {
    ...state,
    conversationHistory: trimmed,
    lastInteractionAt: Date.now(),
  };
}

export function applyXp(state: PetState, xpDelta: number, newMood?: Mood): PetState {
  const newXp = Math.max(0, state.xp + xpDelta);
  const newLevel = Math.min(10, Math.floor(newXp / 100) + 1);
  return {
    ...state,
    xp: newXp,
    level: newLevel,
    mood: newMood ?? state.mood,
  };
}

export function calcXpDelta(event: string): number {
  switch (event) {
    case "checkin": return 10;
    case "goal_hit": return 50;
    case "goal_miss": return -5;
    case "honest_self_report": return 15;
    default: return 0;
  }
}

export function calcMood(xp: number, recentEvent?: string): Mood {
  if (recentEvent === "goal_hit") return "happy";
  if (recentEvent === "goal_miss") return "disappointed";
  if (xp > 200) return "happy";
  if (xp < 50) return "skeptical";
  return "neutral";
}
