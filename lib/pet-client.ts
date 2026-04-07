import type {
  OnboardRequest,
  OnboardResponse,
  ChatRequest,
  ChatResponse,
  WalletAnalyzeRequest,
  WalletSummary,
} from "./types";

export async function onboardPet(data: OnboardRequest): Promise<OnboardResponse> {
  const res = await fetch("/api/pet/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Onboard failed: ${res.status}`);
  return res.json();
}

export async function chatWithPet(data: ChatRequest): Promise<ChatResponse> {
  const res = await fetch("/api/pet/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  return res.json();
}

export async function analyzeWallet(data: WalletAnalyzeRequest): Promise<WalletSummary> {
  const res = await fetch("/api/pet/wallet-analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Wallet analyze failed: ${res.status}`);
  return res.json();
}
