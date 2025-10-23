import { getAddress } from "viem";

/**
 * Safely converts an address to checksum format with error handling
 * @param address - The address to convert
 * @returns Checksummed address or zero address if invalid
 */
export function safeGetAddress(address: any): string {
  try {
    if (!address) return "0x0000000000000000000000000000000000000000";
    return getAddress(String(address));
  } catch (error) {
    console.warn(`Invalid address: ${address}`, error);
    return "0x0000000000000000000000000000000000000000";
  }
}

/**
 * Safely converts a value to BigInt with error handling
 * @param value - The value to convert to BigInt
 * @returns BigInt value or 0n if invalid
 */
export function safeBigInt(value: any): bigint {
  try {
    if (value === null || value === undefined) return BigInt(0);
    return BigInt(String(value));
  } catch (error) {
    console.warn(`Invalid BigInt: ${value}`, error);
    return BigInt(0);
  }
}

