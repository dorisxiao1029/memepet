import { NextRequest, NextResponse } from "next/server";
import type { WalletAnalyzeRequest, WalletSummary } from "@/lib/types";

// four.meme exchange proxy on BNB Chain
const FOUR_MEME_FACTORIES = [
  "0x5c952063c7fc8610ffdb798152d69f0b9550762b",
];

// Moralis EVM API — chain "0x38" = BSC mainnet
const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2";
const BSC_CHAIN = "0x38";

interface MoralisTokenTx {
  transaction_hash: string;
  from_address: string;
  to_address: string;
  token_symbol: string;
  token_name: string;
  address: string; // token contract address
  block_timestamp: string; // ISO string
  value: string;
}

interface MoralisNativeTx {
  hash: string;
  from_address: string;
  to_address: string;
  value: string;
  block_timestamp: string;
  receipt_status: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: WalletAnalyzeRequest = await req.json();
    const { walletAddress } = body;

    if (!walletAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "MORALIS_API_KEY not configured" }, { status: 500 });
    }

    const headers = { "X-API-Key": apiKey };

    // Fetch native txs + token transfers in parallel
    const [nativeRes, tokenRes] = await Promise.all([
      fetch(
        `${MORALIS_BASE}/${walletAddress}?chain=${BSC_CHAIN}&limit=50`,
        { headers }
      ),
      fetch(
        `${MORALIS_BASE}/${walletAddress}/erc20/transfers?chain=${BSC_CHAIN}&limit=50`,
        { headers }
      ),
    ]);

    const [nativeData, tokenData] = await Promise.all([
      nativeRes.json(),
      tokenRes.json(),
    ]);

    const nativeTxs: MoralisNativeTx[] = nativeData.result ?? [];
    const tokenTxs: MoralisTokenTx[] = tokenData.result ?? [];

    // Identify four.meme trades: token transfers where to_address is the factory
    const fourMemeTxs = tokenTxs.filter(
      (tx) =>
        FOUR_MEME_FACTORIES.some(
          (factory) =>
            tx.to_address?.toLowerCase() === factory.toLowerCase() ||
            tx.address?.toLowerCase() === factory.toLowerCase()
        )
    );

    // Calc avg hold time: time between first buy and next sell of same token symbol
    const holdTimes: number[] = [];
    const tokenBuys: Record<string, number> = {};

    // Sort oldest first for buy/sell matching
    const sorted = [...tokenTxs].sort(
      (a, b) => new Date(a.block_timestamp).getTime() - new Date(b.block_timestamp).getTime()
    );

    sorted.forEach((tx) => {
      const ts = new Date(tx.block_timestamp).getTime();
      const symbol = tx.token_symbol ?? "UNKNOWN";
      const isBuy = tx.to_address?.toLowerCase() === walletAddress.toLowerCase();
      const isSell = tx.from_address?.toLowerCase() === walletAddress.toLowerCase();

      if (isBuy && !tokenBuys[symbol]) {
        tokenBuys[symbol] = ts;
      } else if (isSell && tokenBuys[symbol]) {
        const holdMs = ts - tokenBuys[symbol];
        const holdDays = holdMs / (1000 * 60 * 60 * 24);
        if (holdDays > 0 && holdDays < 365) holdTimes.push(holdDays);
        delete tokenBuys[symbol];
      }
    });

    const avgHoldDays =
      holdTimes.length > 0
        ? Math.round(holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length)
        : 0;

    // FOMO score: 3+ token buys on a single day = high-activity day
    const buysByDay: Record<string, number> = {};
    tokenTxs
      .filter((tx) => tx.to_address?.toLowerCase() === walletAddress.toLowerCase())
      .forEach((tx) => {
        const date = tx.block_timestamp.slice(0, 10);
        buysByDay[date] = (buysByDay[date] ?? 0) + 1;
      });

    const fomoSignalDays = Object.values(buysByDay).filter((c) => c >= 3).length;
    const fomoScore =
      fomoSignalDays >= 3 ? "HIGH" : fomoSignalDays >= 1 ? "MEDIUM" : "LOW";

    // Biggest outgoing native tx as a rough loss proxy
    let biggestLoss: WalletSummary["biggestLoss"] = null;
    const bigOut = nativeTxs
      .filter(
        (tx) =>
          tx.from_address?.toLowerCase() === walletAddress.toLowerCase() &&
          tx.receipt_status === "1"
      )
      .sort((a, b) => parseFloat(b.value) - parseFloat(a.value))[0];

    if (bigOut) {
      const bnbValue = parseFloat(bigOut.value) / 1e18;
      if (bnbValue > 0.05) {
        biggestLoss = {
          token: "BNB",
          percent: -15, // approximate — price data needed for exact %
          date: bigOut.block_timestamp.slice(0, 10),
        };
      }
    }

    // Last four.meme trade
    let lastFourMemeTrade: WalletSummary["lastFourMemeTrade"] = null;
    if (fourMemeTxs.length > 0) {
      const last = fourMemeTxs[fourMemeTxs.length - 1];
      const isBuy = last.to_address?.toLowerCase() === walletAddress.toLowerCase();
      lastFourMemeTrade = {
        token: last.token_symbol ?? "UNKNOWN",
        action: isBuy ? "buy" : "sell",
        date: last.block_timestamp.slice(0, 10),
      };
    }

    // Build ~100-token summary string for the LLM
    const parts: string[] = [];
    if (avgHoldDays > 0) parts.push(`avg hold ${avgHoldDays}d`);
    if (biggestLoss) parts.push(`biggest outflow: ${biggestLoss.percent}% BNB (${biggestLoss.date})`);
    parts.push(
      `FOMO score: ${fomoScore}${fomoScore !== "LOW" ? ` (${fomoSignalDays} high-activity buy days)` : ""}`
    );
    if (lastFourMemeTrade) {
      parts.push(
        `last four.meme trade: ${lastFourMemeTrade.action} ${lastFourMemeTrade.token} on ${lastFourMemeTrade.date}`
      );
    }
    if (fourMemeTxs.length > 0) {
      parts.push(`total four.meme trades: ${fourMemeTxs.length}`);
    }

    const summary =
      parts.length > 0
        ? `Wallet: ${parts.join(". ")}.`
        : `Wallet connected (${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}). No significant trading history found.`;

    const result: WalletSummary = {
      summary,
      avgHoldDays,
      fomoScore,
      biggestLoss,
      lastFourMemeTrade,
      totalFourMemeTrades: fourMemeTxs.length,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[wallet-analyze]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
