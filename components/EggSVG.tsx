export type EggColor = "pink" | "blue";
export type EggPhase = "form" | "hatching" | "cracking" | "done";

const CRACK_COLOR = { pink: "#e879a0", blue: "#3b9ef0" };

export default function EggSVG({ color, phase }: { color: EggColor; phase: EggPhase }) {
  const cracking = phase === "cracking" || phase === "done";
  const gradId = `egg-grad-${color}`;
  const crack = CRACK_COLOR[color];

  return (
    <svg viewBox="0 0 120 150" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
          <stop offset="0%"   stopColor={color === "pink" ? "#fce7f3" : "#dbeafe"} />
          <stop offset="60%"  stopColor={color === "pink" ? "#f9a8d4" : "#93c5fd"} />
          <stop offset="100%" stopColor={color === "pink" ? "#ec4899" : "#3b82f6"} />
        </radialGradient>
        {cracking && (
          <filter id="egg-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Body */}
      <ellipse cx="60" cy="82" rx="45" ry="58" fill={`url(#${gradId})`} />
      {/* Shine */}
      <ellipse cx="44" cy="55" rx="12" ry="18" fill="white" fillOpacity="0.35" transform="rotate(-20 44 55)" />

      {/* Crack lines */}
      {cracking && (
        <g stroke={crack} strokeWidth="2" strokeLinecap="round" filter="url(#egg-glow)">
          <path d="M60 30 L55 50 L65 60 L58 80" fill="none" opacity="0.9" />
          <path d="M55 50 L45 45" fill="none" opacity="0.7" />
          <path d="M65 60 L75 58" fill="none" opacity="0.7" />
          <path d="M58 80 L52 90 L62 95" fill="none" opacity="0.6" />
        </g>
      )}
      {/* Glow ring */}
      {cracking && (
        <ellipse cx="60" cy="82" rx="47" ry="60"
          fill="none" stroke={crack} strokeWidth="3" opacity="0.4"
          className="animate-pulse"
        />
      )}
      {/* Hatch sparkle */}
      {phase === "done" && (
        <text x="60" y="90" textAnchor="middle" fontSize="32" className="animate-bounce">✨</text>
      )}
    </svg>
  );
}
