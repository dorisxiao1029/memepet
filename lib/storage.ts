import { nanoid } from "nanoid";
import type { PetState, Goal, Message, Mood } from "./types";

const STORAGE_KEY = "petState";
const MAX_HISTORY = 20;

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
  goalTexts: string[]
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
    xp: 75, // start at 75 so judges see a level-up in ~2 interactions
    level: 1,
    goals,
    conversationHistory: [],
    onboardedAt: Date.now(),
    lastInteractionAt: Date.now(),
  };
}

export function appendMessage(state: PetState, message: Message): PetState {
  const history = [...state.conversationHistory, message];
  // Keep last MAX_HISTORY messages
  const trimmed =
    history.length > MAX_HISTORY
      ? history.slice(history.length - MAX_HISTORY)
      : history;

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
