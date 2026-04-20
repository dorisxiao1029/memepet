"use client";

import { useEffect, useState } from "react";
import { loadPetState, savePetState, clearPetState, applyTimeDecay } from "@/lib/storage";
import type { PetState, Message } from "@/lib/types";
import LandingScreen from "@/components/LandingScreen";
import PetDashboard from "@/components/PetDashboard";

type Screen = "loading" | "landing" | "chat";

export default function Home() {
  const [petState, setPetState] = useState<PetState | null>(null);
  const [screen, setScreen]     = useState<Screen>("loading");

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;
      const saved = loadPetState();
      if (!saved) { setScreen("landing"); return; }

      // Apply time-based vitals decay since last interaction
      const decayed = applyTimeDecay(saved);
      savePetState(decayed);
      setPetState(decayed);
      setScreen("chat");

      // If away > 8h, generate a proactive wakeup message (non-blocking)
      const hoursAway = (Date.now() - saved.lastInteractionAt) / 3_600_000;
      if (hoursAway > 8) {
        fetch("/api/pet/wakeup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ petState: decayed }),
        })
          .then(r => r.json())
          .then((data: { message?: string }) => {
            if (!data.message) return;
            const wakeupMsg: Message = {
              role: "assistant",
              content: data.message,
              timestamp: Date.now(),
              reaction: "neutral",
            };
            // Prepend after index-0 greeting so greeting is always first
            setPetState(prev => {
              if (!prev) return prev;
              const hist = prev.conversationHistory;
              const withWakeup: Message[] = hist.length > 0
                ? [hist[0], wakeupMsg, ...hist.slice(1)].slice(0, 20)
                : [wakeupMsg];
              const updated = { ...prev, conversationHistory: withWakeup };
              savePetState(updated);
              return updated;
            });
          })
          .catch(() => { /* silent — wakeup is best-effort */ });
      }
    });

    return () => { cancelled = true; };
  }, []);

  function handlePetCreated(state: PetState) {
    savePetState(state);
    setPetState(state);
    setScreen("chat");
  }

  function handleStateUpdate(state: PetState) {
    savePetState(state);
    setPetState(state);
  }

  function handleReset() {
    clearPetState();
    setPetState(null);
    setScreen("landing");
  }

  if (screen === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0D0D1A" }}>
        <div className="text-white/30 text-sm">Loading...</div>
      </div>
    );
  }

  if (screen === "chat" && petState) {
    return (
      <PetDashboard
        petState={petState}
        onStateUpdate={handleStateUpdate}
        onReset={handleReset}
      />
    );
  }

  return <LandingScreen onComplete={handlePetCreated} />;
}
