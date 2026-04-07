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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [petState.conversationHistory]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);

    // Optimistically add user message
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

      // Add assistant reply
      const assistantMessage: Message = {
        role: "assistant",
        content: response.reply,
        timestamp: Date.now(),
        reaction: response.reaction,
      };

      updated = appendMessage(updated, assistantMessage);

      // Apply XP if awarded
      if (response.xpDelta) {
        const prevLevel = updated.level;
        updated = applyXp(updated, response.xpDelta, response.moodUpdate as Mood | undefined);
        if (updated.level > prevLevel) {
          setLevelUpFlash(true);
          setTimeout(() => setLevelUpFlash(false), 2000);
        }
      } else if (response.moodUpdate) {
        updated = { ...updated, mood: response.moodUpdate };
      }

      onStateUpdate(updated);
    } catch (err) {
      const errMessage: Message = {
        role: "assistant",
        content: "...(something went wrong, try again)",
        timestamp: Date.now(),
      };
      updated = appendMessage(updated, errMessage);
      onStateUpdate(updated);
    } finally {
      setSending(false);
    }
  }

  function handleWalletConnected(address: string, walletData: WalletSummary) {
    const updated: PetState = {
      ...petState,
      walletAddress: address,
      walletSummary: walletData.summary,
      walletAnalyzedAt: Date.now(),
    };
    onStateUpdate(updated);
    setShowWalletPanel(false);

    // Trigger a message from the pet about the wallet data
    const triggerWalletIntro = async () => {
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
        const assistantMsg: Message = {
          role: "assistant",
          content: response.reply,
          timestamp: Date.now(),
          reaction: response.reaction,
        };

        let next = appendMessage(updated, userMsg);
        next = appendMessage(next, assistantMsg);
        if (response.xpDelta) next = applyXp(next, response.xpDelta, response.moodUpdate as Mood | undefined);
        onStateUpdate(next);
      } finally {
        setSending(false);
      }
    };

    triggerWalletIntro();
  }

  const activeGoals = petState.goals.filter((g) => g.status === "active");

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-900">
        <div className="flex items-center gap-3">
          <PetAvatar
            emoji={petState.emoji}
            name={petState.name}
            mood={petState.mood}
            level={petState.level}
            xp={petState.xp}
          />
        </div>
        <div className="flex items-center gap-2">
          {!petState.walletAddress && (
            <button
              onClick={() => setShowWalletPanel(!showWalletPanel)}
              className="text-xs bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 border border-violet-800/50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Connect Wallet
            </button>
          )}
          {petState.walletAddress && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-900/30 border border-emerald-800/40 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 text-xs font-mono">
                {petState.walletAddress.slice(0, 6)}...{petState.walletAddress.slice(-4)}
              </span>
            </div>
          )}
          <button
            onClick={onReset}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors px-2"
          >
            reset
          </button>
        </div>
      </div>

      {/* Level up flash */}
      {levelUpFlash && (
        <div className="bg-violet-600 text-white text-center py-2 text-sm font-medium animate-pulse">
          Level up! Now Level {petState.level}
        </div>
      )}

      {/* Wallet panel */}
      {showWalletPanel && (
        <div className="px-4 py-3 border-b border-gray-900 bg-gray-900/50">
          <WalletConnect
            onConnected={handleWalletConnected}
            walletAddress={petState.walletAddress}
          />
        </div>
      )}

      {/* Goals strip */}
      {activeGoals.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-900 flex gap-2 overflow-x-auto">
          {activeGoals.map((goal) => (
            <div
              key={goal.id}
              className="flex-shrink-0 text-xs bg-gray-900 border border-gray-800 text-gray-400 px-2 py-1 rounded-lg"
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
              <span className="text-2xl mr-2 flex-shrink-0 mt-1">{petState.emoji}</span>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-violet-700 text-white rounded-br-sm"
                  : msg.reaction === "reality-check"
                  ? "bg-amber-900/30 border border-amber-800/40 text-gray-100 rounded-bl-sm"
                  : "bg-gray-900 text-gray-100 rounded-bl-sm"
              }`}
            >
              {msg.content}
              {msg.reaction === "reality-check" && (
                <div className="mt-1.5 text-xs text-amber-500/70">on-chain reality check</div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <span className="text-2xl mr-2 flex-shrink-0">{petState.emoji}</span>
            <div className="bg-gray-900 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-gray-900">
        <div className="flex gap-3">
          <input
            className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 text-sm"
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
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium px-4 py-3 rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
