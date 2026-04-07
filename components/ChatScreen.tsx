"use client";

import { useState, useRef, useEffect } from "react";
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

export default function ChatScreen({ petState, onStateUpdate, onReset }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const [showWalletPanel, setShowWalletPanel] = useState(false);
  const [xpPopup, setXpPopup] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [petState.conversationHistory]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    let updated = appendMessage(petState, userMessage);
    onStateUpdate(updated);

    try {
      const response = await chatWithPet({
        message: text,
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

        // Show XP popup
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
      const errMessage: Message = {
        role: "assistant",
        content: "...(something went wrong, try again)",
        timestamp: Date.now(),
      };
      updated = appendMessage(updated, errMessage);
      onStateUpdate(updated);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

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

      const userMsg: Message = {
        role: "user",
        content: "I just connected my wallet.",
        timestamp: Date.now(),
      };
      const assistantMsg: Message = {
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
        reaction: response.reaction,
      };

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

  const activeGoals = petState.goals.filter((g) => g.status === "active");

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-2xl mx-auto relative">

      {/* XP popup */}
      {xpPopup !== null && (
        <div className="absolute top-16 right-4 z-50 animate-bounce">
          <div className="bg-violet-600 text-white text-sm font-bold px-3 py-1.5 rounded-full shadow-lg">
            +{xpPopup} XP
          </div>
        </div>
      )}

      {/* Level up banner */}
      {levelUpFlash && (
        <div className="absolute inset-x-0 top-0 z-40 bg-gradient-to-r from-yellow-500 to-amber-400 text-black text-center py-2.5 text-sm font-bold animate-pulse shadow-lg">
          ✨ LEVEL UP — Now Level {petState.level}! ✨
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-900 transition-all ${levelUpFlash ? "mt-10" : ""}`}>
        <PetAvatar
          emoji={petState.emoji}
          name={petState.name}
          mood={petState.mood}
          level={petState.level}
          xp={petState.xp}
          levelUpFlash={levelUpFlash}
        />
        <div className="flex items-center gap-2">
          {!petState.walletAddress ? (
            <button
              onClick={() => setShowWalletPanel(!showWalletPanel)}
              className="text-xs bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-800/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              🔗 Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/30 border border-emerald-800/40 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-xs font-mono">
                {petState.walletAddress.slice(0, 6)}...{petState.walletAddress.slice(-4)}
              </span>
            </div>
          )}
          <button
            onClick={onReset}
            className="text-xs text-gray-700 hover:text-gray-500 transition-colors px-1"
            title="Reset pet"
          >
            ↩
          </button>
        </div>
      </div>

      {/* Wallet panel */}
      {showWalletPanel && (
        <div className="px-4 py-3 border-b border-gray-900 bg-gray-900/60">
          <WalletConnect
            onConnected={handleWalletConnected}
            walletAddress={petState.walletAddress}
          />
        </div>
      )}

      {/* Goals strip */}
      {activeGoals.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-900/60 flex gap-2 overflow-x-auto scrollbar-hide">
          <span className="text-gray-600 text-xs flex-shrink-0 self-center">Goals:</span>
          {activeGoals.map((goal) => (
            <div
              key={goal.id}
              className="flex-shrink-0 text-xs bg-gray-900 border border-gray-800/60 text-gray-400 px-2.5 py-1 rounded-lg"
            >
              {goal.text}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {petState.conversationHistory.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <span className="text-2xl mr-2 flex-shrink-0 mt-0.5 select-none">{petState.emoji}</span>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-700 text-white rounded-br-sm"
                  : msg.reaction === "reality-check"
                  ? "bg-amber-950/60 border border-amber-800/30 text-gray-100 rounded-bl-sm"
                  : "bg-gray-900 text-gray-100 rounded-bl-sm"
              }`}
            >
              {msg.content}
              {msg.reaction === "reality-check" && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600">
                  <span>⛓</span>
                  <span>on-chain reality check</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <span className="text-2xl mr-2 flex-shrink-0 select-none">{petState.emoji}</span>
            <div className="bg-gray-900 rounded-2xl rounded-bl-sm px-4 py-3.5">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-gray-900">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-800 text-sm transition-colors"
            placeholder={`Talk to ${petState.name}...`}
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
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-30 text-white font-medium px-5 py-3 rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
