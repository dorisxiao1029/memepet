"use client";

import { useState } from "react";
import { onboardPet } from "@/lib/pet-client";
import { createInitialState } from "@/lib/storage";
import type { PetState } from "@/lib/types";

interface Props {
  onComplete: (state: PetState) => void;
}

type EggColor = "pink" | "blue";

const EGG_CONFIG = {
  pink: {
    label: "粉色蛋 🌸",
    sublabel: "温柔可爱型",
    bg: "from-pink-300 via-rose-300 to-pink-400",
    border: "border-pink-400",
    glow: "shadow-pink-300",
    ring: "ring-pink-400",
    badgeBg: "bg-pink-100 text-pink-600",
    btnBg: "from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600",
  },
  blue: {
    label: "蓝色蛋 💙",
    sublabel: "酷帅理性型",
    bg: "from-blue-300 via-sky-300 to-blue-400",
    border: "border-blue-400",
    glow: "shadow-blue-300",
    ring: "ring-blue-400",
    badgeBg: "bg-blue-100 text-blue-600",
    btnBg: "from-blue-400 to-sky-500 hover:from-blue-500 hover:to-sky-600",
  },
};

function Egg({ color, selected, onClick }: { color: EggColor; selected: boolean; onClick: () => void }) {
  const cfg = EGG_CONFIG[color];
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-3xl border-2 transition-all duration-200 cursor-pointer
        ${selected
          ? `${cfg.border} bg-white/80 ring-4 ${cfg.ring} ring-offset-2 scale-105 shadow-lg ${cfg.glow}`
          : "border-gray-200 bg-white/40 hover:bg-white/70 hover:scale-102"
        }`}
    >
      {/* Egg shape */}
      <div
        className={`w-20 h-24 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] bg-gradient-to-b ${cfg.bg} shadow-lg
          ${selected ? "egg-float" : ""}`}
        style={{ boxShadow: selected ? `0 8px 24px -4px ${color === "pink" ? "#f9a8d4" : "#93c5fd"}` : "" }}
      >
        {/* shine */}
        <div className="w-5 h-7 bg-white/40 rounded-full mt-4 ml-4 rotate-[-20deg]" />
      </div>

      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badgeBg}`}>
        {cfg.label}
      </span>
      <span className="text-[11px] text-gray-400">{cfg.sublabel}</span>

      {selected && (
        <span className="text-lg animate-bounce">✨</span>
      )}
    </button>
  );
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [eggColor, setEggColor] = useState<EggColor>("pink");
  const [petName, setPetName] = useState("");
  const [personality, setPersonality] = useState("");
  const [goals, setGoals] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cfg = EGG_CONFIG[eggColor];

  async function handleCreate() {
    if (!petName.trim()) { setError("给你的宠物起个名字吧 🐾"); return; }
    if (!personality.trim()) { setError("描述一下宠物的性格吧 ✨"); return; }

    const filteredGoals = goals.filter((g) => g.trim());
    setError("");
    setLoading(true);

    try {
      const response = await onboardPet({
        description: `Pet name: ${petName.trim()}. Personality: ${personality.trim()}. Egg color: ${eggColor} (${eggColor === "pink" ? "cute and warm" : "cool and rational"}).`,
        goals: filteredGoals,
      });

      const { pet } = response;
      // Override with user-provided name
      const finalState = createInitialState(
        petName.trim(),
        pet.personality,
        eggColor === "pink" ? "🌸" : "💙",
        pet.mood,
        filteredGoals,
      );

      const stateWithGreeting: PetState = {
        ...finalState,
        conversationHistory: [
          {
            role: "assistant",
            content: pet.greeting,
            timestamp: Date.now(),
            reaction: "neutral",
          },
        ],
      };

      onComplete(stateWithGreeting);
    } catch {
      setError("创建失败，请重试 😢");
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex flex-col items-center justify-center gap-6">
        <div className={`w-24 h-28 rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%] bg-gradient-to-b ${cfg.bg} shadow-xl egg-float`}>
          <div className="w-6 h-8 bg-white/40 rounded-full mt-5 ml-5 rotate-[-20deg]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-lg font-bold text-gray-700">正在孵化 {petName}...</p>
          <p className="text-sm text-gray-400">AI正在赋予灵魂 ✨</p>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full bg-gradient-to-b ${cfg.bg} animate-bounce`}
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">

        {/* Hero */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-gray-800 leading-tight">
            🥚 孵化你的专属
            <span className="shimmer-text"> Meme Trading Pet</span>
          </h1>
          <p className="text-sm text-gray-400 font-medium">
            它会读你的链上记录，陪你看盘，帮你戒掉 FOMO 🚀
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur rounded-3xl p-6 shadow-xl border border-white space-y-5">

          {/* Egg picker */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">选择你的宠物蛋</p>
            <div className="grid grid-cols-2 gap-3">
              <Egg color="pink" selected={eggColor === "pink"} onClick={() => setEggColor("pink")} />
              <Egg color="blue" selected={eggColor === "blue"} onClick={() => setEggColor("blue")} />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Pet name */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
              宠物名字 ✏️
            </label>
            <input
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 font-semibold text-sm transition-all"
              placeholder="例如：毛毛、Crypto猫、HODL兔"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
            />
          </div>

          {/* Personality */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
              性格描述 💬
            </label>
            <textarea
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 text-sm resize-none transition-all"
              rows={2}
              placeholder="例如：毒舌但关心我，会在我亏钱的时候嘲讽我，在我赚钱的时候比我还开心"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
            />
          </div>

          {/* Goals */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
              Trading 目标 🎯 <span className="text-gray-300 normal-case font-normal">(最多2个)</span>
            </label>
            <div className="space-y-2">
              {goals.map((goal, i) => (
                <input
                  key={i}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-gray-800 placeholder-gray-300 focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100 text-sm transition-all"
                  placeholder={
                    i === 0
                      ? "例如：持仓超过2周，不恐慌卖出"
                      : "例如：不追高，不买没研究过的币"
                  }
                  value={goal}
                  onChange={(e) => {
                    const updated = [...goals];
                    updated[i] = e.target.value;
                    setGoals(updated);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center font-medium">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={!petName.trim() || !personality.trim()}
            className={`w-full bg-gradient-to-r ${cfg.btnBg} disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-base`}
          >
            🥚 开始孵化！
          </button>
        </div>

        <p className="text-center text-xs text-gray-300">
          Built on four.meme × BSC 🔗
        </p>
      </div>
    </div>
  );
}
