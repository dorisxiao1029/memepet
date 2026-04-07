"use client";

import { useEffect, useState } from "react";
import { loadPetState, savePetState } from "@/lib/storage";
import type { PetState } from "@/lib/types";
import OnboardingScreen from "@/components/OnboardingScreen";
import ChatScreen from "@/components/ChatScreen";

export default function Home() {
  const [petState, setPetState] = useState<PetState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadPetState();
    setPetState(saved);
    setLoading(false);
  }, []);

  function handlePetCreated(state: PetState) {
    savePetState(state);
    setPetState(state);
  }

  function handleStateUpdate(state: PetState) {
    savePetState(state);
    setPetState(state);
  }

  function handleReset() {
    localStorage.removeItem("petState");
    setPetState(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!petState) {
    return <OnboardingScreen onComplete={handlePetCreated} />;
  }

  return (
    <ChatScreen
      petState={petState}
      onStateUpdate={handleStateUpdate}
      onReset={handleReset}
    />
  );
}
