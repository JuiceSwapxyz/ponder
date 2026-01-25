// @ts-ignore
import { getAddress } from "viem";

// Campaign Configuration - Maps pool addresses to tasks
export const CAMPAIGN_POOLS: Record<string, { taskId: number; symbol: string }> = {
  ["0x6006797369E2A595D31Df4ab3691044038AAa7FE".toLowerCase()]: { taskId: 1, symbol: "CBTC/NUSD" },
  ["0xA69De906B9A830Deb64edB97B2eb0848139306d2".toLowerCase()]: { taskId: 2, symbol: "CBTC/cUSD" },
  ["0xD8C7604176475eB8D350bC1EE452dA4442637C09".toLowerCase()]: { taskId: 3, symbol: "CBTC/USDC" },
};

// Utility functions with error handling
export function safeGetAddress(address: any): string {
  try {
    if (!address) return "0x0000000000000000000000000000000000000000";
    return getAddress(String(address));
  } catch (error) {
    console.warn(`Invalid address: ${address}`, error);
    return "0x0000000000000000000000000000000000000000";
  }
}

export function safeBigInt(value: any): bigint {
  try {
    if (value === null || value === undefined) return BigInt(0);
    return BigInt(String(value));
  } catch (error) {
    console.warn(`Invalid BigInt: ${value}`, error);
    return BigInt(0);
  }
}