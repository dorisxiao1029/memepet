"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { chatWithPet } from "@/lib/pet-client";
import { appendMessage, applyXp } from "@/lib/storage";
import { T } from "@/lib/i18n";
import type { PetState, Message, Mood, WalletSummary } from "@/lib/types";
import PetAvatar from "./PetAvatar";
import WalletConnect from "./WalletConnect";

interface Props {
  petState: PetState;
  onStateUpdate: (state: PetState) => void;
  onReset: () => void;
}

interface RankingToken {
  name: string;
  symbol: string;
  day1Increase: number;
  day1Vol: number;
  cap: number;
  holders: number;
  progress: number;
}

export default function ChatScreen({ petState, onStateUpdate, onReset }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const [showWalletPanel, setShowWalletPanel] = useState(false);
  const [xpPopup, setXpPopup] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const lang = petState.lang ?? "en";
  const t = T[lang];
  const eggColor = petState.emoji === "💙" ? "blue" : "pink";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [petState.conversationHistory]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    if (!text) setInput("");
    setSending(true);

    const userMessage: Message = { role: "user", content: msg, timestamp: Date.now() };
    let updated = appendMessage(petState, userMessage);
    onStateUpdate(updated);

    try {
      const response = await chatWithPet({
        message: msg,
        petState: updated,
        goals: updated.goals,
        conversationHistory: updated.conversationHistory.slice(-20),
        walletSummary: updated.walletSummary,
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
        reaction: response.reaction,
      };
      updated = appendMessage(updated, assistantMessage);

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
      onStateUpdate(updated);
    } catch {
      updated = appendMessage(updated, { role: "assistant", content: "😢 Something went wrong, try again?", timestamp: Date.now() });
      onStateUpdate(updated);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, petState, onStateUpdate]);

  async function handleWalletConnected(address: string, walletData: WalletSummary) {
    const updated: PetState = { ...petState, walletAddress: address, walletSummary: walletData.summary, walletAnalyzedAt: Date.now() };
    onStateUpdate(updated);
    setShowWalletPanel(false);
    setSending(true);
    try {
      const response = await chatWithPet({
        message: lang === "zh" ? "我刚刚连接了我的钱包。" : "I just connected my wallet.",
        petState: updated,
        goals: updated.goals,
        conversationHistory: updated.conversationHistory.slice(-20),
        walletSummary: walletData.summary,
      });
      const userMsg: Message = { role: "user", content: lang === "zh" ? "我刚刚连接了我的钱包。" : "I just connected my wallet.", timestamp: Date.now() };
      const assistantMsg: Message = { role: "assistant", content: response.reply, timestamp: Date.now(), reaction: response.reaction };
      let next = appendMessage(updated, userMsg);
      next = appendMessage(next, assistantMsg);
      if (response.xpDelta) { next = applyXp(next, response.xpDelta, response.moodUpdate as Mood | undefined); setXpPopup(response.xpDelta); setTimeout(() => setXpPopup(null), 1800); }
      onStateUpdate(next);
    } finally { setSending(false); }
  }

  async function handleTodayRankings() {
    setSending(true);
    try {
      const res = await fetch("/api/pet/rankings");
      const { tokens }: { tokens: RankingToken[] } = await res.json();
      const lines = tokens.map((tk, i) =>
        `${i + 1}. ${tk.name}(${tk.symbol}) ${tk.day1Increase >= 0 ? "+" : ""}${tk.day1Increase.toFixed(1)}% | Vol $${(tk.day1Vol / 1000).toFixed(0)}K | ${tk.holders} holders`
      ).join("\n");
      await sendMessage(t.rankingPrompt(lines));
    } catch { setSending(false); }
  }

  async function handleMintIdentity() {
    setRegistering(true);
    setShowMintModal(false);
    try {
      const res = await fetch("/api/pet/register-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petName: petState.name, personality: petState.personality, emoji: petState.emoji }),
      });
      const data = await res.json();
      if (data.agentId != null) {
        const updated: PetState = { ...petState, agentId: data.agentId };
        onStateUpdate(updated);
        await sendMessage(
          lang === "zh"
            ? `太好了！我的BSC链上身份已铸造，Agent ID #${data.agentId}！tx: ${data.txHash?.slice(0, 10)}...`
            : `My on-chain identity is minted! Agent ID #${data.agentId} on BSC. tx: ${data.txHash?.slice(0, 10)}...`
        );
      } else {
        await sendMessage(lang === "zh" ? "链上身份注册失败，可能是钱包余额不足或网络问题。" : "Identity minting failed — wallet may need BNB for gas.");
      }
    } catch {
      setSending(false);
    } finally {
      setRegistering(false);
    }
  }

  const activeGoals = petState.goals.filter((g) => g.status === "active");

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex flex-col max-w-2xl mx-auto relative">

      {/* XP popup */}
      {xpPopup !== null && (
        <div className="absolute top-20 right-4 z-50 xp-pop pointer-events-none">
          <div className={`text-white text-sm font-black px-3 py-1.5 rounded-full shadow-lg
            ${eggColor === "pink" ? "bg-gradient-to-r from-pink-400 to-rose-500" : "bg-gradient-to-r from-blue-400 to-sky-500"}`}>
            +{xpPopup} XP ✨
          </div>
        </div>
      )}

      {/* Level up banner */}
      {levelUpFlash && (
        <div className={`absolute inset-x-0 top-0 z-40 text-white text-center py-2.5 text-sm font-black animate-pulse shadow-lg
          ${eggColor === "pink" ? "bg-gradient-to-r from-pink-400 to-rose-500" : "bg-gradient-to-r from-blue-400 to-sky-500"}`}>
          🎉 LEVEL UP — {petState.name} → Lv.{petState.level}！🎉
        </div>
      )}

      {/* Mint modal */}
      {showMintModal && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="text-4xl">⛓</div>
              <h3 className="font-black text-gray-800 text-lg">
                {lang === "zh" ? "铸造链上身份 NFT" : "Mint On-Chain Identity"}
              </h3>
              <p className="text-sm text-gray-500">
                {lang === "zh"
                  ? `将 ${petState.name} 的身份注册为 EIP-8004 Agent NFT，永久存储在 BSC 链上。需要少量 BNB 支付 gas。`
                  : `Register ${petState.name} as an EIP-8004 Agent NFT on BSC. Requires a small amount of BNB for gas.`}
              </p>
            </div>
            <div className="bg-gray-50 rounded-2xl p-3 space-y-1 text-xs text-gray-500">
              <div className="flex justify-between"><span>{lang === "zh" ? "合约" : "Contract"}</span><span className="font-mono">0x8004...a432</span></div>
              <div className="flex justify-between"><span>{lang === "zh" ? "网络" : "Network"}</span><span>BNB Chain</span></div>
              <div className="flex justify-between"><span>{lang === "zh" ? "标准" : "Standard"}</span><span>EIP-8004 Agent NFT</span></div>
              <div className="flex justify-between"><span>Gas</span><span>~0.0005 BNB</span></div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowMintModal(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors"
              >
                {lang === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleMintIdentity}
                className={`flex-1 py-3 rounded-2xl text-white font-black text-sm transition-all shadow-md hover:shadow-lg
                  ${eggColor === "pink" ? "bg-gradient-to-r from-pink-400 to-rose-500" : "bg-gradient-to-r from-blue-400 to-sky-500"}`}
              >
                {lang === "zh" ? "⛓ 确认铸造" : "⛓ Confirm Mint"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-white/60 shadow-sm ${levelUpFlash ? "mt-10" : ""}`}>
        <PetAvatar
          emoji={petState.emoji}
          name={petState.name}
          mood={petState.mood}
          level={petState.level}
          xp={petState.xp}
          levelUpFlash={levelUpFlash}
          eggColor={eggColor}
        />
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* On-chain badge */}
          {petState.agentId != null && (
            <div className="text-xs px-2 py-1 bg-violet-100 text-violet-600 rounded-full font-bold border border-violet-200">
              {t.onChainBadge}{petState.agentId}
            </div>
          )}
          {!petState.walletAddress ? (
            <button
              onClick={() => setShowWalletPanel(!showWalletPanel)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors
                ${eggColor === "pink" ? "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100" : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"}`}
            >
              {t.connectWallet}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 text-xs font-bold font-mono">
                {petState.walletAddress.slice(0, 6)}...{petState.walletAddress.slice(-4)}
              </span>
            </div>
          )}
          <button onClick={onReset} className="text-gray-300 hover:text-gray-400 text-xs px-1 transition-colors" title={t.resetTitle}>↩</button>
        </div>
      </div>

      {/* Wallet panel */}
      {showWalletPanel && (
        <div className="px-4 py-3 bg-white/70 border-b border-white/50">
          <WalletConnect onConnected={handleWalletConnected} walletAddress={petState.walletAddress} />
        </div>
      )}

      {/* Goals strip */}
      {activeGoals.length > 0 && (
        <div className="px-4 py-2 bg-white/50 border-b border-white/40 flex gap-2 overflow-x-auto scrollbar-hide">
          <span className="text-gray-400 text-xs flex-shrink-0 self-center font-semibold">🎯</span>
          {activeGoals.map((goal) => (
            <div key={goal.id} className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border
              ${eggColor === "pink" ? "bg-pink-50 border-pink-200 text-pink-600" : "bg-blue-50 border-blue-200 text-blue-600"}`}>
              {goal.text}
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 py-2.5 bg-white/40 border-b border-white/40 flex gap-2 overflow-x-auto scrollbar-hide">
        <button onClick={handleTodayRankings} disabled={sending}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 disabled:opacity-40 transition-colors">
          {t.todayRankings}
        </button>
        <button onClick={() => sendMessage(t.checkinMsg)} disabled={sending}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-colors">
          {t.dailyCheckin}
        </button>
        <button onClick={() => sendMessage(t.analysisMsg)} disabled={sending}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100 disabled:opacity-40 transition-colors">
          {t.behaviorAnalysis}
        </button>
        {/* NFT mint button — always visible, opens modal */}
        {petState.agentId == null && (
          <button
            onClick={() => setShowMintModal(true)}
            disabled={registering || sending}
            className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            {registering ? t.minting : t.mintIdentity}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {petState.conversationHistory.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <span className="text-2xl mr-2 flex-shrink-0 mt-0.5 select-none">{petState.emoji}</span>
            )}
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-medium shadow-sm
              ${msg.role === "user"
                ? eggColor === "pink"
                  ? "bg-gradient-to-br from-pink-400 to-rose-500 text-white rounded-br-sm"
                  : "bg-gradient-to-br from-blue-400 to-sky-500 text-white rounded-br-sm"
                : msg.reaction === "reality-check"
                ? "bg-amber-50 border border-amber-200 text-gray-700 rounded-bl-sm"
                : "bg-white border border-gray-100 text-gray-700 rounded-bl-sm"
              }`}>
              {msg.content}
              {msg.reaction === "reality-check" && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-500 font-bold">
                  <span>⛓</span><span>{t.onChainVerify}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <span className="text-2xl mr-2 flex-shrink-0 select-none">{petState.emoji}</span>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3.5 shadow-sm">
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2].map((i) => (
                  <span key={i}
                    className={`w-1.5 h-1.5 rounded-full animate-bounce ${eggColor === "pink" ? "bg-pink-300" : "bg-blue-300"}`}
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 bg-white/80 backdrop-blur border-t border-white/60">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-200 text-sm font-medium shadow-sm transition-all"
            placeholder={`${t.sendPlaceholder} ${petState.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className={`font-black px-5 py-3 rounded-2xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-30 disabled:translate-y-0 text-white text-sm
              ${eggColor === "pink"
                ? "bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600"
                : "bg-gradient-to-r from-blue-400 to-sky-500 hover:from-blue-500 hover:to-sky-600"}`}
          >
            {t.send}
          </button>
        </div>
      </div>
    </div>
  );
}
