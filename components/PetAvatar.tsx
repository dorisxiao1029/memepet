"use client";

import type { Mood } from "@/lib/types";

interface Props {
  emoji: string;
  name: string;
  mood: Mood;
  level: number;
  xp: number;
  levelUpFlash?: boolean;
}

const moodColors: Record<Mood, string> = {
  happy: "bg-emerald-500",
  neutral: "bg-gray-500",
  disappointed: "bg-amber-500",
  skeptical: "bg-violet-500",
};

const moodEmoji: Record<Mood, string> = {
  happy: "😄",
  neutral: "😐",
  disappointed: "😔",
  skeptical: "🤨",
};

export default function PetAvatar({ emoji, name, mood, level, xp, levelUpFlash }: Props) {
  const xpInLevel = xp % 100;

  return (
    <div className="flex items-center gap-3">
      {/* Emoji avatar with mood ring */}
      <div className="relative">
        <div
          className={`text-4xl leading-none select-none transition-transform duration-300 ${
            levelUpFlash ? "scale-125" : "scale-100"
          }`}
        >
          {emoji}
        </div>
        {/* Mood indicator */}
        <div className="absolute -bottom-1 -right-1 text-sm leading-none">
          {moodEmoji[mood]}
        </div>
      </div>

      {/* Name + level + XP bar */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">{name}</span>
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded-md transition-colors ${
              levelUpFlash
                ? "bg-yellow-400 text-black animate-pulse"
                : "bg-violet-800 text-violet-300"
            }`}
          >
            Lv.{level}
          </span>
        </div>
        <div className="space-y-0.5">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-[120px]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                levelUpFlash ? "bg-yellow-400" : "bg-violet-500"
              }`}
              style={{ width: `${xpInLevel}%` }}
            />
          </div>
          <div className="text-gray-600 text-[10px]">{xpInLevel}/100 XP</div>
        </div>
      </div>
    </div>
  );
}
