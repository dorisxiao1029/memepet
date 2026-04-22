"use client";

/**
 * PetPlayground — an autonomous social scene.
 *
 * Replaces the card-list "Pet Park" with a horizontal stage where your pet
 * and 3–4 community pets wander. Every 6–10 s a random pet walks up, a
 * Groq-generated icebreaker plays as speech bubbles, then reactions
 * (hearts / sparks / frown) float up based on DNA match. User watches.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { PetState } from "@/lib/types";
import type { MatchResult } from "@/lib/compatibility";

interface ApiMatch {
  id: string; nickname: string; emoji: string; level: number;
  archetype: string; tradingStyle: string; walletTags: string[];
  addressShort: string; bio: string; bioZh: string;
  botScore: number; match: MatchResult;
}
interface ApiBot {
  id: string; nickname: string; emoji: string;
  addressShort: string; botScore: number; walletTags: string[];
  bio: string; bioZh: string;
}

interface ScenePet {
  id: string; emoji: string; nickname: string;
  archetype: string; tradingStyle: string; walletTags: string[];
  bio?: string; bioZh?: string; match?: MatchResult; addressShort?: string;
  x: number;            // 0..100 %
  bobSeed: number;      // 0..3 — random phase so they don't sync
  isUser?: boolean;
  isBot?: boolean;
}

interface PetInfoCard {
  petId: string | null;
}

type PlayMode = "solo" | "together" | null;

interface Bubble  { pet: string; text: string }
interface Floater { id: number; x: number; emoji: string }
interface ChatLine { speaker: "pet-a" | "pet-b"; text: string }

interface Props {
  petState: PetState;
  onAction: (a: { tool: string; summary: string; status?: "ok" | "pending" | "error" }) => void;
}

// ── Helpers ──────────────────────────────────────────────

function deriveUserTags(p: PetState): string[] {
  const tags: string[] = [];
  const style = p.tradingDNA?.tradingStyle;
  const arc   = p.tradingDNA?.petArchetype;
  if (style === "holder")     tags.push("DIAMOND_HANDS");
  if (style === "scalper")    tags.push("PAPER_HANDS", "HIGH_FREQ");
  if (style === "degen")      tags.push("DEGEN", "HIGH_FREQ");
  if (style === "quiet")      tags.push("LURKER");
  if (style === "recovering") tags.push("INFO_COLLECTOR");
  if (arc === "hype")         tags.push("SNIPER");
  if (arc === "calm")         tags.push("ALPHA_HUNTER");
  if (arc === "comfort" && !tags.includes("DIAMOND_HANDS")) tags.push("DIAMOND_HANDS");
  if (tags.length === 0) tags.push("INFO_COLLECTOR", "DIAMOND_HANDS");
  return [...new Set(tags)].slice(0, 4);
}

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── Component ────────────────────────────────────────────

export default function PetPlayground({ petState, onAction }: Props) {
  const zh = petState.lang === "zh";

  const [mode, setMode]                     = useState<PlayMode>(null);  // null = 选择模式, "solo" = 宠物自主, "together" = 一起社交
  const [entered, setEntered]               = useState(false);
  const [loading, setLoading]               = useState(false);
  const [scene, setScene]                   = useState<ScenePet[]>([]);
  const [bubble, setBubble]                 = useState<Bubble | null>(null);
  const [floaters, setFloaters]             = useState<Floater[]>([]);
  const [encounterId, setEncounterId]       = useState<string | null>(null);
  const [sideInfo, setSideInfo]             = useState<string | null>(null);
  const [selectedPetId, setSelectedPetId]   = useState<string | null>(null);

  const sceneRef       = useRef<ScenePet[]>([]);
  const busyRef        = useRef(false);
  const floaterIdRef   = useRef(0);
  const encounterIdRef = useRef<string | null>(null);

  useEffect(() => { sceneRef.current = scene; }, [scene]);
  useEffect(() => { encounterIdRef.current = encounterId; }, [encounterId]);

  // ── 1. Enter park → fetch companions → init scene ──
  const enterPark = useCallback(async (playMode: PlayMode) => {
    if (loading || entered || !playMode) return;
    setLoading(true);
    setMode(playMode);
    const me = {
      archetype:    petState.tradingDNA?.petArchetype  ?? "hype",
      tradingStyle: petState.tradingDNA?.tradingStyle ?? "degen",
      walletTags:   deriveUserTags(petState),
      level:        petState.level ?? 1,
    };
    try {
      const res = await fetch("/api/pet/park", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ me, limit: 4, includeBotWarning: true }),
      });
      const data = (await res.json()) as { matches: ApiMatch[]; botWarning: ApiBot | null };
      if (!res.ok) throw new Error(String((data as { error?: string }).error ?? "?"));

      const matches = data.matches ?? [];
      const bot     = data.botWarning ?? null;

      // 聚集式分布：宠物更可能出现在某些区域（左、中、右），而不是均匀铺开
      const clusterCenters = [22, 50, 78];  // 3 个聚集点
      const others: ScenePet[] = matches.map((m, i) => {
        const center = clusterCenters[i % clusterCenters.length];
        return {
          id: m.id, emoji: m.emoji, nickname: m.nickname,
          archetype: m.archetype, tradingStyle: m.tradingStyle, walletTags: m.walletTags,
          bio: m.bio, bioZh: m.bioZh, addressShort: m.addressShort, match: m.match,
          x: clamp(center + rand(-12, 12), 10, 90),  // 围绕聚集点 ±12%
          bobSeed: Math.random() * 3,
        };
      });

      const user: ScenePet = {
        id: "__user",
        emoji: petState.emoji,
        nickname: petState.name,
        archetype: me.archetype,
        tradingStyle: me.tradingStyle,
        walletTags: me.walletTags,
        x: 50,
        bobSeed: Math.random() * 3,
        isUser: true,
      };

      const all: ScenePet[] = [...others, user];
      if (bot) {
        all.push({
          id: bot.id, emoji: bot.emoji, nickname: bot.nickname,
          archetype: "hype", tradingStyle: "bot", walletTags: bot.walletTags,
          bio: bot.bio, bioZh: bot.bioZh, addressShort: bot.addressShort,
          x: 94, bobSeed: Math.random() * 3, isBot: true,
        });
      }
      setScene(all);
      setEntered(true);
      onAction({
        tool: "playground.enter",
        summary: `Pet entered the playground · ${matches.length} companions + ${bot ? "1 bot fenced" : "0 bots"}`,
        status: "ok",
      });
    } catch (err) {
      onAction({ tool: "playground.enter", summary: `Failed: ${err}`, status: "error" });
    } finally {
      setLoading(false);
    }
  }, [loading, entered, petState, onAction]);

  // ── 2. Wandering — pets re-roll x on random intervals (skip user + bot + current encounter) ──
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleWander = () => {
      // 随机间隔：3.5 ~ 7 秒，有变化，不那么规律
      const delay = 3500 + Math.random() * 3500;
      timer = setTimeout(() => {
        if (cancelled) return;
        setScene((prev) =>
          prev.map((p) => {
            if (p.isUser || p.isBot) return p;
            if (encounterIdRef.current === p.id) return p;
            // 每次移动的距离随机：可能移动很远，也可能只动一点
            return { ...p, x: clamp(rand(12, 88), 10, 90) };
          })
        );
        scheduleWander();  // 递归调度，每次延迟都不同
      }, delay);
    };

    scheduleWander();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [entered]);

  // ── 3. Spawn floating emoji (hearts / sparks / frown) ──
  const spawnFloaters = useCallback((x: number, emoji: string, count: number) => {
    const items: Floater[] = Array.from({ length: count }).map((_, i) => ({
      id: ++floaterIdRef.current,
      x: clamp(x + (i - count / 2) * 4, 3, 97),
      emoji,
    }));
    setFloaters((prev) => [...prev, ...items]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => !items.some((n) => n.id === f.id)));
    }, 2400);
  }, []);

  // ── 4. Encounter driver — one approach + chat + reaction + retreat ──
  const runEncounter = useCallback(async (partner: ScenePet) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setEncounterId(partner.id);
    setBubble(null);

    const user = sceneRef.current.find((p) => p.isUser);
    if (!user) { busyRef.current = false; setEncounterId(null); return; }

    // Walk partner to the user — 不只是左右，距离也随机
    const distance = 6 + Math.random() * 10;  // 6~16% 的距离
    const direction = Math.random() > 0.5 ? -1 : 1;
    const approachX = clamp(user.x + direction * distance, 8, 92);
    setScene((prev) => prev.map((p) => (p.id === partner.id ? { ...p, x: approachX } : p)));
    await new Promise((r) => setTimeout(r, 2400));    // let CSS transition finish

    // Fetch dialogue
    let lines: ChatLine[] | null = null;
    try {
      const res = await fetch("/api/pet/pet-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          me: {
            nickname: petState.name, emoji: petState.emoji,
            archetype: user.archetype, tradingStyle: user.tradingStyle,
            walletTags: user.walletTags,
          },
          them: {
            nickname: partner.nickname, emoji: partner.emoji,
            archetype: partner.archetype, tradingStyle: partner.tradingStyle,
            walletTags: partner.walletTags,
            bio: zh ? partner.bioZh : partner.bio,
          },
          match: partner.match,
          lang: petState.lang,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.lines)) lines = data.lines.slice(0, 3) as ChatLine[];
    } catch { /* swallow */ }

    if (!lines || lines.length === 0) {
      lines = [
        { speaker: "pet-b", text: zh ? "嗨～闻到你钱包味了🐾" : "yo, sniffed your wallet from here 🐾" },
        { speaker: "pet-a", text: zh ? "你的 DNA 有意思" : "your DNA looks kinda spicy" },
      ];
    }

    // Play bubbles one at a time
    for (const line of lines) {
      const speakerId = line.speaker === "pet-a" ? user.id : partner.id;
      setBubble({ pet: speakerId, text: line.text });
      await new Promise((r) => setTimeout(r, 2600));
    }
    setBubble(null);

    // Reaction
    const score = partner.match?.score ?? 0;
    const midX  = (user.x + approachX) / 2;
    if (score >= 78) {
      spawnFloaters(midX, "💖", 4);
      setSideInfo(zh
        ? `${partner.nickname} 💖 ${score}% · ${partner.match?.reasonZh ?? ""}`
        : `${partner.nickname} 💖 ${score}% · ${partner.match?.reason ?? ""}`);
      onAction({ tool: "playground.encounter", summary: `${partner.nickname} · ${score}% complementary · 💖 exchanged`, status: "ok" });
    } else if (score >= 60) {
      spawnFloaters(midX, "✨", 3);
      setSideInfo(zh
        ? `${partner.nickname} ✨ ${score}% · ${partner.match?.reasonZh ?? ""}`
        : `${partner.nickname} ✨ ${score}% · ${partner.match?.reason ?? ""}`);
      onAction({ tool: "playground.encounter", summary: `${partner.nickname} · ${score}% amplifier · ✨ chemistry`, status: "ok" });
    } else {
      spawnFloaters(midX, "💢", 2);
      setSideInfo(zh
        ? `${partner.nickname} 💢 ${score}% · ${partner.match?.reasonZh ?? ""}`
        : `${partner.nickname} 💢 ${score}% · ${partner.match?.reason ?? ""}`);
      onAction({ tool: "playground.encounter", summary: `${partner.nickname} · ${score}% mismatch · distance kept`, status: "ok" });
    }

    await new Promise((r) => setTimeout(r, 1600));
    const awayX = clamp(rand(12, 88), 10, 90);
    setScene((prev) => prev.map((p) => (p.id === partner.id ? { ...p, x: awayX } : p)));
    setEncounterId(null);
    busyRef.current = false;
  }, [onAction, petState, spawnFloaters, zh]);

  // ── 5. Encounter scheduler ──
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delay = 6500 + Math.random() * 3500;
      timer = setTimeout(async () => {
        if (cancelled) return;
        if (busyRef.current) { schedule(); return; }
        const candidates = sceneRef.current.filter((p) => !p.isUser && !p.isBot && p.match);
        if (candidates.length === 0) { schedule(); return; }
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        await runEncounter(chosen);
        if (!cancelled) schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [entered, runEncounter]);

  // ── 6. Click a pet → show info card or force encounter ──
  const handlePetClick = (p: ScenePet) => {
    if (p.isUser || p.isBot) return;
    // 点击已选中的宠物触发遭遇；点击新宠物显示信息卡
    if (selectedPetId === p.id) {
      setSelectedPetId(null);
      if (!busyRef.current) runEncounter(p);
    } else {
      setSelectedPetId(p.id);
    }
  };

  // ── Render ─────────────────────────────────────────────

  const accent = "#FF6BAA";

  return (
    <div
      className="trader-card rounded-[28px] p-5 sm:p-6"
      style={{ borderColor: `${accent}45`, position: "relative" }}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="relative z-10 min-w-0">
          <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: accent }}>
            {zh ? "🌳 游乐场 · 宠物社交中" : "🌳 PLAYGROUND · PETS SOCIALIZING"}
          </div>
          <p className="text-[11px] mt-1 text-white/48">
            {zh
              ? "让宠物自己玩。DNA 互补时会飞爱心，机器人被围栏挡在外面。你只需要看。"
              : "Pet roams. Hearts fly when DNA vibes. Bots fenced out. You just watch."}
          </p>
        </div>
        {entered && (
          <span
            className="trader-chip trader-chip-hot px-2.5 py-1 text-[11px] font-signal"
            style={{ background: `${accent}18`, borderColor: `${accent}55`, color: accent }}
          >
            {zh ? "LIVE · 自主社交" : "LIVE · autonomous"}
          </span>
        )}
      </div>

      {!entered ? (
        mode === null ? (
          // 模式选择界面
          <div className="space-y-3">
            <div className="text-xs text-white/48 text-center mb-4">
              {zh ? "宠物进游乐场，你想..." : "Your pet enters the playground:"}
            </div>
            <button
              onClick={() => enterPark("solo")}
              disabled={loading}
              className="w-full trader-action rounded-2xl py-3 px-4 text-sm font-black disabled:opacity-45 transition-all"
              style={{ color: accent, borderColor: `${accent}66`, background: "rgba(255,107,170,0.08)" }}
            >
              {loading ? "..." : (zh ? "🎭 让宠物自己玩" : "🎭 Let Pet Play Solo")}
            </button>
            <button
              onClick={() => enterPark("together")}
              disabled={loading}
              className="w-full trader-action rounded-2xl py-3 px-4 text-sm font-black disabled:opacity-45 transition-all"
              style={{ color: "#00FFAA", borderColor: "rgba(0,255,170,0.66)", background: "rgba(0,255,170,0.08)" }}
            >
              {loading ? "..." : (zh ? "👥 一起去社交" : "👥 Go Together")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => enterPark(mode)}
            disabled={loading}
            className="w-full trader-action rounded-2xl py-3 px-4 text-sm font-black disabled:opacity-45"
            style={{ color: accent, borderColor: `${accent}66` }}
          >
            {loading
              ? (zh ? "宠物跑进游乐场..." : "Pet sprinting into the playground...")
              : (zh ? "🌳 进入游乐场 / Enter Playground" : "🌳 Enter the Playground")}
          </button>
        )
      ) : (
        <>
          {/* ── Stage ── */}
          <div
            className="relative overflow-hidden rounded-2xl"
            style={{
              height: 240,
              background: "linear-gradient(180deg, #1a0f3a 0%, #0d0a28 65%, #06051a 100%)",
              border: "1px solid rgba(255,107,170,0.18)",
              boxShadow: `inset 0 0 60px ${accent}18`,
            }}
          >
            {/* Stars */}
            <div
              style={{
                position: "absolute", inset: 0,
                background:
                  "radial-gradient(1px 1px at 20% 30%, #fff5, transparent)," +
                  "radial-gradient(1px 1px at 70% 20%, #fff3, transparent)," +
                  "radial-gradient(1px 1px at 85% 45%, #fff4, transparent)," +
                  "radial-gradient(1px 1px at 35% 55%, #fff3, transparent)," +
                  "radial-gradient(1px 1px at 52% 15%, #fff4, transparent)",
                opacity: 0.55,
              }}
            />
            {/* Ground line */}
            <div
              style={{
                position: "absolute", left: 0, right: 0, bottom: 24, height: 1,
                background: `linear-gradient(90deg, transparent 0%, ${accent}55 20%, ${accent}55 80%, transparent 100%)`,
              }}
            />
            {/* Ground glow */}
            <div
              style={{
                position: "absolute", left: 0, right: 0, bottom: 0, height: 32,
                background: `linear-gradient(180deg, transparent, ${accent}11)`,
              }}
            />
            {/* Decor */}
            <span style={{ position: "absolute", bottom: 18, left: 8,  fontSize: 28, opacity: 0.8 }}>🌳</span>
            <span style={{ position: "absolute", bottom: 16, left: 32, fontSize: 18, opacity: 0.6 }}>🌿</span>
            <span style={{ position: "absolute", bottom: 18, right: 40, fontSize: 24, opacity: 0.7 }}>🌲</span>
            <span style={{ position: "absolute", top: 12, right: 18,   fontSize: 16, opacity: 0.55 }}>🌙</span>

            {/* Bot fence */}
            {scene.some((p) => p.isBot) && (
              <div
                style={{
                  position: "absolute",
                  right: 12, bottom: 26, top: 44,
                  width: 2,
                  background: "repeating-linear-gradient(0deg, #FF6B6B88 0 4px, transparent 4px 8px)",
                  borderRadius: 1,
                }}
              />
            )}

            {/* Pets */}
            {scene.map((p) => {
              const isBubbled = bubble?.pet === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handlePetClick(p)}
                  style={{
                    position: "absolute",
                    left: `${p.x}%`,
                    bottom: 24,
                    transform: "translateX(-50%)",
                    // 用缓入缓出的贝塞尔曲线，让运动更自然、更有弧线感
                    transition: "left 2.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    cursor: p.isUser || p.isBot ? "default" : "pointer",
                    zIndex: p.isUser ? 5 : isBubbled ? 4 : 2,
                    pointerEvents: p.isBot ? "none" : "auto",
                  }}
                >
                  {/* Speech bubble */}
                  {isBubbled && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "6px 10px",
                        background: p.isUser
                          ? "linear-gradient(135deg, #FF00AA, #A78BFA)"
                          : "rgba(255,255,255,0.96)",
                        color: p.isUser ? "#fff" : "#1a1030",
                        borderRadius: 14,
                        fontSize: 11,
                        fontWeight: 800,
                        lineHeight: 1.35,
                        maxWidth: 220,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        animation: "pp-pop 0.22s ease",
                        pointerEvents: "none",
                        whiteSpace: "normal",
                        textAlign: "center",
                      }}
                    >
                      {(bubble?.text ?? "").length > 64
                        ? (bubble?.text ?? "").slice(0, 62) + "…"
                        : bubble?.text}
                      <span
                        style={{
                          position: "absolute",
                          bottom: -4,
                          left: "50%",
                          transform: "translateX(-50%) rotate(45deg)",
                          width: 8, height: 8,
                          background: p.isUser ? "#A78BFA" : "rgba(255,255,255,0.96)",
                        }}
                      />
                    </div>
                  )}

                  {/* "YOU" tag on user */}
                  {p.isUser && !isBubbled && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "2px 8px",
                        background: `${accent}22`,
                        border: `1px solid ${accent}66`,
                        color: accent,
                        borderRadius: 10,
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {zh ? "你" : "YOU"}
                    </div>
                  )}

                  {/* Glow puddle under user */}
                  {p.isUser && (
                    <div
                      style={{
                        position: "absolute",
                        left: "50%", bottom: -6,
                        transform: "translateX(-50%)",
                        width: 46, height: 12,
                        borderRadius: "50%",
                        background: `radial-gradient(ellipse at center, ${accent}55, transparent 70%)`,
                        pointerEvents: "none",
                      }}
                    />
                  )}

                  {/* Bot chip */}
                  {p.isBot && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "1px 5px",
                        background: "rgba(255,107,107,0.18)",
                        border: "1px dashed #FF6B6B88",
                        color: "#FF6B6B",
                        borderRadius: 6,
                        fontSize: 9, fontWeight: 900,
                        letterSpacing: "0.05em",
                      }}
                    >
                      🤖 BOT
                    </div>
                  )}

                  {/* The emoji body (bobs via CSS, isolated from parent transform) */}
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: p.isUser ? 44 : 36,
                      lineHeight: 1,
                      userSelect: "none",
                      filter: p.isBot
                        ? "grayscale(1) brightness(0.6)"
                        : p.isUser
                        ? `drop-shadow(0 4px 12px ${accent}88)`
                        : "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                      opacity: p.isBot ? 0.5 : 1,
                      animation: `pp-bob ${2.4 + p.bobSeed * 0.35}s ease-in-out ${p.bobSeed}s infinite`,
                    }}
                  >
                    {p.emoji}
                  </span>
                </div>
              );
            })}

            {/* Floating hearts / sparks / frowns */}
            {floaters.map((f) => (
              <span
                key={f.id}
                style={{
                  position: "absolute",
                  left: `${f.x}%`,
                  bottom: 72,
                  transform: "translateX(-50%)",
                  fontSize: 22,
                  pointerEvents: "none",
                  animation: "pp-float 2.3s ease-out forwards",
                }}
              >
                {f.emoji}
              </span>
            ))}
          </div>

          {/* Info card or latest encounter verdict */}
          {selectedPetId ? (() => {
            const selected = scene.find((p) => p.id === selectedPetId);
            if (!selected) return null;
            return (
              <div className="mt-4 rounded-2xl p-4 sm:p-5" style={{ background: "rgba(255,107,170,0.08)", borderColor: `${accent}33`, borderWidth: 1 }}>
                <div className="flex items-start gap-3 mb-3">
                  <span style={{ fontSize: 32 }}>{selected.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-sm mb-1">{selected.nickname}</div>
                    <div className="text-xs text-white/48 mb-2 truncate">{selected.addressShort ?? "—"}</div>
                    {selected.match && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-black" style={{ color: accent }}>
                          {selected.match.score}% {selected.match.score >= 78 ? "💖" : selected.match.score >= 60 ? "✨" : "💢"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-[11px] text-white/56 mb-3 leading-relaxed">
                  <span className="font-black block mb-1">{zh ? "特质" : "DNA"}</span>
                  <span>{selected.archetype.toUpperCase()} / {selected.tradingStyle.toUpperCase()}</span>
                  {selected.walletTags && selected.walletTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selected.walletTags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="inline-block px-2 py-0.5 rounded text-[9px] bg-white/8 text-white/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {selected.match && (
                  <div className="text-[11px] text-white/56 mb-3">
                    <span className="font-black block mb-1">{zh ? "评价" : "VERDICT"}</span>
                    <span>{zh ? selected.match.reasonZh : selected.match.reason}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setSelectedPetId(null);
                    if (!busyRef.current) runEncounter(selected);
                  }}
                  className="w-full text-xs font-black py-2 px-3 rounded-xl"
                  style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}
                >
                  {zh ? "主动打招呼 →" : "Say Hi →"}
                </button>
              </div>
            );
          })() : (
            <div className="mt-3 min-h-[32px]">
              {sideInfo ? (
                <p className="text-[11px] text-white/62 leading-relaxed pp-fadein">
                  <span className="font-black" style={{ color: accent }}>{zh ? "刚才：" : "Just now:"}</span>{" "}
                  {sideInfo}
                </p>
              ) : (
                <p className="text-[11px] text-white/32 italic">
                  {zh ? "宠物们在散步… 点一只可以主动上前打招呼。" : "Pets wandering… click one to say hi."}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes pp-bob {
          0%,100% { translate: 0 0; }
          50%     { translate: 0 -4px; }
        }
        @keyframes pp-float {
          0%   { opacity: 0; translate: 0 0;      scale: 0.6; }
          20%  { opacity: 1; translate: 0 -10px;  scale: 1.1; }
          100% { opacity: 0; translate: 0 -90px;  scale: 0.9; }
        }
        @keyframes pp-pop {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.5); }
          100% { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        .pp-fadein { animation: pp-fade 0.4s ease; }
        @keyframes pp-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
