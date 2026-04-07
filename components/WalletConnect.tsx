"use client";

import { useState } from "react";
import { analyzeWallet } from "@/lib/pet-client";
import type { WalletSummary } from "@/lib/types";

interface Props {
  onConnected: (address: string, summary: WalletSummary) => void;
  walletAddress?: string;
}

export default function WalletConnect({ onConnected, walletAddress }: Props) {
  const [manualAddress, setManualAddress] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(address: string) {
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Enter a valid BSC wallet address (0x...)");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      const summary = await analyzeWallet({ walletAddress: address });
      onConnected(address, summary);
    } catch (err) {
      setError("Could not analyze wallet. Check the address and try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (walletAddress) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/30 border border-emerald-800/50 rounded-xl">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-emerald-400 text-xs font-mono">
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </span>
        <span className="text-emerald-600 text-xs">wallet read</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-gray-700 text-xs font-mono"
          placeholder="0x... (your BSC wallet address)"
          value={manualAddress}
          onChange={(e) => setManualAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAnalyze(manualAddress);
          }}
        />
        <button
          onClick={() => handleAnalyze(manualAddress)}
          disabled={analyzing}
          className="bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {analyzing ? "Reading..." : "Connect"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <p className="text-gray-600 text-xs">
        Read-only. Your pet reads your BSC transaction history to coach you.
      </p>
    </div>
  );
}
