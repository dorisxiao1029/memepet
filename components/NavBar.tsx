"use client";

interface NavBarProps {
  currentPage: "home" | "playground";
  onNavigate: (page: "home" | "playground") => void;
  zh: boolean;
  onShare?: () => void;
  onReset?: () => void;
}

export default function NavBar({ currentPage, onNavigate, zh, onShare, onReset }: NavBarProps) {
  return (
    <div
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{ background: "rgba(13, 13, 26, 0.85)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">

        {/* Logo */}
        <button
          onClick={() => onNavigate("home")}
          className="flex items-center gap-1.5 text-lg font-black select-none shrink-0"
          style={{ color: "#FF6BAA" }}
        >
          🐾 <span>MemePet</span>
        </button>

        {/* Right: nav tabs + chain badge + actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("home")}
            className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
            style={{
              background: currentPage === "home" ? "rgba(255,107,170,0.15)" : "transparent",
              color: currentPage === "home" ? "#FF6BAA" : "rgba(255,255,255,0.4)",
              border: `1px solid ${currentPage === "home" ? "rgba(255,107,170,0.35)" : "transparent"}`,
            }}
          >
            {zh ? "🏠 首页" : "🏠 Home"}
          </button>

          <button
            onClick={() => onNavigate("playground")}
            className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
            style={{
              background: currentPage === "playground" ? "rgba(0,255,170,0.15)" : "transparent",
              color: currentPage === "playground" ? "#00FFAA" : "rgba(255,255,255,0.4)",
              border: `1px solid ${currentPage === "playground" ? "rgba(0,255,170,0.35)" : "transparent"}`,
            }}
          >
            {zh ? "🐾 我的宠物" : "🐾 My Pet"}
          </button>

          {/* Chain badge */}
          <div
            className="hidden sm:flex items-center px-3 py-1.5 rounded-full text-[11px] font-black select-none"
            style={{
              color: "#FF6BAA",
              border: "1px solid rgba(255,107,170,0.45)",
              background: "rgba(255,107,170,0.08)",
              letterSpacing: "0.12em",
            }}
          >
            BSC MEME DESK
          </div>

          {/* Action buttons — only shown when provided */}
          {onShare && (
            <button
              onClick={onShare}
              className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-black transition-all"
              style={{ color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {zh ? "分享" : "Share"}
            </button>
          )}
          {onReset && (
            <button
              onClick={onReset}
              className="hidden sm:flex px-3 py-1.5 rounded-lg text-xs font-black transition-all"
              style={{ color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              {zh ? "重置" : "Reset"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
