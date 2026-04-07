"use client";

import type { Mood } from "@/lib/types";

interface Props {
  emoji: string;
  name: string;
  mood: Mood;
  level: number;
  xp: number;
}

const moodColors: Record<Mood, string> = {
  happy: "bg-emerald-500",
  neutral: "bg-gray-500",
  disappointed: "bg-amber-500",
  skeptical: "bg-violet-500",
};

const moodLabels: Record<Mood, string> = {
  happy: "happy",
  neutral: "neutral",
  disappointed: "disappointed",
  skeptical: "skeptical",
};

export default function PetAvatar({ emoji, name, mood, level, xp }: Props) {
  const xpInLevel = xp % 100;
  const xpPercent = xpInLevel;

  return (
    <div className="flex flex-col items-center gap-3 p-4">
      {/* Emoji avatar */}
      <div className="text-6xl leading-none select-none">{emoji}</div>

      {/* Name + mood */}
      <div className="text-center">
        <div className="text-white font-semibold text-lg">{name}</div>
        <div className="flex items-center gap-1.5 justify-center mt-1">
          <div className={`w-2 h-2 rounded-full ${moodColors[mood]}`} />
          <span className="text-gray-400 text-xs">{moodLabels[mood]}</span>
        </div>
      </div>

      {/* Level + XP bar */}
      <div className="w-full max-w-[160px] space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Level {level}</span>
          <span>{xpInLevel}/100 XP</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
