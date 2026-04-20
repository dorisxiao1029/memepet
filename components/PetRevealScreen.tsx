"use client";

import { useEffect, useState } from "react";
import type { PetState } from "@/lib/types";

interface Props {
  petState: PetState;
  onStartChat: (initialMsg?: string) => void;
}

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
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function PetRevealScreen({ petState, onStartChat }: Props) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [visible, setVisible] = useState(false);

  const eggColor = petState.emoji === "💙" ? "blue" : "pink";
  const accentColor = eggColor === "pink" ? "#FF00AA" : "#00AAFF";
  const accentGradient = eggColor === "pink"
    ? "linear-gradient(135deg, #FF00AA, #A78BFA)"
    : "linear-gradient(135deg, #00AAFF, #00FFAA)";

  useEffect(() => {
    // Entrance animation
    requestAnimationFrame(() => setVisible(true));
    // Stop confetti after 3.5s
    const t = setTimeout(() => setShowConfetti(false), 3500);
    return () => clearTimeout(t);
  }, []);

  const activeGoals = petState.goals.filter((g) => g.status === "active");
  const lang = petState.lang ?? "en";
  const isZh = lang === "zh";

  function handleStartChat() {
    onStartChat();
  }

  function handleTodayCompanion() {
    const msg = isZh
      ? "今天的热榜怎么样？帮我看看有没有值得关注的机会，结合我的交易目标分析一下。"
      : "What's on the hot list today? Analyze it for me in line with my trading goals.";
    onStartChat(msg);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(135deg, #0D0D1A 0%, #1a0d2e 50%, #0d1a2e 100%)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      {showConfetti && <Confetti />}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐾</span>
          <span className="font-black text-white/80 text-sm">Meme<span style={{ color: accentColor }}>Pet</span></span>
        </div>
        <div
          className="text-xs font-bold px-3 py-1 rounded-full"
          style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
        >
          ✨ {isZh ? "新 Pet 已诞生！" : "New Pet Born!"}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">

        {/* ── LEFT: Pet card ── */}
        <div className="lg:w-[42%] flex flex-col items-center justify-center py-10 px-6 relative">
          {/* Glow behind pet */}
          <div
            className="absolute w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ background: accentColor }}
          />

          {/* Pet avatar frame */}
          <div
            className="relative z-10 rounded-3xl p-0.5 mb-5"
            style={{ background: accentGradient, boxShadow: `0 0 40px ${accentColor}44` }}
          >
            <div
              className="rounded-[22px] flex items-center justify-center"
              style={{ width: 200, height: 200, background: "#1a1030" }}
            >
              <span
                className="pet-breathe select-none"
                style={{ fontSize: 96, lineHeight: 1, filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.5))" }}
              >
                {petState.emoji === "🌸" ? "🌸" : petState.emoji === "💙" ? "💙" : petState.emoji}
              </span>
            </div>
          </div>

          {/* Name */}
          <h2 className="text-3xl font-black text-white text-center mb-2" style={{ textShadow: `0 0 20px ${accentColor}66` }}>
            {petState.name}
          </h2>

          {/* Badges row */}
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {petState.memeStyle && (
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
              >
                {petState.memeStyle}
              </span>
            )}
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
              Lv.{petState.level}
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
              {petState.xp} XP
            </span>
          </div>

          {/* XP bar */}
          <div className="w-full max-w-[200px]">
            <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              <span>{isZh ? "成长值" : "Growth"}</span>
              <span>{petState.xp}/100</span>
            </div>
            <div className="h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, petState.xp)}%`, background: accentGradient }}
              />
            </div>
          </div>

          {/* On-chain status */}
          <div
            className="mt-4 flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}
          >
            <span style={{ color: petState.agentId != null ? "#00FFAA" : "rgba(255,255,255,0.3)" }}>⛓</span>
            {petState.agentId != null
              ? (isZh ? `链上身份已铸造 #${petState.agentId}` : `On-chain ID #${petState.agentId}`)
              : (isZh ? "链上身份待铸造" : "On-chain identity pending")}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px bg-white/8 my-8" />
        <div className="lg:hidden h-px bg-white/8 mx-6" />

        {/* ── RIGHT: Info & Actions ── */}
        <div className="lg:w-[58%] flex flex-col justify-center py-10 px-6 lg:px-10 gap-6">

          {/* Core trading goal — most prominent */}
          {activeGoals.length > 0 && (
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                {isZh ? "核心 Trading 目标" : "Core Trading Goal"}
              </p>
              <div
                className="rounded-2xl p-4"
                style={{
                  background: `${accentColor}12`,
                  border: `1px solid ${accentColor}30`,
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                <p className="text-lg font-black text-white leading-snug">
                  {activeGoals[0].text}
                </p>
                {activeGoals[1] && (
                  <p className="text-sm font-semibold mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                    + {activeGoals[1].text}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Personality */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>
              {isZh ? "性格描述" : "Personality"}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              {petState.personality}
            </p>
          </div>

          {/* Action strategy hint */}
          <div
            className="rounded-xl p-3 text-xs leading-relaxed"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
          >
            {isZh
              ? `🎯 ${petState.name} 会用 meme + 热榜分析陪伴你，小赚时疯狂庆祝，亏损时坐在旁边陪你回血。`
              : `🎯 ${petState.name} will use memes & hot-list analysis to stay beside your trades — celebrate wins and comfort red candles in real time.`}
          </div>

          {/* ── 3 Action buttons ── */}
          <div className="flex flex-col gap-3">
            {/* Primary */}
            <button
              onClick={handleStartChat}
              className="w-full py-4 rounded-2xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: accentGradient,
                color: "#fff",
                boxShadow: `0 0 24px ${accentColor}55`,
              }}
            >
              🚀 {isZh ? `开始和 ${petState.name} 聊天` : `Start Chatting with ${petState.name}`}
            </button>

            {/* Secondary */}
            <button
              onClick={handleTodayCompanion}
              className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-[1.01]"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              🔥 {isZh ? "今日 Trading 陪伴 — 看热榜" : "Today's Trading Companion — Hot List"}
            </button>

            {/* Tertiary — evolution (disabled at start) */}
            <button
              disabled
              className="w-full py-3 rounded-2xl font-bold text-sm cursor-not-allowed"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              🌟 {isZh ? "进化 / 升级 — 互动更多后解锁" : "Evolve — unlock after more interactions"}
            </button>
          </div>

          {/* Trading rules reminder */}
          {activeGoals.length > 0 && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                {isZh ? "你的 Trading 规则（Pet 会帮你监督）" : "Your Trading Rules (Pet will enforce these)"}
              </p>
              <div className="space-y-1">
                {activeGoals.map((g) => (
                  <div key={g.id} className="flex items-center gap-2">
                    <span style={{ color: accentColor, fontSize: 10 }}>✓</span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{g.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
