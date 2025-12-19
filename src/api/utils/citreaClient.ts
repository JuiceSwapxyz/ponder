/**
 * Shared Citrea testnet client for on-chain reads
 */
import { createPublicClient, http, parseAbi } from "viem";

// V2 Pair ABI for reading reserves on-chain
const V2_PAIR_ABI = parseAbi([
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
]);

// Citrea testnet client for on-chain reads
export const citreaClient = createPublicClient({
  chain: {
    id: 5115,
    name: 'Citrea Testnet',
    nativeCurrency: { name: 'cBTC', symbol: 'cBTC', decimals: 18 },
    rpcUrls: { default: { http: [process.env.CITREA_RPC_URL ?? 'https://rpc.testnet.citrea.xyz'] } },
  },
  transport: http(),
});

/**
 * Fetch reserves on-chain for a V2 pair
 */
export async function getV2PairReserves(pairAddress: string): Promise<{ reserve0: bigint; reserve1: bigint }> {
  try {
    const [reserve0, reserve1] = await citreaClient.readContract({
      address: pairAddress as `0x${string}`,
      abi: V2_PAIR_ABI,
      functionName: 'getReserves',
    });
    return { reserve0, reserve1 };
  } catch (error) {
    console.error(`[citreaClient] Failed to fetch reserves for ${pairAddress}:`, error);
    return { reserve0: 0n, reserve1: 0n };
  }
}

/**
 * Fetch reserves for multiple V2 pairs in a single RPC call using multicall
 * Falls back to individual calls if multicall fails
 */
export async function getV2PairReservesMulticall(
  pairAddresses: string[]
): Promise<Map<string, { reserve0: bigint; reserve1: bigint }>> {
  if (pairAddresses.length === 0) {
    return new Map();
  }

  try {
    const results = await citreaClient.multicall({
      contracts: pairAddresses.map(addr => ({
        address: addr as `0x${string}`,
        abi: V2_PAIR_ABI,
        functionName: 'getReserves',
      })),
      allowFailure: true,
    });

    const map = new Map<string, { reserve0: bigint; reserve1: bigint }>();
    pairAddresses.forEach((addr, i) => {
      const result = results[i];
      if (result.status === 'success') {
        const [reserve0, reserve1] = result.result as [bigint, bigint, number];
        map.set(addr.toLowerCase(), { reserve0, reserve1 });
      } else {
        // Individual call failed within multicall - log and use zeros
        console.warn(`[citreaClient] Failed to fetch reserves for ${addr} in multicall`);
        map.set(addr.toLowerCase(), { reserve0: 0n, reserve1: 0n });
      }
    });
    return map;
  } catch (error) {
    // Multicall itself failed - fall back to individual calls
    console.warn(`[citreaClient] Multicall failed, falling back to individual calls:`, error);
    const map = new Map<string, { reserve0: bigint; reserve1: bigint }>();
    await Promise.all(
      pairAddresses.map(async (addr) => {
        const reserves = await getV2PairReserves(addr);
        map.set(addr.toLowerCase(), reserves);
      })
    );
    return map;
  }
}
