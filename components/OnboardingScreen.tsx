"use client";

import { useState } from "react";
import { onboardPet } from "@/lib/pet-client";
import { createInitialState } from "@/lib/storage";
import type { PetState } from "@/lib/types";

interface Props {
  onComplete: (state: PetState) => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [step, setStep] = useState<"describe" | "goals" | "loading">("describe");
  const [description, setDescription] = useState("");
  const [goalInputs, setGoalInputs] = useState(["", "", ""]);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!description.trim()) {
      setError("Tell me about your pet first.");
      return;
    }

    const goals = goalInputs.filter((g) => g.trim());
    setStep("loading");
    setError("");

    try {
      const response = await onboardPet({ description, goals });
      const { pet } = response;

      const initialState = createInitialState(
        pet.name,
        pet.personality,
        pet.emoji,
        pet.mood,
        goals
      );

      // Add the greeting as the first message
      const stateWithGreeting: PetState = {
        ...initialState,
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
    } catch (err) {
      setError("Something went wrong. Try again.");
      setStep("goals");
    }
  }

  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-bounce">🥚</div>
        <p className="text-gray-400 text-sm">Hatching your pet...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🐾</div>
          <h1 className="text-2xl font-bold text-white">Meet your crypto coach</h1>
          <p className="text-gray-400 text-sm">
            An AI companion that reads your wallet and holds you accountable.
          </p>
        </div>

        {step === "describe" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Describe your pet's personality
              </label>
              <textarea
                className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 resize-none text-sm"
                rows={4}
                placeholder="e.g. A sarcastic ferret who keeps me brutally honest about my trades. Dry humor, no sugarcoating, but weirdly supportive when I actually do something right."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={() => {
                if (!description.trim()) {
                  setError("Tell me about your pet first.");
                  return;
                }
                setError("");
                setStep("goals");
              }}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl transition-colors"
            >
              Next: Set your goals
            </button>
          </div>
        )}

        {step === "goals" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                What are you working on? (up to 3 goals)
              </label>
              <div className="space-y-2">
                {goalInputs.map((goal, i) => (
                  <input
                    key={i}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 text-sm"
                    placeholder={
                      i === 0
                        ? "e.g. Hold any token for at least 2 weeks"
                        : i === 1
                        ? "e.g. Stop buying meme coins I haven't researched"
                        : "e.g. Optional third goal..."
                    }
                    value={goal}
                    onChange={(e) => {
                      const updated = [...goalInputs];
                      updated[i] = e.target.value;
                      setGoalInputs(updated);
                    }}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => setStep("describe")}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                className="flex-2 flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Create my pet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
