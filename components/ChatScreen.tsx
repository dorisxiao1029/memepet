"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { chatWithPet } from "@/lib/pet-client";
import { appendMessage, applyXp } from "@/lib/storage";
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
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
}

export default function ChatScreen({ petState, onStateUpdate, onReset }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const [showWalletPanel, setShowWalletPanel] = useState(false);
  const [xpPopup, setXpPopup] = useState<number | null>(null);
  const [onChainId, setOnChainId] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      updated = appendMessage(updated, {
        role: "assistant",
        content: "😢 出错了，再试一次？",
        timestamp: Date.now(),
      });
      onStateUpdate(updated);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, petState, onStateUpdate]);

  async function handleWalletConnected(address: string, walletData: WalletSummary) {
    const updated: PetState = {
      ...petState,
      walletAddress: address,
      walletSummary: walletData.summary,
      walletAnalyzedAt: Date.now(),
    };
    onStateUpdate(updated);
    setShowWalletPanel(false);
    setSending(true);

    try {
      const response = await chatWithPet({
        message: "I just connected my wallet.",
        petState: updated,
        goals: updated.goals,
        conversationHistory: updated.conversationHistory.slice(-20),
        walletSummary: walletData.summary,
      });

      const userMsg: Message = { role: "user", content: "I just connected my wallet.", timestamp: Date.now() };
      const assistantMsg: Message = { role: "assistant", content: response.reply, timestamp: Date.now(), reaction: response.reaction };

      let next = appendMessage(updated, userMsg);
      next = appendMessage(next, assistantMsg);
      if (response.xpDelta) {
        next = applyXp(next, response.xpDelta, response.moodUpdate as Mood | undefined);
        setXpPopup(response.xpDelta);
        setTimeout(() => setXpPopup(null), 1800);
      }
      onStateUpdate(next);
    } finally {
      setSending(false);
    }
  }

  async function handleTodayRankings() {
    setSending(true);
    try {
      const res = await fetch("/api/pet/rankings");
      const { tokens }: { tokens: RankingToken[] } = await res.json();

      const rankText = tokens
        .map((t, i) => `${i + 1}. ${t.name}(${t.symbol}) ${t.priceChange24h >= 0 ? "+" : ""}${t.priceChange24h.toFixed(1)}% | Vol $${(t.volume24h / 1000).toFixed(0)}K`)
        .join("\n");

      const prompt = `今天 four.meme 热榜 Top5:\n${rankText}\n\n请用你的性格对这些币评论一下，结合我的trading目标，给我一些看法（中文回复，控制在100字以内）`;
      await sendMessage(prompt);
    } catch {
      setSending(false);
    }
  }

  async function handleRegisterIdentity() {
    setRegistering(true);
    try {
      const res = await fetch("/api/pet/register-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petName: petState.name, personality: petState.personality, emoji: petState.emoji }),
      });
      const data = await res.json();
      if (data.agentId != null) {
        setOnChainId(data.agentId);
        // Pet reacts to getting an on-chain identity
        await sendMessage(`我刚刚帮你在BSC链上注册了你的身份！你的Agent ID是 #${data.agentId}，tx: ${data.txHash?.slice(0, 10)}...`);
      }
    } catch {
      // silently fail — identity is optional
    } finally {
      setRegistering(false);
    }
  }

  const activeGoals = petState.goals.filter((g) => g.status === "active");
  const eggColor = petState.emoji === "💙" ? "blue" : "pink";

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
          🎉 LEVEL UP — {petState.name} 升到 Lv.{petState.level}！🎉
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-white/60 shadow-sm transition-all ${levelUpFlash ? "mt-10" : ""}`}>
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
          {/* On-chain ID badge */}
          {onChainId != null && (
            <div className="text-xs px-2 py-1 bg-violet-100 text-violet-600 rounded-full font-bold border border-violet-200">
              ⛓ Agent #{onChainId}
            </div>
          )}

          {!petState.walletAddress ? (
            <button
              onClick={() => setShowWalletPanel(!showWalletPanel)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-colors border
                ${eggColor === "pink"
                  ? "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100"
                  : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"}`}
            >
              🔗 连接钱包
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 text-xs font-bold font-mono">
                {petState.walletAddress.slice(0, 6)}...{petState.walletAddress.slice(-4)}
              </span>
            </div>
          )}

          <button
            onClick={onReset}
            className="text-gray-300 hover:text-gray-400 transition-colors text-xs px-1"
            title="重置宠物"
          >
            ↩
          </button>
        </div>
      </div>

      {/* Wallet panel */}
      {showWalletPanel && (
        <div className="px-4 py-3 bg-white/70 border-b border-white/60">
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

      {/* Quick action buttons */}
      <div className="px-4 py-2.5 bg-white/40 border-b border-white/40 flex gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={handleTodayRankings}
          disabled={sending}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 disabled:opacity-40 transition-colors"
        >
          🔥 今日热榜
        </button>
        <button
          onClick={() => sendMessage("我今天完成了打卡，帮我记录一下！")}
          disabled={sending}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
        >
          ✅ 每日打卡
        </button>
        <button
          onClick={() => sendMessage("帮我分析一下我最近的trading行为，有什么需要改进的？")}
          disabled={sending}
          className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100 disabled:opacity-40 transition-colors"
        >
          📊 行为分析
        </button>
        {onChainId == null && (
          <button
            onClick={handleRegisterIdentity}
            disabled={registering || sending}
            className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            {registering ? "注册中..." : "⛓ 链上身份"}
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
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-medium shadow-sm
                ${msg.role === "user"
                  ? eggColor === "pink"
                    ? "bg-gradient-to-br from-pink-400 to-rose-500 text-white rounded-br-sm"
                    : "bg-gradient-to-br from-blue-400 to-sky-500 text-white rounded-br-sm"
                  : msg.reaction === "reality-check"
                  ? "bg-amber-50 border border-amber-200 text-gray-700 rounded-bl-sm"
                  : "bg-white border border-gray-100 text-gray-700 rounded-bl-sm"
                }`}
            >
              {msg.content}
              {msg.reaction === "reality-check" && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-500 font-bold">
                  <span>⛓</span>
                  <span>链上数据验证</span>
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
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full animate-bounce
                      ${eggColor === "pink" ? "bg-pink-300" : "bg-blue-300"}`}
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
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
            className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-200 text-sm font-medium transition-all shadow-sm"
            placeholder={`跟 ${petState.name} 说点什么...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className={`font-black px-5 py-3 rounded-2xl transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-30 disabled:translate-y-0 text-white text-sm
              ${eggColor === "pink"
                ? "bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600"
                : "bg-gradient-to-r from-blue-400 to-sky-500 hover:from-blue-500 hover:to-sky-600"}`}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
