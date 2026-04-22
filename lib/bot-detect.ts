/**
 * Lightweight bot-detection scoring for wallet behavior.
 * 7 heuristic signals → 0-100 confidence score.
 *
 * >= 70  🤖 Confirmed Bot   (filter out of Park by default)
 * 40-69  ⚠️  Possibly Bot    (show with warning)
 * 15-39  ⏳ Insufficient     (not enough data to judge)
 * <  15  ✅ Human-like       (has organic patterns)
 *
 * Design note: the output is intentionally called "botScore" not "isBot".
 * We never make a binary claim — always a probability with reasons.
 */

export interface BotSignal {
  id: string;
  label: string;
  labelZh: string;
  hit: boolean;
  weight: number;   // 0-100 contribution if hit
}

export interface BotAnalysis {
  score: number;                 // 0-100
  verdict: "human" | "possibly-bot" | "confirmed-bot" | "insufficient";
  signals: BotSignal[];
}

// We can only evaluate signals that our current wallet-analyze output supports.
// More sophisticated signals (tx timing variance, gas price strategy) need
// tick-level data — left as TODO with `require: "tick-data"`.
export interface WalletProfile {
  totalTxCount: number;
  avgHoldDays: number;
  uniqueTokenCount: number;
  hasRoundAmounts?: boolean;       // e.g. always 0.1 / 0.5 / 1.0 BNB
  hasRegularIntervals?: boolean;   // tx interval std-dev very low
  active247?: boolean;             // no 6h+ gap in any 24h window
  failedTxRate?: number;           // 0-1; humans revert sometimes
  approveSwapSameBlock?: boolean;  // bot pattern: pre-approved + atomic trade
}

export function analyzeBot(p: WalletProfile): BotAnalysis {
  const signals: BotSignal[] = [];

  // Signal 1: round-amount only
  if (p.hasRoundAmounts === true) {
    signals.push({
      id: "round_amounts",
      label: "Every trade is a round BNB amount",
      labelZh: "每笔都是整数 BNB",
      hit: true,
      weight: 18,
    });
  }

  // Signal 2: mechanical timing
  if (p.hasRegularIntervals === true) {
    signals.push({
      id: "regular_intervals",
      label: "Trade intervals are suspiciously regular",
      labelZh: "交易间隔过于规律",
      hit: true,
      weight: 22,
    });
  }

  // Signal 3: 24/7 activity (no sleep)
  if (p.active247 === true) {
    signals.push({
      id: "no_sleep",
      label: "Active every hour — no human sleep pattern",
      labelZh: "24 小时都在动，没有睡眠窗口",
      hit: true,
      weight: 20,
    });
  }

  // Signal 4: zero failed tx rate
  if (p.failedTxRate !== undefined && p.failedTxRate < 0.005 && p.totalTxCount >= 50) {
    signals.push({
      id: "no_failures",
      label: "Never fails a trade — pre-tested execution",
      labelZh: "从不失败 —— 典型预跑测试过",
      hit: true,
      weight: 12,
    });
  }

  // Signal 5: approve + swap atomic
  if (p.approveSwapSameBlock === true) {
    signals.push({
      id: "atomic_approve_swap",
      label: "Approves and swaps in the same block",
      labelZh: "授权和交易在同一区块完成",
      hit: true,
      weight: 14,
    });
  }

  // Signal 6: extreme token diversity with short holds (spray-and-pray bot)
  if (p.uniqueTokenCount >= 100 && p.avgHoldDays < 0.5 && p.totalTxCount >= 200) {
    signals.push({
      id: "spray_and_pray",
      label: `Scanned ${p.uniqueTokenCount} tokens with <12h avg hold`,
      labelZh: `扫了 ${p.uniqueTokenCount} 种币、平均持仓 <12 小时`,
      hit: true,
      weight: 15,
    });
  }

  // Signal 7: volume too high for human hand-coordination
  if (p.totalTxCount >= 1000 && p.uniqueTokenCount >= 500) {
    signals.push({
      id: "superhuman_volume",
      label: "Volume exceeds human hand-operation limits",
      labelZh: "交易量超过人手能完成的上限",
      hit: true,
      weight: 20,
    });
  }

  const score = Math.min(100, signals.reduce((sum, s) => sum + s.weight, 0));
  const dataSufficient = p.totalTxCount >= 20;

  let verdict: BotAnalysis["verdict"];
  if (!dataSufficient) verdict = "insufficient";
  else if (score >= 70) verdict = "confirmed-bot";
  else if (score >= 40) verdict = "possibly-bot";
  else verdict = "human";

  return { score, verdict, signals };
}

export function botBadge(a: BotAnalysis): { emoji: string; textEn: string; textZh: string; color: string } {
  switch (a.verdict) {
    case "confirmed-bot":
      return { emoji: "🤖", textEn: "Confirmed Bot", textZh: "🤖 机器人", color: "#FF6B6B" };
    case "possibly-bot":
      return { emoji: "⚠️", textEn: "Possibly Bot", textZh: "⚠️ 疑似 bot", color: "#FFD166" };
    case "insufficient":
      return { emoji: "⏳", textEn: "Analyzing", textZh: "⏳ 数据不足", color: "#A78BFA" };
    case "human":
    default:
      return { emoji: "✅", textEn: "Human-like", textZh: "✅ 人类信号", color: "#00FFAA" };
  }
}
