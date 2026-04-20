import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, decodeEventLog, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bsc } from "viem/chains";

const NFT_CONTRACT = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const REGISTRATION_TYPE = "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";

const ABI = parseAbi([
  "function register(string agentURI) returns (uint256 agentId)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

export async function POST(req: NextRequest) {
  try {
    const { petName, personality, emoji } = await req.json();

    const privateKey = process.env.PET_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "PET_WALLET_PRIVATE_KEY not configured — skipping on-chain registration" },
        { status: 503 }
      );
    }

    const pk = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(pk);

    const agentURI = buildAgentURI(petName, emoji, personality);
    const rpcUrl = process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org";

    const wallet = createWalletClient({ account, chain: bsc, transport: http(rpcUrl) });
    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

    const txHash = await wallet.writeContract({
      address: NFT_CONTRACT,
      abi: ABI,
      functionName: "register",
      args: [agentURI],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let agentId: number | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== NFT_CONTRACT.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
        if (decoded.eventName === "Registered") {
          agentId = Number((decoded.args as { agentId: bigint }).agentId);
          break;
        }
      } catch { /* skip */ }
    }

    return NextResponse.json({
      success: true,
      txHash,
      agentId,
      ownerAddress: account.address,
      bscScanUrl: `https://bscscan.com/tx/${txHash}`,
    });
  } catch (err) {
    console.error("[register-identity]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function buildAgentURI(name: string, image: string, description: string): string {
  const payload = {
    type: REGISTRATION_TYPE,
    name,
    description: description || "I am a four.meme AI trading pet that reacts to wallet behavior and grows with every BSC meme trade.",
    image,
    active: true,
    supportedTrust: [""],
  };
  return `data:application/json;base64,${Buffer.from(JSON.stringify(payload)).toString("base64")}`;
}
