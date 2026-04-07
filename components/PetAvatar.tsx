"use client";

import type { Mood } from "@/lib/types";

interface Props {
  emoji: string;
  name: string;
  mood: Mood;
  level: number;
  xp: number;
  levelUpFlash?: boolean;
  eggColor?: "pink" | "blue";
}

const moodEmoji: Record<Mood, string> = {
  happy: "😄",
  neutral: "😐",
  disappointed: "😔",
  skeptical: "🤨",
};

export default function PetAvatar({ emoji, name, mood, level, xp, levelUpFlash, eggColor = "pink" }: Props) {
  const xpInLevel = xp % 100;
  const barColor = eggColor === "pink"
    ? levelUpFlash ? "bg-yellow-400" : "bg-gradient-to-r from-pink-400 to-rose-500"
    : levelUpFlash ? "bg-yellow-400" : "bg-gradient-to-r from-blue-400 to-sky-500";
  const levelBadge = eggColor === "pink" ? "bg-pink-100 text-pink-600" : "bg-blue-100 text-blue-600";

  return (
    <div className="flex items-center gap-3">
      {/* Egg avatar */}
      <div className="relative">
        <div className={`text-4xl leading-none select-none transition-transform duration-300 ${levelUpFlash ? "scale-125" : "scale-100"}`}>
          {emoji}
        </div>
        <div className="absolute -bottom-1 -right-1 text-sm leading-none">
          {moodEmoji[mood]}
        </div>
      </div>

      {/* Name + XP */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <div className="flex items-center gap-2">
          <span className="text-gray-800 font-black text-sm">{name}</span>
          <span className={`text-xs font-black px-1.5 py-0.5 rounded-lg transition-all ${
            levelUpFlash ? "bg-yellow-300 text-yellow-800 scale-110" : levelBadge
          }`}>
            Lv.{level}
          </span>
        </div>
        <div className="space-y-0.5">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-[110px] border border-gray-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
          <div className="text-gray-300 text-[10px] font-semibold">{xpInLevel}/100 XP</div>
        </div>
      </div>
    </div>
  );
}
