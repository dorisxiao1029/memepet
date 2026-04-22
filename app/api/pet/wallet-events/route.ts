import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import {
  makePublicClient,
  TOKEN_MANAGER2_ADDRESS,
  TM2_EVENTS_ABI,
} from "@/lib/fourmeme";

// Look back at most this many blocks per poll. TokenManager2 is extremely busy —
// public BSC RPC rejects wider windows. 3 blocks (~9s) is the safe ceiling.
// For production, point BSC_RPC_URL to a higher-tier RPC (Ankr / QuickNode / NodeReal).
const MAX_LOOKBACK = 3n;

interface PublicEvent {
  type: "buy" | "sell";
  token: string;
  amountWei: string;
  costWei: string;
  priceWei: string;
  txHash: string;
  blockNumber: number;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const address = url.searchParams.get("address") as Address | null;
    const sinceBlockParam = url.searchParams.get("sinceBlock");

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const client = makePublicClient();
    const latest = await client.getBlockNumber();

    // Window: max(sinceBlock+1, latest - MAX_LOOKBACK)
    const sinceBlock = sinceBlockParam ? BigInt(sinceBlockParam) : 0n;
    let fromBlock = sinceBlock > 0n ? sinceBlock + 1n : latest - MAX_LOOKBACK;
    if (fromBlock < latest - MAX_LOOKBACK) fromBlock = latest - MAX_LOOKBACK;
    if (fromBlock > latest) {
      return NextResponse.json({ latestBlock: Number(latest), events: [] });
    }

    let logs;
    try {
      logs = await client.getLogs({
        address: TOKEN_MANAGER2_ADDRESS,
        events: TM2_EVENTS_ABI,
        fromBlock,
        toBlock: latest,
      });
    } catch (rpcErr) {
      // Public BSC RPC rejects when the window contains too many events.
      // Degrade gracefully — the UI keeps polling next tick, narrower window.
      const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
      const limited = /limit|too many|exceeds/i.test(msg);
      return NextResponse.json({
        latestBlock: Number(latest),
        fromBlock: Number(fromBlock),
        events: [],
        rpcLimited: limited,
        note: limited
          ? "BSC RPC rate-limited this window. Set BSC_RPC_URL env to a higher-tier provider for production."
          : msg,
      });
    }

    const lower = address.toLowerCase();
    const events: PublicEvent[] = [];
    for (const log of logs) {
      const a = log as unknown as {
        eventName: "TokenPurchase" | "TokenSale";
        args: Record<string, unknown>;
        transactionHash: string;
        blockNumber: bigint;
      };
      const acc = String(a.args.account ?? "").toLowerCase();
      if (acc !== lower) continue;
      events.push({
        type: a.eventName === "TokenPurchase" ? "buy" : "sell",
        token: String(a.args.token ?? ""),
        amountWei: String(a.args.amount ?? "0"),
        costWei: String(a.args.cost ?? "0"),
        priceWei: String(a.args.price ?? "0"),
        txHash: a.transactionHash,
        blockNumber: Number(a.blockNumber),
      });
    }

    return NextResponse.json({
      latestBlock: Number(latest),
      fromBlock: Number(fromBlock),
      events,
    });
  } catch (err) {
    console.error("[wallet-events]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
