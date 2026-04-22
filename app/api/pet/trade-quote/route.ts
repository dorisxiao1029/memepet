import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import {
  getTokenInfo,
  makePublicClient,
  quoteBuy,
  quoteSell,
  formatBnb,
  MAX_BUY_WEI,
} from "@/lib/fourmeme";

interface QuoteRequest {
  action: "buy" | "sell";
  tokenAddress: string;
  fundsBnb?: number;   // for buy
  tokenAmount?: string; // raw wei string for sell
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QuoteRequest;
    const { action, tokenAddress } = body;

    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json({ error: "Invalid tokenAddress" }, { status: 400 });
    }

    const client = makePublicClient();
    const info = await getTokenInfo(client, tokenAddress as Address);
    if (info.version !== 2) {
      return NextResponse.json(
        { error: `Unsupported token version ${info.version}. Only TokenManager2 (V2) tokens are supported.` },
        { status: 400 }
      );
    }
    if (info.liquidityAdded) {
      return NextResponse.json(
        { error: "Token has graduated to DEX — trade via PancakeSwap instead." },
        { status: 400 }
      );
    }

    if (action === "buy") {
      const fundsBnb = body.fundsBnb ?? 0.001;
      const fundsWei = BigInt(Math.floor(fundsBnb * 1e18));
      if (fundsWei > MAX_BUY_WEI) {
        return NextResponse.json(
          { error: `Safety cap: max buy is ${formatBnb(MAX_BUY_WEI, 4)} BNB per tx.` },
          { status: 400 }
        );
      }
      const q = await quoteBuy(client, tokenAddress as Address, fundsWei);
      return NextResponse.json({
        action: "buy",
        fundsBnb,
        fundsWei: fundsWei.toString(),
        estimatedAmount: q.estimatedAmount.toString(),
        estimatedCost: q.estimatedCost.toString(),
        estimatedFee: q.estimatedFee.toString(),
        estimatedFeeBnb: formatBnb(q.estimatedFee, 6),
        // rough human token units (18 decimals)
        estimatedTokens: Number(q.estimatedAmount) / 1e18,
        tokenManager: info.tokenManager,
        lastPriceBnb: Number(info.lastPrice) / 1e18,
      });
    }

    if (action === "sell") {
      const amountWei = BigInt(body.tokenAmount ?? "0");
      if (amountWei <= 0n) {
        return NextResponse.json({ error: "tokenAmount (wei) required for sell" }, { status: 400 });
      }
      const q = await quoteSell(client, tokenAddress as Address, amountWei);
      return NextResponse.json({
        action: "sell",
        tokenAmountWei: amountWei.toString(),
        fundsWei: q.funds.toString(),
        fundsBnb: Number(q.funds) / 1e18,
        feeWei: q.fee.toString(),
        feeBnb: formatBnb(q.fee, 6),
        tokenManager: info.tokenManager,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[trade-quote]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
