"use client";

import { useEffect, useState } from "react";
import type { PetState } from "@/lib/types";

interface Trader {
  rank: number;
  nickname: string;
  address: string;
  avatar?: string;
  pnl7d: number;
  pnlUsd7d: number;
  winRate: number;
  txs7d: number;
  txsWin7d: number;
  // Pet DNA attributes (from wallet analysis)
  petEmoji?: string;
  petName?: string;
  tradingStyle?: string;
  archetype?: string;
  level?: number;
}

interface Props {
  petState: PetState;
  zh: boolean;
}

const MOCK_TRADERS: Trader[] = [
  {
    rank: 1,
    nickname: "阿峰_Afeng",
    address: "0xBF004BFF647259144E36D03887D6965BCED4D903",
    pnl7d: 44.1,
    pnlUsd7d: 12100,
    winRate: 83.7,
    txs7d: 67,
    txsWin7d: 83,
    petEmoji: "🐕",
    petName: "Alpha",
    tradingStyle: "scalper",
    archetype: "hype",
    level: 7,
  },
  {
    rank: 2,
    nickname: "JAMES",
    address: "0xE459668282B387868C07D89201618FFA863650253E",
    pnl7d: 245.7,
    pnlUsd7d: 8871,
    winRate: 50,
    txs7d: 1,
    txsWin7d: 8,
    petEmoji: "🦁",
    petName: "James",
    tradingStyle: "degen",
    archetype: "calm",
    level: 9,
  },
  {
    rank: 3,
    nickname: "0x46..3c2c",
    address: "0x46F00B4BFF647259144E36D03887D6965BCED4D903",
    pnl7d: 4.1,
    pnlUsd7d: 3663,
    winRate: 60,
    txs7d: 506,
    txsWin7d: 415,
    petEmoji: "🐱",
    petName: "Lucky",
    tradingStyle: "quiet",
    archetype: "calm",
    level: 5,
  },
  {
    rank: 4,
    nickname: "cattttt",
    address: "0x09152D99CC2CEB2CE9D73150F262E28AD403F35",
    pnl7d: 88.4,
    pnlUsd7d: 2680,
    winRate: 100,
    txs7d: 1,
    txsWin7d: 8,
    petEmoji: "😺",
    petName: "Catttt",
    tradingStyle: "scalper",
    archetype: "hype",
    level: 6,
  },
  {
    rank: 5,
    nickname: "钻坐p小将",
    address: "0x2CE9D43301C8A6AE31D7F07BFEE0098DFA2D83373",
    pnl7d: 35.1,
    pnlUsd7d: 2534,
    winRate: 69.2,
    txs7d: 14,
    txsWin7d: 27,
    petEmoji: "🐻",
    petName: "Bear",
    tradingStyle: "holder",
    archetype: "comfort",
    level: 4,
  },
];

export default function PetRank({ petState, zh }: Props) {
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In future, this will fetch from /api/pet/trader-rank
    // For now, use mock data
    const loadTraders = async () => {
      try {
        // const res = await fetch("/api/pet/trader-rank");
        // const data = await res.json();
        // setTraders(data.traders);
        setTraders(MOCK_TRADERS);
      } catch (err) {
        console.error("Failed to load traders", err);
        setTraders(MOCK_TRADERS);
      } finally {
        setLoading(false);
      }
    };

    loadTraders();
  }, []);

  const accent = "#00FFAA";

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-black font-signal tracking-[0.18em]" style={{ color: accent }}>
          {zh ? "📊 BSC 顶级交易员排行" : "📊 BSC TOP TRADERS"}
        </div>
        <p className="text-sm mt-1 text-white/48">
          {zh ? "这些交易员的 DNA 特征已被提取，帮他们孵化宠物。" : "Top traders' DNA extracted. Hatching pets to learn from them."}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8 text-white/48">
          {zh ? "加载中..." : "Loading..."}
        </div>
      ) : (
        <div className="space-y-3">
          {traders.map((trader) => (
            <div
              key={trader.rank}
              className="trader-card rounded-2xl p-4 flex items-start gap-4 hover:border-opacity-100 transition-all cursor-pointer"
              style={{
                borderColor: `${accent}44`,
                background: `rgba(0,255,170,0.04)`,
              }}
            >
              {/* Rank Badge */}
              <div
                className="flex items-center justify-center rounded-full w-10 h-10 font-black text-sm flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
                  color: accent,
                  borderWidth: 1,
                  borderColor: `${accent}55`,
                }}
              >
                {trader.rank}
              </div>

              {/* Pet Avatar + Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 24 }}>{trader.petEmoji}</span>
                  <div className="min-w-0">
                    <div className="font-black text-sm text-white truncate">{trader.nickname}</div>
                    <div className="text-xs text-white/40 truncate">{trader.address.slice(0, 6)}...{trader.address.slice(-4)}</div>
                  </div>
                </div>

                {/* DNA + Level */}
                {trader.petName && (
                  <div className="text-xs text-white/60 mb-2">
                    <span className="inline-block px-2 py-0.5 rounded bg-white/8 mr-2">
                      {trader.tradingStyle?.toUpperCase()} / {trader.archetype?.toUpperCase()}
                    </span>
                    {trader.level && (
                      <span className="inline-block px-2 py-0.5 rounded bg-white/8">
                        Lv. {trader.level}
                      </span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 text-[11px] font-black">
                  <div>
                    <div style={{ color: trader.pnl7d >= 0 ? "#00FF88" : "#FF6B6B" }}>
                      {trader.pnl7d >= 0 ? "+" : ""}{trader.pnl7d.toFixed(1)}%
                    </div>
                    <div className="text-white/40 text-[9px]">7D PnL %</div>
                  </div>
                  <div>
                    <div style={{ color: trader.pnlUsd7d >= 0 ? "#00FF88" : "#FF6B6B" }}>
                      ${(trader.pnlUsd7d / 1000).toFixed(1)}K
                    </div>
                    <div className="text-white/40 text-[9px]">USD</div>
                  </div>
                  <div>
                    <div style={{ color: "#FFD166" }}>{trader.winRate.toFixed(1)}%</div>
                    <div className="text-white/40 text-[9px]">Win Rate</div>
                  </div>
                  <div>
                    <div style={{ color: "#A78BFA" }}>
                      {trader.txsWin7d}/{trader.txs7d}
                    </div>
                    <div className="text-white/40 text-[9px]">7D TXs</div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="flex-shrink-0">
                <button
                  className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                  style={{
                    background: `${accent}22`,
                    color: accent,
                    borderWidth: 1,
                    borderColor: `${accent}55`,
                  }}
                >
                  {zh ? "查看" : "View"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
