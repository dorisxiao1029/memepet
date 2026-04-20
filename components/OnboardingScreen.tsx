"use client";

import { useState } from "react";
import { onboardPet } from "@/lib/pet-client";
import { createInitialState } from "@/lib/storage";
import { T, type Lang } from "@/lib/i18n";
import type { PetState } from "@/lib/types";

interface Props {
  onComplete: (state: PetState) => void;
  initialPrompt?: string;
}

type EggColor = "pink" | "blue";
type Phase = "form" | "hatching" | "cracking" | "done";

const EGG_STYLE = {
  pink: {
    bg: "from-pink-300 via-rose-200 to-pink-400",
    glow: "#f9a8d4",
    border: "border-pink-300",
    ring: "ring-pink-400",
    badge: "bg-pink-100 text-pink-600",
    btn: "from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600",
    dot: "bg-pink-400",
    crack: "#e879a0",
    selected: "border-pink-400 ring-4 ring-pink-300 ring-offset-2 shadow-pink-200",
  },
  blue: {
    bg: "from-blue-300 via-sky-200 to-blue-400",
    glow: "#93c5fd",
    border: "border-blue-300",
    ring: "ring-blue-400",
    badge: "bg-blue-100 text-blue-600",
    btn: "from-blue-400 to-sky-500 hover:from-blue-500 hover:to-sky-600",
    dot: "bg-blue-400",
    crack: "#3b9ef0",
    selected: "border-blue-400 ring-4 ring-blue-300 ring-offset-2 shadow-blue-200",
  },
};

