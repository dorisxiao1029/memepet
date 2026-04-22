/**
 * four.meme on-chain helpers — wraps TokenManagerHelper3 + TokenManager2 (BSC V2 only).
 * Pure read-only perception tools used by server routes.
 * Transaction signing happens client-side via wagmi + the user's connected wallet.
 */
import {
  createPublicClient,
  http,
  parseAbi,
  type PublicClient,
  type Address,
} from "viem";
import { bsc } from "viem/chains";

export const HELPER_ADDRESS =
  "0xF251F83e40a78868FcfA3FA4599Dad6494E46034" as const;
export const TOKEN_MANAGER2_ADDRESS =
  "0x5c952063c7fc8610FFDB798152D69F0B9550762b" as const;
export const ZERO = "0x0000000000000000000000000000000000000000" as const;
export const BSC_CHAIN_ID = 56;

// Safety cap for the Trade panel's default spend.
export const MAX_BUY_WEI = 5_000_000_000_000_000n; // 0.005 BNB (~$3)

export const HELPER_ABI = parseAbi([
  "function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)",
  "function tryBuy(address token, uint256 amount, uint256 funds) view returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 amountMsgValue, uint256 amountApproval, uint256 amountFunds)",
  "function trySell(address token, uint256 amount) view returns (address tokenManager, address quote, uint256 funds, uint256 fee)",
]);

export const TM2_BUY_ABI = parseAbi([
  "function buyTokenAMAP(address token, uint256 funds, uint256 minAmount) payable",
  "function buyToken(address token, uint256 amount, uint256 maxFunds) payable",
]);

export const TM2_SELL_SIMPLE_ABI = parseAbi([
  "function sellToken(address token, uint256 amount)",
]);

export const TM2_SELL_MIN_ABI = parseAbi([
  "function sellToken(uint256 origin, address token, uint256 amount, uint256 minFunds)",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

// TokenManager2 events — account is NOT indexed, so we filter in memory after a narrow block query
export const TM2_EVENTS_ABI = parseAbi([
  "event TokenPurchase(address token, address account, uint256 price, uint256 amount, uint256 cost, uint256 fee, uint256 offers, uint256 funds)",
  "event TokenSale(address token, address account, uint256 price, uint256 amount, uint256 cost, uint256 fee, uint256 offers, uint256 funds)",
]);

export function getRpcUrl(): string {
  // Default: Binance public RPC — reliable for contract reads (tryBuy/trySell/getTokenInfo)
  // but tight eth_getLogs limit. For production event detection set BSC_RPC_URL to a
  // higher-tier provider (Ankr / QuickNode / NodeReal / Chainstack).
  return process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";
}

export function makePublicClient(): PublicClient {
  return createPublicClient({ chain: bsc, transport: http(getRpcUrl()) });
}

export interface TokenInfo {
  version: number;
  tokenManager: Address;
  quote: Address;
  lastPrice: bigint;
  liquidityAdded: boolean;
}

export async function getTokenInfo(
  client: PublicClient,
  tokenAddress: Address
): Promise<TokenInfo> {
  const r = await client.readContract({
    address: HELPER_ADDRESS,
    abi: HELPER_ABI,
    functionName: "getTokenInfo",
    args: [tokenAddress],
  });
  return {
    version: Number(r[0]),
    tokenManager: r[1],
    quote: r[2],
    lastPrice: r[3],
    liquidityAdded: r[11],
  };
}

export interface BuyQuote {
  estimatedAmount: bigint;
  estimatedCost: bigint;
  estimatedFee: bigint;
  amountMsgValue: bigint;
  amountApproval: bigint;
}

export async function quoteBuy(
  client: PublicClient,
  tokenAddress: Address,
  fundsWei: bigint
): Promise<BuyQuote> {
  const r = await client.readContract({
    address: HELPER_ADDRESS,
    abi: HELPER_ABI,
    functionName: "tryBuy",
    args: [tokenAddress, 0n, fundsWei],
  });
  return {
    estimatedAmount: r[2],
    estimatedCost: r[3],
    estimatedFee: r[4],
    amountMsgValue: r[5],
    amountApproval: r[6],
  };
}

export async function quoteSell(
  client: PublicClient,
  tokenAddress: Address,
  amountWei: bigint
): Promise<{ funds: bigint; fee: bigint }> {
  const r = await client.readContract({
    address: HELPER_ADDRESS,
    abi: HELPER_ABI,
    functionName: "trySell",
    args: [tokenAddress, amountWei],
  });
  return { funds: r[2], fee: r[3] };
}

export function formatBnb(wei: bigint, digits = 6): string {
  const s = wei.toString().padStart(19, "0");
  const int = s.slice(0, -18) || "0";
  const frac = s.slice(-18).slice(0, digits);
  return `${int}.${frac}`;
}

export function bscScanTx(hash: string) {
  return `https://bscscan.com/tx/${hash}`;
}

export function bscScanAddr(addr: string) {
  return `https://bscscan.com/address/${addr}`;
}