function EggSVG({ color, phase }: { color: EggColor; phase: Phase }) {
  const cracking = phase === "cracking" || phase === "done";
  const cfg = EGG_STYLE[color];
  const gradId = `egg-grad-${color}`;
  return (
    <svg viewBox="0 0 120 150" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor={color === "pink" ? "#fce7f3" : "#dbeafe"} />
          <stop offset="60%" stopColor={color === "pink" ? "#f9a8d4" : "#93c5fd"} />
          <stop offset="100%" stopColor={color === "pink" ? "#ec4899" : "#3b82f6"} />
        </radialGradient>
        {cracking && (
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Egg body */}
      <ellipse cx="60" cy="82" rx="45" ry="58" fill={`url(#${gradId})`} />

      {/* Shine */}
      <ellipse cx="44" cy="55" rx="12" ry="18" fill="white" fillOpacity="0.35" transform="rotate(-20 44 55)" />

      {/* Crack lines — appear during cracking phase */}
      {cracking && (
        <g stroke={cfg.crack} strokeWidth="2" strokeLinecap="round" filter="url(#glow)">
          <path d="M60 30 L55 50 L65 60 L58 80" fill="none" opacity="0.9" />
          <path d="M55 50 L45 45" fill="none" opacity="0.7" />
          <path d="M65 60 L75 58" fill="none" opacity="0.7" />
          <path d="M58 80 L52 90 L62 95" fill="none" opacity="0.6" />
        </g>
      )}

      {/* Glow ring during cracking */}
      {cracking && (
        <ellipse
          cx="60" cy="82" rx="47" ry="60"
          fill="none"
          stroke={cfg.crack}
          strokeWidth="3"
          opacity="0.4"
          className="animate-pulse"
        />
      )}

      {/* Baby peek-out during done */}
      {phase === "done" && (
        <text x="60" y="90" textAnchor="middle" fontSize="32" className="animate-bounce">
          ✨
        </text>
      )}
    </svg>
  );
}

const HATCH_STEPS_EN = [
  "Parsing your description...",
  "Sculpting appearance...",
  "Injecting personality & goals...",
  "Preparing on-chain identity...",
];
const HATCH_STEPS_ZH = [
  "解析自然语言...",
  "生成外观...",
  "注入性格与目标...",
  "准备上链身份...",
];

const PARTICLES = ["✨", "⭐", "💫", "🌟", "🔥", "💎", "🚀", "🐾"];

export default function OnboardingScreen({ onComplete, initialPrompt }: Props) {
  const [lang, setLang] = useState<Lang>("en");
  const [eggColor, setEggColor] = useState<EggColor>("pink");
  const [petName, setPetName] = useState("");
  // If a prefill was passed from landing, auto-select Custom personality and pre-fill it
  const [selectedPersonality, setSelectedPersonality] = useState(initialPrompt ? 3 : 0);
  const [customPersonality, setCustomPersonality] = useState(initialPrompt ?? "");
  const [selectedGoals, setSelectedGoals] = useState<Set<number>>(new Set());
  const [customGoal, setCustomGoal] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [hatchStep, setHatchStep] = useState(0);
  const [error, setError] = useState("");

  const t = T[lang];
  const cfg = EGG_STYLE[eggColor];
  const personalities = t.personalities;
  const isCustomPersonality = personalities[selectedPersonality]?.value === "__custom__";
  const personalityValue = isCustomPersonality ? customPersonality : personalities[selectedPersonality]?.value ?? "";

  function toggleGoal(i: number) {
    setSelectedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else if (next.size < 2) {
        next.add(i);
      }
      return next;
    });
  }

  const activeGoals = [
    ...Array.from(selectedGoals).map((i) => t.presetGoals[i]),
    ...(customGoal.trim() ? [customGoal.trim()] : []),
  ].slice(0, 2);

  async function handleCreate() {
    if (!petName.trim()) { setError(t.errorName); return; }
    if (!personalityValue.trim()) { setError(t.errorPersonality); return; }
    setError("");
    setPhase("hatching");
    setHatchStep(0);

    // Advance through visual steps while API runs in parallel
    const stepTimers = [600, 1300, 2100].map((ms, i) =>
      setTimeout(() => setHatchStep(i + 1), ms)
    );

    try {
      const response = await onboardPet({
        description: `Pet name: ${petName.trim()}. Personality: ${personalityValue.trim()}. Language: ${lang === "zh" ? "Chinese" : "English"}. Egg color: ${eggColor}.`,
        goals: activeGoals,
      });

      stepTimers.forEach(clearTimeout);
      setHatchStep(3); // all steps done
      await delay(400);

      // Trigger crack animation
      setPhase("cracking");
      await delay(1200);
      setPhase("done");
      await delay(900);

      const { pet } = response;
      const finalState = createInitialState(
        petName.trim(),
        pet.personality,
        eggColor === "pink" ? "🌸" : "💙",
        pet.mood,
        activeGoals,
        lang,
        pet.memeStyle,
      );

      onComplete({
        ...finalState,
        conversationHistory: [{
          role: "assistant",
          content: pet.greeting,
          timestamp: Date.now(),
          reaction: "neutral",
        }],
      });
    } catch {
      stepTimers.forEach(clearTimeout);
      setError(t.errorFailed);
      setPhase("form");
    }
  }

  // --- Hatching / cracking screens ---
  if (phase === "hatching" || phase === "cracking" || phase === "done") {
    const steps = lang === "zh" ? HATCH_STEPS_ZH : HATCH_STEPS_EN;
    const isDark = eggColor === "pink"
      ? { from: "#2d0a1e", via: "#1a0830", glow: "#FF00AA" }
      : { from: "#0a1e2d", via: "#081430", glow: "#00AAFF" };

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${isDark.from}, ${isDark.via}, #0D0D1A)` }}
      >
        {/* Floating particles */}
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="absolute text-lg pointer-events-none select-none"
            style={{
              left: `${8 + (i * 12) % 90}%`,
              bottom: `${10 + (i * 13) % 60}%`,
              animation: `particle-rise ${2.5 + (i % 3) * 0.8}s ${(i * 0.4) % 2}s ease-out infinite`,
              opacity: 0.6,
            }}
          >
            {p}
          </span>
        ))}

        {/* Glow orb behind egg */}
        <div
          className="absolute w-64 h-64 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: isDark.glow }}
        />

        {/* Egg */}
        <div className={`relative z-10 transition-all duration-500
          ${phase === "cracking" ? "scale-125" : ""}
          ${phase === "done" ? "scale-140" : ""}
          ${phase === "hatching" ? "egg-float" : ""}`}
          style={{ width: 160, height: 200 }}
        >
          <EggSVG color={eggColor} phase={phase} />
        </div>

        {/* Text */}
        <div className="text-center mt-6 mb-2 z-10 relative">
          <p className="text-2xl font-black text-white">
            {phase === "hatching" && (lang === "zh" ? `正在孵化 ${petName}...` : `Hatching ${petName}...`)}
            {phase === "cracking" && (lang === "zh" ? "💥 破壳而出！" : "💥 Breaking free!")}
            {phase === "done" && (lang === "zh" ? "🎉 诞生了！" : "🎉 Born!")}
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {lang === "zh" ? "你的 Trading Pet 正在破壳..." : "Your Trading Pet is emerging..."}
          </p>
        </div>

        {/* 4-step progress bar */}
        <div className="z-10 relative w-full max-w-xs px-6 mt-6 space-y-2.5">
          {steps.map((label, i) => {
            const done = i <= hatchStep;
            const active = i === hatchStep + 1;
            return (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 transition-all duration-300
                    ${done ? "step-pop" : ""}`}
                  style={{
                    background: done ? isDark.glow : "rgba(255,255,255,0.1)",
                    color: done ? "#fff" : "rgba(255,255,255,0.3)",
                    border: active ? `2px solid ${isDark.glow}` : "none",
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className="text-xs font-semibold transition-all duration-300"
                  style={{ color: done ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress line */}
        <div className="z-10 relative w-full max-w-xs px-6 mt-5">
          <div className="h-1 w-full rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, (hatchStep + 1) * 25)}%`,
                background: `linear-gradient(90deg, ${isDark.glow}, ${eggColor === "pink" ? "#A78BFA" : "#00FFAA"})`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Main form ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Lang toggle + Hero */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-gray-800 leading-tight">
              {t.heroTitle}{" "}
              <span className="shimmer-text">{t.heroTitleHighlight}</span>
            </h1>
            <p className="text-xs text-gray-400 font-medium">{t.heroSub}</p>
          </div>
          {/* Language switcher */}
          <div className="flex bg-white/80 rounded-xl border border-gray-200 overflow-hidden text-xs font-bold flex-shrink-0 ml-3 mt-1">
            {(["en", "zh"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 transition-colors ${lang === l ? "bg-violet-500 text-white" : "text-gray-400 hover:text-gray-600"}`}
              >
                {l === "en" ? "EN" : "中"}
              </button>
            ))}
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white/85 backdrop-blur rounded-3xl p-5 shadow-xl border border-white/80 space-y-5">

          {/* Egg picker */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">{t.pickEgg}</p>
            <div className="grid grid-cols-2 gap-3">
              {(["pink", "blue"] as EggColor[]).map((c) => {
                const s = EGG_STYLE[c];
                const label = c === "pink" ? t.pinkEggLabel : t.blueEggLabel;
                const sub = c === "pink" ? t.pinkEggSub : t.blueEggSub;
                return (
                  <button
                    key={c}
                    onClick={() => setEggColor(c)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 cursor-pointer
                      ${eggColor === c
                        ? `${s.selected} bg-white/90`
                        : "border-gray-200 bg-white/50 hover:bg-white/70 hover:scale-[1.02]"
                      }`}
                  >
                    <div className={`w-16 h-20 transition-transform ${eggColor === c ? "scale-110" : ""}`}>
                      <EggSVG color={c} phase="form" />
                    </div>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${s.badge}`}>{label}</span>
                    <span className="text-[11px] text-gray-400 font-medium">{sub}</span>
                    {eggColor === c && <span className="text-base">✨</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Pet name */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1.5">{t.petNameLabel}</label>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 font-bold text-sm transition-all"
              placeholder={t.petNamePlaceholder}
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
            />
          </div>

          {/* Personality presets */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-2">{t.personalityLabel}</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {personalities.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedPersonality(i)}
                  className={`text-xs font-bold px-3 py-2.5 rounded-xl border-2 transition-all text-left leading-tight
                    ${selectedPersonality === i
                      ? `${cfg.border} bg-white text-gray-700 shadow-sm scale-[1.02]`
                      : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-white"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {isCustomPersonality && (
              <textarea
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 text-sm resize-none transition-all"
                rows={2}
                placeholder={t.personalityCustomPlaceholder}
                value={customPersonality}
                onChange={(e) => setCustomPersonality(e.target.value)}
              />
            )}
          </div>

          {/* Goal presets */}
          <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-wider block mb-1">
              {t.goalsLabel} <span className="normal-case font-medium text-gray-300">{t.goalsOptional}</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {t.presetGoals.map((g, i) => (
                <button
                  key={i}
                  onClick={() => toggleGoal(i)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                    ${selectedGoals.has(i)
                      ? `${cfg.badge} ${cfg.border} scale-[1.02] shadow-sm`
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-white"
                    }`}
                >
                  {selectedGoals.has(i) ? "✓ " : ""}{g}
                </button>
              ))}
            </div>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 text-xs transition-all"
              placeholder={t.goalCustomPlaceholder}
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}

          {/* CTA */}
          <button
            onClick={handleCreate}
            disabled={!petName.trim() || !personalityValue.trim()}
            className={`w-full bg-gradient-to-r ${cfg.btn} disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-base`}
          >
            {t.hatchBtn}
          </button>
        </div>

        <p className="text-center text-xs text-gray-300 font-medium">{t.builtOn}</p>
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
